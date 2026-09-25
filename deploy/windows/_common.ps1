<#
.SYNOPSIS
    Shared helpers. Dot-sourced by the numbered scripts; not run on its own.
#>

function Set-PlainTextFile {
    <#
    .SYNOPSIS
        Writes a text file as UTF-8 with no byte order mark.

    .DESCRIPTION
        Set-Content -Encoding utf8 on Windows PowerShell 5.1 writes a BOM, and
        several things that read these files cannot cope with one. Groovy
        rejects a build.gradle that starts with it - "Unexpected character: '?'
        at line 1, column 1", which reads as file corruption rather than as an
        encoding. java.util.Properties is quieter and worse: it reads the mark
        as part of the first key, so storeFile silently becomes a key nobody
        looks up and the value comes back null.

        PowerShell 6 and later default to no BOM, so this only matters here -
        which is exactly why it is easy to write and hard to spot.
    #>
    param(
        [Parameter(Mandatory)] [string] $Path,
        [Parameter(Mandatory)] [AllowEmptyString()] [string] $Content
    )

    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Import-DeploySettings {
    <#
    .SYNOPSIS
        The values for one environment, from settings.<name>.psd1.

    .DESCRIPTION
        So a host's paths are written down once rather than retyped at every
        prompt. A missing file is not an error: the scripts all carry defaults,
        and a machine that has never been given a settings file should still
        run them by hand.

    .PARAMETER Name
        The environment. Defaults to production, because that is the one nobody
        should be improvising on.
    #>
    [CmdletBinding()]
    param([string] $Name = 'production')

    $path = Join-Path $PSScriptRoot ("settings.{0}.psd1" -f $Name)
    if (-not (Test-Path $path)) { return @{} }

    # Import-PowerShellDataFile reads the file as data and never executes it,
    # which is the point of keeping settings in a .psd1 rather than a .ps1.
    return Import-PowerShellDataFile -Path $path
}

function Get-Setting {
    <#
    .SYNOPSIS
        A parameter the caller gave, or the environment's value, or the default.

    .DESCRIPTION
        Written out because the obvious `if (-not $x) { $x = ... }` treats a
        deliberate 0 or an empty string as "not supplied", and because the
        precedence matters: what somebody typed always wins over the file.
    #>
    param(
        [AllowNull()] [AllowEmptyString()] $Value,
        [hashtable] $Settings,
        [string] $Key,
        $Default = $null
    )

    if ($null -ne $Value -and "$Value" -ne '') { return $Value }
    if ($Settings -and $Settings.ContainsKey($Key)) { return $Settings[$Key] }
    return $Default
}

function Get-SqlConnectionString {
    <#
    .SYNOPSIS
        The connection string the deployed site is actually using.

    .DESCRIPTION
        Read from the site's own configuration rather than passed in, so a
        backup or a migration can never be aimed at a different database from
        the one serving requests.
    #>
    param([Parameter(Mandatory)] [string] $SitePath)

    $config = Join-Path $SitePath 'appsettings.Production.json'
    if (-not (Test-Path $config)) { throw "No $config. Run 03-configure.ps1 first." }

    $value = (Get-Content $config -Raw | ConvertFrom-Json).ConnectionStrings.Default
    if (-not $value) { throw "ConnectionStrings:Default is empty in $config." }
    return $value
}

function Get-SqlcmdArguments {
    <#
    .SYNOPSIS
        How to reach the database with sqlcmd, taken from a connection string.

    .DESCRIPTION
        The site may connect as a SQL login or as its application pool
        identity. Backups and restores follow whichever it is, so they work on
        a server that only accepts Windows authentication and on one that does
        not, without being told which.

        -b so a failed statement is a non-zero exit code, and -C because
        ODBC Driver 18 rejects the self-signed certificate SQL Server installs
        with unless told otherwise.
    #>
    param(
        [Parameter(Mandatory)] [string] $ConnectionString,
        [string] $Database
    )

    $builder = New-Object System.Data.Common.DbConnectionStringBuilder
    $builder.set_ConnectionString($ConnectionString)

    $server = foreach ($key in 'server', 'data source', 'addr', 'address') {
        if ($builder.ContainsKey($key)) { $builder[$key]; break }
    }
    if (-not $server) { throw "No server in the connection string." }

    if (-not $Database) {
        $Database = foreach ($key in 'database', 'initial catalog') {
            if ($builder.ContainsKey($key)) { $builder[$key]; break }
        }
    }

    $arguments = @('-S', $server, '-C', '-b', '-h', '-1', '-W')
    if ($Database) { $arguments += @('-d', $Database) }

    $user = foreach ($key in 'user id', 'uid', 'user') {
        if ($builder.ContainsKey($key)) { $builder[$key]; break }
    }

    if ($user) {
        $password = foreach ($key in 'password', 'pwd') {
            if ($builder.ContainsKey($key)) { $builder[$key]; break }
        }
        $arguments += @('-U', $user, '-P', $password)
    }
    else {
        $arguments += '-E'
    }

    return $arguments
}

function Assert-Elevated {
    <#
        IIS, scheduled tasks and a backup folder outside a profile all need it,
        and each fails differently and late without it.
    #>
    param([string] $What = 'This script')

    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal $identity
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "$What needs an elevated PowerShell. Right-click, Run as administrator."
    }
}

