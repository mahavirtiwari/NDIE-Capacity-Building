# Load testing

Scripts for putting a crowd on staging and finding out what it costs.

```powershell
cd deploy\load
.\accounts.ps1 -Count 1000 -IKnowThisIsNotStaging   # once: logins (writes)
.\run.ps1 -Profile smoke  -Journey applicant
.\run.ps1 -Profile load   -Journey applicant
.\accounts.ps1 -Remove              # when the testing is done
```

`run.ps1` fetches k6 into `deploy\load\k6\` the first time if it is not
already installed. Everything else needs only what the server already has.

## Read this before the first run

**Give the callers an account each.** The API counts its rate limit per
signed-in account — six hundred requests a minute. A thousand callers
sharing one login is one account asking for sixty thousand, and the
limiter refuses almost all of it. The run then measures the limiter and
says nothing about the system. `accounts.ps1` makes one per caller; the
run warns when the list is short.

**Smoke first, every time.** Twenty-five callers for a minute. A wrong
URL, a stale account list or a typo found by twenty-five costs a minute;
the same mistake found by a thousand costs somebody else their staging
for the afternoon.

**A bad account file used to lock the accounts out.** The API locks an
account after a handful of failed sign-ins, so a run with a stale
password did not merely fail - it took the account down with it, and
somebody had to unlock it before anything could be tested again. That is
not a guess: the first run of these scripts locked the account it was
testing with. The journeys now stop on the first failed sign-in rather
than going round again, so the same mistake costs one request. A 429 on
sign-in is the exception: that means too few accounts, and it says so
and backs off.

**Staging is production here.** One machine, one database: `CbmsDb`
serves both, so these thousand accounts go into the live data and
`accounts.ps1` will not write them until you say so with
`-IKnowThisIsNotStaging`. They are all marked - every code begins
`LOADTEST`, every address is at `loadtest.invalid` - and `-Remove`
takes them out again. Run it the moment the testing is finished, and
take a backup first (`..\windows\10-backup.ps1`) so there is a way back
that does not depend on the remove working.

**Tell whoever is using staging.** A thousand callers makes the site
unusable for anybody demonstrating on it. This is not a background task.

**Nothing here writes to the site.** The journeys read. They do not raise
programmes, submit profiles or upload photographs, because a load test
that leaves data behind is one somebody has to clean up before the site
is usable. `accounts.ps1` is the single exception and it is marked.

## The profiles

| Profile | Shape | What it answers |
| --- | --- | --- |
| `smoke` | 25 for 1 min | Is the script, the target and the account list right? |
| `load` | 1000 over 2 min, held 10 | Can it carry the crowd? |
| `soak` | 400 for an hour | Does it still stand after an hour — pools, memory, caches? |
| `spike` | 0 to 1000 in 30s, held 3 min | Does it survive the crowd *arriving*? |

`load` is the question asked. `soak` finds what ten minutes cannot: a
connection pool leaking a handle a minute looks perfect for ten and falls
over at fifty. `spike` is nine o'clock on the morning of a batch.

## The journeys

**`applicant`** is the one that matters at a thousand. Officers are a few
hundred; applicants are everybody the scheme trains. One iteration is an
applicant opening the app: signing in, reading what is waiting, looking at
the programmes open to them, and opening a profile form — which is the
heaviest read in the app, because it pulls the form, its sections, its
choice lists and the LGD masters behind every address field.

**`portal`** is a signed-in officer moving between the dashboard, the
programmes register, the scrutiny queue and the registers down the side.
Each screen is batched the way a browser batches it, because a screen is
its calls and not its slowest one.

Both pause between screens the way a person pauses. A think time that is
too short reports a problem the real crowd would never cause.

## Reading the result

k6 exits non-zero when a threshold is missed, so a run passes or names
what failed. The thresholds are in the scripts:

| | portal | applicant |
| --- | --- | --- |
| Failed requests | < 0.5% | < 0.5% |
| Throttled (429) | < 1% | < 1% |
| p95, any request | 1.5s | 2.0s |
| p99, any request | 3.0s | 4.0s |

The handset budget is wider because a district mobile network is slower
than an office — but it is the server's share being measured, and the
server's share has to leave room for the network.

A `429` rate above the threshold almost always means too few accounts
rather than anything about the system. Check that first. Note that k6
counts a 429 as a failed request, so a short account list shows up twice
- once as throttling and once as failures.

Each run writes a summary to `results\<journey>-<profile>-<stamp>.json`.
Keep them: the useful question after the second release is not "is this
fast" but "is this slower than last time".

## What a failure usually means

**p95 climbing while throughput is flat** — queuing. Something downstream
is the bottleneck: the connection pool, a lock, or one slow query holding
a connection. Look at the API log and at `sys.dm_exec_requests` during
the run.

**Throughput falling as callers rise** — contention. Two requests
fighting for the same rows. The scrutiny queue did exactly this before it
was fixed, because reading it wrote to it.

**Errors only at the top of the ramp** — the pool or the thread pool
growing. Often harmless, sometimes the first sign that
`Max Pool Size` needs raising from its default of 100.

**One endpoint far worse than the rest** — nearly always a query that is
linear in the data rather than in the page. Both of the bad ones found
so far were that: a dashboard that loaded every programme into memory to
count them, and a queue that placed every waiting profile on every read.

## Related

- `deploy\windows\README.md` — deployment.
- `backend\db\releases\README.md` — schema scripts.
