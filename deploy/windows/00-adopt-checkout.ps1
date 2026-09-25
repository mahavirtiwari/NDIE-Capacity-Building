<#
.SYNOPSIS
    Turns a downloaded copy of the code into a git checkout, once.

.DESCRIPTION
    A ZIP from GitHub is the code without the repository: no history, no remote,
    no way to pull. Every release then means downloading again, extracting over
    the top, and hoping nothing was left behind from last time — and the release
    scripts refuse, because they start by pulling.

    This adopts the folder instead. It points it at the repository, fetches, and
    resets it to the branch, so from then on a release is `git pull` and nothing
    else. Run it once; after that it has nothing to do and says so.

    What it replaces: everything in the folder that differs from the branch.
    That is the point — a downloaded copy is meant to be exactly a commit, and
    afterwards it is one. Nothing outside the folder is touched, which is where
    everything that matters lives: the configuration is in the site folder, the
    uploads are in E:\cbms-data, and the backups are in E:\cbms-backups.

.PARAMETER Path
    The downloaded folder. Defaults to the production settings.

.PARAMETER Remote
    The repository. Defaults to the one this code came from.

.EXAMPLE
    .\00-adopt-checkout.ps1
    .\00-adopt-checkout.ps1 -Path 'E:\NDIE-Capacity-Building-main'
#>
[CmdletBinding()]
param(
    [string] $Path,
    [string] $Remote = 'https://github.com/mahavirtiwari/NDIE-Capacity-Building.git',
    [string] $Branch = 'main',
    [switch] $Force
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$settings = Import-DeploySettings
$Path = Get-Setting $Path $settings 'SourcePath' 'E:\NDIE-Capacity-Building-main'

if (-not (Test-Path $Path)) { throw "Not found: $Path" }

# A folder with the repository's own shape in it, so a mistyped path cannot
# turn some unrelated directory into a checkout.
foreach ($marker in @('backend', 'training-portal', 'deploy')) {
    if (-not (Test-Path (Join-Path $Path $marker))) {
        throw "$Path does not look like this repository — no '$marker' folder. Check the path, and that the ZIP was extracted without an extra folder inside it."
    }
}

Write-Host "`n=== Adopting $Path ===`n" -ForegroundColor Cyan

# --- already a checkout? -----------------------------------------------------

if (Test-Path (Join-Path $Path '.git')) {
    Push-Location $Path
    try {
        $origin = (Invoke-Native 'git remote' 'git' @('remote', 'get-url', 'origin') -IgnoreExitCode | Select-Object -First 1)
        $global:LASTEXITCODE = 0
        $commit = (Invoke-Native 'git rev-parse' 'git' @('rev-parse', '--short', 'HEAD')).Trim()
    }
    finally { Pop-Location }

    Write-Host "  Already a checkout of $origin, on $commit." -ForegroundColor Green
    Write-Host "`nNothing to adopt. Releases pull for themselves:" -ForegroundColor Cyan
    Write-Host "  cd $Path\deploy"
    Write-Host "  .\release-web.ps1`n"
    return
}

# --- adopt -------------------------------------------------------------------

Write-Host "  This folder is a downloaded copy, not a checkout." -ForegroundColor Yellow
Write-Host "  Adopting it means replacing anything in it that differs from $Branch."
Write-Host "  Nothing outside it is touched — not the site, not the uploads, not the backups.`n"

if (-not $Force) {
    $answer = Read-Host "  Adopt it? [y/N]"
    if ($answer -notmatch '^(y|yes)$') { Write-Host "`nNothing done.`n"; return }
}

Push-Location $Path
try {
    Invoke-Native 'git init' 'git' @('init') | Out-Null
    Invoke-Native 'git remote add' 'git' @('remote', 'add', 'origin', $Remote) -IgnoreExitCode | Out-Null
    $global:LASTEXITCODE = 0

    # Set it either way: a second run of this script on a half-adopted folder
    # should end up pointing at the right place rather than failing on "remote
    # already exists".
    Invoke-Native 'git remote set-url' 'git' @('remote', 'set-url', 'origin', $Remote) | Out-Null

    Write-Host "  Fetching..." -ForegroundColor Gray
    Invoke-Native 'git fetch' 'git' @('fetch', '--all', '--prune') -Stream | Out-Null

    Write-Host "  Resetting to origin/$Branch..." -ForegroundColor Gray
    Invoke-Native 'git checkout' 'git' @('checkout', '-B', $Branch, "origin/$Branch") -Stream | Out-Null
    Invoke-Native 'git reset' 'git' @('reset', '--hard', "origin/$Branch") -Stream | Out-Null

    $commit  = (Invoke-Native 'git rev-parse' 'git' @('rev-parse', '--short', 'HEAD')).Trim()
    $subject = (Invoke-Native 'git log' 'git' @('log', '-1', '--pretty=%s')).Trim()
}
finally { Pop-Location }

Write-Host "`n  [ok]  now a checkout of $Branch, on $commit  $subject" -ForegroundColor Green
Write-Host "`nFrom here on, a release pulls for itself — no more downloading:" -ForegroundColor Cyan
Write-Host "  cd $Path\deploy"
Write-Host "  .\release-web.ps1`n"
