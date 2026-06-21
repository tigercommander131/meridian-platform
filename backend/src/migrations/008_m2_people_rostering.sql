-- Milestone 2 — People & rostering: invitation workflow, escalation, IC pathway.

-- Course region drives staffing escalation (local → regional → emergency).
ALTER TABLE courses ADD COLUMN IF NOT EXISTS region TEXT;

-- Invitation workflow on staffing assignments.
ALTER TABLE course_staffing ADD COLUMN IF NOT EXISTS invite_token     TEXT;
ALTER TABLE course_staffing ADD COLUMN IF NOT EXISTS message          TEXT;
ALTER TABLE course_staffing ADD COLUMN IF NOT EXISTS decline_reason   TEXT;
ALTER TABLE course_staffing ADD COLUMN IF NOT EXISTS escalation_tier  TEXT;   -- local | regional | emergency
ALTER TABLE course_staffing ADD COLUMN IF NOT EXISTS reminder_count   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE course_staffing ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_staffing_invite_token ON course_staffing(invite_token) WHERE invite_token IS NOT NULL;

-- Availability already exists (007); add an optional note + index for range scans.
ALTER TABLE instructor_availability ADD COLUMN IF NOT EXISTS note TEXT;
CREATE INDEX IF NOT EXISTS idx_avail_date ON instructor_availability(available_on);

-- ic_progress already exists (007); index for lookups by instructor.
CREATE INDEX IF NOT EXISTS idx_ic_instructor ON ic_progress(instructor_id);
