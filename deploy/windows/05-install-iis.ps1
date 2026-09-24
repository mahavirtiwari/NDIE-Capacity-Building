<#
.SYNOPSIS
    Creates the IIS site, binds the certificate and sets the folder rights.

.DESCRIPTION
    One site, one app pool. The API serves both halves — the SPA at / and the
    API at /api — so there is no sub-application, no reverse proxy and no CORS
    between them.

    Run once. It is safe to run again: an existing site or pool is reconfigured
    rather than duplicated.

.PARAMETER PfxPath
    The certificate for the domain. Required the first time.

.PARAMETER PfxPassword
    Its password. Prompted for if omitted, so it stays out of your shell history.

.EXAMPLE
    .\05-install-iis.ps1 -PfxPath E:\certs\leanstaging.qci.org.in.pfx
#>
[CmdletBinding()]
param(
    [string] $SiteName = 'CBMS',
    [string] $HostName = 'leanstaging.qci.org.in',
    [string] $SitePath = 'E:\inetpub\cbms',
    [string] $StorageRoot = 'E:\cbms-data',
    [string] $PoolName = 'CbmsAppPool',
    [string] $PfxPath,
    [System.Security.SecureString] $PfxPassword
)

$ErrorActionPreference = 'Stop'
Import-Module WebAdministration

Write-Host "`nInstalling the $SiteName site`n" -ForegroundColor Cyan

if (-not (Test-Path $SitePath)) {
    throw "$SitePath does not exist. Run 04-publish.ps1 first."
}

# --- Application pool -------------------------------------------------------

if (-not (Test-Path "IIS:\AppPools\$PoolName")) {
    New-WebAppPool -Name $PoolName | Out-Null
    Write-Host "  [ok]  Created app pool $PoolName" -ForegroundColor Green
}

# "No Managed Code" is right for ASP.NET Core: the runtime is loaded by the
# ASP.NET Core Module, not by the CLR the pool would otherwise start.
Set-ItemProperty "IIS:\AppPools\$PoolName" -Name managedRuntimeVersion -Value ''
Set-ItemProperty "IIS:\AppPools\$PoolName" -Name startMode -Value 'AlwaysRunning'

# A daily 02:00 recycle is the IIS default and it drops every in-flight request
# and every cached thing for no reason on a service that is already stable.
Set-ItemProperty "IIS:\AppPools\$PoolName" -Name recycling.periodicRestart.time -Value '00:00:00'
Clear-ItemProperty "IIS:\AppPools\$PoolName" -Name recycling.periodicRestart.schedule -ErrorAction SilentlyContinue

# Idle timeout off: the first request after a quiet night should not pay for a
# cold start, and this site is expected to be up continuously.
Set-ItemProperty "IIS:\AppPools\$PoolName" -Name processModel.idleTimeout -Value '00:00:00'

Write-Host "  [ok]  Pool set to No Managed Code, always running, no idle timeout" -ForegroundColor Green

# --- Site -------------------------------------------------------------------

