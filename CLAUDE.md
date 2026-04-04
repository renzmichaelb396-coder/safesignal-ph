# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Read this file completely before touching any code. Every rule here comes
> from a real production bug that cost time and broke the live system.

---

## What This System Is

**SafeSignal PH / RespondPH** — Emergency SOS platform for Pasay City Police Station.
Citizens send one-tap SOS alerts with GPS. Dispatchers assign officers. Officers respond.

- **Live URL:** https://safesignal-ph.vercel.app
- **GitHub:** https://github.com/renzmichaelb396-coder/safesignal-ph
- **Stack:** React 18 + Vite 5 + TypeScript (frontend) | Express serverless on Vercel (backend)
- **Database:** PostgreSQL via `pg` pool (Neon) — production is `api/index.ts`
- **Auth:** JWT tokens stored in localStorage — role-specific keys, never shared
- **Routing:** wouter (lightweight client-side router)
- **Styling:** Tailwind CSS (inline styles also used extensively)
- **Maps:** Leaflet / MapLibre GL

---

## Build & Development Commands

```bash
npm run dev            # Start both frontend + backend concurrently
npm run dev:client     # Vite dev server only (port 5173)
npm run dev:server     # Express backend only (port 3001, via tsx watch)
npm run build          # Production build (Vite → dist/)
npm run preview        # Preview production build locally
npm run start          # Production server (NODE_ENV=production)
```

**Local dev setup:** Vite proxies `/api/*` → `http://localhost:3001` and `/ws` → `ws://localhost:3001` (configured in `vite.config.ts`). No separate proxy needed.

**No test runner or linter is configured.** Verify changes with `npm run build` (must complete with zero errors).

---

## Architecture Overview

### Two Separate Backends — Only One Is Production
> **CRITICAL RULE:** When you add or rename columns in `api/index.ts`, you MUST also update
> `server/safesignal/database.ts` initSchema() in the same change. They are a synchronized pair.

| Path | Purpose | Used in production? |
|------|---------|-------------------|
| `api/index.ts` | Vercel serverless function — ALL prod routes | **YES** |
| `server/index.ts` | Local Express dev server (uses `server/safesignal/`) | **NO — legacy** |

**All backend changes go in `api/index.ts`.** The `server/` directory is only for local dev convenience and is NOT deployed.

### Frontend Architecture

- **Routing:** `src/App.tsx` defines all routes via wouter `<Switch>`. Citizen routes are at `/`, dispatch routes at `/dispatch/*`, officer at `/officer`.
- **Auth contexts wrap the entire app:** `CitizenAuthProvider` → `DispatchAuthProvider` → `Router`. Each context manages only its own localStorage keys.
- **API layer:** `src/lib/api.ts` exports `citizenApi` and `dispatchApi` objects with typed fetch helpers. All requests go through a shared `request()` function that auto-attaches JWT tokens by role type.
- **`normalizeAlert()`** in `api.ts` handles field name differences between the two backends (legacy compat).

### Path Aliases

- `@/` → `./src/`
- `@shared/` → `./shared/`

Defined in both `tsconfig.json` and `vite.config.ts`. Use these in imports.

### Vercel Deployment

`vercel.json` rewrites all `/api/*` to `api/index.ts` (single serverless function). The `sql.js` WASM files are bundled via `includeFiles`. Frontend builds to `dist/` with SPA fallback (`/(.*) → /index.html`).

---

## Project Structure

```
safesignal-ph/
├── api/
│   └── index.ts          ← THE ONLY PRODUCTION BACKEND. All routes live here.
│                           (server/safesignal/ is legacy, NOT used in prod)
├── src/
│   ├── pages/
│   │   ├── citizen/      ← Landing, Login, Register, VerifyOtp, Home, SosActive,
│   │   │                   SosConfirm, History, Profile
│   │   └── dispatch/     ← DispatchLogin, DispatchLayout, Dashboard, OfficerDashboard,
│   │                       AlertQueue, AlertDetailModal, Officers, Citizens,
│   │                       DispatchHistory, Metrics, Settings
│   ├── contexts/
│   │   ├── DispatchAuthContext.tsx   ← Manages dispatch_token / dispatch_user ONLY
│   │   ├── CitizenAuthContext.tsx    ← Manages citizen auth
│   │   └── ThemeContext.tsx
│   └── lib/
│       └── api.ts        ← All fetch helpers (citizenApi, dispatchApi, officerFetch)
├── vercel.json           ← All /api/* routes → api/index.ts
└── CLAUDE.md             ← This file
```

