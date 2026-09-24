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

function Invoke-Seed {
    <#
        A migration creates the tables and leaves them empty. The roles, the
        LGD location master, the branding defaults and the first Super Admin
        come from the application's own seeder, which until now only ran when
        MigrateOnStartup was true - and that is deliberately false in
        production. So a deployment ended up with a perfect schema, no
        reference data, and no account anyone could sign in as.

        Run through the published application rather than the source tree, so
        it uses the configuration the site itself uses. Everything the seeder
        does is idempotent.
    #>
    $dll = Join-Path $SitePath 'Ntms.Api.dll'
    if (-not (Test-Path $dll)) {
        Write-Host "`n  [skip] Seeding: $dll not found. Run 04-publish.ps1, then this again." -ForegroundColor Yellow
        return
    }

    Write-Host "`nSeeding reference data and the first account`n" -ForegroundColor Cyan

    # The content root decides where appsettings.Production.json is read from,
    # and for a framework-dependent dll that defaults to the current directory.
    $previousRoot = $env:ASPNETCORE_CONTENTROOT
    $env:ASPNETCORE_CONTENTROOT = $SitePath
    try {
        # -Stream so the seeder's own output is seen: when it creates the Super
        # Admin it writes the first-run password, once, and nowhere else.
        Invoke-Native 'seeding' 'dotnet' @($dll, '--seed') -Stream
    }
    finally { $env:ASPNETCORE_CONTENTROOT = $previousRoot }

    Write-Host "  [ok]  Seeded" -ForegroundColor Green
}

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
    Write-Host "  Database is already up to date." -ForegroundColor Green
    Invoke-Seed
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

Invoke-Seed

Write-Host "`nDone. Next: .\07-verify.ps1`n" -ForegroundColor Green
