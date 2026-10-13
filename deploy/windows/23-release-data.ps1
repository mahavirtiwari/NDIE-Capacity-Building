<#
.SYNOPSIS
    The data the 13 October release needs that a migration cannot write.

.DESCRIPTION
    Most of this release lands on its own. Four migrations add their
    columns, and the application writes the rest when it starts: the three
    new e-mail templates are seeded because their keys are missing, and the
    implementing agency role gains exams.view from the seeder's own
    corrections. None of that needs a step here.

    Two things do, and both are about rows that already exist:

      * Programme names. A batch used to be named by composing one -
        "{days}-Day {type} Training Program" - which, on a type already
        called "5-day Assessor Training", produced "5-Day 5-day Assessor
        Training Training Program". New batches take the track's own name.
        The ones already raised keep what they were given, so this rewrites
        them, and only where the name is still exactly what the old rule
        would have produced. A name somebody typed is never touched.

      * A check that the release actually arrived: the columns, the
        templates, and the agency role's new key. Nothing is written by
        that half; it is here so that one script says whether the release
        is whole.

    Safe to run twice. The second run reports that there is nothing left to
    do.

.PARAMETER SitePath
    The deployed site, which is where the connection string is read from.

.PARAMETER SkipNames
    Leave the existing programme names alone.

.PARAMETER Plan
    Say what would change and stop.

.EXAMPLE
    .\23-release-data.ps1 -Plan
    What it would rewrite, and whether the release is whole.

.EXAMPLE
    .\23-release-data.ps1
    Rewrite the generated names and report.
