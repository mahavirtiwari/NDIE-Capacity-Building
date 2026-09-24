<#
.SYNOPSIS
    Redeploys after a code change. The routine one.

.DESCRIPTION
    Publish, migrate, verify. The first-time steps — prerequisites, database,
    configuration, IIS — are not repeated: the configuration and the site
    already exist and are left alone.

    Stops on the first failure rather than carrying on, so a bad build does not
    end up half-installed.

.EXAMPLE
    .\update.ps1
    .\update.ps1 -SkipMigrations     # when the release has no schema change
#>
[CmdletBinding()]
param(
    [string] $SourcePath = 'E:\NDIE-Capacity-Building-main',
    [string] $SitePath   = 'E:\inetpub\cbms',
    [string] $BaseUrl    = 'https://leanstaging.qci.org.in',
    [switch] $SkipMigrations
)

$ErrorActionPreference = 'Stop'
$here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$started = Get-Date

Write-Host "`n=== Redeploying CBMS ===`n" -ForegroundColor Cyan

& (Join-Path $here '04-publish.ps1') -SourcePath $SourcePath -SitePath $SitePath
if ($LASTEXITCODE -gt 0) { throw "Publish failed." }

if (-not $SkipMigrations) {
    & (Join-Path $here '06-migrate.ps1') -SourcePath $SourcePath -SitePath $SitePath -Force
    if ($LASTEXITCODE -gt 0) { throw "Migration failed." }
}

# IIS needs a moment to bring the worker process back up before the first
# request lands, or verification races the cold start.
Start-Sleep -Seconds 5

& (Join-Path $here '07-verify.ps1') -BaseUrl $BaseUrl -SitePath $SitePath

Write-Host ("`nFinished in {0:n0}s.`n" -f ((Get-Date) - $started).TotalSeconds) -ForegroundColor Green
