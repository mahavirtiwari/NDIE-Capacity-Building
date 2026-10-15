<#
.SYNOPSIS
    Makes throwaway applicant accounts for a load run, and the CSV the
    scripts sign in with.

.DESCRIPTION
    THIS WRITES TO THE DATABASE. It is the one script here that does;
    everything else reads.

    A load run needs an account per caller, because the API counts its
    rate limit per signed-in account: a thousand callers wearing one
    login is one account asking for six hundred things a minute, and the
    limiter - correctly - refuses the rest. A run like that measures the
    limiter and tells you nothing about the system.

    Sign-up cannot be scripted, and that is deliberate: it e-mails a
    one-time code and the sender withholds the body of anything carrying
    a credential. So these are written straight in, by a small tool in
    accounts\ that hashes the password with the application's own hasher.
    It has to be that one: the format is ASP.NET Core Identity's v3, and
    a hand-rolled version produces a thousand accounts that exist and
    cannot sign in, with the first sign of it being a load run where
    every sign-in fails.

    The accounts are marked. Every code begins LOADTEST and every address
    is at loadtest.invalid, so -Remove finds them again and so nobody
    mistakes one for somebody who signed up. Run -Remove when the testing
    is done: a staging database with a thousand fake applicants in it is
    one nobody can demonstrate from.

.PARAMETER Count
    How many to make. One per caller, so 1000 for the load profile.

.PARAMETER Remove
    Delete the accounts this made, and the CSV, instead of making them.

.EXAMPLE
    .\accounts.ps1 -Count 1000
    .\accounts.ps1 -Remove
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [int] $Count = 1000,
    [string] $ConnectionString,
    [string] $OutFile = (Join-Path $PSScriptRoot 'accounts-applicant.csv'),
    [switch] $Remove,
    [switch] $IKnowThisIsNotStaging
)

$ErrorActionPreference = 'Stop'

# --------------------------------------------------------- where it points

if (-not $ConnectionString) {
    $settings = Join-Path $PSScriptRoot '..\windows\settings.production.psd1'
    if (Test-Path $settings) {
        $loaded = Import-PowerShellDataFile $settings

        # settings.production.psd1 holds the instance and the database and
        # deliberately not the connection string - one place for a password
        # is enough - so it is read from the file 03-configure.ps1 wrote for
        # the site, which is where that one place is.
        $appsettings = Join-Path $loaded.SitePath 'appsettings.Production.json'
        if (Test-Path $appsettings) {
            $ConnectionString =
                (Get-Content $appsettings -Raw | ConvertFrom-Json).ConnectionStrings.Default
        }

        # Failing that, the same instance over Windows authentication: how
        # every other script in deploy\windows reaches this database, and it
        # needs no password at all.
        if (-not $ConnectionString -and $loaded.SqlInstance -and $loaded.Database) {
            $ConnectionString =
                "Server=$($loaded.SqlInstance);Database=$($loaded.Database);" +
                'Trusted_Connection=True;TrustServerCertificate=True'
        }
    }
}

if (-not $ConnectionString) {
    throw 'No connection string. Run this on the server, where it is read from the ' +
          "site's appsettings.Production.json, or pass -ConnectionString."
}

$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder $ConnectionString
$database = $builder.InitialCatalog

if ($database -notmatch 'stag|probe|test' -and -not $IKnowThisIsNotStaging) {
    throw "Refusing to write test accounts into '$database' unasked. Staging and " +
          "production are one machine and one database here, so the name cannot " +
          "tell them apart and this is the only thing standing between a load run " +
          "and a thousand fake applicants in the live data. Pass " +
          "-IKnowThisIsNotStaging if that is what you mean to do, and run -Remove " +
          "the moment the testing is finished."
}

$tool = Join-Path $PSScriptRoot 'accounts'

# ------------------------------------------------------------------ removing

if ($Remove) {
    if ($PSCmdlet.ShouldProcess($database, 'Delete every LOADTEST applicant')) {
        $env:LOADTEST_CONNECTION = $ConnectionString
        try {
            dotnet run --project $tool -- remove $OutFile
            if ($LASTEXITCODE -ne 0) { throw 'The accounts tool failed. Nothing was removed.' }
        } finally {
            Remove-Item Env:\LOADTEST_CONNECTION -ErrorAction SilentlyContinue
        }
    }
    return
}

# ------------------------------------------------------------- the password

Write-Host ''
Write-Host '  A password for the test accounts. It is written to the CSV beside' -ForegroundColor Cyan
Write-Host '  this script, which is git-ignored - these are throwaway logins on' -ForegroundColor Cyan
Write-Host '  staging and nothing else, and -Remove deletes both.' -ForegroundColor Cyan
Write-Host ''

$secure = Read-Host -Prompt '  Password for the load-test accounts' -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

if ($plain.Length -lt 8) { throw 'Give it at least eight characters.' }

# ------------------------------------------------------------------ making

if (-not $PSCmdlet.ShouldProcess($database, "Create $Count LOADTEST applicants")) { return }

# Through the environment, not the command line: a command line is
# readable by anything on the box that can list processes, and both of
# these are secrets for as long as the accounts exist.
$env:LOADTEST_CONNECTION = $ConnectionString
$env:LOADTEST_PASSWORD = $plain
try {
    dotnet run --project $tool -- make $Count $OutFile
    if ($LASTEXITCODE -ne 0) { throw 'The accounts tool failed.' }
} finally {
    Remove-Item Env:\LOADTEST_CONNECTION, Env:\LOADTEST_PASSWORD -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host '  Check one signs in before running a thousand of them:' -ForegroundColor Cyan
Write-Host '    .\run.ps1 -Profile smoke -Journey applicant' -ForegroundColor Cyan
Write-Host ''
