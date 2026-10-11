<#
.SYNOPSIS
    The data this release needs that a migration cannot write.

.DESCRIPTION
    A migration adds the column. It cannot decide what belongs in it, and it
    must not overwrite what somebody has already put there — so the two
    things below are a step of their own, run after the site is up and safe
    to run twice.

    What it does, and why each one is here rather than in a migration:

      * The "Program schedule" e-mail. The shipped wording now carries the
        timings, the agency, the coordinator's telephone and e-mail, and a
        line about the attached PDF. Templates are seeded only when the key
        is missing, so a database that already has the row keeps the old
        wording for ever. This drops the row — and only when it is still
        the previous shipped text, untouched — so the next start writes the
        current one. An edited template is left exactly as it is and said
        out loud, because somebody chose those words.

      * Support and About. The applicant app offers Support only where a
        page has been given, and About reads whatever the department wrote.
        Both live on the branding record, which is the Super Admin's: this
        fills them in only where they are empty, so a later edit in the
        portal is never undone by a release.

    Nothing here touches a row somebody has already written to. Run it as
    often as you like; the second run reports that there is nothing to do.

.PARAMETER SitePath
    The deployed site, which is where the connection string is read from.
    Taken from the deploy settings.

.PARAMETER SupportUrl
    Where Support goes in the applicant app, if nothing has been set yet.

.PARAMETER Plan
    Say what would change and stop.

.EXAMPLE
    .\22-release-data.ps1
    Refresh the schedule e-mail and fill in Support and About if they are empty.

.EXAMPLE
    .\22-release-data.ps1 -Plan
    What the above would do.
#>
[CmdletBinding()]
param(
    [string] $SitePath,
    [string] $PoolName,
    [string] $SupportUrl = 'https://ndie.qcin.org/contact-us/',
    [switch] $Plan
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$settings = Import-DeploySettings
$SitePath = Get-Setting $SitePath $settings 'SitePath' 'E:\inetpub\cbms'
$PoolName = Get-Setting $PoolName $settings 'PoolName' 'CbmsAppPool'

$connectionString = Get-SqlConnectionString -SitePath $SitePath
$sqlcmdArgs = Get-SqlcmdArguments -ConnectionString $connectionString

Write-Host "`n=== Release data ===`n" -ForegroundColor Cyan
Write-Host "  Site : $SitePath"
Write-Host "  Pool : $PoolName"
if ($Plan) { Write-Host "  Plan : nothing will be written" -ForegroundColor Yellow }

function Invoke-Sql {
    param([Parameter(Mandatory)] [string] $Query)

    $file = Join-Path $env:TEMP ("cbms-release-data-{0}.sql" -f ([guid]::NewGuid()))
    try {
        # Written to a file rather than passed with -Q: the statements below
        # carry quotes and line breaks, and -I is needed anyway for the
        # filtered indexes in this schema.
        Set-PlainTextFile -Path $file -Content $Query
        $output = & sqlcmd @sqlcmdArgs '-I' '-i' $file 2>&1
        if ($LASTEXITCODE -ne 0) { throw "sqlcmd failed: $output" }

        # The comma keeps an empty result an empty array rather than null:
        # a query that found nothing is an answer, and the caller should be
        # able to count it instead of tripping over it.
        return ,@($output | Where-Object { "$_".Trim() })
    }
    finally {
        Remove-Item $file -Force -ErrorAction SilentlyContinue
    }
}

function Read-One {
    <#
        The last line a query printed, or an empty string where it printed
        nothing. A table with no row in it is a real answer — a database
        built from the release script alone has no branding row until the
        application has started once — and it must not come back as null
        for the next line to call .Trim() on.
    #>
    param([Parameter(Mandatory)] [AllowNull()] [AllowEmptyCollection()] [string[]] $Lines)

    if (-not $Lines) { return '' }

    $last = $Lines | Where-Object { "$_".Trim() } | Select-Object -Last 1
    if (-not $last) { return '' }
    return "$last".Trim()
}

# --- is the schema here yet? ------------------------------------------------

# First, because everything below reads columns this release adds. Running
# -Plan before the release is the ordinary way to use this script, and at
# that point the database is still the old one: asking it for SupportUrl
# got a SQL error where it should have got an explanation.

$columns = Invoke-Sql @"
SET NOCOUNT ON;
SELECT CASE WHEN COL_LENGTH(t, c) IS NULL THEN 'MISSING  ' ELSE 'present  ' END + t + '.' + c
FROM (VALUES
    ('Applications', 'ProgrammeId'),
    ('Applicants', 'PendingEmail'),
    ('CurriculumSessions', 'StartTime'),
    ('CurriculumSessions', 'EndTime'),
    ('BrandingSettings', 'SupportUrl'),
    ('BrandingSettings', 'AboutText')
) AS v(t, c);
"@

Write-Host "`n  Columns this release needs:" -ForegroundColor Cyan
$columns | ForEach-Object { Write-Host "    $_" }

if ($columns -match 'MISSING') {
    if ($Plan) {
        Write-Host "`n  The schema is still the old one, which is what -Plan before a release" -ForegroundColor Yellow
        Write-Host "  looks like. The release adds those columns; this step then refreshes the" -ForegroundColor Yellow
        Write-Host "  schedule e-mail and fills in Support and About where they are empty." -ForegroundColor Yellow
        Write-Host "`nNothing to plan until the migrations have run.`n" -ForegroundColor Yellow
        return
    }

    throw ("The schema is behind the code, so there is nothing here to write to. " +
           "Run the release, or windows\06-migrate.ps1, and then this again.")
}

# --- the schedule e-mail ----------------------------------------------------

# The first line of the previous shipped wording. A row still carrying it has
# not been edited, and is safe to replace with what ships now; a row without
# it has either been reworded by an administrator or is already current.
$oldMarker = '<p>You are enrolled in <strong>{{programmeName}}</strong>'

$state = Invoke-Sql @"
SET NOCOUNT ON;
SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE [Key] = 'programme-schedule')
        THEN 'absent'
    WHEN EXISTS (SELECT 1 FROM EmailTemplates
                 WHERE [Key] = 'programme-schedule'
                   AND HtmlBody LIKE '%{{coordinatorName}}%')
        THEN 'current'
    WHEN EXISTS (SELECT 1 FROM EmailTemplates
                 WHERE [Key] = 'programme-schedule'
                   AND HtmlBody LIKE '%$oldMarker%')
        THEN 'shipped-old'
    ELSE 'edited'
