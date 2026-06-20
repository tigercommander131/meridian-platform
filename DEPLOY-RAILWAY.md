# Deploy to Railway

This gets PARASOL EMS a public URL. The repo is already deploy-ready: each
service has a `Dockerfile` + `railway.json`, the backend runs migrations on
start, and CORS / the API URL are env-driven.

> You'll need a Railway account (railway.app) and to add a payment method —
> Railway's free trial is limited and the Postgres add-on needs a plan. I can't
> create the account or enter billing for you; do that part, then follow these
> steps (≈10 min).

## 1. Push the repo (already done)
Code lives at `tigercommander131/meridian-platform`. Railway deploys from GitHub.

## 2. Create the project + database
1. Railway → **New Project** → **Deploy from GitHub repo** → pick `meridian-platform`.
2. In the project, **New** → **Database** → **PostgreSQL**. This creates a `Postgres`
   service exposing a `DATABASE_URL`.

## 3. Backend service
1. **New** → **GitHub Repo** → same repo. Open the service → **Settings**:
   - **Root Directory:** `backend`
   - Builder auto-detects the Dockerfile (via `railway.json`).
2. **Variables** (Settings → Variables):
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
   | `JWT_SECRET` | a strong secret — `openssl rand -hex 32` |
   | `JWT_REFRESH_SECRET` | another strong secret |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | *(fill in step 5 — the frontend URL)* |
   Railway injects `PORT` automatically; the app already reads it.
3. **Settings → Networking → Generate Domain.** Copy the URL, e.g.
   `https://backend-production-xxxx.up.railway.app`. Migrations run on first boot.

## 4. Frontend service
1. **New** → **GitHub Repo** → same repo. Service → **Settings**:
   - **Root Directory:** `frontend`
2. **Variables** — add a **build** variable (baked into the Next.js bundle):
   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | the backend URL from step 3 (no trailing slash) |
3. **Generate Domain.** This is your app URL.

## 5. Close the CORS loop
Set the backend's `CORS_ORIGIN` to the frontend domain from step 4
(e.g. `https://frontend-production-yyyy.up.railway.app`) and let the backend
redeploy.

## 6. First account
Open the frontend URL → **Create an account** (`/signup`). That creates your org
+ admin user — no seeding needed.

*(Optional demo data:* backend service → **Settings → Deploy** → run `npm run seed`
once in a shell to load the sample org/learners/rubric.)*

## Notes & gotchas
- **`NEXT_PUBLIC_API_URL` is build-time.** If the backend URL ever changes,
  redeploy the frontend so the new value is baked in.
- **WebSockets** (`/ws`) work over Railway's HTTPS domains automatically — the
  client derives `wss://` from the API URL.
- **Migrations** run on every backend start and are idempotent (tracked in
  `_migrations`); safe to redeploy.
- **Backups:** snapshot the Postgres volume from the Railway dashboard before
  upgrades.
- Costs scale with usage; the two small services + Postgres are inexpensive but
  not free beyond the trial.

## Alternative: one-box VPS
Prefer a fixed ~$5/mo cost? On any Linux box with Docker:
`git clone`, `cp .env.example .env` (set secrets + `NEXT_PUBLIC_API_URL` to the
box's domain), `docker compose up -d --build`, then put Caddy/nginx in front for
HTTPS. See `README.md`.
