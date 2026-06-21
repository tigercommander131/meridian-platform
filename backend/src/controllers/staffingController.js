import { query } from '../config/database.js';
import { computeStaffing } from '../services/staffingEngine.js';
import { resolveCurrentRules } from './accreditationController.js';

const VALID_ROLES = ['instructor', 'course_director', 'medical_lead', 'doctor', 'assessor', 'instructor_candidate'];
// Statuses driven by the staffing engine (i.e. before delivery).
const PLANNING_STATES = ['draft', 'planning', 'staffing_risk', 'compliance_risk', 'viability_risk', 'ready'];

async function courseInOrg(courseId, orgId) {
  const r = await query(`SELECT * FROM courses WHERE id = $1 AND organisation_id = $2`, [courseId, orgId]);
  return r.rows[0] || null;
}

async function writeAudit(req, action, targetId, from, to, metadata) {
  await query(
    `INSERT INTO audit_events (organisation_id, actor_user_id, action, target_type, target_id, from_state, to_state, metadata)
     VALUES ($1, $2, $3, 'course', $4, $5, $6, $7)`,
    [req.user.organisationId, req.user.sub, action, targetId, from || null, to || null, metadata ? JSON.stringify(metadata) : null]
  );
}

async function staffingFor(courseId) {
  const r = await query(
    `SELECT cs.*, i.first_name, i.last_name
     FROM course_staffing cs JOIN instructors i ON i.id = cs.instructor_id
     WHERE cs.course_id = $1 ORDER BY cs.role, i.last_name`,
    [courseId]
  );
  return r.rows.map((s) => ({
    id: s.id,
    instructorId: s.instructor_id,
    instructorName: `${s.first_name} ${s.last_name}`,
    role: s.role,
    invitationStatus: s.invitation_status,
  }));
}

// Compliance for a course: resolve rules, run the engine over assigned staff.
async function complianceFor(course) {
  const rules = await resolveCurrentRules(course.course_type_id);
  const assigned = await query(`SELECT role FROM course_staffing WHERE course_id = $1`, [course.id]);
  return computeStaffing(course.confirmed_students, rules, assigned.rows);
}

// After staffing changes, move the course status to match the engine (unless
// the course has already been delivered/closed/cancelled).
async function syncStatus(req, course) {
  const compliance = await complianceFor(course);
  if (PLANNING_STATES.includes(course.status) && course.status !== compliance.status) {
    await query(`UPDATE courses SET status = $1 WHERE id = $2`, [compliance.status, course.id]);
    await writeAudit(req, 'course.status', course.id, course.status, compliance.status, { reason: 'staffing' });
  }
  return compliance;
}

// GET /api/courses/:courseId/staffing — assignments + live compliance.
export async function getStaffing(req, res, next) {
  try {
    const course = await courseInOrg(req.params.courseId, req.user.organisationId);
    if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND', status: 404 });
    res.json({ staffing: await staffingFor(course.id), compliance: await complianceFor(course) });
  } catch (err) { next(err); }
}

// POST /api/courses/:courseId/staffing — assign an instructor to a role.
export async function assignStaff(req, res, next) {
  try {
    const course = await courseInOrg(req.params.courseId, req.user.organisationId);
    if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND', status: 404 });
    const { instructorId, role } = req.body;
    if (!instructorId || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `instructorId and a valid role (${VALID_ROLES.join(', ')}) are required`, code: 'VALIDATION_ERROR', status: 400 });
    }
    const instr = await query(`SELECT 1 FROM instructors WHERE id = $1 AND organisation_id = $2`, [instructorId, req.user.organisationId]);
    if (instr.rowCount === 0) return res.status(400).json({ error: 'Instructor not found in your organisation', code: 'VALIDATION_ERROR', status: 400 });

    await query(
      `INSERT INTO course_staffing (course_id, instructor_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (course_id, instructor_id, role) DO NOTHING`,
      [course.id, instructorId, role]
    );
    await writeAudit(req, 'staffing.assign', course.id, null, role, { instructorId });
    const compliance = await syncStatus(req, course);
    res.status(201).json({ staffing: await staffingFor(course.id), compliance });
  } catch (err) { next(err); }
}

// DELETE /api/courses/:courseId/staffing/:staffingId
export async function removeStaff(req, res, next) {
  try {
    const course = await courseInOrg(req.params.courseId, req.user.organisationId);
    if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND', status: 404 });
    const del = await query(`DELETE FROM course_staffing WHERE id = $1 AND course_id = $2 RETURNING role`, [req.params.staffingId, course.id]);
    if (del.rowCount === 0) return res.status(404).json({ error: 'Assignment not found', code: 'NOT_FOUND', status: 404 });
    await writeAudit(req, 'staffing.remove', course.id, del.rows[0].role, null, {});
    const compliance = await syncStatus(req, course);
    res.json({ staffing: await staffingFor(course.id), compliance });
  } catch (err) { next(err); }
}

// GET /api/organisations/:orgId/dashboard — courses needing attention.
export async function opsDashboard(req, res, next) {
  try {
    if (req.params.orgId !== req.user.organisationId) {
      return res.status(403).json({ error: 'Cannot read another organisation', code: 'FORBIDDEN', status: 403 });
    }
    const courses = await query(
      `SELECT c.*, ct.name AS course_type_name FROM courses c
       LEFT JOIN course_types ct ON ct.id = c.course_type_id
       WHERE c.organisation_id = $1 AND c.status NOT IN ('closed', 'cancelled')
       ORDER BY c.start_date NULLS LAST`,
      [req.params.orgId]
    );
    const rows = [];
    for (const c of courses.rows) {
      const compliance = await complianceFor(c);
      rows.push({
        id: c.id,
        name: c.name,
        courseType: c.course_type_name,
        startDate: c.start_date,
        confirmedStudents: c.confirmed_students,
        status: c.status,
        compliance: { status: compliance.status, missing: compliance.missing, explanation: compliance.explanation },
      });
    }
    // Surface at-risk first.
    const rank = { compliance_risk: 0, staffing_risk: 1, viability_risk: 2, planning: 3, ready: 4 };
    rows.sort((a, b) => (rank[a.compliance.status] ?? 9) - (rank[b.compliance.status] ?? 9));
    res.json({ courses: rows });
  } catch (err) { next(err); }
}
