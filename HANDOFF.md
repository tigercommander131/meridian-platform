# CTOP — Handoff

**Last updated:** 2026-06-21 — **M2 (People & rostering) live + airline-bold redesign v2 + Settings page.** M1 live. (Local Postgres still down → DB tests unrun locally; verified via build + live screenshots.)

## Resuscitation rules + 500-course import (NEW)
- **Engine rewritten to the Fictional Resuscitation Course Management Rules** (`services/staffingEngine.js`): group = max 6 / min 4; capacity = groups×6; **ALS1** = 1–3 groups, 1 instructor/group, no CD/MD, any day; **ALS2** = 2–3 groups only, 1 instr/group + **Course Director (accredited)** + **Medical Director (doctor)**, weekend-only. `evaluate()` = planned-groups + count/flag staffing (returns groups, capacity, required, assigned, viable, staffed, canRun, status, explanation). `computeStaffing()` kept as the named-crew wrapper (derives groups, CD may cover MD). New rule shape: `groupSize, minStudentsPerGroup, instructorsPerGroup, minGroups, courseDirectorRequired, medicalDirectorRequired, courseDirectorCanBeMedicalDirector` (old `medicalLead/extraDoctor/countICs` fields retired; ctop-seed + rule editor updated). **NOTE:** this changes existing demo compliance (now 1 instr/group + MD).
- **500-course dataset imported** from `resuscitation_course_operations_500_courses.xlsx` → `seeders/resus-courses.json` (committed). Engine **Can-Run matches the sheet on all 500** (jest parity test, 14 engine tests total).
- Migration `010_resus_import.sql`: courses + `groups, duration_days, external_ref, imported, instructors_assigned, course_director_assigned, medical_director_assigned, cd_qualified, md_doctor`. `complianceFor` branches: imported → `evaluate()` with stored counts; native → named-crew. Course DTO + course-detail show a read-only imported staffing/enrolment summary (no manifest/standby for imported).
- **Importer:** `npm run seed:resus` → new org **`resus`** (login `admin@resus.example` / `password`), Resuscitation Council + ALS1/ALS2 rule sets, 10 centres as regions, 500 courses (bulk via pg-format), status from the engine. Idempotent.

## Redesign v2 — "airline / departures board" (NEW)
- Theme system: `globals.css` adds a dark **board** surface + status **lamps** + accent driven by a runtime CSS var (`--accent`), density (`[data-density]`) and reduced-motion. `utils/appearance.js` applies org accent + local density/motion to `<html>`; `applyAccent` derives hover/soft/ink via `color-mix`.
- New primitives `components/ui/aviation.jsx`: `Lamp`, `FlightStatus` (lamp + mono label), `Stamp` (CLEARED/HOLD), `Station` (IATA-style code), `FlightPath`. `data.js` adds `FLIGHT_STATUS` map (ready→CLEARED, compliance_risk→AT RISK, delivered→DEPARTED…), `flight()`, `station()`.
- **Dashboard = live departures board** (dark panel, mono flight rows: code · course · route · date · crew x/y · status lamp; live clock; ops lamp tiles). Dashboard API now returns `region`, `courseTypeCode`, `crew{assigned,required,groups}`.
- **Course = flight gate**: dark flight banner + **Clearance** card (HOLD/CLEARED stamp + meter) + **Crew manifest** + **Standby list** (the candidate escalation).
- **Invite = boarding pass** (perforated ticket, station route, accept/decline → CLEARED/DECLINED stamp).
- Instructors/courses/students/users/auth: accent-var-driven (core chrome no longer hardcodes teal; semantic status greens kept). Kit Button/Badge/Avatar/Tabs/logo/sidebar use `var(--accent)`.

## Settings + org profile (NEW)
- Migration `009_org_profile.sql`: `organisations` + `accent`, `regions TEXT[]`, `tagline`, `updated_at`.
- `controllers/organisationsController.js` + routes `GET/PUT /api/organisations/:orgId/profile` (PUT admin-gated; validates accent hex). `orgApi` in `data.js`.
- **Settings page** (`app/settings`, in sidebar): org profile (name, tagline, regions chips, **accent swatch picker** — no purple, live preview) + **Appearance** (density comfortable/compact, motion full/reduced, saved to localStorage). AppShell loads org → applies accent + shows org name in header.
- Example data: **seeder now populates BOTH `parasol` and the default `ato` org** (8 crew across regions incl. 1 candidate + 1 expired credential, availability, IC1 record, 4 courses spanning ready / at-risk / delivered). Re-run `npm run seed:ctop` on Railway.

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

