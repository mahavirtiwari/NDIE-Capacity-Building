<#
.SYNOPSIS
    Checks the server can build an Android APK, and says what is missing.

.DESCRIPTION
    Installs nothing. A build box usually has a change process, and a script
    that quietly pulls down a JDK and an SDK is the wrong thing to run on one —
    so this reports, and prints the command for anything absent.

    Run it, fix whatever it names, run it again until it is clean.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\01-prerequisites.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'
$script:Missing = @()

function Test-Item {
    param([string] $Name, [scriptblock] $Check, [string] $Fix)

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

Write-Host "`nChecking what is needed to build the CBMS Android apps`n" -ForegroundColor Cyan

# --- Node --------------------------------------------------------------------

Test-Item -Name 'Node.js 20+' `
    -Check {
    $v = (node --version 2>$null)
    $v -and ([int](($v -replace '^v', '') -split '\.')[0]) -ge 20
} `
    -Fix 'Install Node.js 20 LTS from https://nodejs.org/'

# --- Java --------------------------------------------------------------------

# React Native 0.86 builds on JDK 17. A newer JDK is not a safe substitute:
# the Android Gradle Plugin pinned by the Expo template rejects it outright,
# and the message it gives is about Gradle rather than about Java.
Test-Item -Name 'JDK 17 (JAVA_HOME set to it)' `
    -Check {
    if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) { return $false }
    $version = & (Join-Path $env:JAVA_HOME 'bin\java.exe') -version 2>&1 | Select-Object -First 1
    $version -match '"17\.'
} `
    -Fix 'Install Temurin JDK 17 from https://adoptium.net/temurin/releases/?version=17 and set JAVA_HOME to it: [Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot", "Machine")'

Test-Item -Name 'keytool (comes with the JDK)' `
    -Check { $env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\keytool.exe')) } `
    -Fix 'Part of the JDK above. Once JAVA_HOME is right this passes.'

# --- Android SDK -------------------------------------------------------------

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }

Test-Item -Name 'ANDROID_HOME points at an Android SDK' `
    -Check { $sdk -and (Test-Path $sdk) } `
    -Fix @'
Download the command line tools (Windows) from
https://developer.android.com/studio#command-line-tools-only
Unzip so that the layout is E:\Android\Sdk\cmdline-tools\latest\bin, then:
  [Environment]::SetEnvironmentVariable("ANDROID_HOME", "E:\Android\Sdk", "Machine")
Open a new shell and run 02-keystore.ps1 afterwards.
'@

Test-Item -Name 'sdkmanager' `
    -Check {
    $sdk -and (Test-Path (Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'))
} `
    -Fix 'The cmdline-tools must sit at <ANDROID_HOME>\cmdline-tools\latest\ — the zip unpacks to cmdline-tools\, so rename that inner folder to latest.'

# The build script installs the exact platform and build-tools the generated
# project asks for, so this only confirms the licences are accepted: without
# that, the first install fails with a prompt nobody is there to answer.
Test-Item -Name 'Android SDK licences accepted' `
    -Check {
    $sdk -and (Test-Path (Join-Path $sdk 'licenses\android-sdk-license'))
} `
    -Fix 'Accept them once: & "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --licenses'

# --- Disk --------------------------------------------------------------------

Test-Item -Name 'At least 10 GB free where the SDK lives' `
    -Check {
    if (-not $sdk) { return $false }
    $drive = (Get-Item $sdk -ErrorAction SilentlyContinue).PSDrive
    $drive -and ($drive.Free / 1GB) -ge 10
} `
    -Fix 'A first build downloads the platform, build-tools and a Gradle distribution, and the Gradle caches grow. Free some space or move ANDROID_HOME.'

# --- Result ------------------------------------------------------------------

Write-Host ''
if ($script:Missing.Count -eq 0) {
    Write-Host "Everything is in place. Next: .\02-keystore.ps1" -ForegroundColor Green
    exit 0
}

Write-Host ("{0} item(s) need attention:`n" -f $script:Missing.Count) -ForegroundColor Yellow
foreach ($item in $script:Missing) {
    Write-Host ("  {0}" -f $item.Name) -ForegroundColor Yellow
    Write-Host ("      {0}`n" -f $item.Fix) -ForegroundColor Gray
}
exit 1
