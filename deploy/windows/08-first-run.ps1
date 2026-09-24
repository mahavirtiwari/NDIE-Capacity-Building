<#
.SYNOPSIS
    Sets the Super Admin password for the first sign-in.

.DESCRIPTION
    Seeding creates SA0001 and gives it a password that is never written to the
    repository. If Seed:SuperAdminPassword was not set before the first start,
    one was generated and logged once — and a log that has since rolled is gone.

    This sets a known one instead, using the application's own hasher so the
    stored value is in the format the sign-in expects. The account is left
    marked "must change at first sign-in".

.EXAMPLE
    .\08-first-run.ps1
#>
[CmdletBinding()]
param(
    [string] $SitePath = 'E:\inetpub\cbms',
    [string] $SourcePath = 'E:\NDIE-Capacity-Building-main',
    # Must match what 02-database.ps1 used. A named instance is not
    # reachable as '.', which is what this assumed before.
    [string] $SqlInstance = 'localhost'
)

$ErrorActionPreference = 'Stop'

$config = Join-Path $SitePath 'appsettings.Production.json'
if (-not (Test-Path $config)) { throw "No $config. Run 03-configure.ps1 first." }
$connectionString = (Get-Content $config -Raw | ConvertFrom-Json).ConnectionStrings.Default

Write-Host "`nSuper Admin first sign-in`n" -ForegroundColor Cyan
Write-Host "  The password is hashed before it is stored. Nothing is written to disk." -ForegroundColor Gray

$first  = Read-Host -AsSecureString "  New password for SA0001 (12+ characters)"
$second = Read-Host -AsSecureString "  Again"

$p1 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first))
$p2 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second))

if ($p1 -ne $p2)      { throw "They do not match." }
if ($p1.Length -lt 12) { throw "Use at least 12 characters." }

# Hashed with ASP.NET Core's PasswordHasher, which is what the sign-in verifies
# against — writing anything else would store a value that can never match.
$helper = Join-Path $env:TEMP ("cbms-hash-" + [Guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $helper -Force | Out-Null

try {
    Push-Location $helper
    dotnet new console --force 2>&1 | Out-Null
    dotnet add package Microsoft.Extensions.Identity.Core 2>&1 | Out-Null

    @'
using Microsoft.AspNetCore.Identity;
var hasher = new PasswordHasher<object>();
Console.WriteLine(hasher.HashPassword(new object(), args[0]));
'@ | Set-Content -Path (Join-Path $helper 'Program.cs') -Encoding utf8

    $hash = (dotnet run --no-launch-profile -- $p1 2>&1 | Select-Object -Last 1).Trim()
    if (-not $hash.StartsWith('A')) { throw "Could not produce a hash: $hash" }
    Pop-Location

    # QUOTED_IDENTIFIER is required for any write to a table carrying a filtered
    # index, and sqlcmd does not set it.
    $sql = @"
SET QUOTED_IDENTIFIER ON;
UPDATE PortalUsers
   SET PasswordHash = '$hash',
       MustChangePassword = 1,
       FailedLoginCount = 0,
       LockedOutUntil = NULL
 WHERE UserCode = 'SA0001';
SELECT CONCAT('rows updated: ', @@ROWCOUNT);
"@

    $sqlFile = Join-Path $env:TEMP 'cbms-sa.sql'
    Set-Content -Path $sqlFile -Value $sql -Encoding utf8

    # -C for the same reason as in 02-database.ps1.
    $database = [regex]::Match($connectionString, 'Database=([^;]+)').Groups[1].Value
    $result = sqlcmd -S $SqlInstance -d $database -E -C -b -h -1 -W -i $sqlFile
    Remove-Item $sqlFile -Force
    if ($LASTEXITCODE -ne 0) { throw "Update failed: $result" }

    Write-Host "`n  [ok]  $result" -ForegroundColor Green
    Write-Host "  Sign in at the site as SA0001. You will be asked to change it.`n" -ForegroundColor Cyan
}
finally {
    Remove-Item $helper -Recurse -Force -ErrorAction SilentlyContinue
}
