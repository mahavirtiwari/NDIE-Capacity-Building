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
    [string] $LoginName = 'cbms_app',
    # Use the IIS app pool's Windows identity instead of a SQL login. No
    # password to store or rotate, and it works on an instance that only
    # accepts Windows authentication. Needs the pool to exist, so run
    # 05-install-iis.ps1 first when you use this.
    [switch] $UseWindowsAuth,
    [string] $AppPoolName = 'CbmsAppPool'
)

$ErrorActionPreference = 'Stop'

function Invoke-Sql {
    param([string] $Query, [string] $OnDatabase = 'master')

    # -b makes sqlcmd exit non-zero on error, which is the only way this script
    # can tell that something failed.
    # -C trusts the server certificate. ODBC Driver 18, which sqlcmd 18 and
    # later use, encrypts by default and validates the chain - and a SQL Server
    # installed without a certificate of its own presents a self-signed one,
    # which fails that check. The traffic is still encrypted; only the identity
    # check is skipped, which for a connection to the same machine is no loss.
    # Issue SQL Server a trusted certificate and this can come off.
    $output = sqlcmd -S $SqlInstance -d $OnDatabase -E -C -b -h -1 -W -Q $Query 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ("SQL failed against {0}:`n{1}" -f $SqlInstance, ($output -join "`n"))
    }
    return $output
}

Write-Host "`nPreparing the database on $SqlInstance`n" -ForegroundColor Cyan

# --- Reachable? -------------------------------------------------------------

Invoke-Sql -Query 'SELECT 1' | Out-Null
Write-Host "  [ok]  Connected as $env:USERNAME" -ForegroundColor Green

# --- Which authentications will this instance accept? -----------------------

# A SQL login can be created on a Windows-only instance and will never be
# able to sign in. Catching that here turns a baffling failure five steps
# later into a sentence explaining what to do.
$windowsOnly = (Invoke-Sql -Query "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('IsIntegratedSecurityOnly') AS varchar);").Trim() -eq '1'

if ($windowsOnly -and -not $UseWindowsAuth) {
    Write-Host ''
    Write-Host '  This instance accepts Windows authentication only.' -ForegroundColor Yellow
    Write-Host '  A SQL login would be created here and would never be able to sign in.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  Two ways forward:' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '  1. Use the app pool identity instead. No password anywhere. Run' -ForegroundColor White
    Write-Host '     05-install-iis.ps1 first so the pool exists, then:' -ForegroundColor White
    Write-Host '        .\02-database.ps1 -UseWindowsAuth' -ForegroundColor Gray
    Write-Host ''
    Write-Host '  2. Or turn on mixed mode and restart SQL Server:' -ForegroundColor White
    Write-Host ('        Set-ItemProperty ''HKLM:\Software\Microsoft\Microsoft SQL Server\MSSQL*\MSSQLServer'' -Name LoginMode -Value 2') -ForegroundColor Gray
    Write-Host '        Restart-Service MSSQL$SQLEXPRESS   (or MSSQLSERVER)' -ForegroundColor Gray
    Write-Host ''
    throw 'Stopped before creating a login that could not be used.'
}

if ($windowsOnly) {
    Write-Host '  [ok]  Windows authentication only — using the app pool identity' -ForegroundColor Green
}

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

# With -UseWindowsAuth the "login" is the app pool's own machine identity, so
# there is no password in play at all: nothing to store in a config file,
# nothing to rotate, nothing to leak.
$principal = if ($UseWindowsAuth) { "IIS APPPOOL\$AppPoolName" } else { $LoginName }
$password = $null

$loginExists = (Invoke-Sql -Query "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.server_principals WHERE name = '$principal';").Trim()

