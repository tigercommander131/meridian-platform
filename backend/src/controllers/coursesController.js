import { query } from '../config/database.js';
import { broadcast } from '../realtime.js';

const VALID_STATUS = ['active', 'completed', 'archived'];

function toDTO(row) {
  return {
    id: row.id,
    name: row.name,
    siteId: row.site_id,
    startDate: row.start_date,
    endDate: row.end_date,
    maxLearners: row.max_learners,
    status: row.status,
    createdAt: row.created_at,
  };
}

// Guard: the :orgId in the path must be the caller's own org.
function ownsOrg(req) {
  return req.params.orgId === req.user.organisationId;
}

// GET /api/organisations/:orgId/courses
export async function listCourses(req, res, next) {
  try {
    if (!ownsOrg(req)) {
      return res.status(403).json({ error: 'Cannot read another organisation', code: 'FORBIDDEN', status: 403 });
    }
    const orgId = req.params.orgId;

    const params = [orgId];
    let where = 'WHERE organisation_id = $1';
    if (req.query.status) {
      params.push(req.query.status);
      where += ` AND status = $2`;
    }

    const result = await query(
      `SELECT c.*,
              (SELECT COUNT(*)::int FROM cohorts ch WHERE ch.course_id = c.id) AS cohort_count
       FROM courses c ${where} ORDER BY start_date DESC NULLS LAST`,
      params
    );
    res.json({
      courses: result.rows.map((r) => ({ ...toDTO(r), cohortCount: r.cohort_count })),
      total: result.rows.length,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/organisations/:orgId/courses/:courseId
export async function getCourse(req, res, next) {
  try {
    if (!ownsOrg(req)) {
      return res.status(403).json({ error: 'Cannot read another organisation', code: 'FORBIDDEN', status: 403 });
    }
    const { orgId, courseId } = req.params;
    const result = await query(
      `SELECT * FROM courses WHERE id = $1 AND organisation_id = $2`,
      [courseId, orgId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND', status: 404 });
    }
    res.json(toDTO(result.rows[0]));
  } catch (err) {
    next(err);
  }
}

// POST /api/organisations/:orgId/courses
export async function createCourse(req, res, next) {
  try {
    if (!ownsOrg(req)) {
      return res.status(403).json({ error: 'Cannot modify another organisation', code: 'FORBIDDEN', status: 403 });
    }
    const orgId = req.params.orgId;
    const { name, siteId, startDate, endDate, maxLearners, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required', code: 'VALIDATION_ERROR', status: 400 });
    }
    if (status && !VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${VALID_STATUS.join(', ')}`, code: 'VALIDATION_ERROR', status: 400 });
    }
    const cap = Number.isInteger(maxLearners) && maxLearners > 0 ? maxLearners : 24;

    const result = await query(
      `INSERT INTO courses (organisation_id, site_id, name, start_date, end_date, max_learners, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [orgId, siteId || null, name.trim(), startDate || null, endDate || null, cap, status || 'active']
    );
    const course = toDTO(result.rows[0]);
    broadcast('course.created', { courseId: course.id, name: course.name, by: req.user.email });
    res.status(201).json(course);
  } catch (err) {
    next(err);
  }
}

// PUT /api/organisations/:orgId/courses/:courseId — partial update (name/status/dates/cap).
export async function updateCourse(req, res, next) {
  try {
    if (!ownsOrg(req)) {
      return res.status(403).json({ error: 'Cannot modify another organisation', code: 'FORBIDDEN', status: 403 });
    }
    const { orgId, courseId } = req.params;
    const existing = await query(
      `SELECT * FROM courses WHERE id = $1 AND organisation_id = $2`,
      [courseId, orgId]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND', status: 404 });
    }
    const cur = existing.rows[0];
    const { name, status, startDate, endDate, maxLearners } = req.body;

    if (status && !VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${VALID_STATUS.join(', ')}`, code: 'VALIDATION_ERROR', status: 400 });
    }

    const result = await query(
      `UPDATE courses SET name = $1, status = $2, start_date = $3, end_date = $4, max_learners = $5
       WHERE id = $6 RETURNING *`,
      [
        name && name.trim() ? name.trim() : cur.name,
        status || cur.status,
        startDate !== undefined ? (startDate || null) : cur.start_date,
        endDate !== undefined ? (endDate || null) : cur.end_date,
        Number.isInteger(maxLearners) && maxLearners > 0 ? maxLearners : cur.max_learners,
        courseId,
      ]
    );
    res.json(toDTO(result.rows[0]));
  } catch (err) {
    next(err);
  }
}
