<#
.SYNOPSIS
    Backs up the database and the uploaded files.

.DESCRIPTION
    Two things on this server cannot be rebuilt from the repository: the
    database, and E:\cbms-data — the coordinator photographs and the certificate
    artwork. Everything else is a checkout and a build.

    The database goes to a dated .bak, written with CHECKSUM and then read back
    with RESTORE VERIFYONLY. A backup nobody has verified is a file, not a
    backup; the verify is the difference between having one and believing you
    have one.

    The files are mirrored with robocopy. Be clear-eyed about what a mirror is:
    it is a copy of now, not a history. A file deleted this morning is gone from
    the mirror tonight. Pair it with -ZipData, or with something that takes the
    backup folder off this machine, before treating it as safe.

.PARAMETER BackupRoot
    Where to write. Defaults to the production settings file. A second disc is
    worth more than a second folder.

.PARAMETER KeepDays
    How many days of .bak files to keep. The most recent is never pruned,
    whatever this says — a retention rule that can leave you with nothing is
    worse than no retention rule.

.PARAMETER ZipData
    Also take a dated archive of the uploaded files, not just the mirror. Slow
    and large once there are many photographs; worth it weekly.

.PARAMETER SkipFiles
    Database only. For the backup a release takes before it migrates, where the
    files are not about to be touched.

.EXAMPLE
    .\10-backup.ps1
    .\10-backup.ps1 -ZipData
    .\10-backup.ps1 -SkipFiles -Label 'before-release'