function Invoke-Native {
    <#
    .SYNOPSIS
        Runs an external program and judges it by its exit code.

    .DESCRIPTION
        PowerShell turns everything a native program writes to stderr into an
        ErrorRecord. These scripts run with $ErrorActionPreference = 'Stop', so
        the first such line ends the script - and npm, NuGet, git and sqlcmd all
        write ordinary progress and warnings there. The result is a run that
        stops on something harmless, with a message about PowerShell's pipeline
        rather than about the command.

        Appending 2>&1 is not enough on Windows PowerShell 5.1: the error record
        is still raised. So the preference is lowered for the duration of the
        call and the exit code is read instead, which is the one signal the
        program actually meant as a verdict.

        Arguments are passed as an array rather than a script block on purpose.
        A script block invoked from in here would resolve its variables against
        this function's caller, not against where it was written, so anything
        built inside another function would silently come out empty.

    .PARAMETER Stream
        Let the output go to the console as it arrives instead of collecting it.
        For commands long enough that silence looks like a hang.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $What,
        [Parameter(Mandatory)] [string] $Exe,
        [string[]] $Arguments = @(),
        [switch] $Stream,
        # With -Stream, also write everything to this file. Streamed output
        # goes to the console and nowhere else, so a long build that fails
        # leaves nothing behind but scrollback — and scrollback is finite,
        # truncated when pasted, and gone when the window closes.
        [string] $LogFile,
        # For a command that is expected to fail sometimes, where the caller
        # wants to read $LASTEXITCODE and decide for itself.
        [switch] $IgnoreExitCode
    )

    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($Stream) {
            if ($LogFile) {
                # Tee-Object writes to the console and the file at once, so a
                # build that takes ten minutes still shows progress while it
                # runs and still has a record afterwards.
                & $Exe @Arguments 2>&1 | Tee-Object -FilePath $LogFile
            }
            else {
                & $Exe @Arguments
            }
            $code = $LASTEXITCODE
            $output = @()
        }
        else {
            # Cast to string so a caller can Trim or match on the result: with
            # 2>&1 some of these are ErrorRecord objects, not text.
            $output = & $Exe @Arguments 2>&1 | ForEach-Object { [string] $_ }
            $code = $LASTEXITCODE
        }
    }
    finally { $ErrorActionPreference = $previous }

    if (-not $IgnoreExitCode -and $code -ne 0) {
        # Output is discarded while things go well, so on a failure it is the
        # only thing that says why.
        $tail = if ($Stream -and $LogFile) { "    Full output: $LogFile" }
                elseif ($Stream) { '    (output above)' }
                else { ($output | Select-Object -Last 30 | ForEach-Object { "    $_" }) -join "`n" }
        throw ("{0} failed (exit {1}):`n{2}" -f $What, $code, $tail)
    }

    # Leave $LASTEXITCODE alone: -IgnoreExitCode callers read it.
    return $output
}
