<#
.SYNOPSIS
    The applicant app: pull the repository, then build a signed APK.

.DESCRIPTION
    The app candidates use — applying, their enrolments, the training material,
    and now sitting the written paper. Built on its own, so a change to it does
    not mean rebuilding the coordinator's app and asking a hundred coordinators
    to update for nothing.

    The API address is taken from the production settings, so the build cannot
    quietly point at somewhere else. The version code looks after itself: it
    comes from a counter beside the output and climbs every build, which is what
    Android insists on before it will install over what is already there.

    Signed with the release key in E:\cbms-keystores. That key is the identity
    of the app as far as every phone is concerned — signing with a different one
    means each user must uninstall first, and uninstalling takes anything the
    app had stored with it.

.PARAMETER NoPull
    Build the checkout as it stands.

.PARAMETER ApiBaseUrl
    Override where the app talks to. For a build aimed at somewhere other than
    production, which is the only reason to pass it.

.EXAMPLE
    .\release-applicant-app.ps1
    .\release-applicant-app.ps1 -NoPull
#>
[CmdletBinding()]
param(
    [string] $SourcePath,
    [string] $ApiBaseUrl,
    [string] $OutputDir = 'E:\cbms-apk',
    [switch] $NoPull
)

$ErrorActionPreference = 'Stop'
$windows = Join-Path $PSScriptRoot 'windows'
. (Join-Path $windows '_common.ps1')

$settings   = Import-DeploySettings
$SourcePath = Get-Setting $SourcePath $settings 'SourcePath' 'E:\NDIE-Capacity-Building-main'

if (-not $ApiBaseUrl) {
    # From the one place the host is written down, so a rebuilt app cannot end
    # up pointing at a server nobody meant.
    $base = Get-Setting $null $settings 'BaseUrl' 'https://leanstaging.qci.org.in'
    $ApiBaseUrl = ($base.TrimEnd('/')) + '/api'
}

Write-Host "`n=== CBMS applicant app ===`n" -ForegroundColor Cyan

if ($NoPull) {
    Write-Host "  [--]  Not pulling, as asked." -ForegroundColor DarkGray
}
else {
    Write-Host "  Updating $SourcePath" -ForegroundColor Gray
    $commit = Sync-Checkout -Path $SourcePath
    Write-Host "  $commit`n"
}

& (Join-Path $PSScriptRoot 'android\03-build-apk.ps1') `
    -App applicant `
    -ApiBaseUrl $ApiBaseUrl `
    -SourcePath $SourcePath `
    -OutputDir $OutputDir

exit $LASTEXITCODE
