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
    # Remove files the older download left behind. Kept separate from the
    # adoption itself: deleting things is worth asking for, and the list is
    # printed first so it can be read before it is agreed to.
    [switch] $Clean,
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

        $stray = @(Invoke-Native 'git status' 'git' @('status', '--porcelain') -IgnoreExitCode |
            Where-Object { $_ -match '^\?\?' })
        $global:LASTEXITCODE = 0

        # -Clean is useful on an already-adopted folder too: it is how somebody
        # clears the leftovers this script warned about the first time.
        if ($stray -and $Clean) {
            Invoke-Native 'git clean' 'git' @('clean', '-fd') -Stream | Out-Null
            Write-Host "  [ok]  removed $($stray.Count) untracked file(s)" -ForegroundColor Green
            $stray = @()
        }
    }
    finally { Pop-Location }

    Write-Host "  Already a checkout of $origin, on $commit." -ForegroundColor Green

    if ($stray) {
        Write-Host "`n  [!!]  $($stray.Count) untracked file(s) will stop a release from pulling." -ForegroundColor Yellow
        Write-Host "        .\00-adopt-checkout.ps1 -Clean  removes them.`n" -ForegroundColor Cyan
        return
    }

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

    # Reset, and never checkout here. Every file from the ZIP is untracked, and
    # git checkout refuses rather than overwrite untracked files — which is the
    # whole of what this has to do. git reset --hard makes the working tree
    # match the commit without asking, which is right when the folder is meant
    # to be that commit.
    Write-Host "  Resetting to origin/$Branch..." -ForegroundColor Gray
    Invoke-Native 'git reset' 'git' @('reset', '--hard', "origin/$Branch") -Stream | Out-Null

    # Whatever `git init` called the branch, it is $Branch now, and it follows
    # the remote — so `git pull` works from here without arguments.
    Invoke-Native 'git branch' 'git' @('branch', '-M', $Branch) | Out-Null
    Invoke-Native 'git branch' 'git' @(
        'branch', '--set-upstream-to', "origin/$Branch", $Branch) | Out-Null

    $commit  = (Invoke-Native 'git rev-parse' 'git' @('rev-parse', '--short', 'HEAD')).Trim()
    $subject = (Invoke-Native 'git log' 'git' @('log', '-1', '--pretty=%s')).Trim()

    # A reset makes the tracked files match the commit and leaves everything
    # else alone — which includes whatever an older ZIP left behind. Those show
    # as untracked, and a release refuses on an untracked tree rather than
    # pulling over somebody's work, so they have to be dealt with now or they
    # will stop every release from here on.
    $leftovers = @(Invoke-Native 'git status' 'git' @(
        'status', '--porcelain', '--untracked-files=normal') -IgnoreExitCode |
        Where-Object { $_ -match '^\?\?' } |
        ForEach-Object { ($_ -replace '^\?\?\s*', '').Trim() })
    $global:LASTEXITCODE = 0

    if ($leftovers -and $Clean) {
        # -fd, not -fdx: build outputs are ignored rather than untracked, and
        # removing node_modules and bin here would only mean rebuilding them.
        Invoke-Native 'git clean' 'git' @('clean', '-fd') -Stream | Out-Null
        Write-Host "  [ok]  removed $($leftovers.Count) leftover file(s) from the old copy" -ForegroundColor Green
        $leftovers = @()
    }
}
finally { Pop-Location }

Write-Host "`n  [ok]  now a checkout of $Branch, on $commit  $subject" -ForegroundColor Green

if ($leftovers) {
    Write-Host "`n  [!!]  $($leftovers.Count) file(s) are here that the repository does not have:" -ForegroundColor Yellow
    $leftovers | Select-Object -First 10 | ForEach-Object { Write-Host "          $_" -ForegroundColor DarkGray }
    if ($leftovers.Count -gt 10) { Write-Host "          ... and $($leftovers.Count - 10) more" -ForegroundColor DarkGray }

    Write-Host "`n  They are almost certainly from the older download. A release refuses" -ForegroundColor Yellow
    Write-Host "  to pull over untracked files, so it will stop until these are gone:" -ForegroundColor Yellow
    Write-Host "`n    .\00-adopt-checkout.ps1 -Clean" -ForegroundColor Cyan
    Write-Host "`n  That removes them and keeps what is ignored — node_modules, bin, obj —"
    Write-Host "  so the next build does not start from nothing.`n"
    return
}

Write-Host "`nFrom here on, a release pulls for itself — no more downloading:" -ForegroundColor Cyan
Write-Host "  cd $Path\deploy"
Write-Host "  .\release-web.ps1`n"
