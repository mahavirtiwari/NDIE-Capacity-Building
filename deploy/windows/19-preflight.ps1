<#
.SYNOPSIS
    Checks the server is fit to be production. Changes nothing.

.DESCRIPTION
    A staging box and a production box are the same scripts with different
    settings, which is convenient right up to the day one is mistaken for the
    other. This reads the deployment as it stands and reports the differences
    that matter — sample data seeded on a live site, a signing key left at its
    development value, a backup nobody scheduled, the uploaded files sitting
    inside the folder every release empties.

    Every check says what it found and what to do about it. Nothing is altered:
    read the output, then run the script it names.

.EXAMPLE
    .\19-preflight.ps1
#>
[CmdletBinding()]
param(
    [string] $SitePath,
    [string] $StorageRoot,
    [string] $BackupRoot,
    [string] $BaseUrl,
    [string] $SiteName
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$settings    = Import-DeploySettings
$SitePath    = Get-Setting $SitePath    $settings 'SitePath'    'E:\inetpub\cbms'
$StorageRoot = Get-Setting $StorageRoot $settings 'StorageRoot' 'E:\cbms-data'
$BackupRoot  = Get-Setting $BackupRoot  $settings 'BackupRoot'  'E:\cbms-backups'
$BaseUrl     = Get-Setting $BaseUrl     $settings 'BaseUrl'     'https://localhost'
$SiteName    = Get-Setting $SiteName    $settings 'SiteName'    'CBMS'

$problems = 0
$warnings = 0

function Report {
    param(
        [Parameter(Mandatory)] [ValidateSet('ok', 'warn', 'fail')] [string] $Verdict,
        [Parameter(Mandatory)] [string] $What,
        [string] $Detail,
        [string] $Fix
    )

    switch ($Verdict) {
        'ok'   { Write-Host "  [ok]   $What" -ForegroundColor Green }
        'warn' { Write-Host "  [warn] $What" -ForegroundColor Yellow; $script:warnings++ }
        'fail' { Write-Host "  [FAIL] $What" -ForegroundColor Red;    $script:problems++ }
    }
    if ($Detail) { Write-Host "         $Detail" -ForegroundColor DarkGray }
    if ($Fix -and $Verdict -ne 'ok') { Write-Host "         -> $Fix" -ForegroundColor Cyan }
}

Write-Host "`n=== Production preflight ===`n" -ForegroundColor Cyan

# --- configuration ----------------------------------------------------------

$configPath = Join-Path $SitePath 'appsettings.Production.json'
if (-not (Test-Path $configPath)) {
    Report fail 'No appsettings.Production.json' $configPath '.\03-configure.ps1'
}
else {
    $config = Get-Content $configPath -Raw | ConvertFrom-Json

    $seed = $config.Database.SeedSampleData
    if ($seed) {
        Report fail 'Sample data is switched on' 'Database:SeedSampleData is true' `
            'Set it to false. Sample categories and programme types on a live site are indistinguishable from real ones.'
    }
    else { Report ok 'Sample data is off' }

    $migrate = $config.Database.MigrateOnStartup
    if ($migrate) {
        Report warn 'Migrations run at startup' 'Database:MigrateOnStartup is true' `
            'Set it to false and apply them with .\06-migrate.ps1. An app-pool recycle should never alter a schema, and two starts at once race each other.'
    }
    else { Report ok 'Migrations are applied deliberately, not on boot' }

    $key = [string] $config.Jwt.SigningKey
    if (-not $key) {
        Report fail 'No JWT signing key' '' '.\03-configure.ps1 -NewSigningKey'
    }
    elseif ($key -match 'dev|change|example|sample' -or $key.Length -lt 32) {
        Report fail 'The JWT signing key looks like a placeholder' `
            "$($key.Length) characters" `
            '.\03-configure.ps1 -NewSigningKey  (every token ever issued becomes invalid, so everyone signs in again)'
    }
    else { Report ok "JWT signing key is $($key.Length) characters" }

    $connection = [string] $config.ConnectionStrings.Default
    if ($connection -match 'Password\s*=' -and $connection -notmatch 'Encrypt\s*=\s*True') {
        Report warn 'The database password travels unencrypted' '' `
            'Add Encrypt=True to the connection string.'
    }

    if ($config.Email.Enabled) { Report ok 'Email is configured and on' }
    else {
        Report warn 'Email is off' 'Email:Enabled is false' `
            'Nobody gets their credentials, their OTP or a result notification until this is on. Set it up on the Email screen.'
    }

    $csp = $config.Site.ContentSecurityPolicy
    if (-not $csp -or -not $csp.Enabled) {
        Report warn 'No content security policy' 'Site:ContentSecurityPolicy is off' `
            'Run 13-csp.ps1 — it starts in report-only, which blocks nothing.'
    }
    elseif ($csp.ReportOnly) {
        Report warn 'The policy is reporting, not enforcing' '' `
            'Run 13-csp.ps1 -Reports, then -Enforce once that is empty.'
    }
    else { Report ok 'Content security policy is enforced' }

    if ($config.Site.DiscourageSearchEngines) {
        Report warn 'The site asks search engines to stay away' 'Site:DiscourageSearchEngines is true' `
            'Right for staging, wrong for the live site: set it to false so the public pages can be found.'
    }
    else { Report ok 'Search engines are allowed' }
}

# --- layout -----------------------------------------------------------------

if ($StorageRoot.TrimEnd('\').StartsWith($SitePath.TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase)) {
    Report fail 'Uploaded files live inside the site folder' "$StorageRoot is under $SitePath" `
        'Every release empties the site folder. Move the data and re-run .\03-configure.ps1.'
}
else { Report ok 'Uploaded files are outside the site folder' }

foreach ($folder in @($StorageRoot, $BackupRoot)) {
    if (-not (Test-Path $folder)) {
        Report warn "$folder does not exist yet" '' 'It is created on first use; nothing to do if that is expected.'
    }
}

$drive = Get-PSDrive -Name ($SitePath.Substring(0, 1)) -ErrorAction SilentlyContinue
if ($drive) {
    $freeGb = [math]::Round($drive.Free / 1GB, 1)
    if ($freeGb -lt 10) {
        Report fail "$freeGb GB free on $($drive.Name):" '' `
            'A release copies the whole site before replacing it, and a backup writes the whole database. Both fail late and messily when the disc is full.'
    }
    elseif ($freeGb -lt 25) { Report warn "$freeGb GB free on $($drive.Name):" }
    else { Report ok "$freeGb GB free on $($drive.Name):" }
}

# --- backups ----------------------------------------------------------------
#
# Scheduled or by hand is a decision, not a defect, so this reports what it
# finds rather than insisting on the scheduled task. What it will not let pass
# quietly is a production database with no recent backup by any means.

$anywhere = @(
    (Join-Path $BackupRoot 'database'), $BackupRoot
) | Where-Object { Test-Path $_ } | ForEach-Object {
    Get-ChildItem $_ -Filter '*.bak' -ErrorAction SilentlyContinue
}

$latest = $anywhere | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$task = Get-ScheduledTask -TaskName 'CBMS nightly backup' -ErrorAction SilentlyContinue

if ($task) {
    $info = Get-ScheduledTaskInfo -TaskName 'CBMS nightly backup'
    if ($info.LastRunTime -and $info.LastRunTime -gt (Get-Date).AddDays(-2) -and $info.LastTaskResult -eq 0) {
        Report ok ("Nightly backup ran {0:dd MMM HH:mm}" -f $info.LastRunTime)
    }
    elseif (-not $info.LastRunTime) {
        Report warn 'The backup task is registered but has never run' '' `
            "Start-ScheduledTask -TaskName 'CBMS nightly backup'"
    }
    else {
        Report warn ("The scheduled backup last ran {0:dd MMM HH:mm} and returned {1}" -f
            $info.LastRunTime, $info.LastTaskResult) '' "Check $BackupRoot\logs."
    }
}

if ($latest) {
    $age = ((Get-Date) - $latest.LastWriteTime).TotalHours
    $where = Split-Path $latest.FullName -Parent

    if ($age -gt 48) {
        Report fail ("The newest backup is {0:n0} hours old" -f $age) "$($latest.Name) in $where" `
            'Take one before releasing. A release applies migrations, and the backup is what makes that reversible.'
    }
    else {
        Report ok ("Newest backup {0:dd MMM HH:mm}, {1} MB" -f $latest.LastWriteTime,
            [math]::Round($latest.Length / 1MB, 1))
    }
}
elseif (-not $task) {
    Report fail 'No backups, scheduled or otherwise' "Nothing in $BackupRoot" `
        'Take one by hand before releasing, or run .\12-schedule-backups.ps1 to have it done nightly.'
}

if ($BackupRoot.Substring(0, 1) -eq $SitePath.Substring(0, 1)) {
    Report warn 'Backups are on the same disc as the site' $BackupRoot `
        'That survives a mistake, not a disc. Copy them off this machine as well.'
}

# --- the site ---------------------------------------------------------------

Import-Module WebAdministration -ErrorAction SilentlyContinue
if (Get-Module WebAdministration) {
    $site = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
    if (-not $site) { Report fail "No IIS site called $SiteName" '' '.\05-install-iis.ps1' }
    else {
        if ($site.State -eq 'Started') { Report ok "$SiteName is running" }
        else { Report fail "$SiteName is $($site.State)" '' "Start-Website -Name $SiteName" }

        $https = @(Get-WebBinding -Name $SiteName | Where-Object { $_.protocol -eq 'https' })
        if ($https.Count -eq 0) {
            Report fail 'No HTTPS binding' '' '.\05-install-iis.ps1 -PfxPath <certificate>'
        }
        else { Report ok "HTTPS bound ($($https.Count) binding(s))" }
    }
}
else {
    # Said rather than skipped: a silent pass on the web server's own checks is
    # indistinguishable from a pass, and this is the box that serves requests.
    Report warn 'IIS could not be inspected' 'The WebAdministration module is not on this machine' `
        'Expected on a database-only server. On the web server, install the IIS management tools — .\01-prerequisites.ps1 lists them.'
}

Write-Host ''
if ($problems -gt 0) {
    Write-Host "$problems thing(s) to fix, $warnings to think about.`n" -ForegroundColor Red
    exit 1
}
if ($warnings -gt 0) {
    Write-Host "Nothing blocking. $warnings thing(s) worth a look.`n" -ForegroundColor Yellow
    exit 0
}
Write-Host "Ready.`n" -ForegroundColor Green
