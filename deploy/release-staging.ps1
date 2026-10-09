<#
.SYNOPSIS
    The whole staging release, in order: the web, then both Android apps.

.DESCRIPTION
    Staging and production are the same machine, so this is the release — there
    is no later promotion step, and the scripts beside this one already know
    where everything goes. What was missing was a single command that runs them
    in the right order, from one commit, and says afterwards what shipped.

    Three things are released from this repository and they are built by their
    own scripts:

      * the web — the API with the portal inside its wwwroot, which ship as one
        site and cannot be separated;
      * the applicant app;
      * the coordinator app.

    The checkout is pulled once, here, and each child script is then run with
    -NoPull. That is the point of this script rather than a note in a README:
    run the three by hand and each pulls again, so a commit landing midway
    through leaves a portal built from one revision and an APK from another,
    with nothing to say it happened.

    The web release is 20-release.ps1 underneath, which backs up the database
    before the schema changes, keeps the build that is running, and puts it back
    if verification fails. Nothing here weakens that; the flags are passed
    straight through.

    Every release appends a line to releases.log in the backup folder — the
    commit, the time, and what was built. The next release reads the last line
    to show what has accumulated since, which is the question actually asked
    before a release and the one nothing here could answer before.

.PARAMETER WebOnly
    The API and portal, and neither app. For a release with no mobile change —
    which is most of them, and the apps are a long build.

.PARAMETER AppsOnly
    Both APKs, and nothing to the server. For a mobile-only change, or to
    rebuild after a release where the apps were skipped.

.PARAMETER NoPull
    Release the checkout as it stands. For a second attempt after a failure,
    where pulling again fetches the same commit, or to ship a commit that is
    not the tip.

.PARAMETER SkipMigrations
    The release has no schema change. Passed to the web release.

.PARAMETER SkipBackup
    No schema change, and the wait is not worth it. Said out loud rather than
    skipped quietly.

.PARAMETER BackupRoot
    Where releases.log is kept. Taken from the deploy settings; worth passing
    only to read the log somewhere other than the server.

.PARAMETER Plan
    Print what would run and stop. Changes nothing, pulls nothing.

.EXAMPLE
    .\release-staging.ps1
    Everything: pull, web, both apps.

.EXAMPLE
    .\release-staging.ps1 -Plan
    What the above would do, without doing it.

.EXAMPLE
    .\release-staging.ps1 -WebOnly -SkipMigrations
    A code-only web release.
#>
[CmdletBinding()]
param(
    [string] $SourcePath,
    [string] $BackupRoot,
    [string] $ApkOutputDir = 'E:\cbms-apk',
    [switch] $WebOnly,
    [switch] $AppsOnly,
    [switch] $NoPull,
    [switch] $SkipMigrations,
    [switch] $SkipBackup,
    [switch] $Plan
)

$ErrorActionPreference = 'Stop'
$windows = Join-Path $PSScriptRoot 'windows'
. (Join-Path $windows '_common.ps1')

if ($WebOnly -and $AppsOnly) {
    throw "-WebOnly and -AppsOnly together leave nothing to release. Pass neither for both."
}

$doWeb  = -not $AppsOnly
$doApps = -not $WebOnly

# The APK build does not need the administrator; replacing the site and
# restarting the pool does. Asked for only when it is actually needed, so a
# mobile-only rebuild does not require an elevated window.
if ($doWeb -and -not $Plan) { Assert-Elevated 'A staging release' }

$settings   = Import-DeploySettings
$SourcePath = Get-Setting $SourcePath $settings 'SourcePath' 'E:\NDIE-Capacity-Building-main'
$BackupRoot = Get-Setting $BackupRoot $settings 'BackupRoot' 'E:\cbms-backups'
$BaseUrl    = Get-Setting $null       $settings 'BaseUrl'    'https://leanstaging.qci.org.in'

$log     = Join-Path $BackupRoot 'releases.log'
$started = Get-Date

