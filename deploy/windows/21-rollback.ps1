<#
.SYNOPSIS
    Puts the previous build back, and optionally the schema with it.

.DESCRIPTION
    20-release.ps1 keeps the build it replaced at <SitePath>.previous. This puts
    it back: stop the site, swap the folders, start the site, verify.

    The swap keeps what is running now as well, at <SitePath>.failed, so a
    rollback done in a hurry does not destroy the evidence of why it was needed.

    The schema is separate and deliberate. Code can be swapped back in seconds
    because it holds nothing; a database holds everything that has happened
    since. Two ways to deal with it, neither automatic:

      -ToMigration <name>   revert the migrations applied since that one. Read
                            the Down methods first — a reverting migration drops
                            what its Up added, and anything written into those
                            columns goes with it.

      .\11-restore.ps1      restore the backup the release took. Loses anything
                            written since the release, which on a live site may
                            be an afternoon of marking.

    Most of the time neither is needed: a schema is usually additive and the
    previous build simply ignores the new columns.

.EXAMPLE
    .\21-rollback.ps1
    .\21-rollback.ps1 -ToMigration 20260925030434_ParticipantMarksheet
#>
[CmdletBinding()]
param(
    [string] $SourcePath,
    [string] $SitePath,
    [string] $BaseUrl,
    [string] $SiteName,
    [string] $PoolName,
    [string] $ToMigration,
    [switch] $Force
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')
Assert-Elevated 'Rolling back'

$settings   = Import-DeploySettings
$SourcePath = Get-Setting $SourcePath $settings 'SourcePath' 'E:\NDIE-Capacity-Building-main'
$SitePath   = Get-Setting $SitePath   $settings 'SitePath'   'E:\inetpub\cbms'
$BaseUrl    = Get-Setting $BaseUrl    $settings 'BaseUrl'    'https://localhost'
$SiteName   = Get-Setting $SiteName   $settings 'SiteName'   'CBMS'
$PoolName   = Get-Setting $PoolName   $settings 'PoolName'   'CbmsAppPool'

Import-Module WebAdministration

$previous = "$SitePath.previous"
$failed   = "$SitePath.failed"

if (-not (Test-Path $previous)) {
    throw "No $previous. Nothing to roll back to — the last release either has not run or was the first."
}

$kept = (Get-Item $previous).LastWriteTime

Write-Host "`n=== Rolling back CBMS ===`n" -ForegroundColor Cyan
Write-Host ("  Going back to the build kept at {0:dd MMM yyyy HH:mm}" -f $kept)
Write-Host "  The build running now will be kept at $failed"
if ($ToMigration) { Write-Host "  Schema will be reverted to $ToMigration" -ForegroundColor Yellow }

if (-not $Force) {
    $answer = Read-Host "`n  Roll back? [y/N]"
    if ($answer -notmatch '^(y|yes)$') { Write-Host "`nNothing done.`n"; return }
}

# --- the schema first -------------------------------------------------------
#
# Before the files, not after: the previous build is the one that matches the
# older schema, and between the two steps something has to be wrong. Better the
# window is "new code, old schema" for a few seconds under a stopped site than
# the site serving old code against a schema it does not know.

if (Test-Path "IIS:\Sites\$SiteName") {
    Stop-Website -Name $SiteName -ErrorAction SilentlyContinue
    Stop-WebAppPool -Name $PoolName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    Write-Host "`n  [ok]  site stopped" -ForegroundColor Green
}

if ($ToMigration) {
    $connectionString = Get-SqlConnectionString -SitePath $SitePath
    $infra = Join-Path $SourcePath 'backend\src\Ntms.Infrastructure\Ntms.Infrastructure.csproj'
    $api   = Join-Path $SourcePath 'backend\src\Ntms.Api\Ntms.Api.csproj'

    Write-Host "  Reverting the schema to $ToMigration..." -ForegroundColor Yellow
    $env:ConnectionStrings__Default = $connectionString
    try {
        Invoke-Native 'dotnet ef database update' 'dotnet' @(
            'ef', 'database', 'update', $ToMigration,
            '--project', $infra, '--startup-project', $api, '--configuration', 'Release'
        ) -Stream
    }
    finally { Remove-Item Env:\ConnectionStrings__Default -ErrorAction SilentlyContinue }

    Write-Host "  [ok]  schema reverted" -ForegroundColor Green
}

# --- the files --------------------------------------------------------------

if (Test-Path $failed) { Remove-Item $failed -Recurse -Force }
if (Test-Path $SitePath) { Move-Item $SitePath $failed }

Copy-Item $previous $SitePath -Recurse -Force
Write-Host "  [ok]  previous build in place" -ForegroundColor Green

if (Test-Path "IIS:\Sites\$SiteName") {
    Start-WebAppPool -Name $PoolName -ErrorAction SilentlyContinue
    Start-Website -Name $SiteName
    Write-Host "  [ok]  site started" -ForegroundColor Green
}

Start-Sleep -Seconds 8
& (Join-Path $PSScriptRoot '07-verify.ps1') -BaseUrl $BaseUrl -SitePath $SitePath

Write-Host "`nRolled back." -ForegroundColor Green
Write-Host "  The build that failed is at $failed — keep it until you know why.`n"
