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

See `HANDOFF.md` for current build status.
