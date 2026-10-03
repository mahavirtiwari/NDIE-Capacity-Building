<#
.SYNOPSIS
    The applicant app: install the built APK onto the phones plugged in here.

.DESCRIPTION
    What follows release-applicant-app.ps1. That builds and signs an APK into
    E:\cbms-apk; this puts it on a device.

    For the handsets somebody has in front of them — a pilot phone, the ones
    field staff carry, a tablet in a training centre, an emulator on the build
    server. Applicants install from wherever the APK is published to them, and
    that is not this script.

    Builds nothing. The newest APK already in the output folder is the one that
    goes on, so this can be run on a laptop that has never built anything, as
    long as it has adb and the APK was copied to it.

.PARAMETER ApkPath
    A specific APK, instead of the newest one in OutputDir.

.PARAMETER OutputDir
    Where the APKs are, matching the release script.

.PARAMETER Serial
    One device, as adb devices lists it. Without it, every attached device.

.PARAMETER Downgrade
    Allow an older versionCode over a newer one, for going back to a
    known-good build on a test handset.

.PARAMETER Force
    Uninstall first when the installed copy is signed with a different key.
    That deletes what the copy had stored, so it is never done unasked.

.EXAMPLE
    .\install-applicant-app.ps1
    .\install-applicant-app.ps1 -Serial RZ8N70ABCDE
    .\install-applicant-app.ps1 -ApkPath E:\cbms-apk\cbms-applicant-v7-20261001.apk
#>
[CmdletBinding()]
param(
    [string] $ApkPath,
    [string] $OutputDir = 'E:\cbms-apk',
    [string] $Serial,
    [switch] $Downgrade,
    [switch] $Force
)

$ErrorActionPreference = 'Stop'

& (Join-Path $PSScriptRoot 'android\04-install-apk.ps1') `
    -App applicant `
    -ApkPath $ApkPath `
    -OutputDir $OutputDir `
    -Serial $Serial `
    -Downgrade:$Downgrade `
    -Force:$Force

exit $LASTEXITCODE
