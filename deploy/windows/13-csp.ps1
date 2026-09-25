<#
.SYNOPSIS
    Turns the Content-Security-Policy on, reads the reports, and enforces it.

.DESCRIPTION
    A CSP does not fail loudly. Too tight, and the portal still loads — one
    screen is simply missing its chart, and the reason is a line in a console
    nobody has open. So this does it in the order that finds that out safely:

        .\13-csp.ps1                 report only: the browser reports what the
                                     policy would have blocked, and blocks
                                     nothing
        .\13-csp.ps1 -Reports        what it has collected
        .\13-csp.ps1 -Enforce        once the reports are quiet
        .\13-csp.ps1 -Off            back to no policy at all

    Leave it reporting for a few days of ordinary use, and make sure somebody
    walks the screens that are rarely opened — the certificate preview, the
    dashboard map, an uploaded logo — because a policy is only tested by the
    pages somebody actually loads.

    Each run rewrites Site:ContentSecurityPolicy in appsettings.Production.json,
    recycles the app pool, and then asks the live site what header it is sending
    so the answer comes from the server rather than from this script's
    intentions.

.PARAMETER Policy
    Override the policy itself. Rarely wanted: the default is measured against
    the built portal. Whatever is set here is what is sent, verbatim.

.EXAMPLE
    .\13-csp.ps1
    .\13-csp.ps1 -Reports
    .\13-csp.ps1 -Enforce
#>
[CmdletBinding()]
param(
    [string] $SitePath,
    [string] $StorageRoot,
    [string] $BaseUrl,
    [string] $PoolName,
    [string] $Policy,
    [switch] $Enforce,
    [switch] $Off,
    [switch] $Reports
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$settings    = Import-DeploySettings
$SitePath    = Get-Setting $SitePath    $settings 'SitePath'    'E:\inetpub\cbms'
$StorageRoot = Get-Setting $StorageRoot $settings 'StorageRoot' 'E:\cbms-data'
$BaseUrl     = Get-Setting $BaseUrl     $settings 'BaseUrl'     'https://localhost'
$PoolName    = Get-Setting $PoolName    $settings 'PoolName'    'CbmsAppPool'

$reportFile = Join-Path $StorageRoot 'csp-reports.log'

# --- reading the reports ----------------------------------------------------

if ($Reports) {
    if (-not (Test-Path $reportFile)) {
        Write-Host "`nNothing reported.`n" -ForegroundColor Green
        Write-Host "Either the policy fits, or nobody has loaded the site since it went on."
        Write-Host "Check the second before believing the first: $reportFile does not exist.`n"
        return
    }

    $lines = @(Get-Content $reportFile)
    Write-Host "`n$($lines.Count) report(s) in $reportFile`n" -ForegroundColor Cyan

    # What was blocked and by which rule is the whole of the question; the rest
    # of the report is the page it happened on, which repeats.
    $summary = $lines | ForEach-Object {
        $directive = if ($_ -match '"(?:effective-)?violated-directive"\s*:\s*"([^"]+)"') { $Matches[1] } else { '?' }
        $blocked   = if ($_ -match '"blocked-uri"\s*:\s*"([^"]*)"') { $Matches[1] } else { '?' }
        [pscustomobject]@{ Directive = $directive; Blocked = $blocked }
    } | Group-Object Directive, Blocked | Sort-Object Count -Descending

    $summary | ForEach-Object {
        $parts = $_.Name -split ', ', 2
        Write-Host ("  {0,5}  {1,-28} {2}" -f $_.Count, $parts[0], $parts[1])
    }

    Write-Host "`nEach line is something the policy would have blocked." -ForegroundColor Yellow
    Write-Host "Nothing here means it is safe to enforce:  .\13-csp.ps1 -Enforce`n"
    return
}

Assert-Elevated 'Changing the policy'
Import-Module WebAdministration

$configPath = Join-Path $SitePath 'appsettings.Production.json'
if (-not (Test-Path $configPath)) { throw "No $configPath. Run 03-configure.ps1 first." }

$config = Get-Content $configPath -Raw | ConvertFrom-Json

# The section may not exist on a site configured before this script did.
if (-not $config.PSObject.Properties['Site']) {
    $config | Add-Member -NotePropertyName Site -NotePropertyValue ([pscustomobject]@{})
}

$csp = [ordered]@{
    Enabled    = -not $Off
    ReportOnly = -not $Enforce
}
if ($Policy) { $csp.Policy = $Policy }

if ($config.Site.PSObject.Properties['ContentSecurityPolicy']) {
    $config.Site.ContentSecurityPolicy = [pscustomobject] $csp
}
else {
    $config.Site | Add-Member -NotePropertyName ContentSecurityPolicy -NotePropertyValue ([pscustomobject] $csp)
}

$state = if ($Off) { 'off' } elseif ($Enforce) { 'enforcing' } else { 'report-only' }
Write-Host "`nSetting the content security policy to $state`n" -ForegroundColor Cyan

# UTF-8 without a mark: the configuration reader copes with one, and every other
# file this deployment writes is written the same way.
Set-PlainTextFile -Path $configPath -Content ($config | ConvertTo-Json -Depth 12)
Write-Host "  [ok]  $configPath" -ForegroundColor Green

Restart-WebAppPool -Name $PoolName
Write-Host "  [ok]  $PoolName recycled" -ForegroundColor Green

# --- what the server actually sends -----------------------------------------

Start-Sleep -Seconds 6

[Net.ServicePointManager]::SecurityProtocol =
    [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

try {
    $response = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -TimeoutSec 30
}
catch {
    throw "The site did not answer on $BaseUrl after the recycle: $($_.Exception.Message)"
}

$sent = $response.Headers['Content-Security-Policy']
$sentReportOnly = $response.Headers['Content-Security-Policy-Report-Only']

Write-Host ''
if ($Off) {
    if (-not $sent -and -not $sentReportOnly) { Write-Host "  [ok]  no policy is being sent" -ForegroundColor Green }
    else { Write-Host "  [!!]  a policy is still being sent; check $configPath" -ForegroundColor Red }
}
elseif ($Enforce) {
    if ($sent) {
        Write-Host "  [ok]  enforcing:" -ForegroundColor Green
        Write-Host "        $sent" -ForegroundColor DarkGray
    }
    else { Write-Host "  [!!]  expected an enforcing header and did not get one" -ForegroundColor Red }
}
else {
    if ($sentReportOnly) {
        Write-Host "  [ok]  reporting only, blocking nothing:" -ForegroundColor Green
        Write-Host "        $sentReportOnly" -ForegroundColor DarkGray
    }
    else { Write-Host "  [!!]  expected a report-only header and did not get one" -ForegroundColor Red }
}

Write-Host ''
if (-not $Off -and -not $Enforce) {
    Write-Host "Leave it like this for a few days of ordinary use." -ForegroundColor Cyan
    Write-Host "Walk the screens nobody opens often — the certificate preview, the dashboard"
    Write-Host "map, a programme with an uploaded logo — because a policy is only tested by"
    Write-Host "the pages somebody loads. Then:"
    Write-Host "`n  .\13-csp.ps1 -Reports     # what it would have blocked"
    Write-Host "  .\13-csp.ps1 -Enforce     # when that is empty`n"
}
elseif ($Enforce) {
    Write-Host "Load the portal and click through it once more." -ForegroundColor Cyan
    Write-Host "If anything is missing, .\13-csp.ps1 puts it back to reporting.`n"
}
