# Moving this release to production

The server is already installed — checkout, site, database, IIS, certificate.
This is the sequence that takes it from the build running now to the current
code, once. Afterwards, releases are just `20-release.ps1` and this file is
history.

Everything runs on **leanstaging.qci.org.in**, in an **elevated** PowerShell
(right-click → Run as administrator). Each step stops on failure and says what
to fix; do not run the next one past a red line.

What this release brings, so you know what to look at afterwards: the
evaluation scheme and skills on program types, the trainer's marksheet in the
portal and the coordinator app, the written paper sat online from the applicant
app, the attempt review for staff, and the wording of every screen moved into
Site text. Three migrations come with it.

---

## 1. Bring the checkout up to date

The new scripts arrive with it, so nothing below exists until this is done.

```powershell
cd E:\NDIE-Capacity-Building-main
git status --porcelain
```

**Nothing should print.** If something does, it is almost certainly
`mobile/package.json` or `mobile-coordinator/package.json`, which an APK build
rewrites — a pull will refuse and then look as though it worked:

```powershell
git checkout -- mobile/package.json mobile-coordinator/package.json
```

Then:

```powershell
git pull --ff-only
git log --oneline -1
```

The last line must show the commit you expect. If the pull said
`Already up to date` and the commit is old, the fetch went somewhere else —
stop and look, rather than carrying on.

## 2. Look before you touch anything

```powershell
cd E:\NDIE-Capacity-Building-main\deploy\windows
.\19-preflight.ps1
```

Changes nothing. Fix anything marked `[FAIL]` before going on. `[warn]` lines
are for judgement — the two you should expect are backups on the same disc as
the site, and email being off if it still is.

## 3. Backups, before the first release rather than after it

```powershell
.\12-schedule-backups.ps1
Start-ScheduledTask -TaskName 'CBMS nightly backup'
Get-ScheduledTaskInfo -TaskName 'CBMS nightly backup'
```

`LastTaskResult` of `0` means it worked. Look in `E:\cbms-backups\database` for
the `.bak` before believing it.

The first run grants SQL Server's service account write access to that folder.
That is expected — the server writes the file, not the script.

## 4. Release

```powershell
cd E:\NDIE-Capacity-Building-main\deploy
.\release-web.ps1 -NoPull
```

`-NoPull` because step 1 already did it. Without it the script pulls first,
which is what makes it one command on an ordinary release.

It backs up the database, keeps the build that is running at
`E:\inetpub\cbms.previous`, stops the site, publishes, applies the three
migrations, starts the site and verifies it. Four to ten minutes, most of it
the portal build.

**If it fails** it puts the previous build back by itself and prints the two
database commands — one to revert the schema, one to restore the backup. Read
which one it offers before running either. Neither is usually needed: these
migrations only add tables and columns, and the previous build ignores what it
does not know about.

## 5. Look at what arrived

Sign in as Super Admin and check, in this order, because each depends on the
one before:

1. **Programme setup → Program types** → edit one → the **Evaluation** section
   is there, with the marks pattern.
2. **Programme setup → Evaluation Skills** → the program type appears once its
   evaluation includes a viva.
3. **Operations → Programmes** → open one → the **Marksheet** tab.
4. **Administration → Site text** → 28 groups, one per screen.

Then, if a batch has an examination scheduled, check
**Operations → Programmes → Set exam time** offers the question paper — that
selector is new, and the old one silently did nothing.

## 6. One decision that was right for staging

This box was set up as a staging host, so it asks search engines to stay away.
If the public programme pages should now be findable:

```powershell
cd E:\NDIE-Capacity-Building-main\deploy\windows
. .\_common.ps1
$path = 'E:\inetpub\cbms\appsettings.Production.json'
$config = Get-Content $path -Raw | ConvertFrom-Json
$config.Site.DiscourageSearchEngines = $false
Set-PlainTextFile -Path $path -Content ($config | ConvertTo-Json -Depth 10)
Restart-WebAppPool -Name CbmsAppPool
```

Leave it alone if the site is not meant to be found yet. `19-preflight.ps1`
reports which way it is set.

## 7. The two apps

The marksheet and the online paper reach people only through new APKs. The
portal deploy does nothing for them.

Each is built on its own, so a change to one does not make everybody who uses
the other update for nothing:

```powershell
cd E:\NDIE-Capacity-Building-main\deploy
.\release-applicant-app.ps1        # candidates: applying, enrolments, the written paper
.\release-coordinator-app.ps1      # the hall: register, photographs, the marksheet
```

Both pull first, take the API address from `settings.production.psd1`, and let
the version code look after itself — it comes from a counter beside the output
and climbs every build, which is what Android insists on before it will install
over what is already there.

The one thing to get right is the signing key. Both use the release keystores in
`E:\cbms-keystores`; a build signed with a different one cannot update an
installed app, so every user would have to uninstall first — and uninstalling
takes whatever the app had stored, including a coordinator's unsent work.

The APKs land in `E:\cbms-apk`. Distribute them the way the last ones went out.

## 8. Afterwards

```powershell
.\07-verify.ps1        # any time you want to know it is up
.\09-diagnose.ps1      # when it is not
.\21-rollback.ps1      # within a few minutes, if something surfaces
```

`E:\inetpub\cbms.previous` is kept until the next release, so the way back stays
open until you take another step forward.

---

## Still open

Neither blocks this release; both are worth a decision.

- **Backups do not leave the machine.** They survive a mistake, not a disc.
  When there is somewhere to put them, point `BackupRoot` in
  `settings.production.psd1` at it, or add a copy step to the nightly task.
- **No Content-Security-Policy header.** The other security headers are set by
  the application. CSP is not, because a wrong policy breaks the portal
  silently in one browser and a right one has to be measured against the built
  bundle.
