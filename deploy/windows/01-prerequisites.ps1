<#
.SYNOPSIS
    Checks the server has what the site needs, and says exactly what is missing.

.DESCRIPTION
    Nothing is installed here. A production box usually has a change process,
    and a script that silently pulls down runtimes is the wrong thing to run on
    one — so this reports, and prints the command for anything absent.

    Run it first, fix whatever it names, then run it again until it is clean.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\01-prerequisites.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$script:Missing = @()

function Test-Item {
    param(
        [string] $Name,
        [scriptblock] $Check,
        [string] $Fix
    )

    $ok = $false
    try { $ok = [bool](& $Check) } catch { $ok = $false }

    if ($ok) {
        Write-Host ("  [ok]      {0}" -f $Name) -ForegroundColor Green
    }
    else {
        Write-Host ("  [MISSING] {0}" -f $Name) -ForegroundColor Yellow
        $script:Missing += [pscustomobject]@{ Name = $Name; Fix = $Fix }
    }
}

Write-Host "`nChecking prerequisites for the CBMS site`n" -ForegroundColor Cyan

# --- Administrator ----------------------------------------------------------

$isAdmin = ([Security.Principal.WindowsPrincipal] `
        [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    throw "Run this from an elevated PowerShell. Installing a site needs administrator rights."
}
Write-Host "  [ok]      Running elevated" -ForegroundColor Green

# --- IIS --------------------------------------------------------------------

Test-Item -Name 'IIS (Web-Server role)' `
    -Check { (Get-WindowsOptionalFeature -Online -FeatureName IIS-WebServer).State -eq 'Enabled' } `
    -Fix 'Server: Install-WindowsFeature Web-Server -IncludeManagementTools   |   Client: Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServer -All'

Test-Item -Name 'IIS management cmdlets (WebAdministration)' `
    -Check { $null -ne (Get-Module -ListAvailable -Name WebAdministration) } `
    -Fix 'Server: Install-WindowsFeature Web-Scripting-Tools   |   Client: Enable-WindowsOptionalFeature -Online -FeatureName IIS-ManagementScriptingTools -All'

# Static compression makes a real difference to the Angular bundle over a slow
# line, and costs nothing to turn on.
Test-Item -Name 'IIS static content + compression' `
    -Check {
    (Get-WindowsOptionalFeature -Online -FeatureName IIS-StaticContent).State -eq 'Enabled' -and
    (Get-WindowsOptionalFeature -Online -FeatureName IIS-HttpCompressionStatic).State -eq 'Enabled'
} `
    -Fix 'Server: Install-WindowsFeature Web-Static-Content,Web-Stat-Compression   |   Client: Enable-WindowsOptionalFeature -Online -FeatureName IIS-StaticContent,IIS-HttpCompressionStatic -All'

# --- .NET -------------------------------------------------------------------

# The Hosting Bundle is what puts the ASP.NET Core Module into IIS. The plain
# runtime is not enough, and the SDK alone is not either.
Test-Item -Name '.NET 10 Hosting Bundle (ASP.NET Core Module v2)' `
    -Check {
    $module = Join-Path $env:ProgramFiles 'IIS\Asp.Net Core Module\V2\aspnetcorev2.dll'
    (Test-Path $module) -and
    ((dotnet --list-runtimes 2>$null) -match 'Microsoft\.AspNetCore\.App 10\.')
} `
    -Fix 'Download the .NET 10 Hosting Bundle from https://dotnet.microsoft.com/download/dotnet/10.0 and install it, then run: iisreset'

Test-Item -Name '.NET 10 SDK (to build on this machine)' `
    -Check { (dotnet --list-sdks 2>$null) -match '^10\.' } `
    -Fix 'Install the .NET 10 SDK, or build elsewhere and copy the published output across'

Test-Item -Name 'Node.js 20+ (to build the portal)' `
    -Check {
    $v = (node --version 2>$null)
    $v -and ([int](($v -replace '^v', '') -split '\.')[0]) -ge 20
} `
    -Fix 'Install Node.js 20 LTS, or build the portal elsewhere and copy dist across'

# --- SQL Server -------------------------------------------------------------

Test-Item -Name 'SQL Server service running' `
    -Check { (Get-Service -Name 'MSSQL*' -ErrorAction SilentlyContinue | Where-Object Status -eq 'Running').Count -gt 0 } `
    -Fix 'Install SQL Server, or start the instance: Start-Service MSSQLSERVER'

Test-Item -Name 'sqlcmd available' `
    -Check { $null -ne (Get-Command sqlcmd -ErrorAction SilentlyContinue) } `
    -Fix 'Install the SQL Server command line tools (sqlcmd)'

# --- Result -----------------------------------------------------------------

Write-Host ''
if ($script:Missing.Count -eq 0) {
    Write-Host "Everything is in place. Next: .\02-database.ps1" -ForegroundColor Green
    exit 0
}

Write-Host ("{0} item(s) need attention:`n" -f $script:Missing.Count) -ForegroundColor Yellow
foreach ($item in $script:Missing) {
    Write-Host ("  {0}" -f $item.Name) -ForegroundColor Yellow
    Write-Host ("      {0}`n" -f $item.Fix) -ForegroundColor Gray
}
exit 1