#>
[CmdletBinding()]
param(
    [string] $SitePath,
    [string] $StorageRoot,
    [string] $BackupRoot,
    [int]    $KeepDays,
    [string] $Label,
    [switch] $ZipData,
    [switch] $SkipFiles
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$settings    = Import-DeploySettings
$SitePath    = Get-Setting $SitePath    $settings 'SitePath'    'E:\inetpub\cbms'
$StorageRoot = Get-Setting $StorageRoot $settings 'StorageRoot' 'E:\cbms-data'
$BackupRoot  = Get-Setting $BackupRoot  $settings 'BackupRoot'  'E:\cbms-backups'
if (-not $PSBoundParameters.ContainsKey('KeepDays')) {
    $KeepDays = [int] (Get-Setting $null $settings 'KeepDays' 30)
}

$started = Get-Date
$stamp   = $started.ToString('yyyyMMdd-HHmmss')
$suffix  = if ($Label) { '-' + ($Label -replace '[^\w\-]', '-') } else { '' }

Write-Host "`n=== Backing up CBMS ===`n" -ForegroundColor Cyan

$connectionString = Get-SqlConnectionString -SitePath $SitePath
$sqlArgs          = Get-SqlcmdArguments -ConnectionString $connectionString

# The database name as the site connects to it, so a backup can never be taken
# of a database the site is not using.
$builder = New-Object System.Data.Common.DbConnectionStringBuilder
$builder.set_ConnectionString($connectionString)
$database = foreach ($key in 'database', 'initial catalog') {
    if ($builder.ContainsKey($key)) { $builder[$key]; break }
}
if (-not $database) { throw "No database in the site's connection string." }

$server = foreach ($key in 'server', 'data source') {
    if ($builder.ContainsKey($key)) { $builder[$key]; break }
}

$dbFolder = Join-Path $BackupRoot 'database'
New-Item -ItemType Directory -Path $dbFolder -Force | Out-Null

function Get-SqlServiceAccount {
    <#
    .SYNOPSIS
        The Windows account SQL Server runs as.

    .DESCRIPTION
        BACKUP DATABASE is executed by the server, not by this script, so the
        file is written by the service account and not by whoever is signed in.
        That is the single most common reason a backup script that looks
        correct fails with "Operating system error 5".

        Windows is asked first. The site connects as an ordinary application
        login, which has no business holding VIEW SERVER STATE, so the server's
        own answer to this question is usually a permission error — and an
        error read as a name is worse than no answer, because what follows is
        an attempt to grant file rights to a sentence.

        Three sources, in order of how much they can be trusted: the service
        control manager, which knows; the server, if this login happens to be
        allowed to ask; and the name a default installation would have used,
        which is right far more often than not.
    #>
    param([string] $Instance)

    # The service name: MSSQLSERVER for a default instance, MSSQL$NAME for a
    # named one. The connection string's server may carry the instance after a
    # backslash, and may be an address rather than this machine.
    $named = if ($Instance -match '\\(.+)$') { $Matches[1] } else { $null }
    $serviceName = if ($named) { "MSSQL`$$named" } else { 'MSSQLSERVER' }

    # Not $host: that is PowerShell's own, and assigning to it is an error.
    $serverHost = if ($Instance) { ($Instance -split '\\')[0] } else { '' }
    $isLocal = -not $serverHost -or
               $serverHost -in @('localhost', '.', '(local)', '127.0.0.1', $env:COMPUTERNAME)

    if ($isLocal) {
        $service = Get-CimInstance Win32_Service -Filter "Name = '$serviceName'" -ErrorAction SilentlyContinue
        if ($service -and $service.StartName) { return $service.StartName }

        # The name derived from the connection string is a guess about how the
        # instance was installed, and a connection string saying "localhost" is
        # not a promise that the instance is the default one. So look at what is
        # actually installed: a database engine is sqlservr.exe, which
        # distinguishes it from the agent, the browser and full-text search.
        $engines = @(Get-CimInstance Win32_Service -Filter "Name LIKE 'MSSQL%'" -ErrorAction SilentlyContinue |
            Where-Object { $_.PathName -match 'sqlservr\.exe' })

        if ($engines.Count -eq 1) {
            Write-Host ("        (no {0} service here; using {1})" -f $serviceName, $engines[0].Name) -ForegroundColor DarkGray
            if ($engines[0].StartName) { return $engines[0].StartName }
        }
        elseif ($engines.Count -gt 1) {
            throw ("This machine runs more than one database engine and the connection string does not say which:`n{0}`n" +
                   "Grant the right one write access to the backup folder by hand:`n" +
                   "    icacls `"{1}`" /grant `"<account>:(OI)(CI)M`" /T") -f
                  (($engines | ForEach-Object { "    {0}  runs as {1}" -f $_.Name, $_.StartName }) -join "`n"),
                  $dbFolder
        }
    }

    # The server, if it will say. Anything that is not shaped like an account
    # is an error message wearing one's clothes.
    $answer = Invoke-Native 'sqlcmd' 'sqlcmd' ($sqlArgs + @('-Q',
        "SET NOCOUNT ON; SELECT TOP 1 service_account FROM sys.dm_server_services WHERE servicename LIKE 'SQL Server%';"
    )) -IgnoreExitCode
    $failed = $LASTEXITCODE -ne 0
    $global:LASTEXITCODE = 0

    if (-not $failed) {
        $account = $answer |
            ForEach-Object { "$_".Trim() } |
            Where-Object { $_ -match '^[\w .\-$]+\\[\w .\-$]+$' } |
            Select-Object -First 1
        if ($account) { return $account }
    }

    # What a default installation uses: a virtual account per instance.
    return "NT SERVICE\$serviceName"
}

function Grant-ServerWrite {
    <#
    .SYNOPSIS
        Lets the account SQL Server runs as write to the backup folder.

    .DESCRIPTION
        Granted on the backup root rather than the folder below it, and
        inheritable, so the server can traverse down to where the file goes.
        A grant on the leaf alone leaves the parent unreadable, and the error
        that produces looks exactly like the one it was meant to fix.
    #>
    param([string] $Folder)

    # Granting on this machine only helps if the database engine is on this
    # machine. When it is somewhere else, the backup folder has to be a path
    # that server can write - a share - and no amount of icacls here changes
    # that. Said plainly rather than attempted and blamed on permissions.
    $engineHost = if ($server) { ($server -split '\\')[0] } else { '' }
    $engineIsLocal = -not $engineHost -or
        $engineHost -in @('localhost', '.', '(local)', '127.0.0.1', $env:COMPUTERNAME)

    if (-not $engineIsLocal) {
        throw ("SQL Server is on {0} and cannot write to {1}, which is a path on this machine.`n" +
               "Point -BackupRoot at a share that {0} can write to, and grant its service " +
               "account access there.") -f $engineHost, $Folder
    }

    $account = Get-SqlServiceAccount -Instance $server
    Write-Host "        SQL Server runs as $account; granting it access to $Folder" -ForegroundColor Gray

    $output = Invoke-Native 'icacls' 'icacls' @(
        $Folder, '/grant', ('{0}:(OI)(CI)M' -f $account), '/T') -IgnoreExitCode
    $granted = $LASTEXITCODE -eq 0
    $global:LASTEXITCODE = 0

    if (-not $granted) {
        $installed = (Get-CimInstance Win32_Service -Filter "Name LIKE 'MSSQL%'" -ErrorAction SilentlyContinue |
            Where-Object { $_.PathName -match 'sqlservr' + [regex]::Escape('.') + 'exe' } |
            ForEach-Object { "      {0}  runs as {1}" -f $_.Name, $_.StartName }) -join "`n"

        throw (("Could not grant {0} write access to {1}.`n{2}`n`n" +
                "What is installed here:`n{3}`n`n" +
                "Grant it by hand in an elevated prompt, in single quotes so the " +
                "instance name survives:`n" +
                "    icacls '{1}' /grant 'ACCOUNT:(OI)(CI)M' /T") -f
               $account, $Folder, ($output -join "`n"), $installed)
    }

    Write-Host "  [ok]  $account may now write there" -ForegroundColor Green
}

function Invoke-Sql {
    param([Parameter(Mandatory)] [string] $Query, [switch] $Stream)
    Invoke-Native "sqlcmd" 'sqlcmd' ($sqlArgs + @('-Q', $Query)) -Stream:$Stream
}

# --- database ---------------------------------------------------------------

$backupPath = Join-Path $dbFolder ("{0}-{1}{2}.bak" -f $database, $stamp, $suffix)

# COMPRESSION is not in every edition, and Express is the one most likely to be
# under a deployment like this. Asked rather than assumed: a backup that fails
# on the option is a backup that did not happen.
$edition = [int] (Invoke-Sql "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('EngineEdition') AS varchar);").Trim()
$canCompress = $edition -ne 4   # 4 is Express

$options = @('CHECKSUM', 'INIT', 'STATS = 10', "NAME = N'$database full backup'")
if ($canCompress) { $options = @('COMPRESSION') + $options }

$statement = "BACKUP DATABASE [{0}] TO DISK = N'{1}' WITH {2};" -f
    $database, $backupPath, ($options -join ', ')

Write-Host "  Backing up [$database]..." -ForegroundColor Gray

# Attempted, then diagnosed from what actually went wrong. An earlier version
# tested the folder first by backing master to it, which fails for a login that
# is only db_owner of its own database — and then blamed the folder for a
# permission the folder never had anything to do with. The real backup is the
# only honest test of whether the real backup works.
$output = Invoke-Native 'sqlcmd' 'sqlcmd' ($sqlArgs + @('-Q', $statement)) -IgnoreExitCode
$failed = $LASTEXITCODE -ne 0
$global:LASTEXITCODE = 0

if ($failed) {
    $message = ($output -join "`n")

    # Operating system error 5 is access denied and 3 is a missing path: both
    # are the server failing to write, which is the one thing this script can
    # do something about. Anything else — a permission inside SQL Server, a
    # database in the wrong state — is not ours to fix by granting.
    if ($message -match 'Operating system error (5|3)|Cannot open backup device') {
        Write-Host "  [--]  SQL Server cannot write to $dbFolder" -ForegroundColor Yellow
        Grant-ServerWrite -Folder $BackupRoot

        Write-Host "  Backing up [$database] again..." -ForegroundColor Gray
        Invoke-Native 'sqlcmd' 'sqlcmd' ($sqlArgs + @('-Q', $statement)) | Out-Null
    }
    else {
        throw "The backup was refused:`n$message"
    }
}

if (-not (Test-Path $backupPath)) {
    throw "sqlcmd reported success but $backupPath is not there. The backup is written by the server, not by this script, so check what it can see: a mapped drive or a path that only exists in this session would do exactly this."
}

Write-Host "  Verifying the file reads back..." -ForegroundColor Gray
Invoke-Sql ("RESTORE VERIFYONLY FROM DISK = N'{0}' WITH CHECKSUM;" -f $backupPath) | Out-Null

$sizeMb = [math]::Round((Get-Item $backupPath).Length / 1MB, 1)
Write-Host ("  [ok]  {0}  ({1} MB{2})" -f (Split-Path $backupPath -Leaf), $sizeMb,
    $(if ($canCompress) { ', compressed' } else { '' })) -ForegroundColor Green

# --- uploaded files ---------------------------------------------------------

if (-not $SkipFiles) {
    if (-not (Test-Path $StorageRoot)) {
        Write-Host "  [--]  $StorageRoot does not exist yet; nothing uploaded." -ForegroundColor DarkGray
    }
    else {
        $mirror = Join-Path $BackupRoot 'data-mirror'
        New-Item -ItemType Directory -Path $mirror -Force | Out-Null

        Write-Host "  Mirroring $StorageRoot..." -ForegroundColor Gray
        # /MIR mirrors, /R:2 /W:5 gives up quickly on a locked file rather than
        # retrying for half an hour, /NFL /NDL /NP keep the log readable.
        # Robocopy's exit codes are a bit map: under 8 is success of some kind.
        Invoke-Native 'robocopy' 'robocopy' @(
            $StorageRoot, $mirror, '/MIR', '/R:2', '/W:5', '/NFL', '/NDL', '/NP', '/NJH', '/NJS'
        ) -IgnoreExitCode | Out-Null

        if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)." }
        $global:LASTEXITCODE = 0

        $files = (Get-ChildItem $mirror -Recurse -File -ErrorAction SilentlyContinue).Count
        Write-Host "  [ok]  $files file(s) mirrored" -ForegroundColor Green

        if ($ZipData) {
            $zip = Join-Path $BackupRoot ("data-{0}{1}.zip" -f $stamp, $suffix)
            Write-Host "  Archiving the mirror..." -ForegroundColor Gray
            Compress-Archive -Path (Join-Path $mirror '*') -DestinationPath $zip -Force
            Write-Host ("  [ok]  {0}  ({1} MB)" -f (Split-Path $zip -Leaf),
                [math]::Round((Get-Item $zip).Length / 1MB, 1)) -ForegroundColor Green
        }
    }
}

# --- retention --------------------------------------------------------------

$all = @(Get-ChildItem $dbFolder -Filter '*.bak' | Sort-Object LastWriteTime -Descending)
$stale = @($all | Select-Object -Skip 1 |
    Where-Object { $_.LastWriteTime -lt $started.AddDays(-$KeepDays) })

foreach ($file in $stale) {
    Remove-Item $file.FullName -Force
    Write-Host "  [--]  pruned $($file.Name)" -ForegroundColor DarkGray
}

Write-Host ("`n{0} backup(s) kept in {1}" -f ($all.Count - $stale.Count), $dbFolder)
Write-Host ("Finished in {0:n0}s.`n" -f ((Get-Date) - $started).TotalSeconds) -ForegroundColor Green

# The release script reads this to record what it took before it migrated.
return $backupPath
