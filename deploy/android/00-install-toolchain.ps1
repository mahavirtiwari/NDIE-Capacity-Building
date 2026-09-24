<#
.SYNOPSIS
    Installs JDK 17 and the Android command line tools, and sets the variables
    that point at them.

.DESCRIPTION
    The only script in this repository that installs anything. The web tier
    scripts deliberately do not — a production box has a change process and a
    script that quietly pulls down runtimes is the wrong thing to run on one.
    A build toolchain is different: it is inert, it touches nothing the site
    uses, and typing these steps out by hand is where the mistakes happen.

    Nothing goes into Program Files and nothing runs an installer. Both are
    archives unpacked into one folder, so removing the toolchain is deleting
    that folder and clearing two variables.

    The variables are set machine-wide *and* in this session, so the next
    script works without opening a new shell.

.PARAMETER ToolchainDir
    Where the JDK and the SDK go. Default E:\Android.

.PARAMETER CmdlineToolsUrl
    Override when Google publishes a newer build. The page that lists them is
    https://developer.android.com/studio#command-line-tools-only

.EXAMPLE
    .\00-install-toolchain.ps1
#>
[CmdletBinding()]
param(
    [string] $ToolchainDir = 'E:\Android',
    [string] $JdkUrl = 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk',
    [string] $CmdlineToolsUrl = 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip'
)

