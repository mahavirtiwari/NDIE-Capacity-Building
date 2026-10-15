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
        $ConnectionString = $loaded.Database.ConnectionString
    }
}

if (-not $ConnectionString) {
    throw 'No connection string. Pass -ConnectionString, or run this on the server ' +
          'where deploy\windows\settings.production.psd1 has one.'
}

$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder $ConnectionString
$database = $builder.InitialCatalog

if ($database -notmatch 'stag|probe|test' -and -not $IKnowThisIsNotStaging) {
    throw "Refusing to write test accounts into '$database'. This is for staging. " +
          "If that really is a test database, pass -IKnowThisIsNotStaging."
}

$tool = Join-Path $PSScriptRoot 'accounts'

# ------------------------------------------------------------------ removing

if ($Remove) {
    if ($PSCmdlet.ShouldProcess($database, 'Delete every LOADTEST applicant')) {
        dotnet run --project $tool -- remove $ConnectionString $OutFile
        if ($LASTEXITCODE -ne 0) { throw 'The accounts tool failed. Nothing was removed.' }
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

dotnet run --project $tool -- make $ConnectionString $Count $plain $OutFile
if ($LASTEXITCODE -ne 0) { throw 'The accounts tool failed.' }

Write-Host ''
Write-Host '  Check one signs in before running a thousand of them:' -ForegroundColor Cyan
Write-Host '    .\run.ps1 -Profile smoke -Journey applicant' -ForegroundColor Cyan
Write-Host ''
