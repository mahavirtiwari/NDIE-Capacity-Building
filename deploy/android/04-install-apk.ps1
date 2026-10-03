<#
.SYNOPSIS
    Installs a built APK onto the Android devices plugged into this machine.

.DESCRIPTION
    The other half of 03-build-apk.ps1. That one produces a signed APK in
    E:\cbms-apk; this one puts it on a phone.

    For the devices somebody can hold: pilot handsets, the phones field staff
    carry, a tablet in a training centre, an emulator on the build server.
    Applicants install from wherever the APK is published to them, which is a
    different problem and not this script's.

    Nothing is guessed. The APK is read for the package name and versionCode it
    actually carries rather than trusting its filename, every attached device is
    reported whether it was installed to or not, and the two failures that
    account for almost every "app not installed" on a phone — a different
    signing key, and a versionCode that is not higher — are named in those
    terms instead of being passed through as an adb error code.

.PARAMETER App
    applicant, coordinator, or both. Default applicant.

.PARAMETER ApkPath
    A specific APK. Without it the newest in OutputDir for that app is used,
    by versionCode, which is the one 03-build-apk.ps1 just wrote.

.PARAMETER OutputDir
    Where the APKs are, matching the build script.

.PARAMETER Serial
    One device, as adb devices lists it. Without it every attached device gets
    it, which is the point when a trolley of handsets is being set up.

.PARAMETER Downgrade
    Allow an older versionCode over a newer one. Android refuses this by
    default and it fails on many devices regardless of the flag; it is here for
    going back to a known-good build on a test handset.

.PARAMETER Force
    Uninstall first when the installed copy is signed with a different key.
    This deletes everything that copy had stored — the session, and any exam in
    progress — so it is never done without asking for it.

.EXAMPLE
    .\04-install-apk.ps1
    .\04-install-apk.ps1 -App both
    .\04-install-apk.ps1 -Serial RZ8N70ABCDE
    .\04-install-apk.ps1 -ApkPath E:\cbms-apk\cbms-applicant-v7-20261001.apk
#>
[CmdletBinding()]
param(
    [ValidateSet('applicant', 'coordinator', 'both')]
    [string] $App = 'applicant',
    [string] $ApkPath,
    [string] $OutputDir = 'E:\cbms-apk',
    [string] $Serial,
    [switch] $Downgrade,
    [switch] $Force
)

$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'windows\_common.ps1')

# The package names are the app's identity to Android, and they are declared in
# each app's app.json. Repeated here because this script reads an APK that was
# built from a checkout it does not need to have.
$apps = @{
    applicant   = @{ Label = 'CBMS Applicant';   Package = 'in.gov.msme.ntms.applicant'; Prefix = 'cbms-applicant' }
    coordinator = @{ Label = 'CBMS Coordinator'; Package = 'in.gov.msme.cbms.coordinator'; Prefix = 'cbms-coordinator' }
}
$targets = if ($App -eq 'both') { @('applicant', 'coordinator') } else { @($App) }

if ($ApkPath -and $App -eq 'both') {
    throw 'One APK cannot be two apps. Pass -ApkPath with -App applicant or -App coordinator.'
}

Write-Host "`n=== Installing onto attached devices ===`n" -ForegroundColor Cyan

# ---------------------------------------------------------------- the tools

function Find-SdkTool {
    <#
        adb lives in platform-tools and aapt2 in build-tools, where the folder
        is a version number that changes with whatever Gradle last downloaded —
        so the newest is taken rather than a version being written down here.
    #>
    param([Parameter(Mandatory)] [string] $Name)

    $onPath = Get-Command $Name -ErrorAction SilentlyContinue
    if ($onPath) { return $onPath.Source }

    $sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
    if (-not $sdk) { return $null }

    $direct = Join-Path $sdk ("platform-tools\{0}.exe" -f $Name)
    if (Test-Path $direct) { return $direct }

    $buildTools = Join-Path $sdk 'build-tools'
    if (Test-Path $buildTools) {
        $found = Get-ChildItem $buildTools -Directory |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName ("{0}.exe" -f $Name) } |
            Where-Object { Test-Path $_ } |
            Select-Object -First 1
        if ($found) { return $found }
    }
    return $null
}