---

## Alert Status Lifecycle (MEMORIZE THIS)

```
ACTIVE → ACKNOWLEDGED → EN_ROUTE → ON_SCENE → RESOLVED
                                              → CANCELLED
                                              → FALSE_ALARM
```

**Statuses that mean "emergency is still happening" (in-progress):**
```
ACTIVE, ACKNOWLEDGED, EN_ROUTE, ON_SCENE
```

**Statuses that mean "emergency is over" (terminal):**
```
RESOLVED, CANCELLED, FALSE_ALARM
```

**Every SQL query that touches alert status must be classified as either:**
1. **In-progress query** (citizen polling, cooldown, duplicate check, surge) → must include ALL 4 in-progress statuses
2. **Archive/history query** → uses terminal statuses only

---

## THE 8 PRODUCTION BUGS — Never Repeat These

### BUG-001 — SQL Status Enum Gap (Silent Citizen Kick)
**Root cause:** Citizen active-alert query only had `status IN ('ACTIVE', 'ACKNOWLEDGED')`.
When officer tapped En Route → DB returned null → citizen app navigated to /home mid-emergency.

**Rule:** Any query where a citizen should still see their active SOS must use:
```sql
status IN ('ACTIVE', 'ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE')
```
**Files:** `api/index.ts` lines 617, 630, 652 (fixed ✅), lines 588, 590, 602 (fixed ✅)

**Scan command before any backend change:**
```bash
grep -n "status IN" api/index.ts
```
Every result must either use all 4 in-progress statuses OR be an explicit archive query.

---

### BUG-002 — Map Init Timing (Missing Blue Dot)
**Root cause:** `reportLocation()` called before `mapInstanceRef.current` existed.
`updateOfficerMarker()` hit the null guard and returned silently. Blue dot never showed.

**Rule:** Any function touching the map ref MUST fire inside `map.on('load')`:
```ts
// ✅ CORRECT
mapInstanceRef.current = new maplibregl.Map({ ... });
mapInstanceRef.current.on('load', () => {
  reportLocation(); // map is ready here
});

// ❌ WRONG — map ref is null, silently fails
useEffect(() => {
  initMap();
  reportLocation(); // map not ready yet
}, []);
```
**File:** `src/pages/dispatch/OfficerDashboard.tsx`

---

### BUG-003 — Auth Session Bleed via Read (Dispatch reads Officer key)
**Root cause:** `DispatchAuthContext` init useEffect was falling back to
`safesignal_officer_token` when `dispatch_token` was absent. Officer logged in as dispatcher.

**Rule:** Each context reads ONLY its own keys. No fallbacks to other role keys.
**File:** `src/contexts/DispatchAuthContext.tsx` — fixed ✅

---

### BUG-004 — Status Flow Gating (Officer Skips Acknowledge)
**Root cause:** En Route / On Scene / Resolved buttons showed even when status was ACTIVE.
Officer could skip Acknowledge. Citizen never saw "Officer Assigned" state.

**Rule:** Officer buttons are strictly gated:
- `status === 'ACTIVE'` → show ONLY "Acknowledge Assignment" button
- `status !== 'ACTIVE'` → show En Route / On Scene / Resolved

Backend transition array must start from ACKNOWLEDGED:
```ts
const valid = ['ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE', 'RESOLVED'];
```
**File:** `src/pages/dispatch/OfficerDashboard.tsx` — fixed ✅

---

### BUG-005 — Citizen Status Blindness
**Root cause:** `SosActive.tsx` showed no officer name, no human-readable status.
Citizen saw no change when dispatcher assigned an officer.

**Rule:** `SosActive.tsx` must implement and use:
- `getStatusLabel(status)` — converts DB value to human string
- `getStatusMessage(status, officerName)` — context-aware message per status
- `getStatusColor(status)` — distinct color per status
- Officer card renders when `sosStatus.officer_name` is set

If you add a new status, update all 3 functions AND `getStatusColor`.
**File:** `src/pages/citizen/SosActive.tsx` — fixed ✅

---

