<#
.SYNOPSIS
    The web release: pull the repository, then deploy the API and the portal.

.DESCRIPTION
    One command for the half of the system that runs on this server. The portal
    is built into the API's wwwroot, so the two ship together as one site — they
    cannot be released separately and there is nothing to be gained by trying.

    This is the entry point; the work is in deploy\windows. It pulls, then hands
    over to 20-release.ps1, which backs up the database, keeps the build that is
    running, stops the site, publishes, migrates, starts and verifies — and puts
    the old build back if any of that fails.

    The two apps are built from the same repository by their own scripts, beside
    this one. Nothing here touches them.

.PARAMETER NoPull
    Deploy the checkout as it stands. For a second attempt after a failure,
    where pulling again would only fetch the same commit.

.PARAMETER SkipMigrations
    The release has no schema change.

.PARAMETER SkipBackup
    No schema change, and the wait is not worth it. Said out loud rather than
    skipped quietly.

.EXAMPLE
    .\release-web.ps1
    .\release-web.ps1 -NoPull -SkipMigrations
#>
[CmdletBinding()]
param(
    [string] $SourcePath,
    [switch] $NoPull,
    [switch] $SkipMigrations,
    [switch] $SkipBackup
)

$ErrorActionPreference = 'Stop'
$windows = Join-Path $PSScriptRoot 'windows'
. (Join-Path $windows '_common.ps1')
Assert-Elevated 'A web release'

$settings   = Import-DeploySettings
$SourcePath = Get-Setting $SourcePath $settings 'SourcePath' 'E:\NDIE-Capacity-Building-main'

Write-Host "`n=== CBMS web: API and portal ===`n" -ForegroundColor Cyan

if ($NoPull) {
    Write-Host "  [--]  Not pulling, as asked." -ForegroundColor DarkGray
}
else {
    Write-Host "  Updating $SourcePath" -ForegroundColor Gray
    $commit = Sync-Checkout -Path $SourcePath
    Write-Host "  $commit`n"
}

& (Join-Path $windows '20-release.ps1') `
    -SourcePath $SourcePath `
    -SkipMigrations:$SkipMigrations `
    -SkipBackup:$SkipBackup

exit $LASTEXITCODE