$adb = Find-SdkTool 'adb'
if (-not $adb) {
    # Written out rather than thrown. This is something for the reader to go
    # and do, and a PowerShell exception renders the whole text twice with a
    # stack trace between the copies, which buries it.
    Write-Host '  adb was not found. It comes with the Android SDK platform-tools:' -ForegroundColor Red
    Write-Host ''
    Write-Host '    & "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" "platform-tools"' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host '  or run .\00-install-toolchain.ps1, which installs it. If the SDK is there' -ForegroundColor Red
    Write-Host '  but ANDROID_HOME is not set for this account, set it machine-wide and' -ForegroundColor Red
    Write-Host '  open a new shell.' -ForegroundColor Red
    Write-Host ''
    exit 3
}
Write-Host ("  adb          : {0}" -f $adb) -ForegroundColor Gray

# aapt2 is how the APK is asked what it is. Without it the filename has to be
# believed instead, which is worth a warning rather than a refusal: a renamed
# file would then install under a package nobody expected.
$aapt2 = Find-SdkTool 'aapt2'
if (-not $aapt2) {
    Write-Host '  [warn] aapt2 not found. Falling back to the filename for the versionCode,' -ForegroundColor Yellow
    Write-Host '         so a renamed APK will be described wrongly. It installs either way.' -ForegroundColor Yellow
}

# ---------------------------------------------------------------- the APKs

function Read-Apk {
    <#
        What the APK says about itself. The filename is a convenience; the
        manifest is the truth, and they part company the moment anyone copies
        a file to a friendlier name.
    #>
    param([Parameter(Mandatory)] [string] $Path, [Parameter(Mandatory)] [hashtable] $Expected)

    $info = @{
        Path        = $Path
        Package     = $Expected.Package
        VersionCode = $null
        VersionName = $null
        FromFilename = $true
    }

    if ($Path -match '-v(\d+)-') { $info.VersionCode = [int] $Matches[1] }

    if ($aapt2) {
        $dump = Invoke-Native 'aapt2 dump badging' $aapt2 @('dump', 'badging', $Path) -IgnoreExitCode
        if ($LASTEXITCODE -eq 0 -and $dump) {
            $text = ($dump | Out-String)
            if ($text -match "package: name='([^']+)'") { $info.Package = $Matches[1] }
            if ($text -match "versionCode='(\d+)'")     { $info.VersionCode = [int] $Matches[1] }
            if ($text -match "versionName='([^']*)'")   { $info.VersionName = $Matches[1] }
            $info.FromFilename = $false
        }
    }

    if (-not $info.VersionCode) {
        throw "Could not work out the versionCode of $Path, from aapt2 or from its name."
    }
    return $info
}

$queue = @()
foreach ($name in $targets) {
    $meta = $apps[$name]

    if ($ApkPath) {
        if (-not (Test-Path $ApkPath)) { throw "No APK at $ApkPath" }
        $file = (Resolve-Path $ApkPath).Path
    }
    else {
        if (-not (Test-Path $OutputDir)) {
            throw "$OutputDir does not exist. Build first: .\03-build-apk.ps1 -App $name"
        }
        # Newest by versionCode, not by write time: a rebuild of an older
        # commit can be the most recent file on disk and the wrong thing to put
        # on a phone.
        $file = Get-ChildItem $OutputDir -Filter ("{0}-v*.apk" -f $meta.Prefix) -File |
            Sort-Object { if ($_.Name -match '-v(\d+)-') { [int] $Matches[1] } else { 0 } } -Descending |
            Select-Object -First 1 -ExpandProperty FullName
        if (-not $file) {
            throw "No $($meta.Prefix)-v*.apk in $OutputDir. Build first: .\03-build-apk.ps1 -App $name"
        }
    }

    $info = Read-Apk -Path $file -Expected $meta
    if ($info.Package -ne $meta.Package) {
        throw ("{0} holds package {1}, but the {2} app is {3}. Wrong APK." -f
            (Split-Path $file -Leaf), $info.Package, $name, $meta.Package)
    }

    $size = [Math]::Round((Get-Item $file).Length / 1MB, 1)
    Write-Host ("`n  {0}" -f $meta.Label) -ForegroundColor White
    Write-Host ("    apk        : {0}  ({1} MB)" -f (Split-Path $file -Leaf), $size) -ForegroundColor Gray
    Write-Host ("    package    : {0}" -f $info.Package) -ForegroundColor Gray
    Write-Host ("    versionCode: {0}{1}" -f $info.VersionCode,
        $(if ($info.VersionName) { "  (v$($info.VersionName))" } else { '' })) -ForegroundColor Gray

    $queue += @{ Meta = $meta; Info = $info }
}

