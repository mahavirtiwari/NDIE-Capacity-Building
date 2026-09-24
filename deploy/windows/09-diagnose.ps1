<#
.SYNOPSIS
    Works out why the API cannot reach the database.

.DESCRIPTION
    The shape to look for: the portal loads, an unknown /api path returns 404,
    and every endpoint that reads from the database returns 500 with /health at
    503. That is an application which started perfectly well and cannot open a
    connection - so the question is only ever which identity it is presenting
    and what SQL Server thinks of it.

    Reads only. Nothing here changes the site, the database or the certificate.

.EXAMPLE
    .\09-diagnose.ps1
#>
[CmdletBinding()]
param(
    [string] $SitePath = 'E:\inetpub\cbms',
    [string] $PoolName = 'CbmsAppPool',
    [string] $BaseUrl = 'https://leanstaging.qci.org.in'
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot '_common.ps1')

function Field {
    param([string] $Text, [string] $Key)
    $m = [regex]::Match($Text, "(?i)\b$Key\s*=\s*([^;]+)")
    if ($m.Success) { $m.Groups[1].Value.Trim() } else { $null }
}

Write-Host "`nWhy the API cannot reach the database`n" -ForegroundColor Cyan

# --- What is the site configured to do? --------------------------------------

$config = Join-Path $SitePath 'appsettings.Production.json'
if (-not (Test-Path $config)) { throw "No $config. Run 03-configure.ps1 first." }

$connectionString = (Get-Content $config -Raw | ConvertFrom-Json).ConnectionStrings.Default
if (-not $connectionString) { throw "ConnectionStrings:Default is empty in $config." }

$server = Field $connectionString 'Server'
if (-not $server) { $server = Field $connectionString 'Data Source' }
$database = Field $connectionString 'Database'
if (-not $database) { $database = Field $connectionString 'Initial Catalog' }
$sqlUser = Field $connectionString 'User Id'
if (-not $sqlUser) { $sqlUser = Field $connectionString 'Uid' }

$trusted = $connectionString -match '(?i)(Trusted_Connection|Integrated Security)\s*=\s*(True|SSPI|yes)'
$poolIdentity = "IIS APPPOOL\$PoolName"
$principal = if ($trusted) { $poolIdentity } else { $sqlUser }

Write-Host "  Connection" -ForegroundColor Cyan
Write-Host ("    server    : {0}" -f $server) -ForegroundColor Gray
Write-Host ("    database  : {0}" -f $database) -ForegroundColor Gray
if ($trusted) {
    Write-Host ("    connects as: {0}   (Windows authentication)" -f $principal) -ForegroundColor Gray
}
elseif ($sqlUser) {
    Write-Host ("    connects as: {0}   (SQL login)" -f $principal) -ForegroundColor Gray
}
else {
    Write-Host "    connects as: neither a user id nor Trusted_Connection is set" -ForegroundColor Red
    Write-Host "                 That on its own explains the failure." -ForegroundColor Red
}

# --- Who does the site actually run as? --------------------------------------

Import-Module WebAdministration -ErrorAction SilentlyContinue
try {
    $pool = Get-Item "IIS:\AppPools\$PoolName" -ErrorAction Stop
    $identityType = $pool.processModel.identityType
    $runsAs = if ($identityType -eq 'SpecificUser') { $pool.processModel.userName } else { $poolIdentity }
    Write-Host ("    pool runs as: {0}  ({1})" -f $runsAs, $identityType) -ForegroundColor Gray

    if ($trusted -and $identityType -eq 'SpecificUser') {
        Write-Host "  [!] The pool runs as a named account, so the grant made for" -ForegroundColor Yellow
        Write-Host ("      {0} does not apply. SQL sees {1}." -f $poolIdentity, $pool.processModel.userName) -ForegroundColor Yellow
        $principal = $pool.processModel.userName
    }
}
catch {
    Write-Host ("    pool {0}: not found" -f $PoolName) -ForegroundColor Yellow
}

# --- Is the instance reachable, and is that principal known to it? -----------

Write-Host "`n  SQL Server" -ForegroundColor Cyan

# -E: as whoever is running this script, which is an administrator and proves
# nothing about the site. It establishes that the instance in the connection
# string is the right one and that the database exists - the two things that
# would make everything below meaningless.
try {
    $reachable = Invoke-Native 'sqlcmd' 'sqlcmd' @(
        '-S', $server, '-d', 'master', '-E', '-C', '-b', '-h', '-1', '-W',
        # CAST because SERVERPROPERTY returns sql_variant, which CONCAT will
        # not convert on its own.
        '-Q', "SET NOCOUNT ON; SELECT CONCAT(@@SERVERNAME, ' | ', CAST(SERVERPROPERTY('ProductLevel') AS nvarchar(32)));")
    Write-Host ("    reachable : {0}" -f ($reachable -join ' ')) -ForegroundColor Gray
}
catch {
    # Say what went wrong rather than assuming. "Cannot connect" and "connected
    # and the query was rejected" look identical from here otherwise, and only
    # one of them is about the server being the wrong one.
    Write-Host ("    [FAIL] {0} did not answer the probe:" -f $server) -ForegroundColor Red
    Write-Host ("           {0}" -f $_.Exception.Message) -ForegroundColor Gray
    Write-Host "           If it could not connect and the instance is named, the" -ForegroundColor Gray
    Write-Host "           connection string needs that name: localhost is not the" -ForegroundColor Gray
    Write-Host "           same as localhost\SQLEXPRESS." -ForegroundColor Gray
    Write-Host ''
    exit 1
}