## Milestone 2 — People & rostering (NEW, code-complete)
- **Migration `008_m2_people_rostering.sql`:** `courses.region`; `course_staffing` + `invite_token` (unique), `message`, `decline_reason`, `escalation_tier`, `reminder_count`, `last_reminder_at`; `instructor_availability.note`; indexes. Runs on boot.
- **Email connector** `services/emailService.js`: Resend via global `fetch` (Node 20). Configured by `EMAIL_API_KEY` + `EMAIL_FROM`; **falls back to console logging** when unset (workflow still works, status tracked). Templates: invitation + reminder. `APP_URL` (or first `CORS_ORIGIN`) builds the public accept/decline link.
- **Availability:** `GET/POST /api/instructors/:id/availability`, `DELETE .../availability/:date` (upsert per date; available|tentative|unavailable).
- **Candidate escalation:** `GET /api/courses/:id/staffing/candidates?role=` — eligible (credential role + course type, unexpired) × available on course date × not already assigned, ranked **local→regional→emergency** (region match vs course.region; candidates=emergency), unavailable hidden.
- **Invitations:** `POST /api/courses/:id/staffing/:staffingId/invite` (send/resend, tokenised). **Public (no auth):** `GET /api/invitations/:token`, `POST /api/invitations/:token/respond {response:accept|decline,reason}`. **Declined assignments don't count toward compliance** (engine query excludes them) → course status recomputes on response.
- **IC pathway:** `POST /api/instructors/:id/ic-progress` (stage IC1/IC2, outcome, mentor, notes). **IC2 + passed → promotes candidate to active.** `getInstructor` now returns credentials (with `expired`), availability, icProgress.
- **Instructor update:** `PUT /api/instructors/:id`.
- **Public invite page:** frontend `app/invite/[token]` (no auth, branded accept/decline). `?r=decline` deep-links the decline form.

## UI redesign (major)
- Design tokens in `globals.css` (CSS vars: surfaces/ink/line/accent/shadows, Geist font, `.ctl`/`.lbl`, dotted `.bg-grid`); `tailwind.config.js` extended (fontFamily, shadows, fade-in).
- **Primitive kit** `components/ui/kit.jsx`: Button, Card+CardHeader, Badge, Input/Select/Textarea/Field/Label, Tabs, Skeleton, Spinner, Icon, Avatar. Plus `StatusBadge`, `ComplianceMeter`, refreshed StatCard/PageHeader/EmptyState.
- Shell (AppShell/Sidebar/Header) repainted; **every page** repainted (dashboard risk rails, courses capacity bars, instructors with Credentials/Availability/IC tabs, staffing panel with candidate tiers + invite/resend/copy-link, accreditation, students, users, auth).
- Verified live: built (13 routes), and dashboard + course detail screenshotted against the **live M1 API** with real data, no console errors. (Full M2 UI needs the M2 backend deployed.)

## New env (Railway backend, optional)
`EMAIL_API_KEY` + `EMAIL_FROM` (Resend) to send real invites; `APP_URL` = frontend URL for invite links. All optional — without them invites log to console.

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
- `cd backend && npm test` — staffingEngine (9) + **emailService templates (3, pure, run locally ✓)** + ctop API integration (M1 + **new M2 block:** candidate escalation/hide-unavailable, invite token + public decline drops count, IC2→active, invalid response 400) + auth + learners. **Integration needs Postgres.** Local Docker (`parasol-postgres`) still DOWN 2026-06-21 → M2 integration **unrun locally**; will run in CI / against Railway. Pure tests pass (12). All changed files `node --check` clean; backend app graph loads.
- `cd frontend && npm run build` — compiles (**13 routes**, incl. `/invite/[token]`).

## Seed / first login
- **Run on Railway Console:** `npm run seed:ctop` → org `parasol`, login `admin@parasol.example` / `password`, ARC+RA, ALS2 rule set, 6 instructors, 1 unstaffed demo course (12 students).
- Existing staff accounts (e.g. `admin@ato.example` / `password`) still work and can use CTOP immediately.

## Demo flow
Accreditation & Rules (add ARC + ALS2 + rules) → Instructors (add crew) → Courses
(create, set students, assign staff → compliance flips Compliance Risk → Ready) →
Dashboard (everything needing attention).

## Next (per plan `~/.claude/plans/zazzy-baking-flame.md`)
- **Deploy M2:** push `main` → Railway runs migration 008 + new code. Then `npm run seed:ctop` (now seeds availability + 1 IC1 candidate). Optionally set `EMAIL_API_KEY`/`EMAIL_FROM`/`APP_URL` for real email. Verify: candidates list, send invite, open `/invite/:token`, decline → status flips.
- **M2 polish (deferred):** reminder cron/escalation automation; multi-day course availability (currently checks `start_date` only); instructor login for self-serve availability.
- **M3:** enrolments/waitlist/viability/logistics. **M4:** dashboards + finance prep.