### BUG-006 — Gradient Header Inconsistency
**Root cause:** `History.tsx` used `linear-gradient(135deg, #1e4c8f, #ffc72c)`.
Broke dark navy visual consistency.

**Rule:** All page headers use dark navy ONLY:
```ts
background: '#0d1117'
borderBottom: '1px solid rgba(255,255,255,0.08)'
```
Gold `#ffc72c` is for badges and accents ONLY, never backgrounds.
**File:** `src/pages/citizen/History.tsx` — fixed ✅

---

### BUG-007 — Auth Session Bleed via Write (Dispatch writes Officer keys)
**Root cause:** `DispatchAuthContext.saveSession()` was WRITING to `safesignal_officer_token`
and `safesignal_officer_data`. Dispatch login overwrote officer session. Dispatch logout
called `clearSession()` which deleted officer keys too.

**Rule:** `DispatchAuthContext` must ONLY touch `dispatch_token` and `dispatch_user`.
It must NEVER read, write, or delete `safesignal_officer_*` keys.
**File:** `src/contexts/DispatchAuthContext.tsx` — fixed in commit bb838b2 ✅

---

### BUG-008 — Officer Logout Nukes Dispatch Session
**Root cause:** `OfficerDashboard.handleLogout()` removed `dispatch_user` and `dispatch_token`.
Logging out of officer view killed the dispatch session.

**Rule:** Officer logout removes ONLY officer keys:
```ts
localStorage.removeItem('safesignal_officer_token');
localStorage.removeItem('safesignal_officer_role');
localStorage.removeItem('safesignal_officer_data');
// NEVER touch dispatch_token or dispatch_user here
```
**File:** `src/pages/dispatch/OfficerDashboard.tsx` — fixed in commit bb838b2 ✅

---

## localStorage Key Isolation — The Iron Rule

| Role | Token Key | User Data Key |
|------|-----------|---------------|
| Officer | `safesignal_officer_token` | `safesignal_officer_data` |
| Dispatch | `dispatch_token` | `dispatch_user` |
| Citizen | `safesignal_citizen_token` | *(profile via API)* |
| Citizen SOS | `active_sos_id` | *(alert status via polling)* |

**Cross-reading = bug. Cross-writing = critical bug.**

Audit command:
```bash
grep -rn "safesignal_officer_token\|dispatch_token\|dispatch_user\|safesignal_officer_data" src/contexts/ src/pages/dispatch/
```
- `DispatchAuthContext.tsx` → dispatch keys ONLY
- `OfficerDashboard.tsx` → officer keys ONLY (read AND write AND delete)

---

## API Routes (all in `api/index.ts`)

**Citizen**
- `POST /api/citizen/register` — register + OTP
- `POST /api/citizen/verify-otp` — verify phone OTP
- `POST /api/citizen/login` — login with phone + PIN
- `GET  /api/citizen/profile` — get citizen profile (auth: citizen)
- `POST /api/citizen/sos` — send SOS alert (auth: citizen)
- `GET  /api/citizen/active-alert` — poll active SOS (auth: citizen) ← BUG-001 lives here
- `POST /api/citizen/sos/cancel` — cancel active SOS (auth: citizen)
- `POST /api/citizen/location-update` — update citizen GPS (auth: citizen)
- `GET  /api/citizen/alerts` — alert history (auth: citizen)

**Dispatch / Officer**
- `POST /api/dispatch/login` — login (returns JWT)
- `GET  /api/dispatch/alerts` — list alerts (auth: officer)
- `POST /api/dispatch/alerts/:id/acknowledge` — acknowledge alert
- `POST /api/dispatch/alerts/:id/assign` — assign officer to alert
- `POST /api/dispatch/alerts/:id/resolve` — resolve alert
- `POST /api/dispatch/alerts/:id/false-alarm` — mark false alarm
- `GET  /api/dispatch/officers` — list officers
- `POST /api/dispatch/officer-location` — officer reports GPS (auth: officer)
- `GET  /api/dispatch/officer-locations` — all officer GPS positions
- `GET  /api/officer/active-assignment` — officer's current assignment
- `PATCH /api/officer/assignment/:id/status` — update assignment status (ACKNOWLEDGED → EN_ROUTE → ON_SCENE → RESOLVED)

