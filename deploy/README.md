# Deploying

Three things ship out of this repository, and each has one command:

```powershell
cd E:\NDIE-Capacity-Building-main\deploy

.\release-web.ps1                  # the API and the portal, as one site
.\release-applicant-app.ps1        # the candidates' Android app
.\release-coordinator-app.ps1      # the coordinators' Android app
```

Each pulls the repository first, so they are the whole of an ordinary release.
Each stops on the first failure and says what to fix.

## Why three and not one

**The API and the portal cannot be separated.** The portal is built into the
API's `wwwroot` and served from the same origin — one site, one certificate, no
CORS between the halves. `release-web.ps1` builds and deploys both.

**The apps are separate from each other on purpose.** A change to the
candidates' app should not make a hundred coordinators update theirs, and a
coordinator in the field is the worst person to ask to update for a change that
was not theirs. They share the repository and nothing else: separate Android
packages, separate signing keys, separate version counters.

**The apps are separate from the web because they reach people differently.** A
web release is live the moment it verifies. An APK is live when somebody
installs it, which may be next week — so the API has to keep working for the
version still on the phones.

## What each one does

| | `release-web.ps1` | the two app scripts |
| --- | --- | --- |
| Pulls the repository | yes | yes |
| Backs up the database | yes, before migrating | n/a |
| Keeps the previous build | yes, for rollback | n/a — the old APK is still on the phone |
| Applies migrations | yes | n/a |
| Stops the site | yes, briefly | no |
| Verifies afterwards | yes, over HTTPS | no — install one and look |
| Where it lands | `E:\inetpub\cbms` | `E:\cbms-apk` |

## The rest of the kit

| Folder | What is in it |
| --- | --- |
| `windows\` | The install — prerequisites, database, configuration, IIS, certificate — and the production scripts: backups, restore, preflight, release, rollback. |
| `android\` | The APK toolchain: SDK, keystores, and the build the two app scripts call. |

Start here:

- **[windows\README.md](windows/README.md)** — installing on a new server.
- **[windows\README-production.md](windows/README-production.md)** — running it:
  backups, releases, going back.
- **[windows\GO-LIVE.md](windows/GO-LIVE.md)** — the one-time move of the
  current code onto the server that is already up.
- **[android\README.md](android/README.md)** — the APK toolchain and what each
  part of it is for.

## Before any of it

Everything reads its host, paths and database from
**`windows\settings.production.psd1`**. One file, changed once. A script with a
host baked into it is a script that works on one machine.
