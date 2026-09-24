<#
.SYNOPSIS
    Shared helpers. Dot-sourced by the numbered scripts; not run on its own.
#>

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
        # For a command that is expected to fail sometimes, where the caller
        # wants to read $LASTEXITCODE and decide for itself.
        [switch] $IgnoreExitCode
    )

    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($Stream) {
            & $Exe @Arguments
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
        $tail = if ($Stream) { '    (output above)' }
                else { ($output | Select-Object -Last 30 | ForEach-Object { "    $_" }) -join "`n" }
        throw ("{0} failed (exit {1}):`n{2}" -f $What, $code, $tail)
    }

    # Leave $LASTEXITCODE alone: -IgnoreExitCode callers read it.
    return $output
}