# ---------------------------------------------------------------- the devices

Invoke-Native 'adb start-server' $adb @('start-server') -IgnoreExitCode | Out-Null

$listing = Invoke-Native 'adb devices' $adb @('devices', '-l') -IgnoreExitCode
$devices = @()
foreach ($line in ($listing | Out-String) -split "`r?`n") {
    # "RZ8N70ABCDE  device  product:a23xx model:SM_A235F device:a23x". The
    # first line of the listing is a header and matches nothing here.
    if ($line -notmatch '^(\S+)\s+(device|unauthorized|offline)\b') { continue }
    $serial = $Matches[1]
    $state  = $Matches[2]

    # Read the model from the same line, after $Matches has been emptied of
    # what the line match put there — a second -match overwrites it.
    $model = if ($line -match 'model:(\S+)') { $Matches[1] -replace '_', ' ' } else { '' }

    $devices += [pscustomobject]@{ Serial = $serial; State = $state; Model = $model }
}

if ($Serial) {
    $devices = @($devices | Where-Object { $_.Serial -eq $Serial })
    if (-not $devices) { throw "adb does not see a device with serial $Serial." }
}

if (-not $devices) {
    Write-Host ''
    Write-Host '  No device is attached.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  On the phone: Settings > About phone > tap Build number seven times,' -ForegroundColor Gray
    Write-Host '  then Settings > Developer options > USB debugging. Plug it in with a' -ForegroundColor Gray
    Write-Host '  cable that carries data — a charge-only cable shows nothing here — and' -ForegroundColor Gray
    Write-Host '  accept the "Allow USB debugging" prompt that appears.' -ForegroundColor Gray
    Write-Host ''
    exit 2
}

Write-Host "`n  Devices" -ForegroundColor White
foreach ($d in $devices) {
    $note = switch ($d.State) {
        'unauthorized' { '  — the phone has not accepted this computer yet' }
        'offline'      { '  — not responding; unplug and plug it back in' }
        default        { '' }
    }
    Write-Host ("    {0,-22} {1,-14} {2}{3}" -f $d.Serial, $d.State, $d.Model, $note) -ForegroundColor Gray
}

# ---------------------------------------------------------------- installing