$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal] `
        [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    throw "Run this from an elevated PowerShell. It sets machine-wide environment variables."
}

# Windows PowerShell 5.1 offers SSL 3.0 and TLS 1.0 unless told otherwise, and
# both download hosts refuse them. Without this the failure is a closed
# connection that says nothing about the cause.
$protocols = [Net.SecurityProtocolType]::Tls12
if ([Enum]::IsDefined([Net.SecurityProtocolType], 'Tls13')) {
    $protocols = $protocols -bor [Net.SecurityProtocolType]::Tls13
}
[Net.ServicePointManager]::SecurityProtocol = $protocols

$jdkDir = Join-Path $ToolchainDir 'jdk-17'
$sdkDir = Join-Path $ToolchainDir 'Sdk'
$staging = Join-Path $env:TEMP ("cbms-toolchain-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $staging -Force | Out-Null

function Get-File {
    param([string] $Url, [string] $Destination, [string] $What)

    Write-Host ("  Downloading {0}..." -f $What) -ForegroundColor Gray
    # Invoke-WebRequest renders a progress bar by writing to the console on
    # every chunk, which on a large file costs more time than the transfer.
    $previous = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'
    try { Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing -TimeoutSec 600 }
    finally { $ProgressPreference = $previous }

    $size = [Math]::Round((Get-Item $Destination).Length / 1MB, 1)
    if ($size -lt 1) { throw "$What downloaded as only $size MB. The URL is probably wrong." }
    Write-Host ("  [ok]  {0} ({1} MB)" -f $What, $size) -ForegroundColor Green
}

function Expand-Single {
    <#
        Both archives wrap their contents in one top level folder whose name
        carries a version. Unpacking to a staging area and moving that folder
        into place keeps the final path stable, so JAVA_HOME does not have to
        be repointed every time the JDK is refreshed.
    #>
    param([string] $Zip, [string] $Into, [string] $FinalPath)

    Expand-Archive -Path $Zip -DestinationPath $Into -Force
    $roots = @(Get-ChildItem -Path $Into -Directory)
    if ($roots.Count -ne 1) {
        throw "Expected one folder inside $Zip, found $($roots.Count)."
    }

    $parent = Split-Path $FinalPath -Parent
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    Move-Item -Path $roots[0].FullName -Destination $FinalPath -Force
}

Write-Host "`nInstalling the Android build toolchain into $ToolchainDir`n" -ForegroundColor Cyan

try {
    # --- JDK 17 --------------------------------------------------------------

    if (Test-Path (Join-Path $jdkDir 'bin\java.exe')) {
        Write-Host "  [ok]  JDK 17 already at $jdkDir" -ForegroundColor Green
    }
    else {
        $zip = Join-Path $staging 'jdk17.zip'
        Get-File -Url $JdkUrl -Destination $zip -What 'JDK 17 (Temurin)'
        Expand-Single -Zip $zip -Into (Join-Path $staging 'jdk') -FinalPath $jdkDir
        Write-Host "  [ok]  JDK 17 at $jdkDir" -ForegroundColor Green
    }

    $env:JAVA_HOME = $jdkDir
    [Environment]::SetEnvironmentVariable('JAVA_HOME', $jdkDir, 'Machine')

    $reported = & (Join-Path $jdkDir 'bin\java.exe') -version 2>&1 | Select-Object -First 1
    if ($reported -notmatch '"17\.') {
        throw "The JDK at $jdkDir reports $reported, not 17. React Native 0.86 needs 17."
    }
    Write-Host ("  [ok]  {0}" -f $reported) -ForegroundColor Green

    # --- Android command line tools ------------------------------------------

    $toolsPath = Join-Path $sdkDir 'cmdline-tools\latest'
    if (Test-Path (Join-Path $toolsPath 'bin\sdkmanager.bat')) {
        Write-Host "  [ok]  Command line tools already at $toolsPath" -ForegroundColor Green
    }
    else {
        $zip = Join-Path $staging 'cmdline-tools.zip'
        Get-File -Url $CmdlineToolsUrl -Destination $zip -What 'Android command line tools'
        # The zip unpacks to cmdline-tools\, and sdkmanager insists on being at
        # cmdline-tools\latest\ — it works out where the SDK root is from its
        # own position, and refuses to run from anywhere else.
        Expand-Single -Zip $zip -Into (Join-Path $staging 'tools') -FinalPath $toolsPath
        Write-Host "  [ok]  Command line tools at $toolsPath" -ForegroundColor Green
    }

    $env:ANDROID_HOME = $sdkDir
    $env:ANDROID_SDK_ROOT = $sdkDir
    [Environment]::SetEnvironmentVariable('ANDROID_HOME', $sdkDir, 'Machine')
    [Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $sdkDir, 'Machine')

    # --- Licences and the one package Gradle will not fetch itself -----------

    $sdkmanager = Join-Path $toolsPath 'bin\sdkmanager.bat'

    # Gradle downloads the platform and build-tools the project asks for, so
    # they follow the app rather than a number pinned here. It will not accept
    # the licences on your behalf, and an unattended build stops dead on a
    # prompt nobody is there to answer.
    Write-Host "  Accepting the SDK licences..." -ForegroundColor Gray
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        # One 'y' per licence, and there are more of them in some releases than
        # in others.
        (1..40 | ForEach-Object { 'y' }) | & $sdkmanager --licenses 2>&1 | Out-Null
    }
    finally { $ErrorActionPreference = $previous }

    if (-not (Test-Path (Join-Path $sdkDir 'licenses\android-sdk-license'))) {
        throw "The licences were not accepted. Run it by hand and answer y: `"$sdkmanager`" --licenses"
    }
    Write-Host "  [ok]  Licences accepted" -ForegroundColor Green

    # platform-tools carries adb, which is how an APK gets onto a plugged-in
    # phone. Gradle never asks for it, so it would otherwise be missing at
    # exactly the moment it is wanted.
    Write-Host "  Installing platform-tools (adb)..." -ForegroundColor Gray
    $ErrorActionPreference = 'Continue'
    try { & $sdkmanager 'platform-tools' 2>&1 | Out-Null }
    finally { $ErrorActionPreference = $previous }

    if (Test-Path (Join-Path $sdkDir 'platform-tools\adb.exe')) {
        Write-Host "  [ok]  adb installed" -ForegroundColor Green
    }
    else {
        Write-Host "  [warn] platform-tools did not install. Only adb needs it; the build does not." -ForegroundColor Yellow
    }
}
finally {
    Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`nDone." -ForegroundColor Green
Write-Host "  JAVA_HOME    = $env:JAVA_HOME" -ForegroundColor Gray
Write-Host "  ANDROID_HOME = $env:ANDROID_HOME" -ForegroundColor Gray
Write-Host ""
Write-Host "Set for this session as well as machine-wide, so you can carry straight on:" -ForegroundColor Cyan
Write-Host "  .\01-prerequisites.ps1" -ForegroundColor Gray
Write-Host "  .\02-keystore.ps1" -ForegroundColor Gray
Write-Host "  .\03-build-apk.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "Any other shell already open will not see the variables until it is reopened." -ForegroundColor Yellow
Write-Host ""
