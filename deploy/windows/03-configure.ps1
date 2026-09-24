<#
.SYNOPSIS
    Writes appsettings.Production.json for the site.

.DESCRIPTION
    Every environment-specific value the service refuses to start without, in
    one file outside the repository. It is written to the deployment target, not
    to the source tree, so a later `git pull` cannot overwrite it and a stray
    `git add` cannot publish it.

    The JWT signing key is generated here if you do not supply one. Changing it
    signs everybody out, which is the correct behaviour but worth knowing before
    you re-run this on a live site.

    The SMTP password is deliberately NOT set here. It is held in the database
    and entered once through the portal's Email screen, where it is write-only.

.PARAMETER SitePath
    Where the published site lives. Default E:\inetpub\cbms.

.PARAMETER ConnectionString
    From 02-database.ps1. Required.

.PARAMETER JwtSigningKey
    32+ characters. Generated if omitted.

.PARAMETER PublicUrl
    The address the site answers on, used for the CORS allow-list.

.EXAMPLE
    .\03-configure.ps1 -ConnectionString 'Server=localhost;Database=CbmsDb;User Id=cbms_app;Password=...;Encrypt=True;TrustServerCertificate=True;MultipleActiveResultSets=true'
#>
[CmdletBinding()]
param(
    [string] $SitePath = 'E:\inetpub\cbms',
    [Parameter(Mandatory)] [string] $ConnectionString,
    [string] $JwtSigningKey,
    [string] $PublicUrl = 'https://leanstaging.qci.org.in',
    [string] $StorageRoot = 'E:\cbms-data',
    # On by default: these scripts were written for a staging host. Pass
    # -DiscourageSearchEngines:$false when this becomes the live site.
    [switch] $DiscourageSearchEngines = $true
)

$ErrorActionPreference = 'Stop'

Write-Host "`nWriting production configuration`n" -ForegroundColor Cyan

# --- Signing key ------------------------------------------------------------

if (-not $JwtSigningKey) {
    $bytes = New-Object byte[] 48
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $JwtSigningKey = [Convert]::ToBase64String($bytes)
    Write-Host "  [ok]  Generated a 48-byte signing key" -ForegroundColor Green
}
elseif ($JwtSigningKey.Length -lt 32) {
    throw "Jwt:SigningKey must be at least 32 characters. The API refuses to start otherwise."
}

# --- Storage ----------------------------------------------------------------

# Photographs and certificate artwork are files, not rows. They must live
# outside the published folder: a redeploy replaces that folder wholesale and
# would take the evidence with it.
if ($StorageRoot.StartsWith($SitePath, [StringComparison]::OrdinalIgnoreCase)) {
    throw "StorageRoot must sit outside SitePath, or a redeploy will delete the uploaded files."
}

$monitoringRoot = Join-Path $StorageRoot 'monitoring'
$templateRoot = Join-Path $StorageRoot 'certificate-templates'

foreach ($path in @($StorageRoot, $monitoringRoot, $templateRoot)) {
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        Write-Host "  [ok]  Created $path" -ForegroundColor Green
    }
}

# --- The file ---------------------------------------------------------------

$settings = [ordered]@{
    ConnectionStrings = [ordered]@{ Default = $ConnectionString }

    Jwt               = [ordered]@{
        SigningKey         = $JwtSigningKey
        Issuer             = 'ntms-api'
        Audience           = 'ntms-clients'
        AccessTokenMinutes = 60
        RefreshTokenDays   = 7
    }

    # The portal is served from the same origin as the API, so nothing
    # cross-origin is expected. The entry is kept for the mobile apps, which do
    # call across origins.
    Cors              = [ordered]@{ AllowedOrigins = @($PublicUrl) }

    Storage           = [ordered]@{
        MonitoringRoot          = $monitoringRoot
        CertificateTemplateRoot = $templateRoot
    }

    Database          = [ordered]@{
        # Migrations are applied by 05-migrate.ps1 as a deliberate, reviewable
        # step. Doing it on boot means an app-pool recycle can alter the schema,
        # and two web heads starting together can race each other.
        MigrateOnStartup = $false
        SeedSampleData   = $false
    }

    # UseHttpsRedirection has to be told which port to send people to. Behind
    # IIS it normally learns that from the ASP.NET Core Module, which passes it
    # only when the site has a working https binding - so a broken certificate
    # makes the application quietly serve plain http instead of redirecting,
    # which is the wrong way round for a site carrying real data. Saying it
    # here makes the redirect unconditional: if https breaks, the site breaks
    # visibly rather than downgrading.
    HTTPS_PORT        = 443

    Site              = [ordered]@{
        # A staging host serves real programme data on pages that are
        # genuinely public. Without this it competes with the live site in
        # search results. Set false on production, where being found is the
        # whole point.
        DiscourageSearchEngines = [bool] $DiscourageSearchEngines
    }

    Logging           = [ordered]@{
        LogLevel = [ordered]@{
            Default                              = 'Warning'
            'Microsoft.AspNetCore'               = 'Warning'
            # The default logs every statement, which on a production box fills
            # the disk and leaks parameter values into the log.
            'Microsoft.EntityFrameworkCore.Database.Command' = 'Warning'
            Ntms                                 = 'Information'
        }
    }

    AllowedHosts      = ([Uri] $PublicUrl).Host
}

$target = Join-Path $SitePath 'appsettings.Production.json'
$parent = Split-Path $target -Parent
if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }

$settings | ConvertTo-Json -Depth 6 | Set-Content -Path $target -Encoding utf8
Write-Host "  [ok]  Wrote $target" -ForegroundColor Green

# --- Lock it down -----------------------------------------------------------

# The file holds a database password and the signing key. Administrators and
# the app pool identity, nobody else — inheritance off so a permissive parent
# folder cannot widen it.
$acl = Get-Acl $target
$acl.SetAccessRuleProtection($true, $false)
$acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) | Out-Null }

foreach ($identity in @('BUILTIN\Administrators', 'IIS AppPool\CbmsAppPool', 'NT AUTHORITY\SYSTEM')) {
    try {
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
            $identity, 'Read', 'Allow')
        $acl.AddAccessRule($rule)
    }
    catch {
        # The app pool does not exist until 04-install-iis.ps1 runs; that script
        # re-applies this, so a miss here is expected on a first run.
        Write-Host "  [note] Could not grant $identity yet — 04 will set it" -ForegroundColor Gray
    }
}
Set-Acl -Path $target -AclObject $acl
Write-Host "  [ok]  Restricted the file to Administrators, SYSTEM and the app pool" -ForegroundColor Green

if ($DiscourageSearchEngines) {
    Write-Host "  [ok]  Search engines told not to index this host" -ForegroundColor Green
}
else {
    Write-Host "  [ok]  Search engines allowed to index this host" -ForegroundColor Yellow
}

Write-Host "`nDone. Next: .\04-publish.ps1`n" -ForegroundColor Green
Write-Host "Keep a copy of the signing key somewhere safe. Replacing it signs every user out." -ForegroundColor Yellow