function Get-InstalledVersionCode {
    <#
        Null when the app is not installed at all, which is a different case
        from installed-and-older and is reported differently.
    #>
    param([string] $DeviceSerial, [string] $Package)

    $dump = Invoke-Native 'adb dumpsys package' $adb `
        @('-s', $DeviceSerial, 'shell', 'dumpsys', 'package', $Package) -IgnoreExitCode
    $text = ($dump | Out-String)
    if ($text -notmatch 'versionCode=(\d+)') { return $null }
    return [int] $Matches[1]
}

$installed = 0
$failed = 0
$skipped = 0

foreach ($item in $queue) {
    $meta = $item.Meta
    $info = $item.Info

    Write-Host ("`n  {0}" -f $meta.Label) -ForegroundColor White

    foreach ($device in $devices) {
        $label = if ($device.Model) { "{0} ({1})" -f $device.Serial, $device.Model } else { $device.Serial }

        if ($device.State -ne 'device') {
            Write-Host ("    [skip] {0}  {1}" -f $label, $device.State) -ForegroundColor Yellow
            $skipped++
            continue
        }

        $current = Get-InstalledVersionCode -DeviceSerial $device.Serial -Package $info.Package
        $what =
            if ($null -eq $current) { 'not installed -> installing' }
            elseif ($current -lt $info.VersionCode) { "installed v$current -> upgrading" }
            elseif ($current -eq $info.VersionCode) { "already v$current -> reinstalling" }
            else { "installed v$current is newer" }

        if ($null -ne $current -and $current -gt $info.VersionCode -and -not $Downgrade) {
            Write-Host ("    [skip] {0}  {1}. Pass -Downgrade to go back." -f $label, $what) -ForegroundColor Yellow
            $skipped++
            continue
        }

        Write-Host ("    {0,-34} {1}" -f $label, $what) -ForegroundColor Gray

        # -r replaces an existing copy and keeps its data. -d allows an older
        # versionCode, and is only passed when it was asked for.
        $installArgs = @('-s', $device.Serial, 'install', '-r')
        if ($Downgrade) { $installArgs += '-d' }
        $installArgs += $info.Path

        $output = Invoke-Native 'adb install' $adb $installArgs -IgnoreExitCode
        $text = ($output | Out-String)

        if ($LASTEXITCODE -eq 0 -and $text -notmatch 'Failure|Error') {
            Write-Host '      [ok]  installed' -ForegroundColor Green
            $installed++
            continue
        }

        # The failures worth translating. Everything else is passed through,
        # because a message nobody has seen before is more useful verbatim.
        if ($text -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match|INCONSISTENT_CERTIFICATES') {
            if ($Force) {
                Write-Host '      [warn] different signing key; uninstalling as -Force was given.' -ForegroundColor Yellow
                Write-Host '             Everything that copy had stored goes with it.' -ForegroundColor Yellow
                Invoke-Native 'adb uninstall' $adb @('-s', $device.Serial, 'uninstall', $info.Package) -IgnoreExitCode | Out-Null

                $retry = Invoke-Native 'adb install' $adb $installArgs -IgnoreExitCode
                if ($LASTEXITCODE -eq 0 -and ($retry | Out-String) -notmatch 'Failure|Error') {
                    Write-Host '      [ok]  installed after uninstalling' -ForegroundColor Green
                    $installed++
                    continue
                }
                Write-Host ("      [fail] still refused: {0}" -f (($retry | Out-String).Trim())) -ForegroundColor Red
            }
            else {
                Write-Host '      [fail] the copy on this device is signed with a different key.' -ForegroundColor Red
                Write-Host '             A debug build and a release build cannot replace each other.' -ForegroundColor Red
                Write-Host '             Uninstalling first is the only way, and it takes the stored' -ForegroundColor Red
                Write-Host '             session and any exam in progress with it:' -ForegroundColor Red
                Write-Host ("               `"{0}`" -s {1} uninstall {2}" -f $adb, $device.Serial, $info.Package) -ForegroundColor DarkGray
                Write-Host '             Or re-run this with -Force.' -ForegroundColor Red
            }
            $failed++
            continue
        }

        if ($text -match 'INSTALL_FAILED_VERSION_DOWNGRADE') {
            Write-Host '      [fail] the installed copy is newer. Pass -Downgrade to go back.' -ForegroundColor Red
            $failed++
            continue
        }

        if ($text -match 'INSTALL_FAILED_INSUFFICIENT_STORAGE') {
            Write-Host '      [fail] not enough free space on the device.' -ForegroundColor Red
            $failed++
            continue
        }

        if ($text -match 'INSTALL_FAILED_USER_RESTRICTED|user restriction') {
            Write-Host '      [fail] the device is refusing installs over USB.' -ForegroundColor Red
            Write-Host '             On Xiaomi, Oppo, Vivo and Realme this is a separate switch:' -ForegroundColor Red
            Write-Host '             Developer options > Install via USB.' -ForegroundColor Red
            $failed++
            continue
        }

        Write-Host ("      [fail] {0}" -f $text.Trim()) -ForegroundColor Red
        $failed++
    }
}

# ---------------------------------------------------------------- the verdict

Write-Host ''
$summary = "  {0} installed" -f $installed
if ($skipped) { $summary += ", $skipped skipped" }
if ($failed)  { $summary += ", $failed failed" }
Write-Host $summary -ForegroundColor $(if ($failed) { 'Red' } elseif ($installed) { 'Green' } else { 'Yellow' })
Write-Host ''

if ($failed) { exit 1 }
if (-not $installed) { exit 2 }
exit 0
