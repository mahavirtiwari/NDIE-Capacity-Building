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

$config = Join-Path $SitePath 'appsettings.Production.json'
if (-not (Test-Path $config)) { throw "No $config. Run 03-configure.ps1 first." }

$connectionString = (Get-Content $config -Raw | ConvertFrom-Json).ConnectionStrings.Default
if (-not $connectionString) { throw "ConnectionStrings:Default is empty in $config." }

$apiProject = Join-Path $SourcePath 'backend\src\Ntms.Api\Ntms.Api.csproj'
$infra      = Join-Path $SourcePath 'backend\src\Ntms.Infrastructure\Ntms.Infrastructure.csproj'

if (-not (Get-Command dotnet-ef -ErrorAction SilentlyContinue)) {
    Write-Host "  Installing dotnet-ef..." -ForegroundColor Gray
    # 2>&1 keeps the installer's progress notes out of the error stream; with
    # $ErrorActionPreference = 'Stop' one of them would end the script.
    dotnet tool install --global dotnet-ef 2>&1 | Out-Null
    $env:PATH += ";$env:USERPROFILE\.dotnet\tools"
}

# The tooling reads configuration the same way the app does, so the environment
# has to say Production or it would migrate whatever the dev settings point at.
$env:ASPNETCORE_ENVIRONMENT   = 'Production'
$env:ConnectionStrings__Default = $connectionString

Write-Host "`nPending migrations`n" -ForegroundColor Cyan
$list = dotnet ef migrations list --project $infra --startup-project $apiProject --no-build 2>&1
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

dotnet ef database update --project $infra --startup-project $apiProject --no-build
if ($LASTEXITCODE -ne 0) { throw "Migration failed. The database is unchanged past the last one that succeeded." }

Write-Host "`nDone. Next: .\07-verify.ps1`n" -ForegroundColor Green
