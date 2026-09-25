<#
.SYNOPSIS
    Ships a release to production: back up, publish, migrate, verify, and put
    the old build back if any of it fails.

.DESCRIPTION
    update.ps1 is the staging routine — publish, migrate, verify. Production
    wants three more things around it, and they are the reason this is a
    separate script rather than a flag:

      * a verified database backup taken immediately before the schema changes;
      * the previous build kept, so going back is a folder move rather than a
        rebuild of a commit somebody has to find;
      * the site stopped while files are replaced, so a request cannot arrive
        against half a deployment.

    Whatever it does, it says what it did and how to undo it. If verification
    fails it puts the previous build back on its own — an unattended rollback of
    files is safe, because the files are ours. It does not roll the database
    back on its own: that is a judgement about data, and it prints the exact
    command rather than guessing.

.PARAMETER Pull
    Fetch and fast-forward the checkout first. Refuses if the working tree has
    changes — a production release is of a commit, not of whatever is lying
    around on the server.

.PARAMETER SkipBackup
    Do not back up first. For a release with no schema change, where the wait
    is not worth it. Say it out loud rather than skipping quietly.

.PARAMETER SkipMigrations
    For a release that has none.

.EXAMPLE
    .\20-release.ps1 -Pull
    .\20-release.ps1 -SkipMigrations
