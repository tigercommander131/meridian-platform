-- PARASOL EMS — initial schema
-- Core tables derived from API_SPECIFICATION.md entities.

-- Organisations
CREATE TABLE organisations (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Training sites
CREATE TABLE sites (
  id               TEXT PRIMARY KEY,
  organisation_id  TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  address          TEXT,
  coordinator      TEXT,
  phone            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users (instructors / educators / admins)
CREATE TABLE users (
  id               TEXT PRIMARY KEY DEFAULT 'user_' || substr(md5(random()::text), 1, 12),
  organisation_id  TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  roles            TEXT[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Learners (students)
CREATE TABLE learners (
  id               TEXT PRIMARY KEY DEFAULT 'learner_' || substr(md5(random()::text), 1, 12),
  organisation_id  TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  email            TEXT NOT NULL,
  external_id      TEXT,
  phone            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id, email)
);

-- Courses
CREATE TABLE courses (
  id            TEXT PRIMARY KEY DEFAULT 'course_' || substr(md5(random()::text), 1, 12),
  organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  site_id       TEXT REFERENCES sites(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  start_date    TIMESTAMPTZ,
  end_date      TIMESTAMPTZ,
  max_learners  INTEGER DEFAULT 24,
  status        TEXT NOT NULL DEFAULT 'active',  -- active | completed | archived
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cohorts (group of learners within a course)
CREATE TABLE cohorts (
  id            TEXT PRIMARY KEY DEFAULT 'cohort_' || substr(md5(random()::text), 1, 12),
  course_id     TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  qr_code       TEXT,
  start_date    TIMESTAMPTZ,
  end_date      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cohort membership (many-to-many learners <-> cohorts)
CREATE TABLE cohort_learners (
  cohort_id   TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  learner_id  TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  PRIMARY KEY (cohort_id, learner_id)
);

-- Simulation sessions
CREATE TABLE sessions (
  id               TEXT PRIMARY KEY DEFAULT 'session_' || substr(md5(random()::text), 1, 12),
  cohort_id        TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  scenario_id      TEXT NOT NULL,
  scenario_name    TEXT,
  instructor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'created',  -- created | active | completed
  scheduled_start  TIMESTAMPTZ,
  actual_start     TIMESTAMPTZ,
  actual_end       TIMESTAMPTZ,
  max_participants INTEGER DEFAULT 24,
  qr_code          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Session participants
CREATE TABLE session_participants (
  id              TEXT PRIMARY KEY DEFAULT 'participant_' || substr(md5(random()::text), 1, 12),
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  learner_id      TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  role            TEXT,  -- team_lead | airway_manager | compressor | documentation
  checkin_status  TEXT NOT NULL DEFAULT 'not_checked_in',
  checkin_time    TIMESTAMPTZ,
  checkin_method  TEXT,  -- qr_scan | manual
  UNIQUE (session_id, learner_id)
);

-- Rubric templates
CREATE TABLE rubrics (
  id               TEXT PRIMARY KEY,
  organisation_id  TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  scenario_id      TEXT,
  role             TEXT,
  version          TEXT DEFAULT '1.0',
  max_score        INTEGER DEFAULT 100,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rubric criteria
CREATE TABLE rubric_criteria (
  id              TEXT PRIMARY KEY,
  rubric_id       TEXT NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  max_points      INTEGER NOT NULL,
  evidence_field  TEXT,
  ordering        INTEGER NOT NULL DEFAULT 0
);

-- Rubric scores
CREATE TABLE rubric_scores (
  id              TEXT PRIMARY KEY DEFAULT 'score_' || substr(md5(random()::text), 1, 12),
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id  TEXT NOT NULL REFERENCES session_participants(id) ON DELETE CASCADE,
  learner_id      TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  rubric_id       TEXT NOT NULL REFERENCES rubrics(id),
  scores          JSONB NOT NULL DEFAULT '{}',  -- { criterion_id: {points, notes} }
  total_score     INTEGER,
  assessor_notes  TEXT,
  assessor_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  state           TEXT NOT NULL DEFAULT 'pending_approval', -- pending_approval | approved | released | disputed
  scored_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  released_at     TIMESTAMPTZ
);

-- Flight recorder events (from simulator)
CREATE TABLE flight_recorder_events (
  id              TEXT PRIMARY KEY DEFAULT 'event_' || substr(md5(random()::text), 1, 12),
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id  TEXT REFERENCES session_participants(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL,
  parameters      JSONB NOT NULL DEFAULT '{}',
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Export jobs
CREATE TABLE exports (
  id            TEXT PRIMARY KEY DEFAULT 'export_' || substr(md5(random()::text), 1, 12),
  cohort_id     TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,    -- full_course | candidate_reports | raw_data
  format        TEXT NOT NULL,    -- zip | excel | pdf
  status        TEXT NOT NULL DEFAULT 'processing', -- processing | completed | failed
  file_url      TEXT,
  file_size     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ
);

-- Indexes for common lookups
CREATE INDEX idx_learners_org          ON learners(organisation_id);
CREATE INDEX idx_courses_org           ON courses(organisation_id);
CREATE INDEX idx_cohorts_course        ON cohorts(course_id);
CREATE INDEX idx_sessions_cohort       ON sessions(cohort_id);
CREATE INDEX idx_participants_session  ON session_participants(session_id);
CREATE INDEX idx_scores_session        ON rubric_scores(session_id);
CREATE INDEX idx_fre_session           ON flight_recorder_events(session_id);
CREATE INDEX idx_fre_participant       ON flight_recorder_events(participant_id);
