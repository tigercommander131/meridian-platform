import { query } from '../config/database.js';

function toDTO(row) {
  return {
    id: row.id,
    name: row.name,
    siteId: row.site_id,
    startDate: row.start_date,
    endDate: row.end_date,
    maxLearners: row.max_learners,
    status: row.status,
  };
}

// GET /api/organisations/:orgId/courses
export async function listCourses(req, res, next) {
  try {
    const orgId = req.params.orgId;
    if (orgId !== req.user.organisationId) {
      return res.status(403).json({ error: 'Cannot read another organisation', code: 'FORBIDDEN', status: 403 });
    }

    const params = [orgId];
    let where = 'WHERE organisation_id = $1';
    if (req.query.status) {
      params.push(req.query.status);
      where += ` AND status = $2`;
    }

    const result = await query(`SELECT * FROM courses ${where} ORDER BY start_date DESC NULLS LAST`, params);
    res.json({ courses: result.rows.map(toDTO), total: result.rows.length });
  } catch (err) {
    next(err);
  }
}
