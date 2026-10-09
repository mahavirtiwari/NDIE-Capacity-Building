# Deploying

Three things ship out of this repository. One command releases all of them to
staging, which is the server this deployment has:

```powershell
cd E:\NDIE-Capacity-Building-main\deploy

.\release-staging.ps1              # the lot, from one commit
.\release-staging.ps1 -Plan        # what that would do, without doing it
```

On this server the database backup is taken by hand, so the release that does
not take one has its own name:

```powershell
.\windows\10-backup.ps1 -SkipFiles -Label 'before-release'   # first, by hand
.\release-staging-nobackup.ps1                               # then release
```

Each part also has its own command, for a release that touches only one:

```powershell
.\release-web.ps1                  # the API and the portal, as one site
.\release-applicant-app.ps1        # the candidates' Android app
.\release-coordinator-app.ps1      # the coordinators' Android app
```

Each pulls the repository first, so any of them is the whole of an ordinary
release. Each stops on the first failure and says what to fix.

## Releasing all of it

`release-staging.ps1` pulls once and then runs the three scripts below with
`-NoPull`, so everything is built from the same commit. Run them by hand
instead and each pulls again: a commit landing midway through leaves a portal
built from one revision and an APK from another, with nothing afterwards to say
it happened.

```powershell
.\release-staging.ps1                            # web, then both apps
.\release-staging.ps1 -WebOnly                   # no mobile change in this one
.\release-staging.ps1 -WebOnly -SkipMigrations   # no schema change either
.\release-staging.ps1 -AppsOnly                  # mobile-only, server untouched
.\release-staging.ps1 -NoPull                    # a second attempt, same commit
.\release-staging-nobackup.ps1                   # the backup was taken by hand
```

`release-staging-nobackup.ps1` is `-SkipBackup` with a name instead of a flag:
a release that took no backup is then visible in the shell history rather than
having to be inferred from an argument three scripts deep. Every other flag
still works and is passed straight through. It skips the database backup and
nothing else — the running build is still kept, and verification failing still
puts it back.

Take the backup first where the release has a migration that writes rows.
`21-rollback.ps1` can revert a schema change, but reverting the column a
migration wrote to does not un-write the rows it put there.

It stops before building the apps if the web release fails — an APK pointed at
a server that is not running the matching commit is worse than no APK. If an
app fails after the web is out and verified, it says so and names the one
command to retry, rather than failing the whole release back to nothing.

Before it starts, it prints the commits that have accumulated since the last
recorded release, which is the question actually asked before releasing.
Afterwards it appends a line to `releases.log` in the backup folder — the time,
the commit, and what was built — which is where the next release reads that
from. `-Plan` prints the sequence and changes nothing.

Staging and production are the same machine here, so this *is* the release;
there is no later promotion step. `windows\19-preflight.ps1` is the separate
read-only check of whether the box is fit to be called production.

## Why the parts are separate

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
| Backs up the database | yes, before migrating (not with `-SkipBackup`) | n/a |
| Keeps the previous build | yes, for rollback | n/a — the old APK is still on the phone |
| Applies migrations | yes | n/a |
| Stops the site | yes, briefly | no |
| Verifies afterwards | yes, over HTTPS | no — install one and look |
| Where it lands | `E:\inetpub\cbms` | `E:\cbms-apk` |

## The rest of the kit

| Script | What it is for |
| --- | --- |
| `release-staging.ps1` | The whole release, in order, from one commit. |
| `release-staging-nobackup.ps1` | The same, where the backup is taken by hand. |
| `release-web.ps1` | The API and portal on their own. |
| `release-applicant-app.ps1` | One APK. |
| `release-coordinator-app.ps1` | The other. |

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
