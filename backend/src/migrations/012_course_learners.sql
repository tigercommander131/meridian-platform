-- Links synthesized/enrolled students to a course (CTOP tracks enrolment as a
-- count; this gives an actual per-course roster for imported datasets).
CREATE TABLE IF NOT EXISTS course_learners (
  course_id  TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, learner_id)
);
CREATE INDEX IF NOT EXISTS idx_course_learners_course ON course_learners(course_id);
