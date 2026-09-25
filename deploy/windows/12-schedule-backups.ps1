<#
.SYNOPSIS
    Registers the nightly backup as a scheduled task.

.DESCRIPTION
    A backup that depends on somebody remembering is a backup that stops
    happening in the second week. This registers 10-backup.ps1 to run every
    night as SYSTEM, and a second task on Sundays that also archives the
    uploaded files.

    Re-running it replaces the tasks rather than adding more, so it is safe to
    run again after changing the time or the retention.

.PARAMETER At
    When the nightly run starts, on the 24-hour clock. Defaults to the
    production settings file. Pick an hour when nobody is marking.

.PARAMETER Remove
    Unregister both tasks and stop there.

.EXAMPLE
    .\12-schedule-backups.ps1
    .\12-schedule-backups.ps1 -At 02:15
    .\12-schedule-backups.ps1 -Remove
#>
[CmdletBinding()]
param(
    [string] $At,
    [string] $BackupRoot,
    [switch] $Remove
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')
Assert-Elevated 'Registering a scheduled task'

$settings   = Import-DeploySettings
$At         = Get-Setting $At         $settings 'BackupAt'   '01:30'
$BackupRoot = Get-Setting $BackupRoot $settings 'BackupRoot' 'E:\cbms-backups'

$nightly = 'CBMS nightly backup'
$weekly  = 'CBMS weekly file archive'

foreach ($name in @($nightly, $weekly)) {
    if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $name -Confirm:$false
        Write-Host "  [--]  removed '$name'" -ForegroundColor DarkGray
    }
}

if ($Remove) {
    Write-Host "`nBoth tasks removed. Nothing is backing this server up now.`n" -ForegroundColor Yellow
    return
}

$script = Join-Path $PSScriptRoot '10-backup.ps1'
if (-not (Test-Path $script)) { throw "Not found: $script" }

$logFolder = Join-Path $BackupRoot 'logs'
New-Item -ItemType Directory -Path $logFolder -Force | Out-Null

function Register-BackupTask {
    param(
        [Parameter(Mandatory)] [string] $Name,
        [Parameter(Mandatory)] $Trigger,
        [string[]] $Extra = @(),
        [Parameter(Mandatory)] [string] $Description
    )

    # -NonInteractive so a prompt can never hold the task open all night, and
    # the transcript so a failure at 01:30 leaves something to read at 09:00.
    $log = Join-Path $logFolder ('{0}.log' -f ($Name -replace '[^\w]', '-'))
    $inner = ("& '{0}' {1} *>&1 | Tee-Object -FilePath '{2}'" -f $script, ($Extra -join ' '), $log).Trim()

    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument (
        '-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "{0}"' -f $inner)

    # SYSTEM, because the task must not depend on a person's account still
    # existing or their password still being current.
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

    $taskSettings = New-ScheduledTaskSettingsSet `
        -StartWhenAvailable `
        -DontStopOnIdleEnd `
        -ExecutionTimeLimit (New-TimeSpan -Hours 4) `
        -MultipleInstances IgnoreNew

    Register-ScheduledTask -TaskName $Name -Action $action -Trigger $Trigger `
        -Principal $principal -Settings $taskSettings -Description $Description | Out-Null

    Write-Host "  [ok]  '$Name'  ->  $log" -ForegroundColor Green
}

Register-BackupTask -Name $nightly `
    -Trigger (New-ScheduledTaskTrigger -Daily -At $At) `
    -Description 'Full database backup, verified, with the uploaded files mirrored.'

# An hour later, so it never overlaps the nightly run on a slow night.
$weeklyAt = ([datetime] $At).AddHours(1).ToString('HH:mm')
Register-BackupTask -Name $weekly -Extra @('-ZipData', '-SkipFiles:$false') `
    -Trigger (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At $weeklyAt) `
    -Description 'As nightly, and a dated archive of the uploaded files.'

Write-Host "`nNightly at $At, weekly archive Sundays at $weeklyAt."
Write-Host "Backups land in $BackupRoot.`n"
Write-Host "Run it once now to be sure it works, rather than finding out at $At :" -ForegroundColor Cyan
Write-Host "  Start-ScheduledTask -TaskName '$nightly'"
Write-Host "  Get-ScheduledTaskInfo -TaskName '$nightly'`n"
Write-Host "A backup on the same disc as the database survives a mistake, not a" -ForegroundColor Yellow
Write-Host "disc. Copy $BackupRoot somewhere off this machine as well.`n" -ForegroundColor Yellow
