# CTOP — Handoff

**Last updated:** 2026-06-21 — pivoted from the assessment app to **CTOP (Clinical Training Operations Platform)**. Milestone 1 (Compliance Core) live.

## What CTOP is
Operations platform for running accredited clinical courses. Core question: *"can this
course run — compliantly, with the right people?"* Airline model: courses = flights,
instructors = crew, accreditation rules = the regulator's crew minimums, students =
passengers, waitlist = overbooking, viability = under-booking.

## Live (Railway, auto-deploys from `main`)
- App: https://captivating-heart-production-7552.up.railway.app
- API: https://meridian-platform-production-e2a0.up.railway.app  (health `/api/health`)
- Repo `tigercommander131/meridian-platform`. Migrations run on backend boot. Postgres private network.

## Stack / structure
- Backend: Express (ESM) + PostgreSQL. `backend/src/`: controllers (auth, accreditation, instructors, courses, staffing, learners, users), routes (auth, organisations, ctop), `services/staffingEngine.js` (the heart), migrations 001-007, seeders/ctop-seed.js.
- Frontend: Next.js 14. `frontend/src/app/`: dashboard, courses, courses/[id], instructors, accreditation, students, users, login, signup.

## Data model (CTOP — migration 007)
accreditation_organisations · course_types · rule_sets (versioned, JSONB) · courses (extended: accreditation_org_id, course_type_id, capacity, confirmed_students, status lifecycle) · instructors · instructor_credentials · instructor_availability · course_staffing · ic_progress · enrolments · audit_events. (Assessment tables dropped in 006.)

## Staffing engine (`services/staffingEngine.js`)
Pure function `computeStaffing(confirmedStudents, ruleSet, assigned[])` →
groups = ceil(students/groupSize); requiredInstr = groups×instructorsPerGroup; CD/ML
required; extra doctor when groups > threshold; CD may cover ML; ICs excluded unless
ruled in. Returns {groups, required, assigned, missing, status, explanation}.
status ∈ planning|staffing_risk|compliance_risk|ready. 9 unit tests.

## Key routes
- Auth `/api/auth/{login,register,refresh,...}` (staff only).
- Accreditation `GET/POST /api/organisations/:org/{accreditation,course-types}`; rule sets `GET/POST /api/course-types/:id/rule-sets`.
- Instructors `GET/POST /api/organisations/:org/instructors`; `GET /api/instructors/:id`, `POST /api/instructors/:id/credentials`.
- Courses `GET/POST/PUT /api/organisations/:org/courses[/:id]`.
- Staffing `GET/POST /api/courses/:id/staffing`, `DELETE .../:staffingId` — returns live compliance.
- Dashboard `GET /api/organisations/:org/dashboard` — courses ranked by risk.

## Tests
- `cd backend && npm test` — staffingEngine (9) + ctop API integration + auth + learners. **Needs Postgres.** Local Docker (`parasol-postgres`) was DOWN on the dev machine 2026-06-21 (daemon wouldn't start; see `windows_docker_socket_fix` memory). Verified instead via a live end-to-end script against Railway Postgres (accreditation→rules→instructors→course→staffing→`ready`, all passed).
- `cd frontend && npm run build` — compiles (11 routes).

## Seed / first login
- **Run on Railway Console:** `npm run seed:ctop` → org `parasol`, login `admin@parasol.example` / `password`, ARC+RA, ALS2 rule set, 6 instructors, 1 unstaffed demo course (12 students).
- Existing staff accounts (e.g. `admin@ato.example` / `password`) still work and can use CTOP immediately.

## Demo flow
Accreditation & Rules (add ARC + ALS2 + rules) → Instructors (add crew) → Courses
(create, set students, assign staff → compliance flips Compliance Risk → Ready) →
Dashboard (everything needing attention).

## Next (per plan `~/.claude/plans/zazzy-baking-flame.md`)
M2: instructor availability + invitation workflow with **real email** (Resend/SendGrid) + IC1/IC2 pathway. M3: enrolments/waitlist/viability/logistics. M4: dashboards + finance prep.
