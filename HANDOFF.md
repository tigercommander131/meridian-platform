# PARASOL EMS — Handoff

**Last updated:** 2026-06-20 (Weeks 1-16 COMPLETE + Course Management UI)

## Status: 16-WEEK BUILD COMPLETE + verified

Full build done. Foundation (1-4) + students (5) + cohorts/QR (6) + sessions
lifecycle, check-in, roles, flight recorder (7-9) + rubric scoring with evidence
(10) + **approval workflow (11)** + **learner reports + PDF (12)** + **exports +
audit (13)** + **conflict-resolution UI + QR scan (14)** + **hardening + test
coverage (15)** + **go-live: Docker stack + ops docs (16)**. Every feature
verified end-to-end (API + browser); production Docker image boots, migrates,
and serves.

## Tests
- Backend: `cd backend && npm test` — **52 passing** (auth 9 + sync 5 + realtime 2 + learners 6 + cohorts 5 + sessions/scoring 7 + approval 6 + reports 2 + exports 3 + courses 7). Needs Postgres running.
- Frontend: `cd frontend && npm test` — **7 passing** (login 2 + parseCsv 3 + ScoresPanel 2).

## Routes (live)
- Auth `/api/auth/*` · Sync `/api/sync` · WS `/ws`
- Learners `GET/POST /api/organisations/:org/learners`
- Courses `GET/POST /api/organisations/:org/courses`, `GET/PUT /api/organisations/:org/courses/:id` (create/list/get/update; write = educator/admin; list supports `?status=`)
- Cohorts `POST/GET /api/courses/:course/cohorts`, `GET /api/cohorts/:id`
- Sessions `POST/GET /api/cohorts/:id/sessions`, `GET /api/sessions/:id`, `POST .../start|end`
- Participants `PUT /api/sessions/:id/participants/:pid/checkin|role`
- Flight recorder `POST /api/sessions/:id/flight-recorder-events`, `GET .../participants/:pid/flight-recorder-events`
- Scoring `GET .../participants/:pid/scoring-context`, `POST .../rubric-scores`, `GET /api/sessions/:id/rubric-scores`, `GET /api/rubrics/:id`
- Approval `GET /api/rubric-scores/:id`, `PUT .../approve|release|dispute|reopen` (educator/admin; dispute open)
- Reports `GET /api/learners/:id/report` (released scores aggregate)
- Exports `GET /api/cohorts/:id/exports/scores.csv`, `.../flight-recorder.csv`, `GET .../exports` (history), `GET .../audit`
- Sync override: `POST /api/sync` events accept `resolution:'override'` to force a finalized score
- Frontend pages: `/dashboard` `/students` `/courses` `/cohorts` `/cohorts/[id]` `/sessions` `/sessions/[id]` `/scoring/[sessionId]/[participantId]` `/reports` `/users` (all nav active). `/courses` → "Manage cohorts" deep-links `/cohorts?course=<id>`.

## Database
- PostgreSQL 14 in Docker container `parasol-postgres` (port 5432).
- Start DB: `docker start parasol-postgres` (created via `docker run`, see below).
- Migrations: `npm run migrate:up` · status: `npm run migrate:status`
- Seed: `npm run seed`
- 15 tables. Seed (`npm run seed`): org `parasol-emt`, 2 sites, user `instructor@parasol.edu.au`, **3 courses** (2 active + 1 completed), **3 cohorts** (learners attached, QR set), **10 learners**, **2 rubrics** (ALS VF Team Lead + BLS Adult) with criteria. Idempotent (`ON CONFLICT DO NOTHING`). Run once on Railway after first deploy.

To recreate the container from scratch:
```
docker run --name parasol-postgres -e POSTGRES_USER=parasol_dev -e POSTGRES_PASSWORD=dev_password -e POSTGRES_DB=parasol_ems -p 5432:5432 -d postgres:14
```

## Run it

**Backend** (port 3001):
```
cd C:\Users\joell\parasol-ems\backend
npm run dev
```
**Frontend** (port 3000):
```
cd C:\Users\joell\parasol-ems\frontend
npm run dev
```
Dev login: `instructor@parasol.edu.au` / `password`