**SSE**
- `GET  /api/dispatch/events` — Server-Sent Events stream (real-time alerts to dispatch)

---

## Database Tables

- `sos_alerts` — core alerts table (`status`, `citizen_id`, `assigned_officer_id`, `lat`, `lng`, `triggered_at`, etc.)
- `citizens` — registered citizens (`phone`, `full_name`, `barangay`, `pin_hash`, `suspended`)
- `officers` — police officers (`email`, `badge_number`, `role`, `password_hash`, `is_active`)
- `citizen_trust_scores` — trust score tracking per citizen
- `alert_location_history` — GPS trail per alert
- `officer_locations` — last known GPS per officer
- `station_settings` — cooldown minutes, surge threshold, surge window

---

## Local Dev — SQLite Server (`server/`)

The `server/` directory is **local development only** — it runs Express + SQLite (`better-sqlite3`) instead of PostgreSQL. It is **never deployed to production**.

### How It Works
- `npm run dev` starts BOTH Vite (port 5173) AND Express/SQLite (port 3001) via `concurrently`
- SQLite DB auto-creates at project root: `safesignal.db` (gitignored, along with `.db-shm`, `.db-wal`)
- Schema + seed initialized on first run via `initSchema()` + `seedData()` in `server/safesignal/database.ts`

### Migration Guard (self-healing DB)
On every cold start, the server checks:
```typescript
const o = db.prepare("SELECT email FROM officers WHERE email = 'dispatcher@pasay.safesignal.ph'").get();
if (!o) throw new Error('stale seed');
```
If that query fails (missing `email` column) OR returns null (wrong seed data), the server:
1. Closes the DB connection
2. Deletes `safesignal.db`
3. Recreates with correct schema + seed

**Zero manual steps needed.** Just restart the dev server after schema changes.

### SQLite Column Map (must match route files exactly)
| Table | Key Columns |
|---|---|
| `officers` | `id, station_id, badge_number, email, full_name, role, password_hash, is_active, last_login` |
| `citizens` | `id, full_name, phone, address, barangay, city, photo_url, pin_hash, verified, strike_count, is_suspended, suspension_reason, registered_at, last_active` |
| `sos_alerts` | `id, citizen_id, station_id, status, alert_type, lat, lng, triggered_at, acknowledged_at, assigned_officer_id, resolved_at, cancelled_at, notes, cancellation_reason, is_suspicious, suspicious_reason` |
| `citizen_trust_scores` | `id, citizen_id, score, total_alerts, false_alarms, resolved_emergencies, last_updated` |
| `otp_codes` | `id, citizen_id, code, expires_at, is_used` (note: `citizen_id`, NOT `officer_id`) |
| `alert_location_history` | `id, alert_id, lat, lng, recorded_at` |

### Schema Change Checklist (run every time you add a column)
- [ ] Add column to `api/index.ts` production route
- [ ] Add column to `server/safesignal/database.ts` initSchema()
- [ ] Add value in seedData() if the column needs seed data
- [ ] Update migration guard check string if the change is breaking (forces rebuild on restart)
- [ ] Restart dev server — migration guard auto-rebuilds DB

---

## Developer Workflow (VS Code + Chrome + Cowork)

### The Write Path (no PAT required)
| Task | Tool |
|---|---|
| Read any file | `gh.read(path)` in Chrome console (uses browser session) |
| Edit existing file | GitHub CM6 web editor → targeted `.replace()` patch → commit |
| Create new file | `github.com/.../new/main?filename=path` → inject via CM6 |
| Pull to local | VS Code "Sync Changes N↓" (autofetch detects within 30s) |

### VS Code Autofetch
`.vscode/settings.json` is committed:
```json
{ "git.autofetch": true, "git.autofetchPeriod": 30, "git.confirmSync": false }
```
After pushing to GitHub, VS Code shows "Sync Changes N↓" within 30 seconds. One click pulls.

### CM6 Targeted Patch Pattern
```javascript
const view = document.querySelector('.cm-content')?.cmTile?.view;
const src = view.state.doc.toString();
const patched = src.replace('EXACT_OLD_STRING', 'NEW_STRING');
// SAFETY CHECK: if patched === src, the string wasn't found — do NOT dispatch
view.dispatch({ changes: { from: 0, to: src.length, insert: patched } });
```

