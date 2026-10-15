<#
.SYNOPSIS
    Runs a load profile against staging and says whether it passed.

.DESCRIPTION
    Puts a crowd on the site and reports what it cost, against thresholds
    written into the scripts rather than numbers to squint at afterwards:
    k6 exits non-zero when a threshold is missed, so this either passes or
    tells you which one did not.

    Three profiles:

      smoke   25 callers for a minute. Proves the script, the accounts and
              the target are right. Run this first, every time - a mistake
              found by 25 callers costs a minute, and the same mistake
              found by a thousand costs an afternoon of somebody else's
              staging.

      load    The question asked: a thousand callers, ramped over two
              minutes and held for ten.

      soak    Four hundred callers for an hour. Finds what a ten-minute
              run cannot - a connection pool leaking, memory climbing,
              a cache that never evicts.

      spike   Nine o'clock: nothing, then a thousand in thirty seconds.
              Load says whether the system can carry a crowd; spike says
              whether it survives one arriving at once.

    Nothing here writes to the site. The scripts read; they do not create
    programmes, submit profiles or upload photographs. A load test that
    leaves data behind is one somebody has to clean up before the site is
    usable again.

.PARAMETER Profile
    smoke, load, soak or spike.

.PARAMETER Journey
    portal or applicant. The applicant journey is the one that matters at
    a thousand: officers are a few hundred, applicants are everybody.

.PARAMETER BaseUrl
    Where to point. Defaults to staging, and refuses anything that is not
    staging or localhost unless -IKnowThisIsNotStaging is given.

.PARAMETER Accounts
    The CSV of sign-ins, one `id,password` per line. See README.md - the
    API counts its rate limit per account, so a thousand callers sharing
    one login measures the limiter rather than the system.

.EXAMPLE
    .\run.ps1 -Profile smoke -Journey portal
    .\run.ps1 -Profile load -Journey applicant
#>
[CmdletBinding()]
param(
    [ValidateSet('smoke', 'load', 'soak', 'spike')]
    [string] $Profile = 'smoke',

    [ValidateSet('portal', 'applicant')]
    [string] $Journey = 'portal',

    [string] $BaseUrl = 'https://leanstaging.qci.org.in',

    [string] $Accounts,

    [string] $OutDir = (Join-Path $PSScriptRoot 'results'),

    [switch] $IKnowThisIsNotStaging
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------- the target

# A load test pointed at the wrong host is an outage somebody else has to
# explain. Staging and localhost are allowed; anything else has to be said
# out loud.
$allowed = @('leanstaging.qci.org.in', 'localhost', '127.0.0.1')
$host_ = ([Uri] $BaseUrl).Host

if ($allowed -notcontains $host_ -and -not $IKnowThisIsNotStaging) {
    throw "Refusing to load '$host_'. Staging is leanstaging.qci.org.in. " +
          "If this really is a test target, pass -IKnowThisIsNotStaging."
}

# ------------------------------------------------------------------- k6

$k6 = Get-Command k6 -ErrorAction SilentlyContinue

if (-not $k6) {
    $local = Join-Path $PSScriptRoot 'k6\k6.exe'
    if (Test-Path $local) {
        $k6 = $local
    }
    else {
        Write-Host 'k6 is not installed. Fetching it into deploy\load\k6 ...' -ForegroundColor Cyan

        $version = 'v0.49.0'
        $zip = Join-Path $env:TEMP "k6-$version.zip"
        $url = "https://github.com/grafana/k6/releases/download/$version/k6-$version-windows-amd64.zip"

        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
        $unpacked = Join-Path $env:TEMP "k6-$version"
        if (Test-Path $unpacked) { Remove-Item $unpacked -Recurse -Force }
        Expand-Archive -Path $zip -DestinationPath $unpacked -Force

        $found = Get-ChildItem $unpacked -Recurse -Filter 'k6.exe' | Select-Object -First 1
        if (-not $found) { throw "k6.exe was not in the archive at $url." }

        New-Item -ItemType Directory -Force (Join-Path $PSScriptRoot 'k6') | Out-Null
        Copy-Item $found.FullName $local -Force
        Remove-Item $zip, $unpacked -Recurse -Force -ErrorAction SilentlyContinue

        $k6 = $local
    }
}

$k6Path = if ($k6 -is [string]) { $k6 } else { $k6.Source }

# -------------------------------------------------------------- the accounts

if (-not $Accounts) {
    $Accounts = Join-Path $PSScriptRoot "accounts-$Journey.csv"
}

if (-not (Test-Path $Accounts)) {
    throw "No accounts file at $Accounts. See deploy\load\README.md: the API " +
          "counts its rate limit per signed-in account, so the callers need " +
          "one each or the run measures the limiter."
}

$lines = @(Get-Content $Accounts | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') })
if ($lines.Count -eq 0) { throw "$Accounts has no accounts in it." }

# ------------------------------------------------------------- the profiles

$shape = switch ($Profile) {
    'smoke' { @{ Users = 25;   Ramp = '10s'; Hold = '1m';  Think = 1 } }
    'load'  { @{ Users = 1000; Ramp = '2m';  Hold = '10m'; Think = 2 } }
    'soak'  { @{ Users = 400;  Ramp = '3m';  Hold = '60m'; Think = 3 } }
    'spike' { @{ Users = 1000; Ramp = '30s'; Hold = '3m';  Think = 1 } }
}

if ($lines.Count -lt [Math]::Min($shape.Users, 50)) {
    Write-Host ''
    Write-Host "  Only $($lines.Count) account(s) for $($shape.Users) callers." -ForegroundColor Yellow
    Write-Host '  They will be shared round. Each one gets 600 requests a minute' -ForegroundColor Yellow
    Write-Host '  before the limiter refuses it, so a short account list shows up' -ForegroundColor Yellow
    Write-Host '  as 429s rather than as anything about the system.' -ForegroundColor Yellow
    Write-Host ''
}

New-Item -ItemType Directory -Force $OutDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$summary = Join-Path $OutDir "$Journey-$Profile-$stamp.json"

Write-Host ''
Write-Host "  $Journey, $Profile" -ForegroundColor Cyan
Write-Host "  $($shape.Users) callers, ramped over $($shape.Ramp), held $($shape.Hold)"
Write-Host "  against $BaseUrl"
Write-Host "  with $($lines.Count) account(s) from $(Split-Path -Leaf $Accounts)"
Write-Host ''

$script = Join-Path $PSScriptRoot "$Journey.js"

& $k6Path run `
    --summary-export $summary `
    -e BASE_URL=$BaseUrl `
    -e ACCOUNTS=$Accounts `
    -e USERS=$($shape.Users) `
    -e RAMP=$($shape.Ramp) `
    -e HOLD=$($shape.Hold) `
    -e THINK_SECONDS=$($shape.Think) `
    $script

$passed = $LASTEXITCODE -eq 0

Write-Host ''
if ($passed) {
    Write-Host '  Every threshold held.' -ForegroundColor Green
}
else {
    Write-Host '  A threshold was missed - the lines marked with a cross above' -ForegroundColor Red
    Write-Host '  say which. That is the finding; the rest is detail.' -ForegroundColor Red
}
Write-Host "  Summary written to $summary"
Write-Host ''

exit $LASTEXITCODE
