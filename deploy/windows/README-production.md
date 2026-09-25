# Production

The same scripts as staging, with three things staging does not need: a backup
taken before anything changes, the previous build kept so going back is a folder
move, and a check that this box is actually configured to be the live one.

`README.md` covers the first-time install — prerequisites, database, IIS,
certificate. This covers running the thing once it is up.

## Where the values live

`settings.production.psd1`, next to the scripts. Paths, URL, database, backup
root, retention, the hour the backup runs. Every script reads its defaults from
there, so nobody types a path at four in the morning.

Change a value there, not in a script. Anything passed on the command line still
wins, for the one-off case.

```powershell
SourcePath  = 'E:\NDIE-Capacity-Building-main'   # the checkout
SitePath    = 'E:\inetpub\cbms'                  # emptied and replaced every release
StorageRoot = 'E:\cbms-data'                     # photographs and artwork; never touched
BackupRoot  = 'E:\cbms-backups'                  # on the same disc, for now
BaseUrl     = 'https://leanstaging.qci.org.in'
```

### One machine

Production and staging are the same server. Nothing in these scripts minds
that, but three things follow, and they are better known now than during a
release:

- **There is nowhere to try a build first.** `20-release.ps1` verifies after it
  deploys and puts the previous build back when that fails, which is the whole
  of the safety net.
- **The backups sit on the box they protect.** Good against a wrong `DELETE`,
  useless against the disc.
- **A release is a short outage.** The site is stopped while files are replaced
  — seconds rather than minutes, but pick the hour anyway.

## Before you call it production

```powershell
.\19-preflight.ps1
```

Changes nothing. It reads the deployment and reports the differences that
matter — sample data seeded on a live site, a signing key still at its
development value, backups nobody scheduled, the uploaded files sitting inside
the folder every release empties, a disc with no room for a release to copy
itself. Each line says what to run.

Exit code 1 means something must be fixed; warnings do not stop it.

## Backups

```powershell
.\12-schedule-backups.ps1        # nightly at 01:30, weekly archive on Sundays
.\10-backup.ps1                  # now, by hand
.\10-backup.ps1 -ZipData         # and a dated archive of the uploaded files
```

The database goes to a dated `.bak` written with `CHECKSUM` and then read back
with `RESTORE VERIFYONLY`. A backup nobody has verified is a file, not a backup.

The uploaded files are mirrored with robocopy. **A mirror is a copy of now, not
a history**: a file deleted this morning is gone from the mirror tonight. The
weekly task takes a dated archive for that reason, and neither of them helps
against losing the disc. Copy `E:\cbms-backups` off the machine as well —
whatever the department already uses for that is fine.

The first run grants SQL Server's service account write access to the backup
folder if it does not have it. The server writes the file, not the script, which
is why a backup script that looks right fails with "Operating system error 5".

Retention keeps 30 days and never prunes the most recent, whatever the setting
says.

### Restoring

```powershell
.\11-restore.ps1                                     # the newest backup
.\11-restore.ps1 -BackupFile E:\cbms-backups\database\CbmsDb-20260925-013000.bak
```

It verifies the file, backs up the database as it stands — even a broken present
is evidence — stops the site, restores, and starts it again. It asks you to type
the database name first.

**Do this once on purpose, against a copy**, before the morning it matters. A
restore that has never been run is a hope.

## Releasing

```powershell
.\20-release.ps1 -Pull
```

In order: check the checkout is clean and fast-forward it, note the commit, note
the last migration applied, back up the database, keep the current build at
`E:\inetpub\cbms.previous`, stop the site, publish, migrate, start, verify.

If any of that fails it puts the previous build back by itself and starts the
site again — the files are ours, so an unattended rollback of them is safe. It
does **not** roll the database back by itself. That is a judgement about data, so
it prints the two commands and leaves the choice to you.

Flags worth knowing:

| Flag              | When                                                      |
| ----------------- | --------------------------------------------------------- |
| `-Pull`           | Fetch and fast-forward first. Refuses on a dirty checkout. |
| `-SkipMigrations` | The release has no schema change.                          |
| `-SkipBackup`     | No schema change and the wait is not worth it.             |

## Going back

```powershell
.\21-rollback.ps1
```

Puts `E:\inetpub\cbms.previous` back and keeps what was running at
`E:\inetpub\cbms.failed`, so a rollback in a hurry does not destroy the evidence
of why it was needed.

The schema is separate, and usually needs nothing: migrations are mostly
additive and the previous build ignores columns it does not know about. When it
does need something:

```powershell
.\21-rollback.ps1 -ToMigration 20260925030434_ParticipantMarksheet   # revert the schema too
.\11-restore.ps1 -BackupFile <the backup the release took>           # or go back to the data as well
```

Read the reverting migration before running the first: `Down` drops what `Up`
added, and anything written into those columns goes with it. The second loses
everything written since the release, which on a live site may be an afternoon
of marking.

## The order of a normal week

```
.\19-preflight.ps1     once, and again after changing the server
.\12-schedule-backups.ps1  once
.\20-release.ps1 -Pull     per release
.\07-verify.ps1        any time you want to know it is up
.\09-diagnose.ps1      when it is not
```

## Two things still to decide

**A Content-Security-Policy header.** The other security headers are set by the
application; CSP is not, because a policy that is wrong breaks the portal
silently in one browser and a policy that is right has to be measured against
the built bundle. It deserves its own change.

**Where the off-machine copy goes.** Everything above keeps backups on the
server. That survives a mistake, not a disc and not the building.
