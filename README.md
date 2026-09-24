# Training Module

Training and certification lifecycle for the Ministry of MSME. Super Admin sets
up the programme masters, Admin runs agencies and application scrutiny,
Operation Managers and Coordinators run the programmes on the ground, and
applicants apply from the mobile app against the forms configured here.

The back end has its own guide in [backend/README.md](backend/README.md) and the
applicant app in [mobile/README.md](mobile/README.md).

| Layer | Technology | Where |
|---|---|---|
| Front end | Angular 22.1 (standalone, signals, zoneless), SCSS, no UI framework | `training-portal/` |
| Back end | .NET 10 Web API, EF Core 10 | `backend/` |
| Database | SQL Server 2022 | `backend/db/` |
| Mobile | React Native 0.86 / Expo SDK 57, Expo Router | `mobile/` |

## Running it

Start the API (migrates and seeds SQL Server on first run):

```bash
dotnet run --project backend/src/Ntms.Api
```

Then the portal:

```bash
npm --prefix training-portal install
```

```bash
npm --prefix training-portal start
```

Open http://localhost:4200. The API is on http://localhost:5210 with Swagger at
`/swagger`.

And the applicant app:

```bash
npm --prefix mobile install
```

```bash
npm --prefix mobile start
```

Press `a` for an Android emulator, `i` for iOS, or scan the QR code with Expo
Go. It finds the API automatically on the development machine; see
[mobile/README.md](mobile/README.md) for a deployed address.

To run the portal on its own, set `useMockApi: true` in
`training-portal/src/environments/environment.ts` — it then serves everything
from a browser-side mock with no backend at all.

### Sign-in

Sign-in is by **system generated user ID** — never by email, which the user can
change at any time.

Against the real API, seeding creates one account: **`SA0001`** with password
`Password@123`, which must be changed at first sign-in. Create the rest from
**Portal users**; the API generates each user ID and a one-time password and
emails them.

Against the mock, the login screen lists five ready-made accounts (`SA0001`,
`AD0002`, `AD0004`, `OM0005`, `CO0010`), all with `Password@123`.

## Screens

**Programme setup (Super Admin)**
- Categories, Sub-categories, Program types
- Curriculum — programme register with day-wise Sessions → Topics, Active /
  Blocked tabs (modelled on the live ZED curriculum screen)
- Registration forms — a full form designer: add sections and fields, 17 field
  types, per-field validation, conditional visibility, enable/disable any field
  or section, copy a layout, replicate a finished form onto another program type,
  live applicant preview
- Fee structures — components, GST, concessions, and the TDS rates (2% / 10%)
  the applicant may opt for
- Exam papers — questions, options, marks, negative marking, pass criteria
- Training material — files, videos and links with role-based visibility

**Administration**
- Roles & permissions — Super Admin mints roles from a permission catalogue
- Portal users — admins, operation managers, coordinators, with master scoping
- Implementing agencies
- Applicants, Application scrutiny (queue + full scrutiny screen)
- Branding — the organisation name, short name, portal title, tagline, support
  address, and **two logos**: the organisation's mark and a partner /
  accrediting body's mark (QCI alongside NDIE), which sit at opposite ends of
  the sign-in header (`settings.manage`, held by Super Admin)

**Operations**
- Coordinators
- Programmes — register matching the live workflow (New → Permission accepted →
  Calendar created → Conducted, plus Postponed / Rejected), close registrations,
  set exam time, attendance marking

**Applicant (mobile)**
- Create account (name, email, mobile, PAN, category, sub-category) → email OTP
  → system generated applicant ID and password by email
- Programmes eligible for the applicant's category, with fee and duration
- Apply — the Super Admin designed form for that program type, plus the fee
  breakdown and the TDS declaration
- Applications and enrolments, with the scrutiny trail
- Training material, and a profile where email, mobile and address are editable

### Responsive behaviour

The portal is a single layout that adapts, not a separate mobile build.