END;
"@

$schedule = Read-One $state

switch ($schedule) {
    'current' {
        Write-Host "`n  Schedule e-mail: already carries the coordinator's details." -ForegroundColor Green
    }
    'absent' {
        Write-Host "`n  Schedule e-mail: no row, so the site already uses the shipped wording." -ForegroundColor Green
    }
    'edited' {
        Write-Host "`n  Schedule e-mail: this template has been reworded in the portal." -ForegroundColor Yellow
        Write-Host "    Left alone. To pick up the new lines, add these where you want them:"
        Write-Host "      {{timing}}, {{agencyName}}, {{coordinatorName}}, {{coordinatorMobile}}, {{coordinatorEmail}}"
        Write-Host "    Administration -> Email -> Program schedule."
    }
    'shipped-old' {
        if ($Plan) {
            Write-Host "`n  Schedule e-mail: would be reset to the shipped wording." -ForegroundColor Yellow
        }
        else {
            Invoke-Sql "SET NOCOUNT ON; DELETE FROM EmailTemplates WHERE [Key] = 'programme-schedule';" | Out-Null

            # The row is written again by the seeder the next time the
            # application starts, which is what the recycle is for.
            Set-PoolState -PoolName $PoolName -State 'Stopped'
            Start-Sleep -Seconds 2
            Set-PoolState -PoolName $PoolName -State 'Started'

            Write-Host "`n  Schedule e-mail: reset to the shipped wording, pool recycled." -ForegroundColor Green
        }
    }
    default {
        Write-Host "`n  Schedule e-mail: could not read its state ('$schedule'). Left alone." -ForegroundColor Yellow
    }
}

# --- Support and About ------------------------------------------------------

$about = @'
The Capacity Building Management System is how we run training and
certification: the programs on offer, the agencies that deliver them, the
people who attend, and the certificates they earn.

You use it to fill in your profile once for a discipline, register for the
programs open to you, sit the written paper, and collect the certificate
afterwards. Everything you send in and everything issued to you stays here,
under Applications and Programs.
'@

$branding = Invoke-Sql @"
SET NOCOUNT ON;
SELECT
    CASE WHEN NULLIF(LTRIM(RTRIM(ISNULL(SupportUrl, ''))), '') IS NULL
         THEN 'empty' ELSE 'set' END
  + ' | '
  + CASE WHEN NULLIF(LTRIM(RTRIM(ISNULL(AboutText, ''))), '') IS NULL
         THEN 'empty' ELSE 'set' END
FROM BrandingSettings WHERE Id = 1;
"@

$read = Read-One $branding
$supportState, $aboutState = $read -split '\s*\|\s*'

# No branding row at all, which happens on a database the application has
# never started against. The row is written on first run; there is nothing
# here to fill in until then.
if (-not $read) {
    Write-Host "`n  Support link and About text: there is no branding row yet." -ForegroundColor Yellow
    Write-Host "    It is written the first time the site starts. Run this again afterwards."
    Write-Host "`nDone.`n" -ForegroundColor Green
    return
}

if ($supportState -eq 'set') {
    Write-Host "`n  Support link: already set. Left alone." -ForegroundColor Green
}
elseif ($Plan) {
    Write-Host "`n  Support link: would be set to $SupportUrl" -ForegroundColor Yellow
}
else {
    Invoke-Sql @"
SET NOCOUNT ON;
UPDATE BrandingSettings
   SET SupportUrl = '$($SupportUrl -replace "'", "''")',
       ModifiedOn = SYSUTCDATETIME(),
       ModifiedBy = 'Release'
 WHERE Id = 1 AND NULLIF(LTRIM(RTRIM(ISNULL(SupportUrl, ''))), '') IS NULL;
"@ | Out-Null
    Write-Host "`n  Support link: set to $SupportUrl" -ForegroundColor Green
}

if ($aboutState -eq 'set') {
    Write-Host "  About text  : already written. Left alone." -ForegroundColor Green
}
elseif ($Plan) {
    Write-Host "  About text  : would be filled in with the shipped wording." -ForegroundColor Yellow
}
else {
    Invoke-Sql @"
SET NOCOUNT ON;
UPDATE BrandingSettings
   SET AboutText = '$($about -replace "'", "''")',
       ModifiedOn = SYSUTCDATETIME(),
       ModifiedBy = 'Release'
 WHERE Id = 1 AND NULLIF(LTRIM(RTRIM(ISNULL(AboutText, ''))), '') IS NULL;
"@ | Out-Null
    Write-Host "  About text  : filled in. Reword it under Settings -> Branding." -ForegroundColor Green
}

Write-Host "`nDone.`n" -ForegroundColor Green
