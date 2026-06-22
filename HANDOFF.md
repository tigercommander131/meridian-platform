# CTOP — Handoff

**Last updated:** 2026-06-21 — **LMS people (instructors+allocations+students) + financials in AI report + report persistence + clickable solutions.** AI actions engine (draft→apply) still PENDING. Adaptable columns + 2000-course LMS org. New `lms` org from the LMS xlsx (full source row per course in `attributes` JSONB); board + course cards have a **column picker** to add/remove any variable. Course filters (search · type · location · status · time-window). AI report card reworked. M2 + airline-bold v2 + Settings live. M1 live. (Local Postgres still down → verified via prod build + engine tests; DB seed runs on Railway.)

## LMS people + financials + report persistence (NEW, 2026-06-21)
- **People seeded** (re-run `npm run seed:lms`): 250 named **instructors** (+ `instructor_credentials` capturing eligible roles: instructor / course_director if CD-qualified / medical_lead+doctor if MD-eligible or profession Doctor), 3468 **allocations** → `course_staffing` (role + invitation_status from the sheet's Confirmation Status), and ~enrolled-count **students synthesized** into `learners` + linked via new `course_learners` table (migration `012_course_learners.sql`). Waitlist Summary fields merged into each course's `attributes` (Waitlist Largest Employer / Action / Travel Flexibility). New seed data files: `lms-instructors.json`, `lms-allocations.json` (committed). NOTE: the xlsx has **no named students** — they are fabricated from counts (names from a small pool, emails `stu{n}@lms.example`).
- **Financials surfaced:** reportController passes Expected Revenue / Revenue at Risk / Refund Liability / Estimated Net Margin (from `attributes`) into `opsAdvisor.analyze`, which now sums them into `stats`. AI briefing prompt leads with total financial exposure + weights priorities by $; deterministic fallback adds a finance line. OpsReport shows a second KPI row (Revenue at risk / Refund liability / Expected revenue / Net margin) when present.
- **Report persists across navigation:** `stores/reportStore.js` (module state + sessionStorage). OpsReport hydrates from it on mount and writes on run — dashboard → courses → back no longer loses (or re-bills) the report.
- **Suggested solutions are clickable:** each card is now a `Link` to `/courses/:courseId` (chevron affordance).
- **PENDING (next):** the AI **actions engine** — draft→apply-on-confirm ("contact people" = create invitations to the seeded instructor pool; assign CD/MD; move overflow to waitlist; open extra course), surfaced as a "Let AI fix this course" panel on the course detail page and from the report cards. User chose **draft, apply on confirm**. Seeded people above are its pool.

## Adaptable columns + LMS 2000-course org (NEW)
- **Flexible schema:** migration `011_course_attributes.sql` adds `courses.attributes JSONB`. Imported courses store their **entire source row** there (e.g. all 50 LMS columns: revenue, risk score/rating, venue/equipment/double-booking conflicts, payments, prerequisites, day-of-week…). `coursesController.toDTO` + `opsDashboard` now return `attributes`.
- **LMS dataset:** `seeders/lms-courses.json` (2000 courses, committed, ~3.3MB) from `resuscitation_training_LMS_2000_course_authentic_chaos.xlsx`. Seeder `seeders/lms-seed.js` → **`npm run seed:lms`** → org **`lms`** ("National Resus LMS", login `admin@lms.example` / `password`), ALS1/ALS2 rule sets, 10 centres as regions. Idempotent (bulk via pg-format). Status comes from the sheet's **Operational Status** (mapped in `complianceFor`'s imported branch — the sheet factors in conflicts the engine doesn't model; `SHEET_STATUS` map).
- **Adaptable UI:** `services/data.js` adds `inferFields` (union of attribute keys → `{key,label,type}` with type inference: bool/date/number/currency/text), `formatAttr`, `attrTone` (risk/conflict colouring), `DEFAULT_BOARD_COLS`, `loadCols/saveCols` (localStorage per org). New `components/ui/ColumnPicker.jsx` (light + board popover, searchable, max-N) and `components/ops/AdaptableCourseTable.jsx` (dark dynamic table, horizontal scroll, sticky Course col, clickable rows).
  - **Dashboard board:** when courses carry attributes → renders the adaptable table + a COLUMNS picker (default `DEFAULT_BOARD_COLS`); otherwise the classic fixed board (resus/parasol unchanged).
  - **Courses page:** Columns picker adds chosen attribute chips to each card.
- **Perf:** `resolveCurrentRules` now has a 30s in-process cache (`clearRulesCache` on rule-set writes) so a 500/2000-course dashboard doesn't fire one rules query per course.

## Course filters (NEW)
- Shared `components/ui/CourseFilters.jsx` (`variant` light | board) + helpers in `services/data.js` (`COURSE_WINDOWS`, `emptyCourseFilter`, `courseFilterActive`, `distinct`, `filterCourses(courses, f, acc)`). Filters: **search** (name/location/type/ref), **type**, **location** (region), **status**, **time-window** (any · next 7d/2w/4w/6w). `acc` = field accessors so one filter serves both surfaces (courses page uses `courseTypeName`; board uses `courseTypeCode`).
- Wired into **Courses page** (`app/courses/page.js`, light bar + "no match" state) and the **dashboard board** (`app/dashboard/page.js`, dark bar in board header; filter applies before sort+limit; resets show-more on change; KPI tiles + the "500" header count stay portfolio-wide, filter bar shows count/total). Verified via prod build (compiles, types OK).

## AI operations report + board UX (NEW)
- **AI report:** deterministic advisor `services/opsAdvisor.js` scans courses → prioritised findings + concrete fixes (under-minimum → consolidate into a same-type/region sibling course or drop a group; excess waitlist → add a group or schedule another course; over-capacity; instructor shortage; missing CD/MD). `services/aiReport.js` narrates them via **Claude** (`claude-opus-4-8`, Messages API over global `fetch` — no SDK dep, mirrors emailService) when `CLAUDE_API_KEY` (or `ANTHROPIC_API_KEY`) is set; **deterministic fallback** otherwise (refusal/error-safe). `GET /api/organisations/:org/ops-report` (reportController). Dashboard card `components/ops/OpsReport.jsx` (manual "Run report" — it's billed/latency). Verified: analyzer + fallback produce the requested suggestions on sample data.
- **Report card UX (2026-06-21):** the **40** Claude reads = briefing input only; the card lists **all** deterministic findings (e.g. 307). New layout: **Suggested solutions first** (renamed from "Suggested fixes"), each with a **type icon** (course_director/medical_director/instructors/underfilled/waitlist/overcapacity); **Operations briefing now collapsed by default** below the solutions; **time-window filter** chips (1/2/4/6 weeks · All) filter findings client-side by course `start_date` (undated → "All" only); **stat tiles + count follow the filter**. Backend: `opsAdvisor` attaches `date` to each finding (reportController passes `startDate`); briefing prompt tightened (≤~200 words, no COMPLIANCE/STAFFING/VIABILITY heading prefixes; renderer also strips them) and `max_tokens` 1500→900.
- **Departures board fixes:** renamed panel **COURSES**; columns now **Course · Location · Date · Instructors · Students · Waitlist · Status**; ALS2 dates render as ranges ("27 – 28 Jun"); **show more/all/less** (default 12 of N, sorted by risk). Dashboard API returns endDate/duration/externalRef/waitlist/groups + instructor counts.
- **Bug fixed:** dark-board text was rendering black — Tailwind can't alpha-composite a hex CSS var (`rgb(#e8edf2 / .7)` is invalid → falls back to black). Replaced all `text-board-ink/NN` with solid `text-board-ink` / `text-[var(--board-ink-2)]`.
- New env (optional): `CLAUDE_API_KEY` on the API service.

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
