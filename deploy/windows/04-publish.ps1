<#
.SYNOPSIS
    Builds the API and the portal and publishes them into the site folder.

.DESCRIPTION
    The portal is built and dropped into the API's wwwroot, so one site serves
    both: the SPA at / and the API at /api, same origin, one certificate, no
    CORS between them.

    appsettings.Production.json and the uploaded files are left alone. The
    published folder is otherwise replaced, which is why neither of those may
    live inside it.

.PARAMETER SourcePath
    The checkout. Default E:\NDIE-Capacity-Building-main.

.PARAMETER SitePath
    Where the site runs from. Default E:\inetpub\cbms.

.EXAMPLE
    .\04-publish.ps1
    .\04-publish.ps1 -SourcePath E:\NDIE-Capacity-Building-main -SitePath E:\inetpub\cbms
#>
[CmdletBinding()]
param(
    [string] $SourcePath = 'E:\NDIE-Capacity-Building-main',
    [string] $SitePath = 'E:\inetpub\cbms',
    [switch] $SkipPortal
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$started = Get-Date


$apiProject = Join-Path $SourcePath 'backend\src\Ntms.Api\Ntms.Api.csproj'
$portalPath = Join-Path $SourcePath 'training-portal'
$stagingPath = Join-Path $env:TEMP ("cbms-publish-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))

foreach ($required in @($apiProject, $portalPath)) {
    if (-not (Test-Path $required)) { throw "Not found: $required. Check -SourcePath." }
}

Write-Host "`nBuilding from $SourcePath`n" -ForegroundColor Cyan

# --- API --------------------------------------------------------------------

Write-Host "  Publishing the API..." -ForegroundColor Gray
Invoke-Native 'dotnet publish' 'dotnet' @(
    'publish', $apiProject, '--configuration', 'Release', '--output', $stagingPath, '--nologo'
) | Out-Null
Write-Host "  [ok]  API published" -ForegroundColor Green

# --- Portal -----------------------------------------------------------------

if (-not $SkipPortal) {
    Push-Location $portalPath
    try {
        # npm writes node_modules\.package-lock.json when an install finishes,
        # so its presence means "an install completed" and its timestamp means
        # "against this lock file". Testing only for the file was not enough: a
        # release that pulls a new dependency leaves the marker in place, and
        # the build then runs against what was installed last time - which is
        # how 'Cannot find module xlsx' happens on a machine whose
        # package.json has asked for it since the pull.
        $installed = Join-Path $portalPath 'node_modules\.package-lock.json'
        $lockFile = Join-Path $portalPath 'package-lock.json'

        $needsInstall = -not (Test-Path $installed)
        if (-not $needsInstall -and (Test-Path $lockFile)) {
            $needsInstall = (Get-Item $lockFile).LastWriteTimeUtc -gt (Get-Item $installed).LastWriteTimeUtc
            if ($needsInstall) {
                Write-Host "  package-lock.json is newer than what is installed." -ForegroundColor Yellow
            }
        }

        if ($needsInstall) {
            Write-Host "  Installing portal dependencies..." -ForegroundColor Gray
            # ci, not install: it honours the lock file exactly, which is what a
            # release build should do. It also wants node_modules gone, and an
            # abandoned one from a previous attempt would otherwise stay.
            Invoke-Native 'npm ci' 'npm' @('ci', '--no-audit', '--no-fund') -Stream
        }

        Write-Host "  Building the portal..." -ForegroundColor Gray
        Invoke-Native 'ng build' 'npx' @('ng', 'build', '--configuration', 'production') -Stream
    }
    finally { Pop-Location }

    $dist = Join-Path $portalPath 'dist\training-portal\browser'
    if (-not (Test-Path $dist)) {
        $dist = Join-Path $portalPath 'dist\training-portal'
    }
    if (-not (Test-Path (Join-Path $dist 'index.html'))) {
        throw "Built the portal but found no index.html under $dist."
    }

    # Into wwwroot, which is what makes the API serve the SPA.
    $webRoot = Join-Path $stagingPath 'wwwroot'
    New-Item -ItemType Directory -Path $webRoot -Force | Out-Null
    Copy-Item -Path (Join-Path $dist '*') -Destination $webRoot -Recurse -Force
    Write-Host "  [ok]  Portal built into wwwroot" -ForegroundColor Green
}
else {
    Write-Host "  [skip] Portal (-SkipPortal)" -ForegroundColor Yellow
}

# --- Stop the site while files are replaced ---------------------------------

Import-Module WebAdministration -ErrorAction SilentlyContinue
$poolName = 'CbmsAppPool'
$poolWasRunning = $false

if (Test-Path "IIS:\AppPools\$poolName") {
    $poolWasRunning = (Get-WebAppPoolState -Name $poolName).Value -eq 'Started'
    if ($poolWasRunning) {
        Stop-WebAppPool -Name $poolName
        # The worker process keeps a lock on the DLLs for a moment after the
        # pool is told to stop.
        Start-Sleep -Seconds 3
        Write-Host "  [ok]  Stopped $poolName" -ForegroundColor Green
    }
}

# --- Swap in -----------------------------------------------------------------

try {
    if (-not (Test-Path $SitePath)) {
        New-Item -ItemType Directory -Path $SitePath -Force | Out-Null
    }

    # Everything except the configuration, which belongs to the environment and
    # not to the build.
    $keep = @('appsettings.Production.json')

    Get-ChildItem -Path $SitePath -Force |
    Where-Object { $keep -notcontains $_.Name } |
    Remove-Item -Recurse -Force -ErrorAction Stop

    Copy-Item -Path (Join-Path $stagingPath '*') -Destination $SitePath -Recurse -Force

    # The published appsettings.json ships blank on purpose; the Production
    # overlay is what supplies the real values, so it must survive the copy.
    if (-not (Test-Path (Join-Path $SitePath 'appsettings.Production.json'))) {
        Write-Host "  [warn] No appsettings.Production.json — run 03-configure.ps1" -ForegroundColor Yellow
    }

    Write-Host "  [ok]  Deployed to $SitePath" -ForegroundColor Green
}
finally {
    if ($poolWasRunning) {
        Start-WebAppPool -Name $poolName
        Write-Host "  [ok]  Started $poolName" -ForegroundColor Green
    }
    Remove-Item -Path $stagingPath -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ("`nDone in {0:n0}s. Next: .\05-install-iis.ps1 (first time) or .\06-migrate.ps1`n" -f `
    ((Get-Date) - $started).TotalSeconds) -ForegroundColor Green
