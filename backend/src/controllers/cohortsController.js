import { getPool, query } from '../config/database.js';
import { broadcast } from '../realtime.js';

// POST /api/courses/:courseId/cohorts — create cohort, link learners, make a QR token.
export async function createCohort(req, res, next) {
  try {
    const courseId = req.params.courseId;
    const { name, description, learnerIds = [], startDate, endDate } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required', code: 'VALIDATION_ERROR', status: 400 });
    }

    // Course must belong to the caller's org.
    const course = await query(
      `SELECT id FROM courses WHERE id = $1 AND organisation_id = $2`,
      [courseId, req.user.organisationId]
    );
    if (course.rowCount === 0) {
      return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND', status: 404 });
    }

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const cohortRes = await client.query(
        `INSERT INTO cohorts (course_id, name, description, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [courseId, name, description || null, startDate || null, endDate || null]
      );
      const cohort = cohortRes.rows[0];

      // QR token encodes the cohort id; the scanner resolves it to a check-in URL.
      const qrCode = `COHORT_${cohort.id}`;
      await client.query(`UPDATE cohorts SET qr_code = $1 WHERE id = $2`, [qrCode, cohort.id]);

      for (const learnerId of learnerIds) {
        await client.query(
          `INSERT INTO cohort_learners (cohort_id, learner_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [cohort.id, learnerId]
        );
      }
      await client.query('COMMIT');

      broadcast('cohort.created', { cohortId: cohort.id, name: cohort.name, by: req.user.email });

      res.status(201).json({
        id: cohort.id,
        courseId,
        name: cohort.name,
        learnerCount: learnerIds.length,
        qrCode,
        created_at: cohort.created_at,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
}

// GET /api/cohorts/:cohortId — details + roster.
export async function getCohort(req, res, next) {
  try {
    const cohortId = req.params.cohortId;
    const cohortRes = await query(
      `SELECT c.*, co.organisation_id
       FROM cohorts c JOIN courses co ON co.id = c.course_id
       WHERE c.id = $1`,
      [cohortId]
    );
    const cohort = cohortRes.rows[0];
    if (!cohort || cohort.organisation_id !== req.user.organisationId) {
      return res.status(404).json({ error: 'Cohort not found', code: 'NOT_FOUND', status: 404 });
    }

    const learners = await query(
      `SELECT l.id, l.first_name, l.last_name, l.email
       FROM cohort_learners cl JOIN learners l ON l.id = cl.learner_id
       WHERE cl.cohort_id = $1
       ORDER BY l.last_name`,
      [cohortId]
    );

    res.json({
      id: cohort.id,
      courseId: cohort.course_id,
      name: cohort.name,
      description: cohort.description,
      qrCode: cohort.qr_code,
      learners: learners.rows.map((l) => ({
        id: l.id,
        firstName: l.first_name,
        lastName: l.last_name,
        email: l.email,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/courses/:courseId/cohorts — list cohorts for a course.
export async function listCohorts(req, res, next) {
  try {
    const courseId = req.params.courseId;
    const result = await query(
      `SELECT c.*, (SELECT COUNT(*)::int FROM cohort_learners cl WHERE cl.cohort_id = c.id) AS learner_count
       FROM cohorts c JOIN courses co ON co.id = c.course_id
       WHERE c.course_id = $1 AND co.organisation_id = $2
       ORDER BY c.created_at DESC`,
      [courseId, req.user.organisationId]
    );
    res.json({
      cohorts: result.rows.map((c) => ({
        id: c.id,
        name: c.name,
        learnerCount: c.learner_count,
        qrCode: c.qr_code,
        created_at: c.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}