#>
[CmdletBinding()]
param(
    [string] $SitePath,
    [switch] $SkipNames,
    [switch] $Plan
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$settings = Import-DeploySettings
$SitePath = Get-Setting $SitePath $settings 'SitePath' 'E:\inetpub\cbms'

$connectionString = Get-SqlConnectionString -SitePath $SitePath
$sqlcmdArgs = Get-SqlcmdArguments -ConnectionString $connectionString

Write-Host "`n=== Release data - 13 October 2026 ===`n" -ForegroundColor Cyan
Write-Host "  Site : $SitePath"
if ($Plan) { Write-Host "  Plan : nothing will be written" -ForegroundColor Yellow }

function Invoke-Sql {
    param([Parameter(Mandatory)] [string] $Query)

    $file = Join-Path $env:TEMP ("cbms-release-data-{0}.sql" -f ([guid]::NewGuid()))
    try {
        # A file rather than -Q: these statements carry quotes and line
        # breaks, and -I is needed anyway for the filtered indexes here.
        Set-PlainTextFile -Path $file -Content $Query
        $output = & sqlcmd @sqlcmdArgs '-I' '-i' $file 2>&1
        if ($LASTEXITCODE -ne 0) { throw "sqlcmd failed: $output" }

        # The comma keeps an empty result an empty array rather than null.
        return ,@($output | Where-Object { "$_".Trim() })
    }
    finally {
        Remove-Item $file -Force -ErrorAction SilentlyContinue
    }
}

function Read-One {
    <#
        The last line a query printed, or an empty string where it printed
        nothing - a table with no rows is an answer, not a null.
    #>
    param([Parameter(Mandatory)] [AllowNull()] [AllowEmptyCollection()] [string[]] $Lines)

    if (-not $Lines) { return '' }
    $last = $Lines | Where-Object { "$_".Trim() } | Select-Object -Last 1
    if (-not $last) { return '' }
    return "$last".Trim()
}

# --- is the schema here yet? ------------------------------------------------

# First, because everything below reads what this release adds. Running
# -Plan before the release is the ordinary way to use this script, and the
# database is the old one at that point: it should get an explanation
# rather than a SQL error.

$columns = Invoke-Sql @"
SET NOCOUNT ON;
SELECT CASE WHEN COL_LENGTH(t, c) IS NULL THEN 'MISSING  ' ELSE 'present  ' END + t + '.' + c
FROM (VALUES
    ('ProgramTypeEligibilityRoutes', 'QualificationCode'),
    ('Notifications', 'UserId'),
    ('Programmes', 'RequestedVenue'),
    ('Programmes', 'VenueChangeRequestedOn'),
    ('OptionSetItems', 'Description'),
    ('ProfileAttachments', 'EntryIndex')
) AS v(t, c);
"@

Write-Host "`n  Columns this release needs:" -ForegroundColor Cyan
$columns | ForEach-Object { Write-Host "    $_" }

if ($columns -match 'MISSING') {
    if ($Plan) {
        Write-Host "`n  The schema is still the old one, which is what -Plan before a release" -ForegroundColor Yellow
        Write-Host "  looks like. The release adds those; this step then tidies the programme" -ForegroundColor Yellow
        Write-Host "  names and reports whether everything arrived." -ForegroundColor Yellow
        Write-Host "`nNothing to plan until the migrations have run.`n" -ForegroundColor Yellow
        return
    }

    throw ("The schema is behind the code, so there is nothing here to write to. " +
           "Run the release, or windows\06-migrate.ps1, and then this again.")
}

# --- the generated programme names ------------------------------------------

# Matched against what the old rule would have produced for that batch's own
# programme type, so only a name nobody chose is rewritten. The duration is
# read from the type rather than assumed, because that is what composed it.
$nameMatch = @"
    p.ProgrammeName = CONCAT(t.DurationDays, '-Day ', t.Name, ' Training Program')
"@

if ($SkipNames) {
    Write-Host "`n  Programme names: left alone (-SkipNames)." -ForegroundColor Yellow
}
else {
    $pending = Invoke-Sql @"
SET NOCOUNT ON;
SELECT COUNT(*) FROM Programmes p
JOIN ProgramTypes t ON t.Id = p.ProgramTypeId
WHERE $nameMatch;
"@

    $count = [int](Read-One $pending)

    Write-Host "`n  Programme names still as generated: $count" -ForegroundColor Cyan

    if ($count -gt 0) {
        $sample = Invoke-Sql @"
SET NOCOUNT ON;
SELECT TOP 5 '    ' + p.ProgrammeId + '  ' + p.ProgrammeName + '   ->   ' + t.Name
FROM Programmes p
JOIN ProgramTypes t ON t.Id = p.ProgramTypeId
WHERE $nameMatch
ORDER BY p.Id;
"@
        $sample | ForEach-Object { Write-Host $_ }

        if ($Plan) {
            Write-Host "`n  Plan: those $count names would become the track's own name." -ForegroundColor Yellow
        }
        else {
            $null = Invoke-Sql @"
SET NOCOUNT ON;
UPDATE p SET p.ProgrammeName = t.Name
FROM Programmes p
JOIN ProgramTypes t ON t.Id = p.ProgramTypeId
WHERE $nameMatch;
"@
            Write-Host "  Rewritten: $count." -ForegroundColor Green
        }
    }
    else {
        Write-Host "  Nothing to rewrite." -ForegroundColor Green
    }
}

# --- did the rest of the release arrive? ------------------------------------

# Written by the application at startup rather than here, so this only reads.
# A missing row means the site has not been started since the release, or it
# failed on the way up.

$templates = Invoke-Sql @"
SET NOCOUNT ON;
SELECT CASE WHEN EXISTS (SELECT 1 FROM EmailTemplates WHERE [Key] = k)
            THEN 'present  ' ELSE 'MISSING  ' END + k
FROM (VALUES
    ('programme-permitted'),
    ('venue-change-requested'),
    ('venue-change-decided')
) AS v(k);
"@

Write-Host "`n  E-mail templates this release adds:" -ForegroundColor Cyan
$templates | ForEach-Object { Write-Host "    $_" }

$agencyKey = Invoke-Sql @"
SET NOCOUNT ON;
SELECT CASE WHEN EXISTS (
    SELECT 1 FROM RolePermissions rp
    JOIN AdminRoles r ON r.Id = rp.RoleId
    WHERE r.Code = 'AGENCY_ADMIN' AND rp.Permission = 'exams.view')
    THEN 'present  exams.view on the implementing agency role'
    ELSE 'MISSING  exams.view on the implementing agency role'
END;
"@

Write-Host "    $(Read-One $agencyKey)"

if (($templates -match 'MISSING') -or ((Read-One $agencyKey) -match 'MISSING')) {
    Write-Host "`n  Those are written when the application starts." -ForegroundColor Yellow
    Write-Host "  If the site has been up since the release and they are still missing," -ForegroundColor Yellow
    Write-Host "  the seeder did not finish: windows\09-diagnose.ps1" -ForegroundColor Yellow
}

Write-Host "`n=== Done ===`n" -ForegroundColor Green
