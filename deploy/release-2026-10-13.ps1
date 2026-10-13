<#
.SYNOPSIS
    The 13 October release: the web, both apps, and the data that goes with
    them.

.DESCRIPTION
    Pulled from git and released the ordinary way, with one step afterwards
    that a migration cannot do for itself.

    What is in it:

      * Eligibility, as the scheme actually states it. A programme type can
        list a way in per educational qualification - a graduate with five
        years, a diploma holder with eight - each carrying what else has to
        be produced. The applicant is held to the row their own
        qualification puts them on and has to meet all of it; the app shows
        the rows, marks theirs, and lists the programmes they qualify for
        with All programs a tap away.

      * The coordinator app. A programme reaches the phone only once the
        operation manager has permitted it, and nothing can be recorded
        against one that has not been. On permission the coordinator gets a
        notice on the handset and an e-mail with the particulars. The app
        has a menu - training material, profile with what the role grants,
        change password, support - signing out now returns to sign-in, and
        the home screen separates what is still to run from what has been
        submitted.

      * Moving a venue. An implementing agency can ask to hold a permitted
        physical or hybrid programme somewhere else; the manager that
        permitted it accepts or refuses, and both sides are told.

      * The portal bell, which was a button with nothing behind it. It now
        carries what the scheme has said to that account - a programme
        waiting on their permission, a venue change asked for - counted and
        unread first.

      * Forms that can say more. A choice on a shared list carries a
        description, shown under it on the form - "qualified lead auditor"
        and "auditor" are a distinction no reader should have to carry -
        and a new Duration field asks for two dates and works the length
        out as they are picked.

      * A good deal of tidying that was asked for screen by screen: retired
        roles are no longer offered, a coordinator is picked by name and
        user ID, reports list conducted programmes, detail sheets put one
        section to a row, and the tiers are offered only the screens that
        have anything on them.

    Four migrations:
      MoreThanOneWayIntoAProgramme, ANoticeCanBeAddressedToOnePerson,
      AVenueMovesOnlyWhenTheManagerSaysSo, AChoiceCanSayWhatItMeans.

    It runs in three parts, and stops at the first that fails:

      1. release-staging.ps1 - pull, publish the web, migrate, verify, and
         build both APKs. Every flag is passed straight through.
      2. 23-release-data.ps1 - rewrite the programme names that were
         composed by the old rule, and check the release arrived whole.
      3. A read of what shipped, so the window you ran it in says what is
         now live.

    Both apps change, so the APKs are not optional. A coordinator on the
    old build has no menu and will be shown batches the server now refuses
    to record against; an applicant on the old build sees no eligibility
    rows. -WebOnly is there for a second attempt at the server half, but it
    leaves the apps behind.

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

.PARAMETER SkipNames
    Leave the existing programme names as they are.

.PARAMETER DataOnly
    Skip the release and run only the data step.

.PARAMETER Plan
    Print what each part would do and stop. Changes nothing, pulls nothing.

.EXAMPLE
    .\release-2026-10-13.ps1 -Plan
    What the whole thing would do.

.EXAMPLE
    .\windows\10-backup.ps1 -SkipFiles -Label 'before-2026-10-13'
    .\release-2026-10-13.ps1 -SkipBackup
    The pair, in the order they belong in.

.EXAMPLE
    .\release-2026-10-13.ps1 -DataOnly
    For a release that landed and a data step that did not.
#>
[CmdletBinding()]
param(
    [string] $SourcePath,
    [string] $SitePath,
    [switch] $WebOnly,
    [switch] $AppsOnly,
    [switch] $NoPull,
    [switch] $SkipBackup,
    [switch] $SkipNames,
    [switch] $DataOnly,
    [switch] $Plan
)

$ErrorActionPreference = 'Stop'
$windows = Join-Path $PSScriptRoot 'windows'
. (Join-Path $windows '_common.ps1')

$settings   = Import-DeploySettings
$SourcePath = Get-Setting $SourcePath $settings 'SourcePath' 'E:\NDIE-Capacity-Building-main'
$BaseUrl    = Get-Setting $null       $settings 'BaseUrl'    'https://leanstaging.qci.org.in'

Write-Host "`n=== CBMS release - 13 October 2026 ===`n" -ForegroundColor Cyan
Write-Host "  Source : $SourcePath"
Write-Host "  URL    : $BaseUrl"
Write-Host ("  Parts  : {0}" -f (@(
    if (-not $DataOnly) { 'release' }
    if (-not $AppsOnly) { 'release data' }
) -join ', '))

if ($Plan) { Write-Host "`n  Plan: nothing will be pulled, built or written.`n" -ForegroundColor Yellow }

# --- 1. the release itself --------------------------------------------------

if (-not $DataOnly) {
    $release = Join-Path $PSScriptRoot 'release-staging.ps1'
    if (-not (Test-Path $release)) { throw "release-staging.ps1 is not beside this script." }

    # A hashtable, not an array. Splatting an array passes its elements
    # positionally - "-WebOnly" would be bound to the first parameter as a
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

    $data = Join-Path $windows '23-release-data.ps1'
    if (-not (Test-Path $data)) { throw "23-release-data.ps1 is not under $windows." }

    $dataArgs = @{}
    if ($SitePath)  { $dataArgs.SitePath  = $SitePath }
    if ($SkipNames) { $dataArgs.SkipNames = $true }
    if ($Plan)      { $dataArgs.Plan      = $true }

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
    Write-Host "    1. Masters -> Program types -> edit one: 'Ways in' takes a row per"
    Write-Host "       qualification. Add graduation with 5 years and diploma with 8, each"
    Write-Host "       asking for the lead auditor certificate and the 25 mandays evidence."
    Write-Host "    2. The applicant app: Programs shows 'For me' and 'View eligibility', and"
    Write-Host "       the row the applicant's own qualification puts them on is marked Yours."
    Write-Host "    3. Raise a program as an agency, then sign in as the operation manager:"
    Write-Host "       the bell carries it, and Programs offers Accept permission."
    Write-Host "    4. Permit it: the coordinator gets the e-mail and the app notice, and the"
    Write-Host "       program appears on the phone. It should not have been there before."
    Write-Host "    5. As the agency, Change venue on that program; as the manager, answer it."
    Write-Host "    6. Administration -> Email: 'Program permitted', 'Venue change requested'"
    Write-Host "       and 'Venue change decided' are in the list and switched on."
    Write-Host "    7. Masters -> Choice lists -> edit one: each choice takes a description,"
    Write-Host "       and it reads under the choice on the form. Program setup -> Profile"
    Write-Host "       forms offers a Duration field that adds up two dates."
    Write-Host ""
    Write-Host "  The APKs are in E:\cbms-apk unless -WebOnly was passed." -ForegroundColor Cyan
    Write-Host "  Both apps changed in this release - install them both." -ForegroundColor Cyan
    Write-Host ""
}
