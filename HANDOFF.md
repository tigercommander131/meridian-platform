# PARASOL EMS — Handoff

**Last updated:** 2026-06-20 (Week 1, Day 1-3 done)

## Status: Week 1 Day 1-3 complete + verified

Scaffold + database live. Backend + frontend running, auth works end-to-end against PostgreSQL.

## Database
- PostgreSQL 14 in Docker container `parasol-postgres` (port 5432).
- Start DB: `docker start parasol-postgres` (created via `docker run`, see below).
- Migrations: `npm run migrate:up` · status: `npm run migrate:status`
- Seed: `npm run seed`
- 15 tables. Seeded: org `parasol-emt`, 2 sites, user `instructor@parasol.edu.au`, 1 rubric + 3 criteria, 2 learners.

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

## VERIFIED
- GET /api/health → 200
- DB login good creds → JWT + user pulled from Postgres (Sarah Johnson / educator,observer).
- Bad password → 401 · unknown user → 401 · no-token protected route → 401.
- Browser (Day 1): login form → dashboard.
- DB: 15 tables, seeded rows confirmed (1 user, 2 learners, 2 sites, 1 rubric, 3 criteria).

## PENDING (next)
- Wire frontend to show real data (needs cohort/learner GET endpoints — Week 5).
- No tests yet (Jest/RTL/Playwright) — Week 2.
- Frontend: Zustand store, useAuth hook, offline SQLite (sql.js) — Day 4-5 / Week 3.
- Refresh-token flow not wired into frontend yet.
- GitHub repos not created.
- WebSocket / real-time — Week 4.

## BUGS
- None known.

## Notes
- Backend path: custom Node + PostgreSQL (not Firebase).
- **Docker gotcha (fixed):** Docker Desktop crashed on boot with corrupt Unix-socket files (`dockerInference`, `engine.sock`) — "file cannot be accessed by the system." Windows `del`/Remove-Item CAN'T delete them; `wsl -e rm -f /mnt/c/...` does. If Docker won't start: quit Docker, `wsl --shutdown`, `wsl -e rm -f` the stale sockets under `AppData\Local\Docker\run` and `AppData\Local\docker-secrets-engine`, relaunch.
