<#
.SYNOPSIS
    Creates the database and the login the site connects as.

.DESCRIPTION
    The site does not connect as sa, and it does not connect as the machine
    account with sysadmin. It gets its own SQL login with rights over one
    database and nothing else, so a compromise of the web tier cannot reach the
    rest of the instance.

    The password is generated here and shown once. Put it straight into
    03-configure.ps1 (or pass it along) — it is not written to disk.

    Safe to run twice: an existing database or login is left alone.

.PARAMETER SqlInstance
    The instance to create it on. Default is the local default instance.

.PARAMETER Database
    Database name. Default CbmsDb.

.PARAMETER LoginName
    SQL login the site authenticates as. Default cbms_app.

.EXAMPLE
    .\02-database.ps1
    .\02-database.ps1 -SqlInstance 'localhost\SQLEXPRESS' -Database CbmsDb
#>
[CmdletBinding()]
param(
    [string] $SqlInstance = 'localhost',
    [string] $Database = 'CbmsDb',
    [string] $LoginName = 'cbms_app'
)

$ErrorActionPreference = 'Stop'

function Invoke-Sql {
    param([string] $Query, [string] $OnDatabase = 'master')

    # -b makes sqlcmd exit non-zero on error, which is the only way this script
    # can tell that something failed.
    $output = sqlcmd -S $SqlInstance -d $OnDatabase -E -b -h -1 -W -Q $Query 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ("SQL failed against {0}:`n{1}" -f $SqlInstance, ($output -join "`n"))
    }
    return $output
}

Write-Host "`nPreparing the database on $SqlInstance`n" -ForegroundColor Cyan

# --- Reachable? -------------------------------------------------------------

Invoke-Sql -Query 'SELECT 1' | Out-Null
Write-Host "  [ok]  Connected as $env:USERNAME" -ForegroundColor Green

# --- Database ---------------------------------------------------------------

$exists = (Invoke-Sql -Query "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.databases WHERE name = '$Database';").Trim()

if ($exists -eq '0') {
    Invoke-Sql -Query "CREATE DATABASE [$Database];"
    Write-Host "  [ok]  Created database $Database" -ForegroundColor Green
}
else {
    Write-Host "  [ok]  Database $Database already exists — left as it is" -ForegroundColor Green
}

# The app reads and writes JSON-ish payloads and uses a filtered index, both of
# which need these on. They are the defaults for new databases; set explicitly
# so a restored or older database behaves the same.
Invoke-Sql -Query "ALTER DATABASE [$Database] SET QUOTED_IDENTIFIER ON; ALTER DATABASE [$Database] SET ANSI_NULLS ON;"
Write-Host "  [ok]  QUOTED_IDENTIFIER and ANSI_NULLS on" -ForegroundColor Green

# --- Login ------------------------------------------------------------------

$loginExists = (Invoke-Sql -Query "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.server_principals WHERE name = '$LoginName';").Trim()

$password = $null
if ($loginExists -eq '0') {
    # 24 bytes of cryptographic randomness, rendered without characters that
    # would need escaping in a connection string.
    $bytes = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $password = [Convert]::ToBase64String($bytes) -replace '[+/=]', 'x'

    Invoke-Sql -Query @"
CREATE LOGIN [$LoginName] WITH PASSWORD = '$password', CHECK_POLICY = ON;
"@
    Write-Host "  [ok]  Created login $LoginName" -ForegroundColor Green
}
else {
    Write-Host "  [ok]  Login $LoginName already exists — password unchanged" -ForegroundColor Green
}

# --- Rights -----------------------------------------------------------------

# db_owner on this one database only. The app runs EF migrations, which create
# and alter tables, so db_datareader/writer is not enough. It has no rights on
# any other database and none at the server level.
Invoke-Sql -OnDatabase $Database -Query @"
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = '$LoginName')
    CREATE USER [$LoginName] FOR LOGIN [$LoginName];
ALTER ROLE db_owner ADD MEMBER [$LoginName];
"@
Write-Host "  [ok]  $LoginName is db_owner on $Database (and nothing else)" -ForegroundColor Green

# --- Report -----------------------------------------------------------------

Write-Host "`nDone.`n" -ForegroundColor Green

if ($password) {
    Write-Host "Connection string for 03-configure.ps1:" -ForegroundColor Cyan
    Write-Host ("  Server=$SqlInstance;Database=$Database;User Id=$LoginName;Password=$password;" +
        "Encrypt=True;TrustServerCertificate=True;MultipleActiveResultSets=true") -ForegroundColor White
    Write-Host "`nThis password is shown once and is not stored anywhere. Copy it now." -ForegroundColor Yellow
}
else {
    Write-Host "The login already existed, so no password was generated." -ForegroundColor Yellow
    Write-Host "Use the existing one, or reset it with:" -ForegroundColor Yellow
    Write-Host "  ALTER LOGIN [$LoginName] WITH PASSWORD = '<new>';" -ForegroundColor Gray
}
