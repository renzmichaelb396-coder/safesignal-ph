# SafeSignal PH — Claude Code Project Context

> Read this file completely before touching any code. Every rule here comes
> from a real production bug that cost time and broke the live system.

---

## What This System Is

**SafeSignal PH / RespondPH** — Emergency SOS platform for Pasay City Police Station.
Citizens send one-tap SOS alerts with GPS. Dispatchers assign officers. Officers respond.

- **Live URL:** https://safesignal-ph.vercel.app
- **GitHub:** https://github.com/renzmichaelb396-coder/safesignal-ph
- **Stack:** React + Vite + TypeScript (frontend) | Express serverless on Vercel (backend)
- **Database:** PostgreSQL via `pg` pool (Neon) — production is `api/index.ts`
- **Auth:** JWT tokens stored in localStorage — role-specific keys, never shared

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
