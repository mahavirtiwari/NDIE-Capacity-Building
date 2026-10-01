# Training Module — .NET Core API & SQL Server database

REST API behind the Angular portal and the React Native applicant app.

| | |
|---|---|
| Runtime | .NET 10 (ASP.NET Core Web API) |
| ORM | Entity Framework Core 10 |
| Database | SQL Server 2022 |
| Auth | JWT bearer + permission claims |

## Running it

Prerequisites: .NET 10 SDK, SQL Server 2022 (Express is fine).

```bash
dotnet run --project backend/src/Ntms.Api
```

The API listens on `http://localhost:5210`. In Development it migrates the
database and seeds it on start, and Swagger is at `/swagger`.

Health check: `GET /health`.

### First sign-in

Seeding creates one Super Admin, `SA0001`, and gives it a first-run password
that has to be changed at first sign-in.

That password is **not** written down anywhere in this repository. Set it
yourself before the first start:

```
dotnet user-secrets set "Seed:SuperAdminPassword" "<a password you choose>" --project src/Ntms.Api
```

If you do not, one is generated and written to the application log at warning
level as the database is seeded — the only time it is ever shown:

```
warn: Seeded Super Admin SA0001 with the first-run password: <generated>.
```

Sign-in is by **user ID only**. E-mail is profile data the user can change, so
it is never accepted as a login identifier.

## Solution layout

```
backend/
  src/
    Ntms.Domain/          entities and enums, no dependencies
    Ntms.Application/     DTOs, the permission catalogue, format rules, guards
    Ntms.Infrastructure/  EF Core, SQL Server, services, JWT, email
    Ntms.Api/             controllers, auth policies, middleware
  db/
    NtmsDb-schema.sql     idempotent schema script for a DBA
```

Dependencies point inward: `Api → Infrastructure → Application → Domain`.

## Database

40 tables. Notable design decisions:

- **Identity is a generated code.** `PortalUsers.UserCode` and
  `Applicants.ApplicantCode` are unique; `Email` is indexed but *not* unique,
  because users change it.
- **Nothing is hard deleted.** Masters carry a `Status` of `Active` / `Inactive`
  (shown as Block / Unblock on the curriculum register). There are no DELETE
  endpoints for masters.
- **LGD is the location master.** `LgdStates` and `LgdDistricts` use the Local
  Government Directory codes as primary keys — 36 states/UTs and 763 districts,
  seeded from https://lgdirectory.gov.in/. Every address column is a foreign key
  to those codes, not free text.
- **Enums are stored as text** (`varchar(40)`), so the tables read correctly in
  SSMS and match the strings the clients exchange.
- **Applicant answers are JSON.** `Applications.Responses` holds the dynamic
  registration form answers, so a form change needs no schema migration. SQL
  Server 2022's `OPENJSON` can query it for reporting.
- **Money and rates carry explicit precision** — `decimal(18,2)` for amounts,
  `decimal(5,2)` for percentages.

### Migrations

```bash
dotnet ef migrations add <Name> --project backend/src/Ntms.Infrastructure --startup-project backend/src/Ntms.Api --output-dir Persistence/Migrations
```

```bash
dotnet ef database update --project backend/src/Ntms.Infrastructure --startup-project backend/src/Ntms.Api
```

For an environment where the application account cannot alter schema, hand
`db/NtmsDb-schema.sql` to the DBA — it is idempotent and safe to re-run.

It must be run with quoted identifiers on, which sqlcmd does not do by
default. Several tables carry filtered unique indexes, and they cannot be
created without it:

```bash
sqlcmd -S <server> -d NtmsDb -i backend/db/NtmsDb-schema.sql -b -I
```

Regenerate it after adding a migration, or it falls behind what the code
expects:

```bash
dotnet ef migrations script --idempotent --project backend/src/Ntms.Infrastructure --startup-project backend/src/Ntms.Api --output backend/db/NtmsDb-schema.sql
```

Raw SQL in a migration needs care because of this script. `database update`
sends each operation as its own command, but the script puts a whole
migration in one batch, and SQL Server resolves column names when it compiles
a batch. A statement naming a column that an earlier `AddColumn` in the same
migration adds will not parse. Wrap such statements in `EXEC(N'...')`, as the
existing ones are.

## Security

- **JWT bearer** tokens carry one `perm` claim per permission plus the base role.
  Refresh tokens are stored, rotated on use, and revoked on password change or
  reset.
- **Permission policies** are generated on demand: `[HasPermission("fees.manage")]`
  on an action is all that is needed. Super Admin passes every check implicitly.
- **Lockout** after 5 failed sign-ins, for 15 minutes.
- **Passwords** are PBKDF2 (ASP.NET Core `PasswordHasher`). OTP codes are stored
  hashed with the same hasher and are single use with a 5-attempt budget.