#>
[CmdletBinding()]
param(
    [string] $SourcePath,
    [string] $SitePath,
    [string] $BaseUrl,
    [string] $SiteName,
    [string] $PoolName,
    [switch] $Pull,
    [switch] $SkipBackup,
    [switch] $SkipMigrations
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')
Assert-Elevated 'A production release'

$settings   = Import-DeploySettings
$SourcePath = Get-Setting $SourcePath $settings 'SourcePath' 'E:\NDIE-Capacity-Building-main'
$SitePath   = Get-Setting $SitePath   $settings 'SitePath'   'E:\inetpub\cbms'
$BaseUrl    = Get-Setting $BaseUrl    $settings 'BaseUrl'    'https://localhost'
$SiteName   = Get-Setting $SiteName   $settings 'SiteName'   'CBMS'
$PoolName   = Get-Setting $PoolName   $settings 'PoolName'   'CbmsAppPool'

Import-Module WebAdministration

$started  = Get-Date
$previous = "$SitePath.previous"
$backup   = $null

Write-Host "`n=== Releasing CBMS to production ===`n" -ForegroundColor Cyan
Write-Host "  Source : $SourcePath"
Write-Host "  Site   : $SitePath"
Write-Host "  URL    : $BaseUrl`n"

# --- the commit -------------------------------------------------------------

Push-Location $SourcePath
try {
    $dirty = Invoke-Native 'git status' 'git' @('status', '--porcelain') -IgnoreExitCode
    $global:LASTEXITCODE = 0

    if ($Pull) {
        if ($dirty) {
            throw ("The checkout has uncommitted changes:`n{0}`nCommit, stash or discard them. A release is of a commit." -f
                (($dirty | Select-Object -First 10) -join "`n"))
        }
        Invoke-Native 'git fetch' 'git' @('fetch', '--all', '--prune') -Stream | Out-Null
        Invoke-Native 'git pull'  'git' @('pull', '--ff-only') -Stream | Out-Null
    }
    elseif ($dirty) {
        Write-Host "  [!!]  The checkout has uncommitted changes. Releasing them anyway." -ForegroundColor Yellow
    }

    $commit  = (Invoke-Native 'git rev-parse' 'git' @('rev-parse', '--short', 'HEAD')).Trim()
    $subject = (Invoke-Native 'git log' 'git' @('log', '-1', '--pretty=%s')).Trim()
}
finally { Pop-Location }

Write-Host "  Commit : $commit  $subject`n"

# --- what is already there --------------------------------------------------

$appliedBefore = $null
if (-not $SkipMigrations) {
    try {
        $connectionString = Get-SqlConnectionString -SitePath $SitePath
        $sqlArgs = Get-SqlcmdArguments -ConnectionString $connectionString
        $appliedBefore = (Invoke-Native 'sqlcmd' 'sqlcmd' ($sqlArgs + @(
            '-Q', "SET NOCOUNT ON; SELECT TOP 1 MigrationId FROM __EFMigrationsHistory ORDER BY MigrationId DESC;"
        )) -IgnoreExitCode | Select-Object -First 1)
        $global:LASTEXITCODE = 0
        if ($appliedBefore) { $appliedBefore = $appliedBefore.Trim() }
    }
    catch {
        # A first release has no history table yet. Not a problem; there is
        # simply nothing to roll back to.
        $appliedBefore = $null
    }
}

# --- backup -----------------------------------------------------------------

if ($SkipBackup) {
    Write-Host "  [!!]  Skipping the backup, as asked.`n" -ForegroundColor Yellow
}
else {
    $backup = & (Join-Path $PSScriptRoot '10-backup.ps1') -SitePath $SitePath -SkipFiles -Label 'before-release' |
        Select-Object -Last 1
}

# --- keep the build that is running -----------------------------------------

if (Test-Path $SitePath) {
    if (Test-Path $previous) { Remove-Item $previous -Recurse -Force }
    Write-Host "  Keeping the current build..." -ForegroundColor Gray
    Copy-Item $SitePath $previous -Recurse -Force
    Write-Host "  [ok]  $previous" -ForegroundColor Green
}

# --- stop, publish, migrate, start ------------------------------------------

function Set-SiteRunning {
    param([bool] $Running)
    if (-not (Test-Path "IIS:\Sites\$SiteName")) { return }
    if ($Running) {
        Start-WebAppPool -Name $PoolName -ErrorAction SilentlyContinue
        Start-Website -Name $SiteName -ErrorAction SilentlyContinue
    }
    else {
        Stop-Website -Name $SiteName -ErrorAction SilentlyContinue
        Stop-WebAppPool -Name $PoolName -ErrorAction SilentlyContinue
        # The worker process holds the DLLs for a moment after the pool stops,
        # and a publish into a folder it still has open fails halfway.
        Start-Sleep -Seconds 3
    }
}

$failed = $null
try {
    Set-SiteRunning $false
    Write-Host "  [ok]  site stopped`n" -ForegroundColor Green

    & (Join-Path $PSScriptRoot '04-publish.ps1') -SourcePath $SourcePath -SitePath $SitePath
    if ($LASTEXITCODE -gt 0) { throw "Publish failed." }

    if (-not $SkipMigrations) {
        & (Join-Path $PSScriptRoot '06-migrate.ps1') -SourcePath $SourcePath -SitePath $SitePath -Force
        if ($LASTEXITCODE -gt 0) { throw "Migration failed." }
    }

    Set-SiteRunning $true
    Write-Host "`n  [ok]  site started" -ForegroundColor Green

    # The first request after a cold start compiles and warms; verifying into
    # that races it and reports a timeout as an outage.
    Start-Sleep -Seconds 8

    & (Join-Path $PSScriptRoot '07-verify.ps1') -BaseUrl $BaseUrl -SitePath $SitePath
    if ($LASTEXITCODE -gt 0) { throw "Verification failed." }
}
catch {
    $failed = $_

    Write-Host "`n=== Release failed: $($_.Exception.Message) ===`n" -ForegroundColor Red

    if (Test-Path $previous) {
        Write-Host "  Putting the previous build back..." -ForegroundColor Yellow
        Set-SiteRunning $false
        Remove-Item $SitePath -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item $previous $SitePath -Recurse -Force
        Set-SiteRunning $true
        Write-Host "  [ok]  previous build restored and the site started" -ForegroundColor Green
    }
    else {
        Set-SiteRunning $true
        Write-Host "  [!!]  No previous build to go back to." -ForegroundColor Red
    }
}

# --- what happened ----------------------------------------------------------

$elapsed = ((Get-Date) - $started).TotalSeconds

if ($failed) {
    Write-Host "`nThe files are back as they were. The database is not." -ForegroundColor Yellow
    Write-Host "Decide about the schema deliberately:`n"

    if ($appliedBefore) {
        Write-Host "  Revert the migrations this release applied:" -ForegroundColor Cyan
        Write-Host ("    .\21-rollback.ps1 -ToMigration {0}" -f $appliedBefore)
        Write-Host "  (a reverting migration can drop columns; read it first)`n" -ForegroundColor DarkGray
    }
    if ($backup) {
        Write-Host "  Or restore the database as it was before the release:" -ForegroundColor Cyan
        Write-Host ("    .\11-restore.ps1 -BackupFile {0}`n" -f $backup)
    }

    Write-Host ("Failed after {0:n0}s.`n" -f $elapsed) -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Released $commit ===" -ForegroundColor Green
if ($backup)  { Write-Host "  Backup   : $backup" }
Write-Host "  Previous : $previous  (kept until the next release)"
Write-Host ("  Took     : {0:n0}s" -f $elapsed)
Write-Host "`nIf something shows up in the next few minutes:" -ForegroundColor Cyan
Write-Host "  .\21-rollback.ps1`n"
