-- Student self-service accounts + certificates.

-- Learners can claim a login (password set on self-registration).
ALTER TABLE learners ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Certificates issued to a learner for completing a course.
CREATE TABLE IF NOT EXISTS certificates (
  id                TEXT PRIMARY KEY DEFAULT 'cert_' || substr(md5(random()::text), 1, 12),
  organisation_id   TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  learner_id        TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  course_id         TEXT REFERENCES courses(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'issued',  -- issued | revoked
  verification_code TEXT UNIQUE NOT NULL,
  issued_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_certs_learner ON certificates(learner_id);
CREATE INDEX IF NOT EXISTS idx_certs_org     ON certificates(organisation_id);
