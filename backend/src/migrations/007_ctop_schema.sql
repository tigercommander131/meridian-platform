-- CTOP operational core.

-- Accreditation organisations (ARC, RA) per tenant.
CREATE TABLE accreditation_organisations (
  id              TEXT PRIMARY KEY DEFAULT 'accred_' || substr(md5(random()::text), 1, 12),
  organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  code            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_accred_org ON accreditation_organisations(organisation_id);

-- Course types per accreditation org (e.g. ALS2).
CREATE TABLE course_types (
  id                   TEXT PRIMARY KEY DEFAULT 'ctype_' || substr(md5(random()::text), 1, 12),
  organisation_id      TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  accreditation_org_id TEXT NOT NULL REFERENCES accreditation_organisations(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  code                 TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ctype_org ON course_types(organisation_id);

-- Versioned, effective-dated rule sets per course type.
CREATE TABLE rule_sets (
  id             TEXT PRIMARY KEY DEFAULT 'rule_' || substr(md5(random()::text), 1, 12),
  course_type_id TEXT NOT NULL REFERENCES course_types(id) ON DELETE CASCADE,
  version        INTEGER NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rules          JSONB NOT NULL DEFAULT '{}',
  created_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ruleset_ctype ON rule_sets(course_type_id);

-- Extend courses for CTOP operations. courses.status now uses the CTOP lifecycle:
-- draft | planning | staffing_risk | compliance_risk | viability_risk | ready | delivered | closed | cancelled
ALTER TABLE courses ADD COLUMN IF NOT EXISTS accreditation_org_id TEXT REFERENCES accreditation_organisations(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_type_id      TEXT REFERENCES course_types(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS venue_site_id       TEXT REFERENCES sites(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS capacity            INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS confirmed_students  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS waitlist_count      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS catering            JSONB;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS equipment           JSONB;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS venue_notes         TEXT;

-- Instructors (records; not necessarily app logins in the MVP).
CREATE TABLE instructors (
  id               TEXT PRIMARY KEY DEFAULT 'instr_' || substr(md5(random()::text), 1, 12),
  organisation_id  TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  region           TEXT,
  travel_radius_km INTEGER,
  employment_type  TEXT,  -- employee | casual | sole_trader | company | medical_consultant
  status           TEXT NOT NULL DEFAULT 'active',  -- active | candidate | inactive
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_instructors_org ON instructors(organisation_id);

-- Instructor credentials (eligibility + expiry).
CREATE TABLE instructor_credentials (
  id                       TEXT PRIMARY KEY DEFAULT 'cred_' || substr(md5(random()::text), 1, 12),
  instructor_id            TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  accreditation_org_id     TEXT REFERENCES accreditation_organisations(id) ON DELETE SET NULL,
  eligible_course_type_ids TEXT[] NOT NULL DEFAULT '{}',
  eligible_roles           TEXT[] NOT NULL DEFAULT '{}',  -- instructor|course_director|medical_lead|doctor|assessor
  expires_at               TIMESTAMPTZ,
  evidence_note            TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cred_instructor ON instructor_credentials(instructor_id);

-- Instructor availability (per date).
CREATE TABLE instructor_availability (
  id            TEXT PRIMARY KEY DEFAULT 'avail_' || substr(md5(random()::text), 1, 12),
  instructor_id TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  available_on  DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'available',
  UNIQUE (instructor_id, available_on)
);

-- Course staffing assignments.
CREATE TABLE course_staffing (
  id                TEXT PRIMARY KEY DEFAULT 'staff_' || substr(md5(random()::text), 1, 12),
  course_id         TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  instructor_id     TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  role              TEXT NOT NULL,  -- instructor|course_director|medical_lead|doctor|assessor|instructor_candidate
  invitation_status TEXT NOT NULL DEFAULT 'invited', -- invited|accepted|declined|no_response|confirmed
  invited_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at      TIMESTAMPTZ,
  UNIQUE (course_id, instructor_id, role)
);
CREATE INDEX idx_staffing_course ON course_staffing(course_id);

-- Instructor candidate progression (IC1 / IC2).
CREATE TABLE ic_progress (
  id            TEXT PRIMARY KEY DEFAULT 'ic_' || substr(md5(random()::text), 1, 12),
  instructor_id TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  stage         TEXT NOT NULL,  -- IC1 | IC2
  course_id     TEXT REFERENCES courses(id) ON DELETE SET NULL,
  mentor_id     TEXT REFERENCES instructors(id) ON DELETE SET NULL,
  outcome       TEXT,           -- passed | remediation | not_suitable | deferred
  signed_off_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  signed_off_at TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Student enrolments (a learner enrolled in a course).
CREATE TABLE enrolments (
  id            TEXT PRIMARY KEY DEFAULT 'enrol_' || substr(md5(random()::text), 1, 12),
  course_id     TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  learner_id    TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'enrolled', -- enrolled|waitlisted|cancelled|attended|dna
  dietary       TEXT,
  accessibility TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, learner_id)
);
CREATE INDEX idx_enrolments_course ON enrolments(course_id);

-- Generalised audit trail (replaces score_audit).
CREATE TABLE audit_events (
  id              TEXT PRIMARY KEY DEFAULT 'audit_' || substr(md5(random()::text), 1, 12),
  organisation_id TEXT REFERENCES organisations(id) ON DELETE CASCADE,
  actor_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  target_type     TEXT,
  target_id       TEXT,
  from_state      TEXT,
  to_state        TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_org ON audit_events(organisation_id);
