-- CTOP pivot: remove the assessment module. These tables held demo data only.
DROP TABLE IF EXISTS rubric_scores CASCADE;
DROP TABLE IF EXISTS rubric_criteria CASCADE;
DROP TABLE IF EXISTS rubrics CASCADE;
DROP TABLE IF EXISTS score_audit CASCADE;
DROP TABLE IF EXISTS flight_recorder_events CASCADE;
DROP TABLE IF EXISTS certificates CASCADE;
DROP TABLE IF EXISTS exports CASCADE;
DROP TABLE IF EXISTS session_participants CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS cohort_learners CASCADE;
DROP TABLE IF EXISTS cohorts CASCADE;
DROP TABLE IF EXISTS synced_events CASCADE;

ALTER TABLE learners DROP COLUMN IF EXISTS password_hash;
