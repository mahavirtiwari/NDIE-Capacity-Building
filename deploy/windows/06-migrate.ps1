<#
.SYNOPSIS
    Applies EF Core migrations to the production database.

.DESCRIPTION
    A deliberate, reviewable step rather than something that happens on boot.
    MigrateOnStartup is off in production for two reasons: an app-pool recycle
    should never alter a schema, and two web heads starting together would race
    each other through the same migrations.

    It prints what is pending and asks before applying, unless -Force.

.EXAMPLE
    .\06-migrate.ps1
    .\06-migrate.ps1 -Force        # unattended, for a pipeline
#>
[CmdletBinding()]
param(
    [string] $SourcePath = 'E:\NDIE-Capacity-Building-main',
    [string] $SitePath   = 'E:\inetpub\cbms',
    [switch] $Force
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$config = Join-Path $SitePath 'appsettings.Production.json'
if (-not (Test-Path $config)) { throw "No $config. Run 03-configure.ps1 first." }

$connectionString = (Get-Content $config -Raw | ConvertFrom-Json).ConnectionStrings.Default
if (-not $connectionString) { throw "ConnectionStrings:Default is empty in $config." }

$apiProject = Join-Path $SourcePath 'backend\src\Ntms.Api\Ntms.Api.csproj'
$infra      = Join-Path $SourcePath 'backend\src\Ntms.Infrastructure\Ntms.Infrastructure.csproj'

if (-not (Get-Command dotnet-ef -ErrorAction SilentlyContinue)) {
    Write-Host "  Installing dotnet-ef..." -ForegroundColor Gray
    Invoke-Native 'dotnet tool install' 'dotnet' @(
        'tool', 'install', '--global', 'dotnet-ef') | Out-Null
    $env:PATH += ";$env:USERPROFILE\.dotnet\tools"
}

# The tooling starts the application the same way the app does, so it needs the
# whole of its configuration and not just a connection string. It looks for
# that next to the project, where there is none - the deployed settings live
# in the site folder. Pointing the content root there is what makes it read
# the real appsettings.Production.json; without it the host refuses to start
# on "Jwt:SigningKey must be configured", which has nothing to do with
# migrating and reads like a broken build.
#
# ASPNETCORE_ENVIRONMENT has to say Production too, or it would pick up the
# development settings and migrate whatever those point at.
$env:ASPNETCORE_ENVIRONMENT     = 'Production'
$env:ASPNETCORE_CONTENTROOT     = $SitePath
$env:ConnectionStrings__Default = $connectionString

# --no-build below means "a build is already on disk", and on a fresh
# checkout there is none: 04-publish.ps1 builds Release into a temporary
# folder and leaves bin\ empty, so the tooling looked for a Debug
# deps.json that had never been written. Build once here; this is for the
# tooling only and is not what gets deployed.
Write-Host "`nBuilding for the migration tooling..." -ForegroundColor Gray
Invoke-Native 'dotnet build' 'dotnet' @('build', $apiProject, '--nologo') | Out-Null

Write-Host "`nPending migrations`n" -ForegroundColor Cyan

# Through Invoke-Native so a failure throws. Read straight into $list, a
# command that died produced no '(Pending)' lines and this script called
# that "already up to date" and exited 0 - the worst possible reading of a
# migration tool that did not run.
$list = Invoke-Native 'dotnet ef migrations list' 'dotnet' @(
    'ef', 'migrations', 'list', '--project', $infra, '--startup-project', $apiProject, '--no-build')
$pending = $list | Where-Object { $_ -match '\(Pending\)' }

if (-not $pending) {
    Write-Host "  Database is already up to date.`n" -ForegroundColor Green
    exit 0
}

$pending | ForEach-Object { Write-Host ("  {0}" -f $_.Trim()) -ForegroundColor Yellow }

if (-not $Force) {
    Write-Host "`nBack the database up before continuing." -ForegroundColor Yellow
    $answer = Read-Host "Apply these migrations? (yes/no)"
    if ($answer -ne 'yes') { Write-Host "Nothing applied."; exit 1 }
}

# -Stream: this can run for a while and silence would look like a hang.
try {
    Invoke-Native 'dotnet ef database update' 'dotnet' @(
        'ef', 'database', 'update', '--project', $infra, '--startup-project', $apiProject, '--no-build') -Stream
}
catch {
    throw "Migration failed. The database is unchanged past the last one that succeeded.`n$_"
}

Write-Host "`nDone. Next: .\07-verify.ps1`n" -ForegroundColor Green
