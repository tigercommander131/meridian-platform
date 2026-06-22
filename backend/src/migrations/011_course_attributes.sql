-- Flexible per-course attributes for imported datasets (e.g. the LMS 2000-course
-- export). Stores the full source row so the UI can render adaptable columns
-- without a schema change per field.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;