## CHANGED
**Day 1:**
- Backend: Express server, `/api/health`, full `/api/auth/*` (login/refresh/logout/verify), JWT middleware, role middleware, error handler, CORS, rate limiting (5/min on login).
- Frontend: Next.js 14 + Tailwind. `/login`, `/dashboard` (protected), `/` (redirects by auth). API client `src/services/api.js`.
- Added `parasol-frontend` to `~/.claude/launch.json` (preview on 3000).

**Day 2-3:**
- DB schema `001_init.sql` (15 tables: org, sites, users, learners, courses, cohorts, cohort_learners, sessions, session_participants, rubrics, rubric_criteria, rubric_scores, flight_recorder_events, exports, _migrations).
- Migration runner `src/migrations/run.js` (transactional, tracks applied in `_migrations`).
- Seeder `src/seeders/run.js`.
- **Swapped stub auth → real Postgres lookup** in `authController.js`.
- Fixed `environment.js` to load `.env.local` (plain dotenv reads `.env` only).

**GitHub:**
- Monorepo pushed to **private** repo `tigercommander131/meridian-platform` (inconspicuous codename — no PARASOL/EMT/medical hint in repo name/title).
- Root `.gitignore`, `README.md` (neutral "Meridian Platform"). Secrets verified NOT committed (`.env.local` ignored; only `.env.example` template committed).
- gh account: `tigercommander131`.

**Day 4-5 (offline storage):**
- `frontend/src/services/database.js` — sql.js SQLite in browser, persisted to IndexedDB (DB binary snapshotted after every write). Offline schema (learners/sessions/rubric_scores) + `sync_queue` outbox.
- `frontend/src/utils/cryptography.js` — AES-256-GCM via Web Crypto + PBKDF2 (dev passphrase placeholder — see SECURITY note below).
- `frontend/src/stores/syncStore.js` (Zustand) — online/offline + pending count.
- `frontend/src/hooks/useSync.js` — online/offline listeners + outbox refresh.
- `frontend/src/hooks/usePersist.js` — `create()`/`list()` local DB, auto-enqueues sync events.
- Dashboard: live Online/Offline badge + queued count + offline self-test card.
- WASM served from `frontend/public/sql-wasm.wasm` — generated by `copy-wasm` script (predev/prebuild), gitignored not committed.

**VERIFIED (Day 4-5):** Browser — wrote a learner to local SQLite, read back (rows: 1), badge showed "1 queued"; after full page reload the queued event persisted (IndexedDB survives reload). `preview_screenshot` hangs on this page (sql.js/WASM renderer quirk) — verified via DOM snapshot + eval instead.

**SECURITY follow-up:** `cryptography.js` uses a hardcoded dev passphrase. Before any real data, derive the key from the user session / device secret — never the constant. Tracked here.

**Week 2 (auth + app shell + tests):**
- `stores/authStore.js` (Zustand) + `hooks/useAuth.js` — reactive auth state, hydrates from localStorage. api.js owns token storage.
- `services/api.js` — refresh-token flow: auto-refreshes once on 401 via `/auth/refresh`, retries the request, clears session on failure. Stores refreshToken.
- App shell: `components/layout/{Header,Sidebar,AppShell}.jsx` — responsive (sidebar fixed on md+, slide-over on mobile), sync badge in header, nav with Dashboard active + Students/Sessions/Reports "Soon".
- `AppShell` guards routes (redirect to /login when unauthenticated); `/login` redirects to /dashboard when already authed. Auth persists across refresh.
- Dashboard refactored to render inside AppShell.
- Backend refactored: `src/app.js` (createApp, no listener) imported by `server.js` + tests.
- Backend rate limiter skips in test env (`config.nodeEnv === 'test'`).
- Tests: backend `src/__tests__/auth.test.js` (9), frontend `src/app/login/__tests__/login.test.jsx` (2).

**VERIFIED (Week 2):** Browser — login via store → dashboard with full shell (header + sidebar); sync badge shows persisted "1 queued"; `/login` while authed → redirects to `/dashboard`. Both test suites green.