### CM6 Safety Rules
1. **Always use `to: view.state.doc.length`** for full-file replacements — never a hardcoded number
2. **Verify `patched !== src`** before dispatching — if equal, the match failed, abort
3. **Check line count after injection** — if it's higher than expected, duplicate content was introduced
4. **Never use partial `to:`** — it leaves the original tail and creates duplicate exports/functions

---

## Pre-Deploy Checklist (run EVERY time before `git push`)

```bash
# 1. Sync check
git fetch && git status   # must be on main, not behind

# 2. Status enum audit
grep -n "status IN" api/index.ts
# Every in-progress query must have all 4: ACTIVE, ACKNOWLEDGED, EN_ROUTE, ON_SCENE

# 3. Auth isolation audit
grep -n "safesignal_officer_token\|dispatch_token" src/contexts/DispatchAuthContext.tsx
# Must NOT see safesignal_officer_token in saveSession or clearSession

# 4. Build check
npm run build   # must complete with zero errors

# 5. No .env files staged
git diff --staged --name-only | grep -i env   # must return nothing
```

Only push when all 5 pass. No exceptions.

---

## Adding a New Alert Status (Full Checklist)

If you ever add a status (e.g., `DISPATCHING`, `ON_HOLD`):

- [ ] `api/index.ts` — add to transition validation array in `PATCH /api/officer/assignment/:id/status`
- [ ] `api/index.ts` — add to ALL `status IN (...)` in-progress queries (run grep to find them all)
- [ ] `src/pages/citizen/SosActive.tsx` — add to `getStatusLabel()`
- [ ] `src/pages/citizen/SosActive.tsx` — add to `getStatusMessage()`
- [ ] `src/pages/citizen/SosActive.tsx` — add to `getStatusColor()`
- [ ] `src/pages/dispatch/OfficerDashboard.tsx` — update button gating logic if it's a new officer-driven step
- [ ] `src/pages/dispatch/Dashboard.tsx` — update status badge display
- [ ] Run full workflow simulation to verify citizen sees the new state

Missing even one item causes a silent bug in at least one role's view.

---

## Commit Format

```
fix(<scope>): <what broke and why in plain English>
feat(<scope>): <what was added and why>

scope examples: citizen, dispatch, officer, api, auth, map
```

Example: `fix(api): include EN_ROUTE and ON_SCENE in citizen active-alert query`

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Demo Accounts (Production + Local)

All accounts use Pasay Police Station data seeded via `initializeDatabase()`.

| Role | Email | Badge | Password / PIN | URL |
|---|---|---|---|---|
| Dispatcher | `dispatcher@pasay.safesignal.ph` | `PNP-001` | `password123` | /dispatch/login |
| Field Officer | `officer@pasay.safesignal.ph` | `PNP-002` | `password123` | /dispatch/login |
| Station Admin | `admin@pasay.safesignal.ph` | `PNP-ADM` | `password123` | /dispatch/login |
| Citizen | *(phone-based)* | `09171234567` | PIN: `1234` | / (Login button) |

Station Admin (PNP-ADM) is the only role that can access /dispatch/settings.

---

## Bug Fix Log — Apr 4 2026 (8 fixes shipped)

### BUG-MAP-01: Dispatch map auto-zoom lock
**Root cause:** Every 3s poll → `setAlerts` → `useEffect([alerts])` → `updateMapMarkers` → unconditional `flyTo`. User could not zoom out manually.
**Fix:** Added `autoZoomAlertIdRef`. `flyTo` only fires when the priority alert ID *changes*, not on every poll cycle.
**File:** `src/pages/dispatch/Dashboard.tsx`

### BUG-OFFICER-01: Officer status update silent failure
**Root cause:** `updateStatus` called `await officerFetch(...)` but never checked `res.ok`. Toast fired regardless of HTTP 4xx/5xx response — dispatch dashboard and citizen app never updated.
**Fix:** Added `if (!res.ok) throw new Error(...)` before `fetchAssignment()`. Error is now shown to officer; success toast only fires on confirmed server update.
**File:** `src/pages/dispatch/OfficerDashboard.tsx`

