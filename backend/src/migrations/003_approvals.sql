-- Approval workflow: dispute metadata on scores + an immutable audit trail.
-- State machine: pending_approval -> approved -> released; any of
-- {approved, released} -> disputed; disputed -> pending_approval (reopen).

ALTER TABLE rubric_scores
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
  ADD COLUMN IF NOT EXISTS disputed_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disputed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_by    TEXT REFERENCES users(id) ON DELETE SET NULL;

-- Immutable audit log: one row per state transition (and the initial submit).
CREATE TABLE score_audit (
  id          TEXT PRIMARY KEY DEFAULT 'audit_' || substr(md5(random()::text), 1, 12),
  score_id    TEXT NOT NULL REFERENCES rubric_scores(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,        -- submitted | approved | released | disputed | reopened
  from_state  TEXT,
  to_state    TEXT NOT NULL,
  actor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_score_audit_score ON score_audit(score_id, created_at);