if ($loginExists -eq '0') {
    if ($UseWindowsAuth) {
        # Fails if the pool does not exist yet, because Windows cannot resolve
        # the identity to a SID. The message says so rather than leaving a
        # bare SQL error.
        try {
            Invoke-Sql -Query "CREATE LOGIN [$principal] FROM WINDOWS;"
        }
        catch {
            throw ("Could not create a login for $principal. " +
                   "Run 05-install-iis.ps1 first so the application pool exists, then try again.")
        }
    }
    else {
        $bytes = New-Object byte[] 24
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $password = [Convert]::ToBase64String($bytes) -replace '[+/=]', 'x'

        Invoke-Sql -Query "CREATE LOGIN [$principal] WITH PASSWORD = '$password', CHECK_POLICY = ON;"
    }
    Write-Host "  [ok]  Created login $principal" -ForegroundColor Green
}
else {
    Write-Host "  [ok]  Login $principal already exists" -ForegroundColor Green
}

# --- Rights -----------------------------------------------------------------

# db_owner on this one database only. The app runs EF migrations, which create
# and alter tables, so db_datareader/writer is not enough. It has no rights on
# any other database and none at the server level.
Invoke-Sql -OnDatabase $Database -Query @"
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = '$principal')
    CREATE USER [$principal] FOR LOGIN [$principal];
ALTER ROLE db_owner ADD MEMBER [$principal];
"@
Write-Host "  [ok]  $principal is db_owner on $Database (and nothing else)" -ForegroundColor Green

# --- Prove it actually works ------------------------------------------------

# The original version of this script declared success on having run the
# statements. A SQL login can be created on a Windows-only instance and never
# be able to sign in, so "created" is not the same as "works" — this connects
# as the identity the site will use and checks.

if (-not $UseWindowsAuth) {
    $probe = sqlcmd -S $SqlInstance -d $Database -U $principal -P $password -C -b -h -1 -W `
        -Q "SET NOCOUNT ON; SELECT 'ok';" 2>&1

    if ($LASTEXITCODE -ne 0) {
        throw ("The login was created but cannot sign in:`n{0}`n`n" -f ($probe -join "`n")) +
              "If this says 'Login failed', the instance is probably not accepting SQL logins. " +
              "Enable mixed mode and restart SQL Server, or re-run with -UseWindowsAuth."
    }
    Write-Host "  [ok]  Signed in as $principal and reached $Database" -ForegroundColor Green
}
else {
    # The app pool identity cannot be impersonated from here, so this confirms
    # the grant exists rather than exercising it. 07-verify.ps1 proves the rest
    # by calling an endpoint that reads from the database.
    $granted = (Invoke-Sql -OnDatabase $Database -Query `
        "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.database_principals WHERE name = '$principal';").Trim()
    if ($granted -eq '0') { throw "The database user for $principal was not created." }
    Write-Host "  [ok]  $principal is a user of $Database" -ForegroundColor Green
}

# --- Report -----------------------------------------------------------------

Write-Host "`nDone.`n" -ForegroundColor Green
Write-Host "Connection string for 03-configure.ps1:" -ForegroundColor Cyan

if ($UseWindowsAuth) {
    Write-Host ("  Server=$SqlInstance;Database=$Database;Trusted_Connection=True;" +
        "Encrypt=True;TrustServerCertificate=True;MultipleActiveResultSets=true") -ForegroundColor White
    Write-Host "`nNo password: the site authenticates as $principal." -ForegroundColor Green
}
elseif ($password) {
    Write-Host ("  Server=$SqlInstance;Database=$Database;User Id=$principal;Password=$password;" +
        "Encrypt=True;TrustServerCertificate=True;MultipleActiveResultSets=true") -ForegroundColor White
    Write-Host "`nThis password is shown once and is not stored anywhere. Copy it now." -ForegroundColor Yellow
}
else {
    Write-Host "  (the login already existed, so no password was generated)" -ForegroundColor Yellow
    Write-Host "`nUse the existing password, or reset it with:" -ForegroundColor Yellow
    Write-Host "  ALTER LOGIN [$principal] WITH PASSWORD = '<new>';" -ForegroundColor Gray
}