- **One sign-in failure message** regardless of cause, so the response never
  reveals whether a user ID exists.
- **Master scope is enforced in the query, not the UI.** An Operation Manager or
  Coordinator carries their category / sub-category / program-type ids as claims
  on the token, and the applicant, application and programme queries narrow
  themselves to that slice at the source. Super Admin and Admin are unscoped. An
  out-of-scope record is invisible, including by direct id, which answers 404.
- **Password reset is enumeration-resistant.** `forgot-password` returns a byte
  for byte identical response for a real user ID, an unknown one, a disabled
  account and a request made inside the 60-second cooldown — it never echoes
  back a masked address, because doing so only for real accounts would hand
  back exactly the signal the generic message withholds. The code is hashed,
  single use, valid 15 minutes, and capped at 5 attempts; a successful reset
  revokes every refresh token.
- **OTP sending is throttled** — 60 seconds between codes for one address and 5
  per hour. The endpoint has to stay anonymous, so this is what stops an inbox
  being bombed, and stops an attacker retiring a genuine applicant's live code
  over and over.
- **Applications are only ever created by the applicant**, through
  `POST /api/me/applications`, which takes the applicant id from the bearer
  token. The id is `[JsonIgnore]` on the DTO so it can never be bound from a
  request body.

## Validation

`Ntms.Application/Common/Formats.cs` is the server-side twin of the portal's
format registry: email, mobile, PAN, TAN, GSTIN, Aadhaar, pincode, IFSC, Udyam,
bank account and master codes. `Guard.Check()` composes them so a service
rejects everything wrong in one response rather than one problem at a time.

The browser validates for convenience; these rules decide what reaches the
database. Dynamic registration answers are validated against the published form
definition on submit — required fields, conditional visibility, and the format
implied by each field type.

## Email

Sender, SMTP connection and the wording of every transactional message are
editable at **Administration → Email** and stored in the database; the settings
in `appsettings.json` are only a fallback for anything left blank there, so an
untouched deployment behaves exactly as before.

- The SMTP password is **write-only over the API** — it is accepted on a save
  and never returned, so the portal cannot disclose it. `hasPassword` says
  whether one is stored.
- Bodies hold `{{placeholder}}` tokens. Values are **HTML-encoded** on the way
  in, so a name containing markup cannot break or inject into the message.
  Unknown tokens are left visible rather than blanked, so a typo shows up.
- Templates carrying a credential or a one-time code (`otp`,
  `applicant-credentials`, `portal-credentials`, `password-reset`) **cannot be
  switched off** — doing so would lock people out with no way back.
- A missing template row falls back to the shipped wording, so a deleted row can
  never stop the system notifying anyone.
- The branded frame around every message reads the organisation name and portal
  title from the branding settings, so email matches the portal.

### Legacy configuration

Configured under the `Email` section:

```json
"Email": {
  "Enabled": false,
  "Host": "smtp.example.gov.in",
  "Port": 587,
  "UseSsl": true,
  "UserName": "",
  "Password": "",
  "FromAddress": "no-reply@ntms.gov.in",
  "FromName": "National Training Management System",
  "ReplyTo": "support@ntms.gov.in",
  "RedirectAllTo": null,
  "TimeoutSeconds": 30,
  "OtpValidityMinutes": 10
}
```

- `Enabled: false` (the default) logs the message instead of sending it, so the
  OTP is visible in the console during development.
- `RedirectAllTo` sends every message to one address — use it on staging so a
  test never reaches a real applicant.
- Delivery failures are logged, never thrown: a notification that cannot be sent
  must not roll back the transaction that triggered it.

Messages sent: e-mail OTP, applicant welcome (carrying the applicant ID), portal
credentials (user ID + one-time password), application received, scrutiny
outcome, and the programme schedule on enrolment.

## Endpoints

```
POST   /api/auth/login | refresh | logout | change-password
GET    /api/auth/me
PUT    /api/auth/contact

POST   /api/otp/send | verify

POST   /api/auth/forgot-password    anonymous — mails a single-use reset code
POST   /api/auth/reset-password     anonymous — consumes the code, sets the password

GET    /api/email/settings          settings.manage — sender + SMTP (never returns the password)
PUT    /api/email/settings          settings.manage
POST   /api/email/settings/test     settings.manage — sends a real test message
GET    /api/email/templates         settings.manage
GET    /api/email/templates/{key}   settings.manage
PUT    /api/email/templates/{key}   settings.manage
POST   /api/email/templates/{key}/reset     settings.manage
POST   /api/email/templates/{key}/preview   settings.manage — renders, does not send

GET    /api/branding                anonymous — names and both logo URLs
GET    /api/branding/logo           anonymous — the organisation's mark
GET    /api/branding/partner-logo   anonymous — the partner/accrediting mark
PUT    /api/branding                settings.manage
POST   /api/branding/logo           settings.manage, multipart "file"
POST   /api/branding/partner-logo   settings.manage, multipart "file"
DELETE /api/branding/logo           settings.manage
DELETE /api/branding/partner-logo   settings.manage

GET    /api/lookups/{categories|sub-categories|program-types|agencies|
                     coordinators|operation-managers|roles|states|districts}
GET    /api/dashboard

GET    /api/{resource}              paged   (page, pageSize, search, sortBy, sortDir, filters)
GET    /api/{resource}/all
GET    /api/{resource}/{id}
POST   /api/{resource}
PUT    /api/{resource}/{id}
PATCH  /api/{resource}/{id}/status
```

