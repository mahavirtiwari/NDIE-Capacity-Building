<#
.SYNOPSIS
    Brings the checkout on this server up to date with git, and says what
    arrived.

.DESCRIPTION
    The pull on its own.

    A release pulls for itself - release-staging.ps1 does it once and runs
    everything else with -NoPull, so one release is one commit - and this
    is for the times that is not what is wanted: seeing what has landed
    before deciding to release it, taking the code now and releasing it in
    a window later, or putting a checkout back in step after somebody has
    been working in it.

    It fast-forwards only. A merge made here would be a commit that exists
    on this server and nowhere else, which is the one thing a deployment
    checkout must never contain. A tree with uncommitted work in it stops
    the pull and says which files - with one exception, the two
    package.json files an APK build rewrites, which are restored because
    expo prebuild edits them and does not always put them back.

    Nothing is built, published or migrated. The site goes on serving
    whatever was last published until a release is run.

.PARAMETER SourcePath
    The checkout. Taken from the deploy settings.

.PARAMETER Plan
    Fetch and say what would land, without moving the checkout.

.EXAMPLE
    .\24-pull.ps1 -Plan
    What is waiting, and nothing else.

.EXAMPLE
    .\24-pull.ps1
    Take it, and print the commits that arrived.

.EXAMPLE
    .\24-pull.ps1
    ..\release-2026-10-13.ps1 -NoPull -SkipBackup
    Pull now, release the commit you just read.
#>
[CmdletBinding()]
param(
    [string] $SourcePath,
    [switch] $Plan
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$settings   = Import-DeploySettings
$SourcePath = Get-Setting $SourcePath $settings 'SourcePath' 'E:\NDIE-Capacity-Building-main'

Write-Host "`n=== Pull ===`n" -ForegroundColor Cyan
Write-Host "  Source : $SourcePath"
if ($Plan) { Write-Host "  Plan   : the checkout will not be moved" -ForegroundColor Yellow }

if (-not (Test-Path (Join-Path $SourcePath '.git'))) {
    throw "$SourcePath is not a git checkout. Nothing to pull."
}

Push-Location $SourcePath
try {
    $branch = (Invoke-Native 'git branch' 'git' @('rev-parse', '--abbrev-ref', 'HEAD')).Trim()
    $before = (Invoke-Native 'git rev-parse' 'git' @('rev-parse', '--short', 'HEAD')).Trim()
    Write-Host "  Branch : $branch"
    Write-Host "  Now on : $before"

    # Fetch either way. Reading what is waiting changes nothing on the
    # working tree, and -Plan with stale remote refs would answer about
    # whatever was last fetched rather than about what is there now.
    Write-Host "`n  Fetching..." -ForegroundColor Gray
    Invoke-Native 'git fetch' 'git' @('fetch', '--all', '--prune') -Stream | Out-Null

    # Asked through for-each-ref rather than by the branch's @{upstream}
    # shorthand: an at-sign followed by a double quote opens a here-string
    # in PowerShell, and the rest of the file is then read as text.
    $upstream = (Invoke-Native 'git for-each-ref' 'git' `
        @('for-each-ref', '--format=%(upstream:short)', "refs/heads/$branch") `
        -IgnoreExitCode).Trim()
    $asked = $LASTEXITCODE
    $global:LASTEXITCODE = 0

    if ($asked -gt 0 -or -not $upstream) {
        throw ("$branch is not tracking a remote branch, so there is nothing to pull from. " +
               "Set one with:  git branch --set-upstream-to=origin/$branch")
    }

    $waiting = @(Invoke-Native 'git log' 'git' `
        @('log', '--oneline', "HEAD..$upstream") -IgnoreExitCode | Where-Object { $_ })
    $global:LASTEXITCODE = 0

    if ($waiting.Count -eq 0) {
        Write-Host "`n  Up to date with $upstream - nothing to pull.`n" -ForegroundColor Green
        return
    }

    Write-Host "`n  Waiting on $upstream - $($waiting.Count) commit(s):" -ForegroundColor Cyan
    $waiting | Select-Object -First 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    if ($waiting.Count -gt 20) {
        Write-Host ("    ... and {0} more" -f ($waiting.Count - 20)) -ForegroundColor Gray
    }

    # Whether this release will need the database moved. Said here because
    # it is the question somebody asks next, and the answer is in the
    # commits that just arrived.
    $migrations = @(Invoke-Native 'git diff' 'git' `
        @('diff', '--name-only', "HEAD..$upstream", '--',
          'backend/src/Ntms.Infrastructure/Persistence/Migrations') -IgnoreExitCode |
        Where-Object { $_ -and $_ -notmatch 'Designer\.cs$' -and $_ -match '/\d{14}_.+\.cs$' })
    $global:LASTEXITCODE = 0

    if ($migrations.Count -gt 0) {
        Write-Host "`n  Carries $($migrations.Count) migration(s):" -ForegroundColor Yellow
        $migrations | ForEach-Object {
            Write-Host ("    {0}" -f [IO.Path]::GetFileNameWithoutExtension($_)) -ForegroundColor Yellow
        }
        Write-Host "  Back the database up before releasing this." -ForegroundColor Yellow
    }

    if ($Plan) {
        Write-Host "`n  Plan: the checkout stays on $before. Run this again without -Plan to take it.`n" -ForegroundColor Yellow
        return
    }
}
finally { Pop-Location }

# Sync-Checkout does the rest: it refuses a dirty tree, restores the two
# package.json files an APK build rewrites, and fast-forwards.
Write-Host "`n  Updating $SourcePath" -ForegroundColor Gray
$landed = Sync-Checkout -Path $SourcePath

Write-Host "`n=== Pulled ===" -ForegroundColor Green
Write-Host "  $landed"
Write-Host ""
Write-Host "  Nothing has been built or published. To release what you just pulled:" -ForegroundColor Cyan
Write-Host "    .\10-backup.ps1 -SkipFiles -Label 'before-release'"
Write-Host "    ..\release-2026-10-13.ps1 -NoPull -SkipBackup"
Write-Host ""
