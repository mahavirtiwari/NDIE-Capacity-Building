<#
.SYNOPSIS
    Restores the database from a backup taken by 10-backup.ps1.

.DESCRIPTION
    The other half of a backup, and the half nobody exercises until the morning
    it matters. Run it once on purpose, against a copy, so that the first time
    is not the real time.

    What it does, in order: takes a backup of the database as it stands now —
    even a corrupted present is evidence, and overwriting it is how a bad
    afternoon becomes a bad week — stops the site so nothing writes during the
    restore, puts the database into single-user mode, restores, and starts the
    site again.

    It asks before doing any of that, unless -Force.

.PARAMETER BackupFile
    The .bak to restore. Omit it and the most recent one is offered.

.PARAMETER RestoreFiles
    Also put the uploaded files back from the mirror. Off by default: the
    database and the files fail separately, and restoring both when only one is
    broken throws away good work.

.EXAMPLE
    .\11-restore.ps1
    .\11-restore.ps1 -BackupFile E:\cbms-backups\database\CbmsDb-20260925-013000.bak
#>
[CmdletBinding()]
param(
    [string] $BackupFile,
    [string] $SitePath,
    [string] $StorageRoot,
    [string] $BackupRoot,
    [string] $SiteName,
    [string] $PoolName,
    [switch] $RestoreFiles,
    [switch] $Force
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')
Assert-Elevated 'Restoring'

$settings    = Import-DeploySettings
$SitePath    = Get-Setting $SitePath    $settings 'SitePath'    'E:\inetpub\cbms'
$StorageRoot = Get-Setting $StorageRoot $settings 'StorageRoot' 'E:\cbms-data'
$BackupRoot  = Get-Setting $BackupRoot  $settings 'BackupRoot'  'E:\cbms-backups'
$SiteName    = Get-Setting $SiteName    $settings 'SiteName'    'CBMS'
$PoolName    = Get-Setting $PoolName    $settings 'PoolName'    'CbmsAppPool'

# Tolerant: a restore is about the database, and the database may live on a
# server with no IIS on it at all. Where the site is here, it is stopped first;
# where it is not, there is nothing to stop.
Import-Module WebAdministration -ErrorAction SilentlyContinue
$hasIis = $null -ne (Get-Module WebAdministration)

$connectionString = Get-SqlConnectionString -SitePath $SitePath
$builder = New-Object System.Data.Common.DbConnectionStringBuilder
$builder.set_ConnectionString($connectionString)
$database = foreach ($key in 'database', 'initial catalog') {
    if ($builder.ContainsKey($key)) { $builder[$key]; break }
}

# master, because a database cannot be restored while it is the one you are
# connected to.
$sqlArgs = Get-SqlcmdArguments -ConnectionString $connectionString -Database 'master'

function Invoke-Sql {
    param([Parameter(Mandatory)] [string] $Query)
    Invoke-Native 'sqlcmd' 'sqlcmd' ($sqlArgs + @('-Q', $Query))
}

if (-not $BackupFile) {
    $latest = Get-ChildItem (Join-Path $BackupRoot 'database') -Filter '*.bak' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latest) { throw "No .bak files in $BackupRoot\database. Pass -BackupFile." }
    $BackupFile = $latest.FullName
}

if (-not (Test-Path $BackupFile)) { throw "Not found: $BackupFile" }

$taken = (Get-Item $BackupFile).LastWriteTime

Write-Host "`n=== Restoring $database ===`n" -ForegroundColor Cyan
Write-Host "  From   : $BackupFile"
Write-Host ("  Taken  : {0:dd MMM yyyy HH:mm}  ({1:n0} hours ago)" -f $taken,
    ((Get-Date) - $taken).TotalHours)
Write-Host "  Site   : $SiteName will be stopped while this runs"
if ($RestoreFiles) { Write-Host "  Files  : $StorageRoot will be replaced from the mirror" }

Write-Host "`n  Everything written to $database since that backup will be lost.`n" -ForegroundColor Yellow

if (-not $Force) {
    $answer = Read-Host "  Type the database name to confirm"
    if ($answer -ne $database) { Write-Host "`nNothing done.`n"; return }
}

Write-Host "`n  Verifying the backup before touching anything..." -ForegroundColor Gray
Invoke-Sql ("RESTORE VERIFYONLY FROM DISK = N'{0}';" -f $BackupFile) | Out-Null
Write-Host "  [ok]  the file reads back" -ForegroundColor Green

# --- keep the present -------------------------------------------------------

$safety = Join-Path $BackupRoot ("database\{0}-before-restore-{1}.bak" -f
    $database, (Get-Date).ToString('yyyyMMdd-HHmmss'))

Write-Host "  Backing up the database as it stands now..." -ForegroundColor Gray
Invoke-Sql ("BACKUP DATABASE [{0}] TO DISK = N'{1}' WITH CHECKSUM, INIT;" -f $database, $safety) | Out-Null
Write-Host "  [ok]  $safety" -ForegroundColor Green

# --- restore ----------------------------------------------------------------

if ($hasIis -and (Test-Path "IIS:\Sites\$SiteName")) {
    Set-WebsiteState -SiteName $SiteName -State 'Stopped'
    Set-PoolState -PoolName $PoolName -State 'Stopped'
    Write-Host "  [ok]  site stopped" -ForegroundColor Green
}

try {
    # Single user rolls back anything still connected. Without it the restore
    # waits behind a connection pool that will never let go.
    Invoke-Sql ("ALTER DATABASE [{0}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;" -f $database) | Out-Null
    Invoke-Sql ("RESTORE DATABASE [{0}] FROM DISK = N'{1}' WITH REPLACE, RECOVERY;" -f
        $database, $BackupFile) | Out-Null
    Write-Host "  [ok]  database restored" -ForegroundColor Green
}
finally {
    # Whatever happened above, the database must not be left in single-user
    # mode: the site cannot start and the next attempt cannot connect.
    Invoke-Native 'sqlcmd' 'sqlcmd' ($sqlArgs + @(
        '-Q', ("ALTER DATABASE [{0}] SET MULTI_USER;" -f $database))) -IgnoreExitCode | Out-Null
    $global:LASTEXITCODE = 0
}

if ($RestoreFiles) {
    $mirror = Join-Path $BackupRoot 'data-mirror'
    if (-not (Test-Path $mirror)) { throw "No mirror at $mirror." }

    Write-Host "  Putting the uploaded files back..." -ForegroundColor Gray
    Invoke-Native 'robocopy' 'robocopy' @(
        $mirror, $StorageRoot, '/MIR', '/R:2', '/W:5', '/NFL', '/NDL', '/NP', '/NJH', '/NJS'
    ) -IgnoreExitCode | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)." }
    $global:LASTEXITCODE = 0
    Write-Host "  [ok]  files restored" -ForegroundColor Green
}

if ($hasIis -and (Test-Path "IIS:\Sites\$SiteName")) {
    Set-PoolState -PoolName $PoolName -State 'Started'
    Set-WebsiteState -SiteName $SiteName -State 'Started'
    Write-Host "  [ok]  site started" -ForegroundColor Green
}

Write-Host "`nRestored from $BackupFile" -ForegroundColor Green
Write-Host "The database as it was before this is at:`n  $safety`n"
Write-Host "Run .\07-verify.ps1 before telling anyone it is back.`n" -ForegroundColor Cyan
