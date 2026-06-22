import { query } from '../config/database.js';
import { broadcast } from '../realtime.js';

// CTOP course lifecycle.
const VALID_STATUS = [
  'draft', 'planning', 'staffing_risk', 'compliance_risk', 'viability_risk',
  'ready', 'delivered', 'closed', 'cancelled',
];

function toDTO(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    accreditationOrgId: row.accreditation_org_id,
    courseTypeId: row.course_type_id,
    courseTypeName: row.course_type_name,
    venueSiteId: row.venue_site_id,
    capacity: row.capacity,
    confirmedStudents: row.confirmed_students,
    waitlistCount: row.waitlist_count,
    region: row.region,
    startDate: row.start_date,
    endDate: row.end_date,
    groups: row.groups,
    durationDays: row.duration_days,
    externalRef: row.external_ref,
    imported: row.imported,
    instructorsAssigned: row.instructors_assigned,
    courseDirectorAssigned: row.course_director_assigned,
    medicalDirectorAssigned: row.medical_director_assigned,
    cdQualified: row.cd_qualified,
    mdDoctor: row.md_doctor,
    attributes: row.attributes || {},
    createdAt: row.created_at,
  };
}

function ownsOrg(req) {
  return req.params.orgId === req.user.organisationId;
}

// GET /api/organisations/:orgId/courses  (optional ?status=)
export async function listCourses(req, res, next) {
  try {
    if (!ownsOrg(req)) return res.status(403).json({ error: 'Cannot read another organisation', code: 'FORBIDDEN', status: 403 });
    const params = [req.params.orgId];
    let where = 'WHERE c.organisation_id = $1';
    if (req.query.status) { params.push(req.query.status); where += ` AND c.status = $2`; }
    const result = await query(
      `SELECT c.*, ct.name AS course_type_name
       FROM courses c LEFT JOIN course_types ct ON ct.id = c.course_type_id
       ${where} ORDER BY c.start_date DESC NULLS LAST`,
      params
    );
    res.json({ courses: result.rows.map(toDTO), total: result.rows.length });
  } catch (err) { next(err); }
}

// GET /api/organisations/:orgId/courses/:courseId
export async function getCourse(req, res, next) {
  try {
    if (!ownsOrg(req)) return res.status(403).json({ error: 'Cannot read another organisation', code: 'FORBIDDEN', status: 403 });
    const { orgId, courseId } = req.params;
    const result = await query(
      `SELECT c.*, ct.name AS course_type_name
       FROM courses c LEFT JOIN course_types ct ON ct.id = c.course_type_id
       WHERE c.id = $1 AND c.organisation_id = $2`,
      [courseId, orgId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND', status: 404 });
    res.json(toDTO(result.rows[0]));
  } catch (err) { next(err); }
}

// POST /api/organisations/:orgId/courses
export async function createCourse(req, res, next) {
  try {
    if (!ownsOrg(req)) return res.status(403).json({ error: 'Cannot modify another organisation', code: 'FORBIDDEN', status: 403 });
    const orgId = req.params.orgId;
    const { name, accreditationOrgId, courseTypeId, venueSiteId, capacity, confirmedStudents, startDate, endDate, status } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required', code: 'VALIDATION_ERROR', status: 400 });
    if (status && !VALID_STATUS.includes(status)) return res.status(400).json({ error: `status must be one of ${VALID_STATUS.join(', ')}`, code: 'VALIDATION_ERROR', status: 400 });

    const result = await query(
      `INSERT INTO courses
         (organisation_id, name, accreditation_org_id, course_type_id, venue_site_id, capacity, confirmed_students, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [orgId, name.trim(), accreditationOrgId || null, courseTypeId || null, venueSiteId || null,
       Number.isInteger(capacity) ? capacity : null, Number.isInteger(confirmedStudents) ? confirmedStudents : 0,
       startDate || null, endDate || null, status || 'planning']
    );
    const course = toDTO(result.rows[0]);
    broadcast('course.created', { courseId: course.id, name: course.name, by: req.user.email });
    res.status(201).json(course);
  } catch (err) { next(err); }
}

// PUT /api/organisations/:orgId/courses/:courseId — partial update.
export async function updateCourse(req, res, next) {
  try {
    if (!ownsOrg(req)) return res.status(403).json({ error: 'Cannot modify another organisation', code: 'FORBIDDEN', status: 403 });
    const { orgId, courseId } = req.params;
    const existing = await query(`SELECT * FROM courses WHERE id = $1 AND organisation_id = $2`, [courseId, orgId]);
    if (existing.rowCount === 0) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND', status: 404 });
    const cur = existing.rows[0];
    const b = req.body;
    if (b.status && !VALID_STATUS.includes(b.status)) {
      return res.status(400).json({ error: `status must be one of ${VALID_STATUS.join(', ')}`, code: 'VALIDATION_ERROR', status: 400 });
    }
    const pick = (v, fallback) => (v !== undefined ? v : fallback);
    const result = await query(
      `UPDATE courses SET name=$1, status=$2, accreditation_org_id=$3, course_type_id=$4, venue_site_id=$5,
              capacity=$6, confirmed_students=$7, waitlist_count=$8, start_date=$9, end_date=$10
       WHERE id=$11 RETURNING *`,
      [
        b.name && b.name.trim() ? b.name.trim() : cur.name,
        b.status || cur.status,
        pick(b.accreditationOrgId, cur.accreditation_org_id),
        pick(b.courseTypeId, cur.course_type_id),
        pick(b.venueSiteId, cur.venue_site_id),
        Number.isInteger(b.capacity) ? b.capacity : cur.capacity,
        Number.isInteger(b.confirmedStudents) ? b.confirmedStudents : cur.confirmed_students,
        Number.isInteger(b.waitlistCount) ? b.waitlistCount : cur.waitlist_count,
        pick(b.startDate, cur.start_date),
        pick(b.endDate, cur.end_date),
        courseId,
      ]
    );
    res.json(toDTO(result.rows[0]));
  } catch (err) { next(err); }
}