Write-Host "`n=== CBMS staging release ===`n" -ForegroundColor Cyan
Write-Host "  Source : $SourcePath"
Write-Host "  URL    : $BaseUrl"
Write-Host ("  Parts  : {0}" -f (@(
    if ($doWeb)  { 'web (API + portal)' }
    if ($doApps) { 'applicant app'; 'coordinator app' }
) -join ', '))

# --- what shipped last time -------------------------------------------------

# Read before the pull, so the range is measured from the deployed commit and
# not from the one we are about to land on.
$previous = $null
if (Test-Path $log) {
    $last = Get-Content $log -Tail 1 -ErrorAction SilentlyContinue
    if ($last -match '\b([0-9a-f]{7,40})\b') { $previous = $Matches[1] }
}

if ($previous) {
    Push-Location $SourcePath
    try {
        $range = @(Invoke-Native 'git log' 'git' `
            @('log', '--oneline', "$previous..HEAD") -IgnoreExitCode | Where-Object { $_ })
        $asked = $LASTEXITCODE
        $global:LASTEXITCODE = 0

        if ($asked -gt 0) {
            # A rewritten branch, or a checkout replaced rather than pulled.
            # Worth saying: the alternative is an empty list, which reads as
            # "nothing has changed since the last release".
            Write-Host "`n  The last recorded release was $previous, which is not in this" -ForegroundColor Yellow
            Write-Host "  checkout. Cannot say what has changed since." -ForegroundColor Yellow
        }
        elseif ($range.Count -gt 0) {
            Write-Host "`n  Since $previous — $($range.Count) commit(s):" -ForegroundColor Gray
            $range | Select-Object -First 15 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
            if ($range.Count -gt 15) {
                Write-Host ("    ... and {0} more" -f ($range.Count - 15)) -ForegroundColor DarkGray
            }
        }
    }
    finally { Pop-Location }
}
else {
    Write-Host "`n  No previous release recorded here. This will be the first line in" -ForegroundColor DarkGray
    Write-Host "  $log" -ForegroundColor DarkGray
}

# --- the plan ---------------------------------------------------------------

if ($Plan) {
    Write-Host "`n  Would run, in order:`n" -ForegroundColor Yellow
    $n = 0
    if (-not $NoPull) { $n++; Write-Host "    $n. pull $SourcePath (fast-forward only)" }
    if ($doWeb) {
        $n++
        $flags = @('-NoPull')
        if ($SkipMigrations) { $flags += '-SkipMigrations' }
        if ($SkipBackup)     { $flags += '-SkipBackup' }
        Write-Host ("    {0}. release-web.ps1 {1}" -f $n, ($flags -join ' '))

        $steps = @()
        if (-not $SkipBackup) { $steps += 'back up the database' }
        $steps += 'stop the site', 'publish'
        if (-not $SkipMigrations) { $steps += 'migrate' }
        $steps += 'start', 'verify'
        Write-Host ("         {0}" -f ($steps -join ', ')) -ForegroundColor DarkGray
        Write-Host "         puts the previous build back if verification fails" -ForegroundColor DarkGray

        if ($SkipBackup) {
            Write-Host "         no backup first, as asked" -ForegroundColor Yellow
        }
    }
    if ($doApps) {
        $n++; Write-Host "    $n. release-applicant-app.ps1 -NoPull   -> $ApkOutputDir"
        $n++; Write-Host "    $n. release-coordinator-app.ps1 -NoPull -> $ApkOutputDir"
    }
    Write-Host "`n  Nothing was changed.`n" -ForegroundColor Yellow
    exit 0
}

# --- one commit for all three -----------------------------------------------

if ($NoPull) {
    Write-Host "`n  [--]  Not pulling, as asked." -ForegroundColor DarkGray
}
else {
    Write-Host "`n  Updating $SourcePath" -ForegroundColor Gray
    $landed = Sync-Checkout -Path $SourcePath
    Write-Host "  $landed"
}

