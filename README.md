# METRO ASSIST

**Divyangjan Assistance & Station Coordination System — independent prototype**

> **Important:** This is an independent prototype. It is not connected to DMRC internal systems, is not approved by DMRC, and must not be used with real passenger data without authorisation. The bundled station list and route order are synthetic demonstration data, not the official Pink Line sequence. Replace and verify them before any field deployment.

Metro Assist coordinates assistance for visually impaired and wheelchair-using passengers between stations across the Pink Line station network. A station raises a request for a destination; both the creating and destination stations receive a high-priority alarm; the boarding station records the train's actual position; a second alarm fires exactly three stations before arrival; and the destination closes the request once assistance has been provided.

The prototype runs completely offline on a local SQLite database, so it works without Supabase or any external credential. A Supabase/PostgreSQL schema is provided for teams that want a hosted database.

---

## Contents

- [What is implemented](#what-is-implemented)
- [Technology](#technology)
- [Quick start](#quick-start)
- [Accounts and portals](#accounts-and-portals)
- [End-to-end demonstration scenario](#end-to-end-demonstration-scenario)
- [How the workflow is enforced](#how-the-workflow-is-enforced)
- [Administrator portal](#administrator-portal)
- [Station CSV import](#station-csv-import)
- [Database schema](#database-schema)
- [Realtime, alarms and notifications](#realtime-alarms-and-notifications)
- [PWA installation and offline behaviour](#pwa-installation-and-offline-behaviour)
- [Android APK](#android-apk)
- [Configuration](#configuration)
- [Supabase mode](#supabase-mode)
- [Deployment](#deployment)
- [Security and production checklist](#security-and-production-checklist)
- [Project structure](#project-structure)
- [Troubleshooting and limitations](#troubleshooting-and-limitations)

---

## What is implemented

### Station console

- Separate station login with a station dropdown and password.
- Three large dashboard cards: **Visually Impaired**, **Wheelchair**, **Other Information**.
- Statistics for total, pending, acknowledged, approaching, completed and active notices.
- Live request register, train tracking, information board and notification history.
- Assistance request form with:
  - assistance type, automatically filled boarding station, destination;
  - passenger count with +/− controls;
  - train number and train set;
  - automatic `+ Circular` / `− Circular` direction and journey preview;
  - unique request code generated and stored in the database.
- Destination-only acknowledgement with full request details, **ACKNOWLEDGE** and **SILENCE**.
- Destination-only **ASSISTANCE PROVIDED** completion.
- Boarding-station departure and manual location updates with direction, sequence and destination validation.
- Movement history and status timestamps attributed to staff accounts.
- Other Information broadcasts (Lost & Found, Separate Passenger, Other) with optional image, broadcast to every active station with an audible/flashing alarm, direct acknowledgement from the alarm overlay, notice board and administrator closure.
- Duplicate acknowledgement/completion prevention and idempotent movement updates.
- Alarm overlay, audible siren, browser notifications, Web Push and notification delivery history.
- Dedupe across reconnects so the same critical alarm is not replayed indefinitely.
- Demo-mode banner while the synthetic dataset is in use.

### Administrator portal

- Network overview with live counts, recent requests, direction split and audit feed.
- Station master with search, create, edit, activate/deactivate, validated CSV/XLSX import and CSV template download.
- Route sequence editor for both circular directions, verification panel, unsaved-change tracking and guarded save.
- User account management for station staff and administrators, including station assignment, activation and password reset. Password resets and role changes revoke existing sessions.
- Read-only request register with filters, full journey, timeline, movement history and acknowledgements.
- Notice register with station acknowledgement names and administrator closure.
- Daily, weekly and monthly reports with assistance mix, average acknowledgement/completion times, station-wise breakdown and CSV export.
- System settings for organisation name, ETA model, alarm volume, alarm repeat interval, browser notifications, Web Push, notice auto-close and demo mode.
- Searchable audit log and CSV export.
- JSON and SQLite backups.

---

## Technology

- **Next.js 15** (App Router, server components, route handlers) and **React 19**
- **TypeScript** in strict mode
- **Tailwind CSS 3**
- **SQLite** through Node's built-in `node:sqlite` module (WAL mode, foreign keys, transactions)
- Server-side sessions: random token, SHA-256 hash stored in the database, httpOnly cookie
- **scrypt** password hashing
- Server-Sent Events for live dashboard updates
- **Web Push** with VAPID (`web-push`) and a service worker
- **SheetJS (`xlsx`)** for CSV/XLSX station imports
- Optional **Supabase/PostgreSQL** schema in `supabase/schema.sql`

No external service is required for local development: the database, VAPID keys and demonstration data are created automatically on first start.

---

## Quick start

### Requirements

- Node.js **22.5 or newer** (Node 24 recommended; `node:sqlite` is built in).
- npm.
- A modern browser. Web Push requires HTTPS, except on `localhost`.

This workspace also contains a portable Node toolchain in `.tools/node` (git-ignored). To use it:

```bash
export PATH=$PWD/.tools/node/bin:$PATH
node -v
```

### Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The first request creates `data/metro.db`, seeds the settings, the demonstration stations/routes, demo accounts and sample requests. A VAPID key pair is generated into `data/vapid.json`.

Production build:

```bash
npm run build
npm start
```

The app must run as a long-lived Node server, not a stateless/serverless function, because the SQLite database and SSE connections live on disk. See [Deployment](#deployment).

### Reset the local database

Stop the server, then:

```bash
npm run seed:reset
npm run dev
```

The reset script refuses to run while `http://localhost:3000` is responding. Uploaded images in `data/uploads` are preserved; delete them manually only if you want a completely clean environment.

---

## Accounts and portals

All **38 Pink Line stations** are provisioned as active station accounts and appear in the station dropdown at `/login`. Every station account uses the temporary password `12345`. Usernames are station-name slugs and are visible in **Admin → Users**; examples:

| Portal | URL | Username | Password |
| --- | --- | --- | --- |
| Station | `/login` | `anand-vihar` | `12345` |
| Station | `/login` | `lajpat-nagar` | `12345` |
| Station | `/login` | `rajouri-garden` | `12345` |
| Station | `/login` | `mayur-vihar-1` | `12345` |
| Administrator | `/admin/login` | `admin` | `Admin@12345` |

Select any station in the dropdown and enter `12345`. The dropdown is populated from active station accounts, so a station deactivated or added in the administrator portal is reflected immediately. The provisioning step is idempotent: while demonstration mode is enabled, an existing database receives accounts for any missing active stations on the next server start without losing data. Once real credentials are issued, turn off **Demo mode** in **Admin → Settings** so the demo accounts are not recreated.

> **Temporary prototype password:** `12345` is for controlled testing only. Before deployment, sign in as administrator and reset every station password to a unique credential. Change `ADMIN_PASSWORD` before the first production start so the seeded administrator is not created with the public default.

Station accounts can operate only their own station's requests, but all stations participate in the shared network: **Other Information** notices are broadcast to all 38 active stations, and assistance requests coordinate the boarding and destination stations with real-time updates. Administrators have network-wide access.

---

## End-to-end demonstration scenario

Use two browser windows or devices, one per station.

1. Sign in at `/login` as **Anand Vihar ISBT**.
2. Enable sound when prompted (browser autoplay rules require a user gesture).
3. Click **Visually Impaired**, choose destination **Lajpat Nagar**, set passengers to **2**, enter train **2890**, set **23**, confirm direction **+ Circular**, and submit. A unique code such as `MA-…` is created. Anand Vihar receives a request-created alarm and Lajpat Nagar receives the new-request alarm.
4. Switch to **Lajpat Nagar**. A high-priority alarm appears immediately; the notice board and notification tab show the request. The overlay flashes until handled.
5. Click **ACKNOWLEDGE** (or **SILENCE**). The acknowledgement is timestamped and attributed to the Lajpat Nagar account; Anand Vihar sees it live.
6. Back at Anand Vihar, click **TRAIN DEPARTED**.
7. Use **UPDATE LOCATION** to advance the train through the actual stations. Backward moves, stations outside the journey and moves beyond the destination are rejected.
8. When the train is exactly **three stations** from Lajpat Nagar, the second alarm fires with the exact text **“TRAIN APPROACHING – PLEASE PREPARE FOR DIVYANGJAN ASSISTANCE.”** and the destination details. It fires once per request.
9. Silence the alarm if needed; moving further does not create duplicate alarms.
10. Advance the train to Lajpat Nagar. The arrival notification appears.
11. At Lajpat Nagar click **ASSISTANCE PROVIDED**. The completion timestamp and staff member are stored, and the request becomes **COMPLETED** at every station.
12. The administrator audit log records request creation, acknowledgement, departure, movements, the second alarm, arrival and completion.
13. To test wheelchair assistance, sign in at Lajpat Nagar and create a request back to Anand Vihar; the direction is automatically `− Circular`.
14. To test network-wide broadcasts, use **Other Information** at any station, choose **Separate Passenger**, add a description and optionally an image. Every active station receives an alarm overlay and notification.
15. At a receiving station, click **ACKNOWLEDGE NOTICE** in the alarm overlay or open the notice and acknowledge it. The origin station sees the acknowledgement.
16. Sign in to `/admin`, open **Notices**, review acknowledgements and close the notice. Repeat the whole flow as needed.

The request, acknowledgement, movement, notice, notification and audit rows are all written to SQLite; there is no frontend-only mock workflow.

---

## How the workflow is enforced

All rules are enforced on the server in `src/lib/workflow.ts`; the UI cannot bypass them.

- A request must start and end at different active stations that belong to the chosen direction.
- The journey is derived from the configured route sequence, never from an invented coordinate system.
- Acknowledgement and completion are accepted only from the destination station account.
- Moved stations must be on the journey and strictly ahead of the current position; a train cannot move past its destination.
- The second alarm is triggered by the **stored manual location** when `remaining <= 3`, not by a timer, and only while `second_alarm_sent = 0`.
- Acknowledgement creates a destination notification back to the boarding station.
- Notifications use a dedupe key so retries and reconnects do not duplicate them.
- Sessions, role checks, station ownership and request state are verified on every mutation.
- Every meaningful action is written to `audit_logs`.

---

## Administrator portal

Open `/admin` and sign in.

| Tab | What it does |
| --- | --- |
| **Home** | Network statistics, latest requests, direction split, recent audit activity. |
| **Stations** | Create/edit stations, activate/deactivate, import CSV/XLSX, download template. |
| **Routes** | Review and reorder `+` and `−` circular sequences; verification reports missing, duplicate or inactive stations. |
| **Users** | Create station/admin accounts, assign a station, activate/deactivate, reset passwords, revoke sessions. |
| **Requests** | Read-only monitor of every request with journey, timeline, movements and acknowledgements. |
| **Notices** | Review broadcasts, acknowledgement counts/names, close resolved notices. |
| **Reports** | Daily (14 days), weekly (8 weeks) and monthly (12 months) reports with CSV export. |
| **Settings** | Organisation name, seconds per station, alarm volume, alarm repeat, browser/push toggles, notice auto-close, demo mode. |
| **Audit** | Searchable audit trail and CSV export. |
| **Backup** | Download a JSON snapshot (hashes removed) or a full SQLite copy. |

### CSV/XLSX station import

The template is available from **Stations → CSV template**.

Required columns:

```csv
station_code,station_name,plus_sequence,minus_sequence,active_status
AVH,Anand Vihar ISBT,1,38,active
IPE,IP Extension,2,37,active
LPN,Lajpat Nagar,11,28,active
```

Rules enforced before anything is written:

- station code 2–12 characters (`A–Z`, `a–z`, `0–9`, `_`, `-`) and unique;
- station name non-empty and unique;
- `plus_sequence` / `minus_sequence` positive, unique, and complete;
- every active station present in both sequences;
- no duplicate sequence positions;
- `active_status` accepts `active/inactive`, `true/false`, `1/0`, `yes/no`.

An import replaces the active station list and both route sequences in a transaction. Stations absent from the file are deactivated. The full validation result is returned to the UI before any change is committed. **Always verify the official station order; the bundled 38-station loop is demonstration data.**

---

## Database schema

SQLite tables created in `src/lib/db.ts`:

| Table | Purpose |
| --- | --- |
| `stations` | Station code, name, active flag, timestamps. |
| `route_sequences` | `(station_id, direction, sequence)` for `+` and `−` circular orders. |
| `users` | Admin and station accounts, scrypt hashes, role, station assignment, active flag. |
| `sessions` | Hashed session tokens with expiry and last-seen time. |
| `assistance_requests` | Request details, direction, status, staff, timestamps, current station, second-alarm state, ETA. |
| `request_acknowledgements` | Destination acknowledgement and completion receipts. |
| `train_movements` | Actual manual location history with offsets. |
| `notifications` | Per-station alerts, priority, status and dedupe key. |
| `other_information` | Lost & Found, separate passenger and other notices. |
| `information_acknowledgements` | Per-station notice acknowledgements. |
| `audit_logs` | Actor, station, action, entity and details. |
| `settings` | Operational configuration as key/value pairs. |
| `push_subscriptions` | Web Push endpoints, keys and owning station/user. |

Foreign keys, uniqueness constraints, check constraints and indexes are defined in the same file. The Supabase version is in `supabase/schema.sql`, including the required `plus_sequence`, `minus_sequence` and `active_status` station columns and RLS policies.

---

## Realtime, alarms and notifications

- **Live updates:** `/api/events` is a Server-Sent Events stream. Station clients receive only their station's events; administrators receive all events.
- **Reconnect:** the station UI reconnects with a delay and falls back to polling, then reconciles the dashboard.
- **Request-created alarm:** every new request triggers an audible/flashing high-priority alarm at the creating station and the destination. The destination can acknowledge directly from the overlay; both stations receive a browser/push notification.
- **Broadcast alarm:** every active station receives an audible/flashing alarm overlay when Other Information is broadcast, with **ACKNOWLEDGE NOTICE** and **SILENCE ALARM** actions.
- **Second alarm:** triggered by the stored manual train location exactly three stations before the destination. Title: **“TRAIN APPROACHING – PLEASE PREPARE FOR DIVYANGJAN ASSISTANCE.”**
- **Sound:** synthesised in the browser with the Web Audio API, so no audio file is required. Volume and repeat interval come from administrator settings. Browsers require a user gesture before audio can start; the dashboard shows an **Enable sound** prompt.
- **Silence:** stops the siren and removes the overlay but does not acknowledge the request.
- **Browser notifications:** shown when the tab is in the background and permission is granted.
- **Web Push:** VAPID keys are generated automatically on first start when env credentials are absent. Subscriptions are stored per station. Push works when the app is closed, subject to browser/platform limits.
- **Delivery history:** every notification is persisted in `notifications`; marking read/silenced is stored server-side.
- **Dedupe:** high-priority and critical alarms are not re-queued after reconnect or polling.
- **Test alarm:** available from the station header and Alerts tab; it exercises sound/overlay and writes a `TEST ALARM` audit entry.

---

## PWA installation and offline behaviour

- `/manifest.webmanifest` defines the app name, icons, theme and shortcuts.
- `/sw.js` caches the offline shell, serves static assets stale-while-revalidate and handles navigation network-first with an offline fallback.
- `/offline` explains that live coordination needs connectivity.
- The service worker handles `push` and `notificationclick`, focusing or opening `/dashboard`.
- Icons: `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` and `icon.svg`.
- Install from the browser's **Install app / Add to Home Screen** action. Web Push and service workers require HTTPS in production (`localhost` is treated as secure).

The service worker never caches `/api/*` responses, so request data is not served stale.

---

## Android APK

An installable Android wrapper is built at `android-apk/out/METRO-ASSIST.apk` (also served at `/downloads/METRO-ASSIST.apk` while the server is running).

The APK is a thin native WebView shell around the same Next.js application, not a second copy of the backend. The phone talks to the METRO ASSIST server over the network, so:

- the server must be running on a computer reachable from the phone (same Wi-Fi for the default local setup);
- the app shows a **Server address** prompt on first launch, pre-filled with `http://192.168.29.79:3000`. Accept it or enter the server's LAN address;
- use the **⋮ → Change server** action at any time, for example after the server's IP address changes;
- **⋮ → Reload** refreshes the app; **⋮ → Open in browser** opens the same page in Chrome.

Supported in the wrapper: station/admin login with persisted cookies, live SSE updates, alarm overlays and the Web Audio siren (after **Enable sound**), CSV/JSON/SQLite downloads (saved to `Downloads/METRO-ASSIST`), image uploads through the Android file picker, Android back navigation, and a retry screen when the server is unreachable.

Limitations of a WebView wrapper:

- **Web Push and browser notifications are not available inside the APK.** Web Push requires a full browser/PWA environment. Use Chrome and install the PWA if background push is required; the in-app siren and alarm overlay still work while the app is open.
- The APK is signed with a local debug key for sideloading. Replace it with a release key before distributing it.
- The prototype talks plain HTTP on the LAN, so cleartext traffic is enabled. Use HTTPS and remove cleartext permission for any wider deployment.
- The APK targets Android 7.0+ (API 24) and does not include the server or database.

To rebuild after changing the wrapper:

```bash
./android-apk/build-apk.sh
cp android-apk/out/METRO-ASSIST.apk public/downloads/METRO-ASSIST.apk
```

The build uses the portable JDK and Android SDK under `.tools/` (installed for this project) and needs no Gradle or Android Studio. The wrapper source is in `android-apk/`:

```text
AndroidManifest.xml            permissions, cleartext LAN access, launcher activity
java/.../MainActivity.java     WebView, server settings, uploads, downloads, error screen
res/raw/download_bridge.js     saves blob-based CSV exports through the native bridge
res/drawable/ic_launcher.xml   app icon
build-apk.sh                   reproducible aapt2 → javac → d8 → apksigner build
```

Install on a phone with **Install unknown apps** enabled, either by opening `http://<server>:3000/downloads/METRO-ASSIST.apk` on the phone or by transferring the file and tapping it. The default server address can be changed in the first-launch prompt.

---

## Configuration

Copy `.env.example` to `.env.local` and adjust as needed:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ADMIN_USERNAME` | `admin` | Initial administrator username, created only when no admin exists. |
| `ADMIN_PASSWORD` | `Admin@12345` | Initial administrator password. **Change before production.** |
| `ADMIN_NAME` | `System Administrator` | Display name for the initial administrator. |
| `SECONDS_PER_STATION` | `180` | Initial ETA model; editable later in Settings. |
| `DATA_DIR` | `./data` | SQLite database, VAPID keys and uploads. Must be persistent. |
| `VAPID_SUBJECT` | `mailto:metro-assist@example.local` | Web Push contact. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | auto-generated | Optional externally managed VAPID keys. |
| `NEXT_PUBLIC_SUPABASE_URL` | empty | Optional hosted database URL (not used in local mode). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | empty | Optional Supabase anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | empty | Optional server-only service key. Never expose it to the browser. |

The environment variables above are read on the server. The local mode does not need Supabase variables at all.

---

## Supabase mode

The shipped application is deliberately self-contained and uses SQLite. If you want PostgreSQL/Supabase:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Create Auth users and link them through `users.auth_user_id`, or continue using the application's server-side accounts.
4. Keep all writes on the server with the service-role key; the schema grants browser clients read-only, station-scoped access through RLS.
5. Adapt the repository layer (`src/lib/repo.ts`, `src/lib/workflow.ts`, `src/lib/db.ts`) to PostgreSQL queries. The schema mirrors the local tables, and the business rules remain server-side.
6. Enable Realtime for `notifications`, `assistance_requests` and `other_information` (the SQL file attempts to add them to the `supabase_realtime` publication).

Because the prototype has no Supabase credentials, **local SQLite mode is the supported out-of-the-box runtime**. Nothing is silently mocked: all writes go to the real local database.

---

## Deployment

The application is a long-running Node service with a file-backed database and SSE connections.

1. Provision a Node 24 host with a **persistent volume** mounted at `data/` (or set `DATA_DIR`).
2. Set production environment variables, especially `ADMIN_PASSWORD`, `DATA_DIR` and VAPID credentials (or persist the auto-generated `data/vapid.json`).
3. Install and build:

   ```bash
   npm ci
   npm run build
   npm start
   ```

4. Terminate TLS at a reverse proxy (HTTPS is required for Web Push and installation).
5. Restrict administrator and station access to the intended network; consider an additional identity-aware proxy.
6. Import and verify the official station/route data, then rotate every seeded password.
7. Schedule backups with the JSON export and copy the SQLite file only to restricted storage.
8. Run a single application instance per SQLite file. For horizontal scaling, migrate to PostgreSQL/Supabase and replace the in-process SSE bus with a shared pub/sub channel.

Do not deploy this prototype on the public internet with the demonstration accounts or the `12345` password.

---

## Security and production checklist

- Passwords are hashed with scrypt; plaintext passwords are never stored.
- Session tokens are random and stored only as SHA-256 hashes; cookies are httpOnly, same-site and secure in production.
- Login is rate-limited; mutating API requests verify origin.
- Role and station ownership are checked on every endpoint.
- Uploads are limited to images and 5 MB, and served from the controlled uploads route.
- CSRF protection relies on same-site cookies plus origin checks; add a per-session CSRF token if exposing the app beyond a controlled network.
- Audit logs capture sign-in/out, requests, movements, acknowledgements, notices, imports, route changes, settings and user administration.
- Passwords resets revoke existing sessions.
- Demonstration data is clearly labelled in the UI, the database seed, the audit trail and exports.

Before deployment:

- [ ] Replace all demo stations and both route sequences with verified official data.
- [ ] Change the administrator password and every station password.
- [ ] Disable demo mode.
- [ ] Configure HTTPS, persistent storage and backups.
- [ ] Confirm Web Push works on the target devices and browsers.
- [ ] Complete an independent security review and accessibility audit.
- [ ] Confirm data-protection authorisation for any real passenger information.

**Do not connect this code to DMRC internal systems or use real passenger data without explicit authorisation.**

---

## Project structure

```text
src/
  app/
    api/                 Route handlers (auth, dashboard, requests, info, admin, upload, push, events)
    admin/               Administrator portal pages
    dashboard/           Station console page
    login/               Station login
    offline/             Offline fallback
    layout.tsx           Metadata, manifest, PWA registration
  components/
    admin/               Administrator sections
    station/             Station dashboard, alarms, forms and tabs
    Logo.tsx, PwaSetup.tsx, ui.tsx
  lib/
    db.ts                Schema, seeding, SQL helpers, settings
    auth.ts              Sessions and password verification
    workflow.ts          Assistance, movement and alarm rules
    repo.ts              Dashboard and read models
    notify.ts, push.ts   Notifications and Web Push
    route.ts             Route/journey engine
    spreadsheet.ts       CSV/XLSX import and template
    admin.ts, events.ts, api.ts, types.ts
data/                    SQLite database, VAPID keys, uploads (git-ignored)
android-apk/             Android WebView wrapper and no-Gradle APK build script
public/
  sw.js                  Service worker (cache, push, notification click)
  manifest.webmanifest   PWA manifest
  icons/                 PWA and Apple icons
  downloads/             METRO-ASSIST.apk served to phones
supabase/schema.sql      PostgreSQL/Supabase schema and RLS policies
scripts/reset-db.mjs     Local database reset helper
```

---

## Troubleshooting and limitations

- **No sound:** browsers block audio until a user gesture. Click **Enable sound**; check the device volume and the administrator alarm volume.
- **No browser notification:** permission must be granted at the browser level, and the dashboard must be in the background. Browser notifications can also be disabled in Settings.
- **No push:** requires HTTPS (or localhost), a service worker, permission, and configured VAPID keys. Some browsers (notably iOS) only allow Web Push for installed PWAs.
- **Offline page instead of dashboard:** live station coordination needs a network connection; the offline shell is intentional.
- **APK shows “Server unreachable”:** confirm the server is running, the phone is on the same Wi-Fi, the computer firewall allows the port, and the address in **⋮ → Change server** matches the current LAN IP (the default is `http://192.168.29.79:3000`).
- **No Web Push in the APK:** use Chrome and install the PWA for background push; the APK keeps alarms and the siren while it is open.
- **Reset doesn't run:** stop the dev/production server first. The script refuses to delete an in-use database.
- **Uploaded images disappear after redeploy:** mount `data/` as a persistent volume.
- **Multiple instances:** SQLite and in-process SSE are single-instance. Move to PostgreSQL and shared pub/sub before scaling out.
- **Route data:** the bundled 38-station loop is synthetic. It proves the engine but must be replaced with the administrator-verified order.
- **Time zone:** the interface formats times in IST for station coordination; timestamps are stored in UTC.

---

**Metro Assist — independent prototype, not affiliated with DMRC.**
