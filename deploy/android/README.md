# Building the Android apps

Two apps, built on the same server that runs the site:

| App | Folder | Package |
|---|---|---|
| CBMS Applicant | `mobile/` | `in.gov.msme.ntms.applicant` |
| CBMS Coordinator | `mobile-coordinator/` | `in.gov.msme.cbms.coordinator` |

Everything happens locally. No Expo account, no EAS, nothing uploaded.

## First time

From an **elevated PowerShell console** (not ISE):

```powershell
cd E:\NDIE-Capacity-Building-main\deploy\android

# 0. JDK 17 and the Android command line tools. The one script here that
#    installs anything; skip it if the server already has both.
.\00-install-toolchain.ps1

# 1. Confirm. Installs nothing — reports, and prints the command.
powershell -ExecutionPolicy Bypass -File .\01-prerequisites.ps1

# 2. The signing keys. Once, ever. Back up what it writes.
.\02-keystore.ps1

# 3. Build. First run takes a while: Gradle and the SDK bits download.
.\03-build-apk.ps1
```

The APKs land in `E:\cbms-apk` as `cbms-applicant-v1-20260924.apk` and
`cbms-coordinator-v1-20260924.apk`.

## Afterwards

```powershell
.\03-build-apk.ps1                        # both apps, versionCode incremented
.\03-build-apk.ps1 -App coordinator       # just one
.\03-build-apk.ps1 -ApiBaseUrl https://cbms.msme.gov.in/api   # for production
```

## What the server needs

`01-prerequisites.ps1` checks all of it and prints the fix for anything absent.
In short: Node 20+, **JDK 17** (not a newer one — the Android Gradle Plugin the
Expo template pins rejects it, and says so in terms of Gradle rather than
Java), and the Android command line tools with their licences accepted.

The SDK platform and build-tools are not listed here on purpose: Gradle
downloads exactly the versions the generated project asks for, so they follow
the app rather than a number written down in a script.

## Decisions worth knowing about

**The API address is injected at build time.** `app.json` holds the development
default, which is `localhost`. An APK built with that in it is a silent
failure: it installs, it opens, and every request dies on the device with
nothing on the server to show for it. `app.config.js` reads
`CBMS_API_BASE_URL`, and the build script refuses a localhost, a private or a
plain-http address before spending twenty minutes producing something that
cannot work. Android has blocked cleartext by default since API 28, so `http://`
would not merely be insecure — it would not function.

**`android/` is regenerated on every build and deleted afterwards.** It comes
from `expo prebuild --clean`, so it is disposable. Leaving it behind only
invites someone to edit it and lose the change at the next build. Pass
`-KeepNativeProject` when you need to look at it.

**The release build is signed with a real key.** The Expo template signs a
release build with the *debug* key, and that APK installs perfectly well —
which is the problem. It cannot be published, and it cannot later be upgraded
by a properly signed build. The script re-applies a release signing config
after each prebuild and **stops** if the template has changed enough that it
cannot, rather than handing back something that looks finished.

**versionCode is tracked in `E:\cbms-apk\versioncode.txt`**, not in the
repository, so two builds of the same commit still differ. A device refuses an
APK whose versionCode is not higher than the one already installed, and the
message on the phone is only "app not installed".

## The signing keys

`02-keystore.ps1` writes them to `E:\cbms-keystores`, outside the repository, in
a folder only administrators can read. Each keystore has a generated password
stored beside it; the build reads it from there, and it never appears on a
command line where the process list would show it.

**Back that folder up somewhere off this machine.** Android identifies an app by
its package name *and* its signing key. Lose the key and the installed app can
never be updated again — not by you, not by Google, not by anyone. The only way
forward is a new package name and every user reinstalling.

Nothing else backs it up: it is deliberately outside the repository, so it is
outside the deploy and outside `git`.

## If something goes wrong

**`SDK location not found`.** `ANDROID_HOME` is not set for the account running
the build. Set it machine-wide and open a new shell.

**`Failed to install the following Android SDK packages as some licences have
not been accepted`.** Run
`& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --licenses` once
and accept them.

**`Unsupported class file major version` or a Gradle/AGP complaint about
Java.** The JDK is not 17. Check `$env:JAVA_HOME` — a newer JDK on the PATH is
not enough and not a substitute.

**The build succeeds and the app cannot reach the server.** Check the address
went in: `npx expo config --type public` inside the app folder with
`CBMS_API_BASE_URL` set shows what will be baked in. Also confirm the phone can
open `https://<host>/api/public/programmes` in its browser — on mobile data, not
on the office Wi-Fi, which is where a DNS or firewall difference shows up.

**"App not installed" on the phone.** Either an existing copy is signed with a
different key — uninstall it first — or the versionCode is not higher than the
installed one.

**Gradle runs out of memory.** Add `-KeepNativeProject`, then raise
`org.gradle.jvmargs` in `android/gradle.properties` and run
`.\gradlew.bat assembleRelease` by hand to find a working value.
