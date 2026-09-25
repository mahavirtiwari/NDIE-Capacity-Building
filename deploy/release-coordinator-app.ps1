<#
.SYNOPSIS
    The coordinator app: pull the repository, then build a signed APK.

.DESCRIPTION
    The app used in the hall — the venue, the trainers, the register, the
    photographs, and now the trainer's marksheet. Built on its own, because a
    coordinator in the field is the worst person to ask to update an app for a
    change that was not theirs.

    Worth knowing before you distribute one: this app keeps unsent work on the
    phone. An update signed with the same key keeps it; a reinstall does not. So
    the release key in E:\cbms-keystores is not a formality here — losing it
    means asking somebody to uninstall, and uninstalling throws away an
    afternoon in a hall with no signal.

    The API address comes from the production settings, and the version code
    from a counter beside the output that climbs every build.

.PARAMETER NoPull
    Build the checkout as it stands.

.PARAMETER ApiBaseUrl
    Override where the app talks to. For a build aimed at somewhere other than
    production, which is the only reason to pass it.

.EXAMPLE
    .\release-coordinator-app.ps1
    .\release-coordinator-app.ps1 -NoPull
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
    $base = Get-Setting $null $settings 'BaseUrl' 'https://leanstaging.qci.org.in'
    $ApiBaseUrl = ($base.TrimEnd('/')) + '/api'
}

Write-Host "`n=== CBMS coordinator app ===`n" -ForegroundColor Cyan

if ($NoPull) {
    Write-Host "  [--]  Not pulling, as asked." -ForegroundColor DarkGray
}
else {
    Write-Host "  Updating $SourcePath" -ForegroundColor Gray
    $commit = Sync-Checkout -Path $SourcePath
    Write-Host "  $commit`n"
}

& (Join-Path $PSScriptRoot 'android\03-build-apk.ps1') `
    -App coordinator `
    -ApiBaseUrl $ApiBaseUrl `
    -SourcePath $SourcePath `
    -OutputDir $OutputDir

exit $LASTEXITCODE