**Harness note:** `preview_fill` doesn't trigger React's onChange for controlled inputs — use native setter + `input` event in `preview_eval` to drive forms. `preview_screenshot` hangs on the sql.js dashboard; verify via `preview_snapshot`.

**Week 3 (offline→cloud sync engine):**
- Migration `002_sync.sql` — `synced_events` idempotency log.
- Backend `controllers/syncController.js` + `routes/sync.js` → `POST /api/sync` (auth'd):
  - Idempotent: dedupe by `event_id` (re-send = no-op, returns `deduped: true`).
  - Applies `learners.upsert` + `rubric_scores.upsert` to domain tables (org from JWT).
  - Conflict detection per spec §9: if server score already `approved`/`released` and differs → returns `{status:'conflict', serverVersion, clientVersion, resolution:'manual_review_required'}`, does NOT overwrite. Per-event transaction (conflict/fail rolls back).
  - `GET /api/sync/status` → count of this user's synced events.
- Frontend `services/sync.js` `drainQueue()` — reads local outbox, POSTs, marks synced, returns conflicts.
- `stores/syncStore.js` — `sync()` action (syncing/synced/error status, conflicts, lastSyncedAt).
- `hooks/useSync.js` — auto-drains on mount (if online) and on `online` event.
- Dashboard `SyncPanel` — status, "Sync now", conflict display.
- Backend tests `src/__tests__/sync.test.js` (4): auth required, learner syncs to DB, idempotent re-send, conflict not overwritten.

**VERIFIED (Week 3):** Browser — leftover queued event auto-drained on mount (reached Postgres, `synced_events`=2); clicked self-test → "1 queued" → "Sync now" → "All synced", second Offline learner landed in DB (count 1→2). Backend 13/13.

**Week 4 (real-time + error handling):**
- Backend `realtime.js` — `ws` server on `/ws` (same port 3001), `broadcast(type, payload)`, client tracking + disconnect cleanup. `server.js` now wraps app in `http.Server` + `initRealtime`. Kept separate from app.js to avoid import cycle.
- `syncController` broadcasts `events.synced` after a successful drain → other clients update live.
- Frontend `services/realtime.js` — WS client with exponential-backoff auto-reconnect (resets on open, max 30s), graceful (never throws). `stores/realtimeStore.js` + `hooks/useRealtime.js` (mounted once in AppShell).
- Dashboard `LiveActivity` panel — connection dot + live event feed.
- `stores/toastStore.js` + `components/shared/Toast.jsx` (auto-dismiss) + `components/shared/ErrorBoundary.jsx`. AppShell renders ToastContainer + wraps children in ErrorBoundary. Sync success/conflict/failure raise toasts.
- Backend tests `realtime.test.js` (2): connect handshake + broadcast relay.

**VERIFIED (Week 4):** Browser dashboard showed Live activity "(connected)"; POSTed a sync as a second client via PowerShell → browser's Live activity updated live to "1 event(s) synced by instructor@parasol.edu.au" with no refresh. Backend 15/15, frontend 2/2.

**Week 5 (student management):**
- Backend `learnersController.js` + `routes/organisations.js`: create (single + `{data:[]}` batch, validation, dedupe via ON CONFLICT, row-level failures), list (search ILIKE, pagination). Org-scoped via JWT (403 on mismatch). Broadcasts `learners.created`.
- Frontend `services/data.js` (learnersApi/coursesApi/cohortsApi + `parseCsv`). `/students` page: searchable table + "Add students" (manual multi-row + CSV upload with per-row validation/preview). Dashboard stat cards now real (Active Courses, Learners).
- Sidebar: Students + Cohorts now active (were "Soon").
- Tests `learners.test.js` (6).

**Week 6 (cohorts + QR):**
- Backend `coursesController.js` (list) + `cohortsController.js` (create cohort + link learners + `COHORT_<id>` QR token, get detail w/ roster, list per course) + `routes/cohorts.js`. Seeder adds `course_als_2026_01`. Broadcasts `cohort.created`.
- Frontend `/cohorts` (course dropdown, create with learner multiselect, list) + `/cohorts/[id]` (QR rendered client-side via `qrcode` lib to data-URL `<img>`, roster, Print poster via `window.print()`).
- Tests `cohorts.test.js` (5).

**VERIFIED (Week 5-6):** Browser — Students list showed 6→7 after manual import (Grace Hopper landed via backend→DB→refresh); created cohort "Demo Batch A" with 2 learners; cohort detail rendered a real QR data-image (token `COHORT_cohort_...`) + 2-person roster + print button. Backend 26/26.

**Weeks 7-10 (sessions + scoring):**
- Backend `sessionsController.js`: createSession (auto-rosters participants from cohort), listCohortSessions, getSession (+roster), checkin (roster frozen once started → 409), assignRole, start, end, flight-recorder ingest + per-participant query. Broadcasts session/participant events.
- Backend `rubricsController.js`: getRubric, **scoringContext** (resolves rubric by scenario+role, flattens flight-recorder params into an `evidence` map), submitScore (computes total, `pending_approval`), listSessionScores. Routes `sessions.js` + `rubrics.js`.
- Frontend: `/sessions` (cohort picker, create, list), `/sessions/[id]` (roster: check-in, role select, start/end, "+ evidence" demo button since no real simulator, Score link), `/scoring/[sessionId]/[participantId]` (criteria with point inputs, **flight-recorder evidence pre-filled per criterion**, live total, notes, save).
- Sidebar Sessions now active. Tests `sessions.test.js` (7, full lifecycle→scoring).

**VERIFIED (Week 7-10):** Browser full flow — created session for Demo Batch A → checked in Grace Hopper → role team_lead → added flight-recorder evidence → scoring page showed evidence pre-filled (`timeToFirstCompression=11`, `compressionDepthMM=52`), live total computed 24 → saved → persisted as `Grace Hopper | team_lead | 24 | pending_approval`. Backend 33/33.

**Gotcha logged:** added a route (`GET /cohorts/:id/sessions`) after a backend restart → 404 until next restart. Always restart the backend (`node src/server.js`) after adding/removing routes; nodemon (`npm run dev`) would auto-reload.

**Harness note:** `preview_screenshot` hangs on ALL authed pages (AppShell → Header → SyncBadge → useSync → sql.js init). Verify via `preview_snapshot` / `preview_eval` DOM checks instead.

**Week 11 (approval workflow):**
- Migration `003_approvals.sql` — dispute fields on `rubric_scores` + immutable `score_audit` table.
- Backend `rubricsController.js`: state machine `approve/release/dispute/reopen` (`makeTransition` factory, 409 on invalid move, dispute requires a reason), org-scoped, every transition + submit writes a `score_audit` row. `getScoreDetail` returns the full audit trail. Routes guarded `requireRole('educator','admin')` (dispute open). Tests `approval.test.js` (6).
- Frontend `components/scoring/ScoresPanel.jsx` on `/sessions/[id]`: per-score state badges + contextual action buttons + expandable audit timeline.
- **VERIFIED:** live approve→release on Grace's score; audit `approved>released`; UI badges + timeline render.

**Week 12 (learner reports + PDF):**
- Backend `reportsController.js` — `GET /learners/:id/report` aggregates released scores (criterion breakdown, %, average). Routes `reports.js`. Tests `reports.test.js` (2).
- Frontend `/reports` (candidate picker, per-scenario cards, percent bars) + `utils/reportPdf.js` (jsPDF candidate report, code-split). Reports nav active.
- **VERIFIED:** Grace report 24/25 = 96%; PDF generates with no error.

**Week 13 (exports + audit):**
- Backend `exportsController.js` — `scores.csv` + `flight-recorder.csv` (org-scoped, records an `exports` job row), `exports` history, cohort `audit`. Tests `exports.test.js` (3).
- Frontend `components/exports/ExportsPanel.jsx` on cohort detail — download buttons + export history + recent audit. `api.js` `apiDownload()` blob helper.
- **VERIFIED:** CSV with Grace's released row, export job recorded (269 B), audit shows approved+released.

**Week 14 (conflict UI + QR scan):**
- Backend `syncController.js` — events accept `resolution:'override'` to force a finalized score over the server version; the override is written to `score_audit`. Test in `sync.test.js`.
- Frontend: dashboard conflict resolver (keep-server / use-mine) via `syncStore.resolve` + `sync.js resolveConflict` + `database.getEvent`. `components/shared/QrScanner.jsx` (html5-qrcode, dynamic import, manual-entry fallback) on `/sessions` — scans `SESSION_`/`COHORT_` codes to jump to the page. Fixed missing `useEffect` import on dashboard.
- **VERIFIED:** conflict→override applied (total 85→42 + override audit); QR manual entry `COHORT_…` navigated to the cohort.

**Week 15 (hardening + tests):**
- `utils/cryptography.js` — passphrase now derived from a per-device random secret + signed-in user identity (no hardcoded constant). `sessionPassphrase()` exported; defaults encrypt/decrypt.
- Tests: backend sync override (45 total); frontend `parseCsv` + `ScoresPanel` (7 total).

**Week 16 (go-live):**
- `backend/Dockerfile` (migrations run on start), `frontend/Dockerfile` (multi-stage, `NEXT_PUBLIC_API_URL` build arg), root `docker-compose.yml` (db+backend+frontend, healthcheck), `.env.example`, `.dockerignore`s.
- README ops runbook (config table, migrations, backups, security notes).
- **VERIFIED:** `next build` green (11 routes; jsPDF/html5-qrcode code-split). Both Docker images build (bcrypt compiles). Production backend image boots → runs migrations → connects DB → `/api/health` ok (`env: production`) → login works.

## VERIFIED
- GET /api/health → 200
- DB login good creds → JWT + user pulled from Postgres (Sarah Johnson / educator,observer).
- Bad password → 401 · unknown user → 401 · no-token protected route → 401.
- Browser (Day 1): login form → dashboard.
- DB: 15 tables, seeded rows confirmed (1 user, 2 learners, 2 sites, 1 rubric, 3 criteria).

## PENDING (post-MVP — all 16 planned weeks done)
- **E2E tests (Playwright)** — not started; unit/integration only (backend 45, frontend 7).
- **Real QR camera scan** — component uses html5-qrcode + manual fallback; camera path unverifiable in the headless harness (verified via fallback). Test on a real device.
- **WebSocket polling fallback** — reconnect works; a long-poll fallback for hostile networks is not implemented.
- **Crypto deployment hardening** — key is per-device/per-user but the device secret lives in localStorage; back it with a server-issued/hardware key for higher assurance. `cryptography.js` is built but not yet wired into `database.js` storage.
- **Frontend coverage** — add page-level tests for students/cohorts/sessions/reports (AppShell pulls in sql.js, so these need a heavier harness/mocks).
- **De-branding (optional):** code still contains "PARASOL EMT" (login title, seed data, db name `parasol_ems`, container `parasol-postgres`). Private repo mitigates; full scrub = rename db/container + UI/seed strings.

## BUGS
- None known. (Fixed this build: missing `useEffect` import on the dashboard.)

## Deployment
- `cp .env.example .env` (change every secret) → `docker compose up --build` → `docker compose exec backend npm run seed`.
- Backend image runs migrations on start; Postgres state lives in the `pgdata` volume — back it up before upgrades.
- See README "Operations runbook" for full detail.

## Notes
- Backend path: custom Node + PostgreSQL (not Firebase).
- **Docker gotcha (fixed):** Docker Desktop crashed on boot with corrupt Unix-socket files (`dockerInference`, `engine.sock`) — "file cannot be accessed by the system." Windows `del`/Remove-Item CAN'T delete them; `wsl -e rm -f /mnt/c/...` does. If Docker won't start: quit Docker, `wsl --shutdown`, `wsl -e rm -f` the stale sockets under `AppData\Local\Docker\run` and `AppData\Local\docker-secrets-engine`, relaunch.