`{resource}` is one of `categories`, `sub-categories`, `program-types`,
`agencies`, `curricula`, `registration-forms`, `fees`, `exam-papers`,
`materials`, `roles`, `users`, `applicants`, `applications`, `programs`.

Workflow routes:

```
POST   /api/registration-forms/replicate
GET    /api/registration-forms/by-program-type/{programTypeId}
GET    /api/fees/current/{programTypeId}
GET    /api/materials/mine
POST   /api/applicants/sign-up
PATCH  /api/applicants/{id}/blocked
POST   /api/applications                        (mobile submission)
POST   /api/applications/{id}/scrutiny
PATCH  /api/applications/{id}/assign
PATCH  /api/applications/{id}/documents/{docId}
POST   /api/users/{id}/reset-password
POST   /api/programs/{id}/close-registrations | exam-time | sessions | enrol
POST   /api/programs/{id}/sessions/{sessionId}/attendance
```

Every response is wrapped:

```json
{ "success": true, "message": null, "data": { }, "errors": null }
```

Lists return `{ "items": [], "total": 0, "page": 1, "pageSize": 10 }`.

## Configuration

| Key | Purpose |
|---|---|
| `ConnectionStrings:Default` | SQL Server connection |
| `Jwt:SigningKey` | **Required**, minimum 32 characters. The API refuses to start without it |
| `Jwt:AccessTokenMinutes` / `RefreshTokenDays` | Token lifetimes |
| `Cors:AllowedOrigins` | Origins the portal and mobile app are served from |
| `Database:MigrateOnStartup` | Migrate on boot (on in Development) |
| `Database:SeedSampleData` | Seed a few masters alongside the roles and Super Admin |
| `Email:*` | SMTP, as above |
| `Storage:MonitoringRoot` | Where coordinator photographs are written |
| `Storage:CertificateTemplateRoot` | Where certificate artwork is written |
| `Seed:SuperAdminPassword` | First-run password for `SA0001`; generated and logged if unset |

Before deploying, set `Jwt:SigningKey` and the SMTP password from the
environment or a key vault — not from `appsettings.json`.

## Deploying somewhere other than a developer machine

`appsettings.json` ships with no connection string and no signing key. Both are
deliberate: the service should refuse to start rather than quietly reach for a
database that is not there. Supply them as environment variables, which is what
containers and app services pass through:

```
ConnectionStrings__Default=Server=...;Database=NtmsDb;User Id=...;Password=...
Jwt__SigningKey=<32+ characters>
Cors__AllowedOrigins__0=https://cbms.example.gov.in
Storage__MonitoringRoot=/var/lib/cbms/monitoring
Storage__CertificateTemplateRoot=/var/lib/cbms/certificate-templates
```

**The two storage paths matter.** Uploaded photographs and certificate artwork
are files, not rows. Left unset they land beside the binaries, which is fine on
a developer machine and wrong anywhere else — a container filesystem is usually
read-only, and a redeploy would take the evidence with it. Point both at a
volume or a mounted share that every web head can reach and that gets backed
up. Nothing else the service writes lives outside the database.

**Linux is fine.** The IST conversion tries the Windows and the IANA zone id in
turn and falls back to a fixed +05:30, and path handling is case-sensitive off
Windows. The one thing tied to a platform is the database: the schema uses SQL
Server types and a filtered index, so it wants SQL Server, on whatever operating
system suits.

**Culture is pinned to `en-IN` at start-up** rather than inherited from the
host. Left to the machine, an unqualified `yyyy` can render a non-Gregorian year
and month names come out in the server's language. Anything that travels on the
wire formats invariantly at its own call site regardless.

## Connecting the portal

In `training-portal/src/environments/environment.ts` (development):

```ts
useMockApi: false,
apiBaseUrl: 'http://localhost:5210/api',
```

`environment.production.ts` uses a relative `/api`, which is correct wherever
the built app is served from the same origin as the API. Point it at an
absolute URL only if the two are genuinely split, and add that origin to
`Cors:AllowedOrigins`.

Setting `useMockApi: true` puts the portal back on its in-browser mock, which
implements the same routes and the same envelope.
