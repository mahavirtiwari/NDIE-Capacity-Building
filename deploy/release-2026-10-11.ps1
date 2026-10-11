<#
.SYNOPSIS
    The 11 October release: the web, both apps, and the data that goes with
    them.

.DESCRIPTION
    This release is the ordinary one plus a step afterwards, so it has a
    script of its own rather than a note in a README that somebody has to
    remember to read.

    What is in it:

      * five migrations — a registration remembering its batch, an address
        proven before it moves, session start and end times, and the
        Support link and About text;
      * the applicant app, substantially rearranged: the dashboard is the
        landing page, Applications lists profile forms as well as program
        applications, Batches are called Programs and refuse a registration
        the applicant's own history closes, the written paper is ten
        questions to a screen with a declaration at the end, and leaving
        the app during an examination ends the sitting;
      * registering now sends the joining instructions with the session
        plan attached as a PDF.

    It runs in three parts, and stops at the first one that fails:

      1. release-staging.ps1 — pull, publish the web, migrate, verify, and
         build both APKs. Unchanged; every flag is passed straight through.
      2. 22-release-data.ps1 — the schedule e-mail's new wording, and
         Support and About where nobody has written them yet.
      3. A read of what shipped, so the window you ran it in says what is
         now live.

    Both apps change in this release, so the APKs are not optional: an
    applicant on the old build will not see the new screens and will be
    refused by the server where it now insists on a photograph before an
    examination. -WebOnly is still there for a second attempt at the
    server half, but it leaves the apps behind.

.PARAMETER SkipBackup
    The database is backed up by hand on this server. Passed through, and
    said out loud rather than skipped quietly.

.PARAMETER WebOnly
    The server half only. The apps are then on the previous build.

.PARAMETER AppsOnly
    Rebuild both APKs and touch nothing on the server.

.PARAMETER NoPull
    Release the checkout as it stands, for a second attempt after a failure.

.PARAMETER SitePath
    The deployed site, if it is not where the deploy settings say. The
    connection string is read from inside it.

.PARAMETER DataOnly
    Skip the release and run only the data step. For a release that landed
    and a data step that did not.

.PARAMETER Plan
    Print what each part would do and stop. Changes nothing, pulls nothing.

.EXAMPLE
    .\release-2026-10-11.ps1 -Plan
    What the whole thing would do.

.EXAMPLE
    .\release-2026-10-11.ps1 -SkipBackup
    The release, on a server where the backup was taken by hand first.

.EXAMPLE
    .\windows\10-backup.ps1 -SkipFiles -Label 'before-2026-10-11'
    .\release-2026-10-11.ps1 -SkipBackup
    The pair, in the order they belong in.
#>
[CmdletBinding()]
param(
    [string] $SourcePath,
    [string] $SitePath,
    [string] $SupportUrl = 'https://ndie.qcin.org/contact-us/',
    [switch] $WebOnly,
    [switch] $AppsOnly,
    [switch] $NoPull,
    [switch] $SkipBackup,
    [switch] $DataOnly,
    [switch] $Plan
)

$ErrorActionPreference = 'Stop'
$windows = Join-Path $PSScriptRoot 'windows'
. (Join-Path $windows '_common.ps1')

$settings   = Import-DeploySettings
$SourcePath = Get-Setting $SourcePath $settings 'SourcePath' 'E:\NDIE-Capacity-Building-main'
$BaseUrl    = Get-Setting $null       $settings 'BaseUrl'    'https://leanstaging.qci.org.in'

Write-Host "`n=== CBMS release — 11 October 2026 ===`n" -ForegroundColor Cyan
Write-Host "  Source : $SourcePath"
Write-Host "  URL    : $BaseUrl"
Write-Host ("  Parts  : {0}" -f (@(
    if (-not $DataOnly) { 'release' }
    'release data'
) -join ', '))

if ($Plan) { Write-Host "`n  Plan: nothing will be pulled, built or written.`n" -ForegroundColor Yellow }

# --- 1. the release itself --------------------------------------------------

if (-not $DataOnly) {
    $release = Join-Path $PSScriptRoot 'release-staging.ps1'
    if (-not (Test-Path $release)) { throw "release-staging.ps1 is not beside this script." }

    # A hashtable, not an array. Splatting an array passes its elements
    # positionally — "-WebOnly" would be bound to the first parameter as a
    # string rather than read as a switch, and the release would run with
    # the source path set to the word "-WebOnly".
    $forward = @{}
    if ($SourcePath) { $forward.SourcePath = $SourcePath }
    if ($WebOnly)    { $forward.WebOnly    = $true }
    if ($AppsOnly)   { $forward.AppsOnly   = $true }
    if ($NoPull)     { $forward.NoPull     = $true }
    if ($SkipBackup) { $forward.SkipBackup = $true }
    if ($Plan)       { $forward.Plan       = $true }

    Write-Host "`n--- 1 of 2: the release`n" -ForegroundColor Cyan

    $global:LASTEXITCODE = 0
    & $release @forward
    if ($LASTEXITCODE -ne 0) { throw "The release failed. Nothing after this has run." }
}

# --- 2. the data that goes with it -----------------------------------------

# Skipped on an apps-only run: nothing on the server moved, so there is
# nothing for it to catch up with.
if (-not $AppsOnly) {
    Write-Host "`n--- 2 of 2: the data that goes with it`n" -ForegroundColor Cyan

    $data = Join-Path $windows '22-release-data.ps1'
    if (-not (Test-Path $data)) { throw "22-release-data.ps1 is not under $windows." }

    $dataArgs = @{ SupportUrl = $SupportUrl }
    if ($SitePath) { $dataArgs.SitePath = $SitePath }
    if ($Plan)     { $dataArgs.Plan     = $true }

    $global:LASTEXITCODE = 0
    & $data @dataArgs
    if ($LASTEXITCODE -ne 0) { throw "The data step failed. The site is released; this is not." }
}

# --- what is now live -------------------------------------------------------

if (-not $Plan) {
    Write-Host "`n=== Released ===" -ForegroundColor Green

    # A summary must never be the thing that fails a release that worked,
    # so the checkout is only read where there is one to read.
    if (Test-Path $SourcePath) {
        Push-Location $SourcePath
        try {
            $commit = (git rev-parse --short HEAD 2>$null)
            $when   = (git log -1 --format=%cd --date=short 2>$null)
            if ($commit) { Write-Host "  Commit : $commit ($when)" }
        }
        catch { }
        finally { Pop-Location }
    }

    Write-Host "  Portal : $BaseUrl"
    Write-Host ""
    Write-Host "  Worth checking by hand, in this order:" -ForegroundColor Cyan
    Write-Host "    1. Settings -> Branding: the Support link and About text read as you want them."
    Write-Host "    2. Program setup -> Curriculum: a session now has start and end times. Fill them in;"
    Write-Host "       the schedule PDF is built from them."
    Write-Host "    3. Administration -> Email: 'Program schedule' mentions the coordinator, and"
    Write-Host "       'Applicant password reset' is in the list."
    Write-Host "    4. Register an applicant for a batch on a test account and read the e-mail:"
    Write-Host "       venue, timings, coordinator, and the schedule attached as a PDF."
    Write-Host ""
    Write-Host "  The APKs are in E:\cbms-apk unless -WebOnly was passed." -ForegroundColor Cyan
    Write-Host ""
}