### BUG-SELFIE-01: Citizen registration selfie not clickable
**Root cause:** Camera circle `<div>` was a *sibling* of `<label>`, not inside it. Tapping the circle did nothing.
**Fix:** Wrapped entire selfie block (circle + text + `<input type="file">`) in one `<label htmlFor="selfie-upload">`. Also added required validation: form blocks submission if no photo uploaded.
**File:** `src/pages/citizen/Register.tsx`

### BUG-HISTORY-01: Dispatch history notes field blank
**Root cause:** DB column is `notes` but frontend read `resolution_notes` (old column name).
**Fix:** Added `notes?: string` to Alert interface; display reads `alert.notes || alert.resolution_notes` for backward compat.
**File:** `src/pages/dispatch/DispatchHistory.tsx`

### BUG-AUTH-01: Settings page accessible to non-admin roles
**Fix (2 parts):**
1. `DispatchLayout.tsx` — Settings nav item now has `roles: ['STATION_ADMIN']` restriction (hidden from DISPATCHER/OFFICER)
2. `Settings.tsx` — Added hard guard: if `officer.role !== 'STATION_ADMIN'`, renders locked screen instead of form
**Files:** `src/pages/dispatch/DispatchLayout.tsx`, `src/pages/dispatch/Settings.tsx`

### BUG-EMOJI-01: Citizens page broken emoji
**Root cause:** Corrupted UTF-8 bytes `\u00f0\u009f\u0091\u0095` stored as 4 separate characters instead of `👤` (U+1F464).
**Fix:** Replaced with `String.fromCodePoint(0x1f464)` / literal `👤`.
**File:** `src/pages/dispatch/Citizens.tsx`

---

## Map Configuration

**Pasay Police Station center:** `[120.9987, 14.5547]` (lng, lat)
Map auto-centers here when no active emergency. Dispatch map uses MapLibre GL (Mapbox-compatible API). Officer map uses Leaflet.

**Auto-zoom rule:** Only zoom to alert on *new* alert ID. Never flyTo on every poll cycle (breaks manual zoom).

---

## Authentication Architecture

Three completely isolated auth systems. Never mix tokens:

| System | Token key | Context |
|---|---|---|
| Citizen | `safesignal_citizen_token` | CitizenAuthContext |
| Dispatch/Officer | `dispatch_token` | DispatchAuthContext |
| Officer view only | `safesignal_officer_token` | bridged from dispatch_token on OFFICER role login |

**Critical:** Dispatch login bridges token to `safesignal_officer_token` for officers. Never clear `dispatch_token` from officer logout — only clear `safesignal_officer_token`.

---

## Bug Fix Log — Apr 5 2026 (Dev Environment Fix)

### BUG-SCHEMA-01: SQLite dev schema completely out of sync with route files
**Root cause:** `server/safesignal/database.ts` was never updated when production routes evolved.
Used old column names: `name` (not `full_name`), `status` (not `is_active`), no `email`,
no `last_login`, `latitude`/`longitude` (not `lat`/`lng`), `officer_id` in otp_codes (should be `citizen_id`).
**Fix:** Rewrote initSchema() with correct schema + migration guard that auto-rebuilds DB on stale schema.
**Files:** `server/safesignal/database.ts`

### BUG-SEED-01: Officer seed credentials didn't match frontend demo buttons
**Root cause:** Seeded `pnp001@safesignal.ph` / badge `ADM-001` but frontend expected
`dispatcher@pasay.safesignal.ph` / badge `PNP-ADM`. Login returned 401.
**Fix:** Read login page DOM to capture exact demo credential values, updated seedData() to match.
**Files:** `server/safesignal/database.ts`

### BUG-EXPORT-01: CM6 patch in previous session duplicated server/safesignal/index.ts
**Root cause:** CM6 dispatch used `to:` value smaller than actual file length. Replacement stopped
early, original tail remained, new content was prepended creating `registerSafeSignalRoutes` twice.
**Fix:** Detected via line count (25-line file reporting errors on line 32). Replaced entire content.
**Files:** `server/safesignal/index.ts`

### WORKFLOW-01: VS Code autofetch + CM6 pipeline established
- `.vscode/settings.json` committed: autofetch every 30s, no sync confirmation prompt
- `.gitignore` updated: SQLite WAL files excluded from tracking
- `.claude/cowork-bridge.js` committed: `gh.read()` fast file read helper
- Dev workflow documented in new "Developer Workflow" section above