if (-not (Test-Path "IIS:\Sites\$SiteName")) {
    New-Website -Name $SiteName -PhysicalPath $SitePath -ApplicationPool $PoolName `
        -HostHeader $HostName -Port 80 | Out-Null
    Write-Host "  [ok]  Created site $SiteName" -ForegroundColor Green
}
else {
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name physicalPath -Value $SitePath
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationPool -Value $PoolName
    Write-Host "  [ok]  Site $SiteName already existed — repointed" -ForegroundColor Green
}

# --- Certificate ------------------------------------------------------------

$binding = Get-WebBinding -Name $SiteName -Protocol https -ErrorAction SilentlyContinue

if ($PfxPath) {
    if (-not (Test-Path $PfxPath)) { throw "Certificate not found: $PfxPath" }

    if (-not $PfxPassword) {
        $PfxPassword = Read-Host -AsSecureString "Password for $([IO.Path]::GetFileName($PfxPath))"
    }

    # Into LocalMachine\My, which is where IIS looks for a binding certificate.
    $imported = Import-PfxCertificate -FilePath $PfxPath `
        -CertStoreLocation 'Cert:\LocalMachine\My' -Password $PfxPassword

    Write-Host ("  [ok]  Imported certificate, thumbprint {0}" -f $imported.Thumbprint) -ForegroundColor Green
    Write-Host ("        Subject : {0}" -f $imported.Subject) -ForegroundColor Gray
    Write-Host ("        Expires : {0:dd MMM yyyy}" -f $imported.NotAfter) -ForegroundColor Gray

    if ($imported.NotAfter -lt (Get-Date)) {
        Write-Host "  [WARN] This certificate has already expired." -ForegroundColor Red
    }
    elseif ($imported.NotAfter -lt (Get-Date).AddDays(30)) {
        Write-Host ("  [WARN] Expires in {0} days — plan the renewal." -f `
            [int]($imported.NotAfter - (Get-Date)).TotalDays) -ForegroundColor Yellow
    }

    if (-not $binding) {
        New-WebBinding -Name $SiteName -Protocol https -Port 443 -HostHeader $HostName -SslFlags 1
        Write-Host "  [ok]  Added the https binding" -ForegroundColor Green
    }

    # SNI (SslFlags 1) so the box can host other certificates on 443 alongside
    # this one.
    $bindingPath = "IIS:\SslBindings\!443!$HostName"
    if (Test-Path $bindingPath) { Remove-Item $bindingPath -Force }
    New-Item -Path $bindingPath -Value $imported -SSLFlags 1 | Out-Null
    Write-Host "  [ok]  Bound the certificate to $HostName:443 (SNI)" -ForegroundColor Green
}
elseif (-not $binding) {
    Write-Host "  [WARN] No https binding and no -PfxPath given. The site is http only." -ForegroundColor Yellow
}

# --- Folder rights ----------------------------------------------------------

$poolIdentity = "IIS AppPool\$PoolName"

# The site folder is read and execute only. The application has no business
# writing into its own binaries, and if it is ever compromised this is one less
# thing it can do.
$acl = Get-Acl $SitePath
$acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
            $poolIdentity, 'ReadAndExecute', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
Set-Acl -Path $SitePath -AclObject $acl
Write-Host "  [ok]  $poolIdentity can read $SitePath" -ForegroundColor Green

# The storage root is the one place it may write: photographs and certificate
# artwork land here, outside the folder a redeploy replaces.
foreach ($path in @($StorageRoot)) {
    if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
    $acl = Get-Acl $path
    $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
                $poolIdentity, 'Modify', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    Set-Acl -Path $path -AclObject $acl
    Write-Host "  [ok]  $poolIdentity can write $path" -ForegroundColor Green
}

# The configuration file holds the database password and the signing key.
$configFile = Join-Path $SitePath 'appsettings.Production.json'
if (Test-Path $configFile) {
    $acl = Get-Acl $configFile
    $acl.SetAccessRuleProtection($true, $false)
    $acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) | Out-Null }
    foreach ($identity in @('BUILTIN\Administrators', 'NT AUTHORITY\SYSTEM', $poolIdentity)) {
        $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
                    $identity, 'Read', 'Allow')))
    }
    Set-Acl -Path $configFile -AclObject $acl
    Write-Host "  [ok]  Locked appsettings.Production.json to three identities" -ForegroundColor Green
}

# --- Environment ------------------------------------------------------------

# ASPNETCORE_ENVIRONMENT decides which appsettings overlay is read and turns off
# Swagger and the developer exception page.
$envConfig = "IIS:\Sites\$SiteName"
Set-WebConfigurationProperty -PSPath $envConfig -Filter 'system.webServer/aspNetCore/environmentVariables' `
    -Name '.' -Value @{ name = 'ASPNETCORE_ENVIRONMENT'; value = 'Production' } -ErrorAction SilentlyContinue
Write-Host "  [ok]  ASPNETCORE_ENVIRONMENT=Production" -ForegroundColor Green

Restart-WebAppPool -Name $PoolName
Write-Host "`nDone. Next: .\06-migrate.ps1`n" -ForegroundColor Green
