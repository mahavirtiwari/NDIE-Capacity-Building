# Release scripts

The schema changes for a release, as SQL, for a deployment where somebody
wants to read them before they run or where a DBA applies them rather than
the deploy doing it.

**The ordinary release does not need these.** `deploy\release-staging.ps1`
runs `dotnet ef database update` itself, against the checkout it just
pulled, which is one fewer artefact to keep in step with the code. These
exist for the cases that one does not cover: a change that has to be
reviewed before it is allowed near the data, a database an application
account may not alter, or a restore being brought up to the current
schema by hand.

## Which one

Take the newest pair. The older ones are kept so a database that was
built from one can be read against what it was given.

| File | Runs against | Use it when |
| --- | --- | --- |
| `2026-10-11-release.sql` | A database at `20261009112017_TrainerEngagementAndCredentials` | You know what the database is on, and want only this release's changes to read. |
| `2026-10-11-full.sql` | Any database, including an empty one | You do not know what it is on, or you are building one from nothing. |
| `2026-10-09-release.sql` | A database at `20261006000958_AnAgencySuspensionIsRecorded` | Superseded; kept for reference. |
| `2026-10-09-full.sql` | Any database | Superseded; kept for reference. |

The 11 October pair carries five migrations: a registration remembering
its batch, an address proven before it moves, session start and end
times, and the Support link and About text. Both were run against a
fresh database and against one sitting at the October release, and the
full one was run twice to confirm the second run does nothing.

Both are **idempotent**: every migration is wrapped in a check against
`__EFMigrationsHistory`, so running one twice does nothing the second time
and running the full script against an up-to-date database is a no-op.
When in doubt, use the full one — it cannot do less than it should, only
more slowly.

## Running one

```powershell
sqlcmd -S localhost\SQLEXPRESS -E -I -d CbmsDb -i 2026-10-09-full.sql -b
```

`-I` is not optional. It turns on `QUOTED_IDENTIFIER`, without which the
filtered indexes in this schema refuse to be created — the error names
SET options and not the index, so it is worth getting right the first
time. `-b` makes a failed statement a non-zero exit code instead of a
message scrolling past.

Take a backup first. `deploy\windows\10-backup.ps1` does it and verifies
what it wrote.

## What is in this release

Ten migrations, from the agency-suspension record to the trainer fields:

| Migration | What it does |
| --- | --- |
| `AFloorForABatchAndAPostponementAsked` | Minimum participants on a program type; the agency's postponement request. |
| `BatchHoursAndVenuePincode` | Start and end times on a batch, and the venue's pincode. |
| `CoordinatorPanAndAadhaar` | PAN and Aadhaar on a portal account. |
| `AdminOrganisationName` | Organisation name on an administrator. |
| `NotificationsAndPushDevices` | Notifications, the handsets registered for them, and what has been read. |
| `ProfilePhotoCaptureAndRota` | Where and when an applicant's photograph was taken, and the allocation rota. |
| `MonitoringPhotoCapture` | The same for a coordinator's monitoring photographs. |
| `QualityControlOnSubmissions` | QC on a conducted programme's report. |
| `AttendancePerDay` | A register row per person per day. |
| `TrainerEngagementAndCredentials` | Engagement, experience, qualification and Aadhaar on a trainer. |

### Four of them write data, not only schema

Read these before running, because they are the ones that touch rows:

- **`SyncedOn` on profile and monitoring photographs** is set from
  `CapturedOn`. Those columns did not exist, so every existing row would
  otherwise read as the first of January in the year 1.
- **`QcStatus` on existing submissions** is set to `Pending`. A programme
  submitted before quality control existed has not been quality
  controlled, and writing it in as approved would record a check nobody
  made. **On a deployment with a long history this fills the manager's
  pending queue.** Worth knowing before, rather than after.
- **The attendance register** is seeded for one-day programmes already
  marked: their single tick is that day's mark, because there was only
  ever one day to tick. Multi-day programmes are left alone — attributing
  an old tick to a particular day would be evidence of attendance nobody
  recorded.

Each is wrapped in `EXEC(N'…')`. That is not decoration. An idempotent
script compiles a whole migration as one batch, and SQL Server resolves
column and table names when the batch is compiled, so a statement naming
something the same batch creates will not compile however correct the
order of execution is. The wrapper defers it to run time.

## Regenerating these

From `backend`:

```powershell
dotnet ef migrations script 0 --idempotent --project src/Ntms.Infrastructure --startup-project src/Ntms.Api -o db/releases/<date>-full.sql
```

For an incremental one, name the migration the database is already on as
the first argument.

If a new migration writes to a column or table it also creates, wrap that
statement in `EXEC(N'…')` in the migration itself, with the quotes
doubled. There is no way to find out afterwards except by running the
script, and it fails on the deployment rather than on the machine that
generated it.