$dbExists = (Invoke-Native 'sqlcmd' 'sqlcmd' @(
    '-S', $server, '-d', 'master', '-E', '-C', '-b', '-h', '-1', '-W',
    '-Q', "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.databases WHERE name = '$database';")).Trim()

if ($dbExists -eq '0') {
    Write-Host ("    [FAIL] there is no database called {0} on this instance." -f $database) -ForegroundColor Red
    Write-Host ''
    exit 1
}
Write-Host ("    database {0}: present" -f $database) -ForegroundColor Gray

if ($principal) {
    $login = (Invoke-Native 'sqlcmd' 'sqlcmd' @(
        '-S', $server, '-d', 'master', '-E', '-C', '-b', '-h', '-1', '-W',
        '-Q', "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.server_principals WHERE name = '$principal';")).Trim()

    $dbUser = (Invoke-Native 'sqlcmd' 'sqlcmd' @(
        '-S', $server, '-d', $database, '-E', '-C', '-b', '-h', '-1', '-W',
        '-Q', "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.database_principals WHERE name = '$principal';")).Trim()

    $isOwner = (Invoke-Native 'sqlcmd' 'sqlcmd' @(
        '-S', $server, '-d', $database, '-E', '-C', '-b', '-h', '-1', '-W',
        '-Q', "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.database_role_members m
                 JOIN sys.database_principals r ON r.principal_id = m.role_principal_id
                 JOIN sys.database_principals u ON u.principal_id = m.member_principal_id
                WHERE r.name = 'db_owner' AND u.name = '$principal';")).Trim()

    Write-Host ("    login {0}: {1}" -f $principal, $(if ($login -eq '0') { 'MISSING' } else { 'present' })) `
        -ForegroundColor $(if ($login -eq '0') { 'Red' } else { 'Gray' })
    Write-Host ("    user in {0}: {1}" -f $database, $(if ($dbUser -eq '0') { 'MISSING' } else { 'present' })) `
        -ForegroundColor $(if ($dbUser -eq '0') { 'Red' } else { 'Gray' })
    Write-Host ("    db_owner  : {0}" -f $(if ($isOwner -eq '0') { 'NO' } else { 'yes' })) `
        -ForegroundColor $(if ($isOwner -eq '0') { 'Red' } else { 'Gray' })

    if ($login -eq '0' -or $dbUser -eq '0' -or $isOwner -eq '0') {
        Write-Host ''
        Write-Host "  That is the fault. Grant it:" -ForegroundColor Cyan
        if ($trusted) {
            Write-Host ("    .\02-database.ps1 -SqlInstance '{0}' -Database {1} -UseWindowsAuth -AppPoolName {2}" -f $server, $database, $PoolName) -ForegroundColor Gray
        }
        else {
            Write-Host ("    .\02-database.ps1 -SqlInstance '{0}' -Database {1} -LoginName {2}" -f $server, $database, $principal) -ForegroundColor Gray
            Write-Host "    (then re-run 03-configure.ps1 with the connection string it prints)" -ForegroundColor Gray
        }
    }
}

# --- What did the application itself say? ------------------------------------

# On Windows the default host adds the event log as a logging provider at
# Warning and above, so the exception behind a 500 is usually sitting there.
# It is far more specific than anything that can be inferred from outside.
Write-Host "`n  What the application logged" -ForegroundColor Cyan

$since = (Get-Date).AddHours(-2)
$entries = @()
try {
    $entries = @(Get-WinEvent -FilterHashtable @{
            LogName   = 'Application'
            StartTime = $since
        } -ErrorAction Stop |
        Where-Object {
            $_.LevelDisplayName -in 'Error', 'Warning' -and
            $_.Message -match 'Ntms|SqlException|EntityFrameworkCore|Login failed|IIS AspNetCore'
        } | Select-Object -First 5)
}
catch { }

if ($entries.Count -eq 0) {
    Write-Host "    nothing in the last two hours." -ForegroundColor Gray
    Write-Host "    Hit $BaseUrl/api/branding once and run this again - the entry is" -ForegroundColor Gray
    Write-Host "    written when the request fails, not when the application starts." -ForegroundColor Gray
}
else {
    foreach ($entry in $entries) {
        Write-Host ("    {0:HH:mm:ss}  {1}" -f $entry.TimeCreated, $entry.ProviderName) -ForegroundColor Yellow
        $first = ($entry.Message -split "`n" | Where-Object { $_.Trim() } | Select-Object -First 6)
        $first | ForEach-Object { Write-Host ("      {0}" -f $_.Trim()) -ForegroundColor Gray }
        Write-Host ''
    }
}

Write-Host ''
