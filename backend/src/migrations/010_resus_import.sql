-- Resuscitation course import: planned groups + count-based staffing on courses
-- (the operations spreadsheet tracks staffing as counts/flags, not named crew).
ALTER TABLE courses ADD COLUMN IF NOT EXISTS groups                    INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS duration_days             INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS external_ref              TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS imported                  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructors_assigned      INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_director_assigned  BOOLEAN;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS medical_director_assigned BOOLEAN;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cd_qualified              BOOLEAN;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS md_doctor                 BOOLEAN;
CREATE INDEX IF NOT EXISTS idx_courses_external_ref ON courses(external_ref);