Push-Location $SourcePath
try {
    $commit  = (Invoke-Native 'git rev-parse' 'git' @('rev-parse', '--short', 'HEAD')).Trim()
    $subject = (Invoke-Native 'git log' 'git' @('log', '-1', '--pretty=%s')).Trim()
}
finally { Pop-Location }

$shipped = @()

# --- the web ----------------------------------------------------------------

if ($doWeb) {
    Write-Host "`n--- web ---" -ForegroundColor Cyan

    # Cleared first. The checks below read $LASTEXITCODE, and a value left by
    # any earlier native command would otherwise be reported as this script
    # failing — which, for a release, means rolling back something that worked.
    $global:LASTEXITCODE = 0

    & (Join-Path $PSScriptRoot 'release-web.ps1') `
        -SourcePath $SourcePath `
        -NoPull `
        -SkipMigrations:$SkipMigrations `
        -SkipBackup:$SkipBackup

    if ($LASTEXITCODE -gt 0) {
        # 20-release.ps1 has already put the previous build back and printed how
        # to undo the database. Stopping here is deliberate: APKs built against
        # a server that is not running the matching commit are worse than no
        # APKs at all.
        Write-Host "`n  The web release failed. The apps were not built." -ForegroundColor Red
        Write-Host "  The server is on its previous build; read the output above before retrying.`n" -ForegroundColor Red
        exit $LASTEXITCODE
    }

    $shipped += 'web'
}

# --- the apps ---------------------------------------------------------------

$apks = @()

if ($doApps) {
    foreach ($app in @(
        @{ Name = 'applicant';   Script = 'release-applicant-app.ps1' },
        @{ Name = 'coordinator'; Script = 'release-coordinator-app.ps1' }
    )) {
        Write-Host "`n--- $($app.Name) app ---" -ForegroundColor Cyan

        $global:LASTEXITCODE = 0

        & (Join-Path $PSScriptRoot $app.Script) `
            -SourcePath $SourcePath `
            -OutputDir $ApkOutputDir `
            -NoPull

        if ($LASTEXITCODE -gt 0) {
            # The web is already out and verified. Say which app is missing
            # rather than failing the whole release back to nothing.
            Write-Host "`n  The $($app.Name) app did not build." -ForegroundColor Red
            Write-Host "  The web release stands. Fix the build and run:" -ForegroundColor Yellow
            Write-Host "    .\$($app.Script) -NoPull`n" -ForegroundColor Yellow
            exit $LASTEXITCODE
        }

        $shipped += "$($app.Name) app"

        $newest = Get-ChildItem -Path $ApkOutputDir -Filter "*$($app.Name)*.apk" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($newest) { $apks += $newest }
    }
}

# --- what shipped -----------------------------------------------------------

if (-not (Test-Path $BackupRoot)) {
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
}

$line = "{0}  {1}  [{2}]  {3}" -f `
    (Get-Date -Format 'yyyy-MM-dd HH:mm'), $commit, ($shipped -join ', '), $subject
Add-Content -Path $log -Value $line -Encoding utf8

$elapsed = ((Get-Date) - $started).TotalSeconds

Write-Host "`n=== Released $commit to staging ===" -ForegroundColor Green
Write-Host "  $subject"
Write-Host ("  {0}" -f ($shipped -join ', '))
Write-Host ("  {0:n0}s. Recorded in $log`n" -f $elapsed)

if ($doWeb) {
    Write-Host "  Check it: $BaseUrl" -ForegroundColor Gray
}

if ($apks.Count -gt 0) {
    Write-Host "`n  APKs to distribute:" -ForegroundColor Gray
    foreach ($a in $apks) {
        Write-Host ("    {0}  ({1:n1} MB)" -f $a.FullName, ($a.Length / 1MB))
    }
    Write-Host "`n  Both are signed with the release key in E:\cbms-keystores, so they" -ForegroundColor DarkGray
    Write-Host "  install over what is already on a handset. Push notifications need" -ForegroundColor DarkGray
    Write-Host "  the Expo project and the FCM key in place before they reach one." -ForegroundColor DarkGray
}

Write-Host ""
exit 0