| Width | Behaviour |
| --- | --- |
| > 1280px | Full sidebar, four-column filter bars |
| 900–1280px | Filters fall to three then two columns; forms stay two-up |
| < 900px | Sidebar becomes an off-canvas drawer with a scrim; forms go one-up |
| < 600px | Dialogs take the full screen; footers stack |
| < 480px | Filters go full width; page padding tightens |

Crossing the 900px line is handled live through `matchMedia`, so rotating a
tablet or dragging a window reflows immediately rather than on the next reload.
Heights use `dvh` so mobile browser chrome cannot clip the drawer or a dialog
footer, wide tables scroll inside their own container rather than stretching the
page, and every grid uses `minmax(0, 1fr)` so long values cannot force the
layout wider than the screen.

## Front-end architecture

```
training-portal/src/app/
  core/
    models/        DTOs shared with the API, plus the LGD state/district master
    services/      ApiService + a generic CrudService each feature extends
    guards/        authGuard, guestGuard, roleGuard, permissionGuard
    interceptors/  auth (bearer), error (toasts), mock API
    mock/          in-memory database + seed data
    validation/    one registry of Indian document formats and validators
  shared/          design-system components (table, modal, charts, dynamic form…)
  layout/          shell, sidebar, topbar
  features/        one folder per area, every route lazy loaded
```

### Validation

`core/validation/formats.ts` is the single source of truth for email, mobile,
PAN, TAN, GSTIN, Aadhaar, pincode, IFSC, Udyam, bank account and master codes.
The same patterns drive reactive forms in the portal *and* the dynamic
registration fields rendered for applicants, so a PAN is validated identically
wherever it is captured.

### State and district master

States and districts come from the **Local Government Directory (LGD)**,
Ministry of Panchayati Raj — 36 states/UTs and 763 districts with their LGD
codes, in `core/models/lgd.data.ts`. Lookup ids *are* LGD codes, so the values
stored here line up with any other government system.

Source: https://lgdirectory.gov.in/

## The API contract

The mock and the real API implement the same routes and the same
`{ success, data }` envelope, so the portal cannot tell them apart:

```
POST   /api/auth/login
GET    /api/lookups/{categories|sub-categories|program-types|agencies|
                     coordinators|operation-managers|roles|states|districts}
GET    /api/dashboard
GET    /api/{resource}            paged list  (page, pageSize, search, sortBy, sortDir, …filters)
GET    /api/{resource}/all        unpaged list
GET    /api/{resource}/{id}
POST   /api/{resource}
PUT    /api/{resource}/{id}
PATCH  /api/{resource}/{id}/status     enable / disable — masters are never deleted
```

plus the workflow routes: `applications/{id}/scrutiny`, `applications/{id}/assign`,
`applications/{id}/documents/{docId}`, `programs/{id}/sessions`,
`programs/{id}/sessions/{sid}/attendance`, `programs/{id}/enrol`,
`registration-forms/by-program-type/{id}`, `users/{id}/reset-password`,
`applicants/{id}/blocked`.

## Conventions worth knowing

- **Identity is the generated ID.** Users have a `userCode`, applicants an
  `applicantCode`. Email is editable profile data and is never a key.
- **Records are disabled, not deleted.** Every master screen offers
  Enable/Disable (Block/Unblock on the curriculum register) so history and
  downstream references stay intact.
- **TDS is the applicant's declaration.** Admin configures which rates the fee
  structure offers; the applicant chooses one and supplies their own TAN on the
  registration form.
- **Scope is a boundary, not a filter.** Operation Managers and Coordinators are
  created against a category, sub-category and program type; the API narrows
  every applicant, application and programme query to that slice, so the screens
  cannot show what the role is not entitled to.
- **Branding is data, not an asset.** Both logos and the organisation names live
  in the database and are served by `GET /api/branding`, which is anonymous so
  the sign-in screen and the mobile app are already branded. Both clients fall
  back to a text wordmark when no logo has been uploaded.

## Build

```bash
npm --prefix training-portal run build
```

Output goes to `training-portal/dist/training-portal`.

```bash
dotnet build backend/Ntms.slnx
```

```bash
npm --prefix mobile run export
```
