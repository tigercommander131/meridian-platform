# Meridian Platform

Internal web platform — training session management, assessment scoring, and reporting. Offline-capable.

## Structure

```
backend/    Express + PostgreSQL API (port 3001)
frontend/   Next.js 14 + Tailwind web app (port 3000)
```

## Quick start

**Database** (Docker):
```
docker start parasol-postgres  # or see HANDOFF.md for first-time create
```

**Backend:**
```
cd backend
npm install
cp .env.example .env.local
npm run migrate:up
npm run seed
npm run dev
```

**Frontend:**
```
cd frontend
npm install
npm run dev
```

App: http://localhost:3000 · API: http://localhost:3001

Dev login: `instructor@parasol.edu.au` / `password`

## Run the whole stack with Docker

One command brings up Postgres, the API, and the web app (migrations run on
backend start):

```
cp .env.example .env          # then change every secret
docker compose up --build
docker compose exec backend npm run seed   # one-time demo data
```

App: http://localhost:3000 · API: http://localhost:3001

## Configuration

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | backend | Postgres connection string |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | backend | **Generate fresh** (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_API_URL` | frontend (build time) | Public URL the browser uses for the API |
| `POSTGRES_USER/PASSWORD/DB` | compose | Database credentials |

## Operations runbook

- **Migrations** — `cd backend && npm run migrate:up` (status: `migrate:status`).
  Forward-only; transactional; tracked in `_migrations`. In Docker they run
  automatically when the backend container starts.
- **Seed demo data** — `npm run seed` (org, sites, instructor, rubric, learners).
- **Tests** — backend `cd backend && npm test` (45, needs Postgres); frontend
  `cd frontend && npm test` (7).
- **Production build** — frontend `npm run build` (outputs optimized bundle;
  `jsPDF`/`html5-qrcode` are code-split and load only on the pages that use them).
- **Health check** — `GET /api/health` → `{ status: "ok" }`.
- **Backups** — the Postgres volume `pgdata` holds all state; snapshot it (or
  `pg_dump`) before upgrades.
- **Real-time** — WebSocket on the API port at `/ws`; clients auto-reconnect
  with exponential backoff, so a backend restart is non-fatal to open tabs.

## Security notes

- Never commit `.env*` (only `*.example` templates are tracked).
- Rotate `JWT_SECRET` / `JWT_REFRESH_SECRET` away from the placeholders before any
  real deployment.
- Offline data at rest is encrypted (AES-256-GCM) with a per-device, per-user
  key. For higher assurance, back the device secret with a server-issued or
  hardware-backed key at deploy time.

See `HANDOFF.md` for current build status and the week-by-week changelog.
