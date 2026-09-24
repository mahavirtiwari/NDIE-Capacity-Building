# Deploying to Windows Server + IIS

For `leanstaging.qci.org.in`, with SQL Server on the same machine and a PFX
certificate for the domain.

## How it is arranged

**One IIS site, one app pool, one certificate.** The API serves both halves: the
Angular portal at `/` and the API at `/api`. The portal is built into the API's
`wwwroot` during publish.

That is not the only way to do it, but it is the one with the fewest moving
parts. The alternatives each cost something:

- Mounting the API as a sub-application at `/api` would answer on `/api/api/...`,
  because the controller routes already begin with `api/`.
- A separate site behind an ARR reverse proxy needs two more IIS extensions and
  a second site to keep in step.
- Two origins would need CORS, a second certificate or a wildcard, and would put
  a preflight in front of every request.

Same origin also means the browser sends no preflights and the production build
can use a relative `/api`, which is correct on whatever host it is deployed to.

```
E:\NDIE-Capacity-Building-main   the checkout, built from
E:\inetpub\cbms                  the published site  (replaced on every deploy)
  └─ wwwroot\                    the Angular portal
  └─ appsettings.Production.json the configuration   (kept across deploys)
E:\cbms-data                     uploaded files      (never touched by a deploy)
  ├─ monitoring\                 coordinator photographs
  └─ certificate-templates\      certificate artwork
```

`E:\cbms-data` is deliberately outside `E:\inetpub\cbms`. A deploy empties the
site folder; anything in it would go with it.

## First time

Run from an **elevated** PowerShell, in order. Each one stops on failure and
says what to fix.

```powershell
cd E:\NDIE-Capacity-Building-main\deploy\windows

# 1. What is missing? Installs nothing — reports, and prints the command.
powershell -ExecutionPolicy Bypass -File .\01-prerequisites.ps1

# 2. Database and the login the site connects as. Prints a connection string.
#    If the instance only accepts Windows authentication it stops and says
#    so; see "Which authentication to the database" below.
.\02-database.ps1

# 3. Configuration. Paste the connection string from step 2.
.\03-configure.ps1 -ConnectionString 'Server=localhost;Database=CbmsDb;User Id=cbms_app;Password=...;Encrypt=True;TrustServerCertificate=True;MultipleActiveResultSets=true'

# 4. Build and publish.
.\04-publish.ps1

# 5. IIS site, certificate, folder rights.
.\05-install-iis.ps1 -PfxPath E:\certs\leanstaging.qci.org.in.pfx

# 6. Schema.
.\06-migrate.ps1

# 7. Check it from outside.
.\07-verify.ps1

# 8. Set the Super Admin password.
.\08-first-run.ps1
```

## Afterwards

```powershell
.\update.ps1                    # publish, migrate, verify
.\update.ps1 -SkipMigrations    # when the release has no schema change
```

## Which authentication to the database

`02-database.ps1` checks what the instance will actually accept before it
creates anything.

**Mixed mode** — it creates the SQL login `cbms_app`, generates a password,
signs in as it to prove it works, and prints the connection string.

**Windows authentication only** — a SQL login can be created on such an
instance and will never be able to sign in, so the script stops rather than
leaving you to find that out five steps later. Two ways on:

```powershell
# Preferred: the site authenticates as the app pool identity, so there is no
# password to store, rotate or leak. Needs the pool, so run 05 first.
.\05-install-iis.ps1 -PfxPath E:\certs\leanstaging.qci.org.in.pfx
.\02-database.ps1 -UseWindowsAuth

# Or turn on mixed mode and restart the instance.
Set-ItemProperty 'HKLM:\Software\Microsoft\Microsoft SQL Server\MSSQL*\MSSQLServer' -Name LoginMode -Value 2
Restart-Service 'MSSQL$SQLEXPRESS'
```

With `-UseWindowsAuth` the connection string uses `Trusted_Connection=True`
and `appsettings.Production.json` holds no database password at all.

## The certificate

`05-install-iis.ps1` imports the PFX into `LocalMachine\My` and binds it to
`443` with SNI, so the machine can serve other certificates alongside it. It
prints the expiry and warns inside 30 days.

To replace one later, re-run just that step:

```powershell
.\05-install-iis.ps1 -PfxPath E:\certs\renewed.pfx
```

It will prompt for the password rather than take it on the command line, which
keeps it out of your shell history and out of the event log.

## What is not in the repository, and why

| Held where | What | Why |
|---|---|---|
| `appsettings.Production.json` | connection string, JWT signing key | Written to the server, never to the checkout. `git pull` cannot overwrite it and `git add` cannot publish it. |
| The database | SMTP password | Write-only through the portal's Email screen: accepted on save, never returned. |
| Nowhere | Super Admin password | Set once by `08-first-run.ps1`, stored only as a hash. |

`appsettings.json` in the repository ships with an **empty** connection string
and signing key. That is deliberate — the service refuses to start without them
rather than quietly reaching for a database that is not there.

## This is a staging host

`03-configure.ps1` sets `Site:DiscourageSearchEngines` to true, which puts
`X-Robots-Tag: noindex, nofollow, noarchive` on every response and serves a
`robots.txt` that disallows everything.

It matters here because `/programmes` and `/p/{code}` are genuinely public and
carry real programme data. Indexed, a staging host competes with the live site
in search results and sends applicants to the wrong place.

When this becomes the live site, turn it off — being found is then the point:

```powershell
.\03-configure.ps1 -DiscourageSearchEngines:$false -ConnectionString '...'
```

The header goes out as well as `robots.txt` on purpose: a crawler that reached
a page through a link somebody shared never asked for `robots.txt`, and the
header is the only instruction it will see.

## Decisions worth knowing about

**Migrations are not applied on start-up.** `Database:MigrateOnStartup` is
`false` in production. An app-pool recycle should never alter a schema, and two
web heads starting together would race each other through the same migrations.
`06-migrate.ps1` shows what is pending and asks first.

**The app pool has no daily recycle and no idle timeout.** The IIS defaults drop
in-flight requests at 02:00 and cold-start the first request after a quiet
night, neither of which this site benefits from.

**The site folder is read-only to the app pool.** The application has no reason
to write into its own binaries. `E:\cbms-data` is the one place it may write.

**The database login is not `sa`.** `cbms_app` is `db_owner` on `CbmsDb` and has
nothing at the server level. It needs `db_owner` rather than
reader/writer because EF migrations create and alter tables.

**Logging is at Warning.** The development settings log every SQL statement,
which on a production box fills the disk and puts parameter values in the log.

## If something goes wrong

**HTTP 500.30 — the app failed to start.** Almost always configuration. Look in
the Windows Application event log; the ASP.NET Core Module records the startup
exception there. The usual causes are a missing connection string, a signing key
under 32 characters, or SQL Server refusing the login.

**sqlcmd: "The certificate chain was issued by an authority that is not
trusted."** ODBC Driver 18, which sqlcmd 18 and later use, encrypts by default
and validates the server's certificate. A SQL Server installed without one of
its own presents a self-signed certificate, which fails that check. The scripts
pass `-C` to trust it — the traffic is still encrypted, only the identity check
is skipped, which for a connection to the same machine costs nothing. If you
would rather not skip it, issue SQL Server a certificate from a CA the machine
trusts and drop the `-C`.

**HTTP 500.19 — configuration error.** The .NET Hosting Bundle is not installed,
or was installed before IIS. Reinstall it and run `iisreset`.

**The portal loads but every call fails with 401.** The signing key changed.
Everyone must sign in again — that is what changing it does.

**A deep link like `/programmes` 404s.** The SPA fallback is not running, which
means `wwwroot\index.html` is missing. Re-run `04-publish.ps1` without
`-SkipPortal`.

**Uploads fail.** Check `E:\cbms-data` exists and that `IIS AppPool\CbmsAppPool`
can write to it. `07-verify.ps1` tests this by writing a probe file.

## Rolling back

There is no automatic rollback, on purpose: a migration that has run cannot be
reversed by copying files back. To go back a release:

1. Restore the database from the backup taken before `06-migrate.ps1`.
2. Check out the previous tag and run `.\update.ps1 -SkipMigrations`.

Take the backup. `06-migrate.ps1` asks you to, and it is the only thing standing
between a bad migration and a long evening.
