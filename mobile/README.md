# CBMS Applicant (React Native / Expo)

The applicant-facing client of the Capacity Building Management System. Built
with **Expo SDK 57 / React Native 0.86** and **Expo Router** file-based routing.

Applicants register here, verify their email with an OTP, receive a
**system generated applicant ID** by email, and then see only the programmes
their category and sub-category entitle them to.

---

## Running it

```bash
cd mobile
npm install
npm start
```

Then press `a` for an Android emulator, `i` for an iOS simulator, or scan the QR
code with Expo Go on a physical device.

### Pointing the app at the API

`src/api/client.ts` resolves the base URL in this order:

1. `extra.apiBaseUrl` in `app.json`, when it is not a `localhost` address.
2. The host Metro is serving from — so a phone on the same Wi-Fi reaches the
   development machine automatically.
3. `10.0.2.2` on an Android emulator, which is how the emulator reaches the host.
4. `http://localhost:5210/api` as a last resort (iOS simulator and web).

For a deployment, set the real address once:

```json
{ "expo": { "extra": { "apiBaseUrl": "https://api.example.gov.in/api" } } }
```

The .NET API must be running and reachable; see `../backend/README.md`.

---

## What the app does

| Screen | Route | Purpose |
| --- | --- | --- |
| Splash | `app/index.tsx` | Restores the stored session and redirects |
| Sign in | `app/(auth)/sign-in.tsx` | Applicant ID + password (never email) |
| Create account | `app/(auth)/sign-up.tsx` | Name, email, mobile, PAN, category, sub-category |
| Verify email | `app/(auth)/verify.tsx` | 6 digit OTP; verifying issues the ID and password by email |
| Programmes | `app/(tabs)/programs.tsx` | Eligible programmes, fee, duration, delivery mode |
| Apply | `app/apply/[programTypeId].tsx` | The Super Admin designed form, plus fee and TDS |
| Applications | `app/(tabs)/applications.tsx` | Submitted applications and batch enrolments |
| Application | `app/application/[id].tsx` | Answers, documents and the scrutiny trail |
| Material | `app/(tabs)/materials.tsx` | Role-based reading material and videos |
| Profile | `app/(tabs)/profile.tsx` | Contact details, address, password |

### Identity

The applicant ID (`APP240001`) is issued by the server and is the only
credential used to sign in. **Email is editable profile data** — changing it on
the Profile tab does not change how the applicant signs in, and never reassigns
their record.

### Dynamic registration form

`src/components/DynamicForm.tsx` renders whatever Super Admin enabled for the
program type: text, number, email, mobile, PAN, TAN, GSTIN, IFSC, Aadhaar,
pincode, date, select, multi-select, radio, checkbox and file fields, including
conditional fields that only appear when another answer matches. The same
format rules the portal and the API enforce live in `src/validation/formats.ts`,
so the applicant is corrected before anything is posted.

### TDS

When a fee structure offers TDS options (2% and 10%), the applicant chooses a
rate on the apply screen. Choosing a non-zero rate requires their **TAN**, which
is validated locally and again by the API.

### Branding

`src/branding/BrandingContext.tsx` fetches `GET /api/branding` anonymously at
start-up, so the splash and sign-in screens show the organisation name and the
logo Super Admin uploaded in the web portal. If the call fails, the app falls
back to the compiled-in NDIE names and an emblem — it never blocks on branding.

---

## Layout

```
app/                     Expo Router routes (the file tree is the navigation)
  (auth)/                Sign in, sign up, OTP verification
  (tabs)/                The signed-in tab bar
  apply/[programTypeId]  Application form
  application/[id]       Application detail
src/
  api/                   Typed client, endpoints, DTO mirrors, useResource
  auth/                  AuthContext over expo-secure-store
  branding/              Portal identity fetched from the API
  components/            UI kit, Picker, DynamicForm
  validation/            Shared Indian format rules
  theme.ts               Tokens mirroring the Angular portal
```

Session tokens are held in `expo-secure-store` on device (and `localStorage` on
web, which has no secure store), and cleared on sign-out or a 401.
