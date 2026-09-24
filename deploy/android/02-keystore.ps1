<#
.SYNOPSIS
    Creates the signing keystore each app is signed with.

.DESCRIPTION
    Android identifies an app by its package name and the key it was signed
    with. Lose the key and you cannot publish an update to an installed app
    ever again — there is no recovery, no reset, and no support channel that
    can help. So this refuses to overwrite one that already exists, and the
    keystore is written outside the repository where a deploy cannot touch it
    and git cannot publish it.

    Back up the folder this writes to. It is not in the repository on purpose,
    which means nothing else is backing it up either.

    The password is generated here and stored beside the keystore in a
    properties file that only administrators can read. The build script reads
    that file; it is never passed on a command line, where the process list
    would show it.

.PARAMETER App
    applicant, coordinator, or both. Default both.

.PARAMETER KeystoreDir
    Where the keystores live. Default E:\cbms-keystores.

.PARAMETER ValidityYears
    Default 30. Play requires a key valid past 2033; a short one strands the
    app when it expires.

.EXAMPLE
    .\02-keystore.ps1
    .\02-keystore.ps1 -App coordinator
#>
[CmdletBinding()]
param(
    [ValidateSet('applicant', 'coordinator', 'both')]
    [string] $App = 'both',
    [string] $KeystoreDir = 'E:\cbms-keystores',
    [int] $ValidityYears = 30
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\windows\_common.ps1')

$isAdmin = ([Security.Principal.WindowsPrincipal] `
        [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    throw "Run this from an elevated PowerShell. It writes files only administrators may read."
}

if (-not $env:JAVA_HOME) { throw "JAVA_HOME is not set. Run .\01-prerequisites.ps1." }
$keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
if (-not (Test-Path $keytool)) { throw "No keytool at $keytool. Run .\01-prerequisites.ps1." }

$apps = @{
    applicant   = @{ Alias = 'cbms-applicant'; Cn = 'CBMS Applicant' }
    coordinator = @{ Alias = 'cbms-coordinator'; Cn = 'CBMS Coordinator' }
}
$targets = if ($App -eq 'both') { @('applicant', 'coordinator') } else { @($App) }

if (-not (Test-Path $KeystoreDir)) {
    New-Item -ItemType Directory -Path $KeystoreDir -Force | Out-Null
    Write-Host "  [ok]  Created $KeystoreDir" -ForegroundColor Green
}

Write-Host "`nSigning keys`n" -ForegroundColor Cyan

foreach ($name in $targets) {
    $spec = $apps[$name]
    $store = Join-Path $KeystoreDir "$name-release.keystore"
    $props = Join-Path $KeystoreDir "$name-signing.properties"

    if (Test-Path $store) {
        Write-Host ("  [ok]  {0}: already exists, left alone" -f $name) -ForegroundColor Green
        Write-Host ("        {0}" -f $store) -ForegroundColor Gray
        if (-not (Test-Path $props)) {
            Write-Host "  [WARN] but its properties file is missing, so the build cannot" -ForegroundColor Yellow
            Write-Host "         read the password. If you have it, write it into:" -ForegroundColor Yellow
            Write-Host ("         {0}" -f $props) -ForegroundColor Gray
            continue
        }

        # An earlier version wrote this with a byte order mark, which
        # java.util.Properties folds into the first key — storeFile becomes a
        # key Gradle never looks up, and the failure says nothing about
        # encoding. Rewriting it is safe: the content is unchanged.
        $bytes = [System.IO.File]::ReadAllBytes($props)
        if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
            Set-PlainTextFile -Path $props -Content ([System.IO.File]::ReadAllText($props))
            Write-Host "        rewrote its properties file without the byte order mark" -ForegroundColor Gray
        }
        continue
    }

    # RandomNumberGenerator::Fill is .NET Core only and Windows PowerShell runs
    # on .NET Framework.
    $bytes = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $password = [Convert]::ToBase64String($bytes) -replace '[+/=]', 'x'

    # -storepass and -keypass do appear in this process's command line for the
    # moment keytool runs. There is no stdin route through keytool that avoids
    # it, and the alternative - a password the operator types and then has to
    # keep - is worse on a build server. The keystore that comes out is locked
    # down below.
    Invoke-Native "keytool for $name" $keytool @(
        '-genkeypair', '-noprompt',
        '-alias', $spec.Alias,
        '-keyalg', 'RSA', '-keysize', '2048',
        '-validity', [string]($ValidityYears * 365),
        '-keystore', $store,
        '-storetype', 'PKCS12',
        '-storepass', $password,
        '-keypass', $password,
        '-dname', ("CN={0}, OU=NDIE, O=Ministry of MSME, L=New Delhi, S=Delhi, C=IN" -f $spec.Cn)
    ) | Out-Null

    # No BOM. java.util.Properties reads a byte order mark as part of the first
    # key, so storeFile would become a key Gradle never looks up and the path
    # would come back null — with nothing to say why.
    Set-PlainTextFile -Path $props -Content (@(
            "# Read by deploy/android/03-build-apk.ps1. Not in the repository.",
            "storeFile=$($store -replace '\\', '/')",
            "storePassword=$password",
            "keyAlias=$($spec.Alias)",
            "keyPassword=$password"
        ) -join "`r`n")

    Write-Host ("  [ok]  {0}: created" -f $name) -ForegroundColor Green
    Write-Host ("        {0}" -f $store) -ForegroundColor Gray
}

# --- Lock the folder down ----------------------------------------------------

# Administrators and SYSTEM, nobody else, inheritance off so a permissive
# parent cannot widen it. FullControl rather than Read: this script has to be
# able to add the second app's key later.
$folder = Get-Item $KeystoreDir
$acl = $folder.GetAccessControl('Access')
$acl.SetAccessRuleProtection($true, $false)
$acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) | Out-Null }
foreach ($identity in @('BUILTIN\Administrators', 'NT AUTHORITY\SYSTEM')) {
    $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
                $identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
}
$folder.SetAccessControl($acl)
Write-Host "  [ok]  $KeystoreDir restricted to Administrators and SYSTEM" -ForegroundColor Green

Write-Host ''
Write-Host "Back this folder up somewhere off this machine." -ForegroundColor Yellow
Write-Host "A lost signing key cannot be replaced: the app can never be updated again," -ForegroundColor Yellow
Write-Host "only republished under a different package name." -ForegroundColor Yellow
Write-Host "`nNext: .\03-build-apk.ps1`n" -ForegroundColor Green
