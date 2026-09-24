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

Seeding creates one Super Admin:

| User ID | Password |
|---|---|
| `SA0001` | `Password@123` (must be changed at first sign-in) |

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

Before deploying, set `Jwt:SigningKey` and the SMTP password from the
environment or a key vault — not from `appsettings.json`.

## Connecting the portal

In `training-portal/src/environments/environment.ts`:

```ts
useMockApi: false,
apiBaseUrl: 'http://localhost:5210/api',
```

Setting `useMockApi: true` puts the portal back on its in-browser mock, which
implements the same routes and the same envelope.
