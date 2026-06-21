import { query } from '../config/database.js';
import { computeStaffing, evaluate } from '../services/staffingEngine.js';
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

export async function staffingFor(courseId) {
  const r = await query(
    `SELECT cs.*, i.first_name, i.last_name, i.email
     FROM course_staffing cs JOIN instructors i ON i.id = cs.instructor_id
     WHERE cs.course_id = $1 ORDER BY cs.role, i.last_name`,
    [courseId]
  );
  return r.rows.map((s) => ({
    id: s.id,
    instructorId: s.instructor_id,
    instructorName: `${s.first_name} ${s.last_name}`,
    instructorEmail: s.email,
    role: s.role,
    invitationStatus: s.invitation_status,
    invitedAt: s.invited_at,
    respondedAt: s.responded_at,
    escalationTier: s.escalation_tier,
    reminderCount: s.reminder_count,
    declineReason: s.decline_reason,
    invited: Boolean(s.invite_token),
    inviteToken: s.invite_token,
  }));
}

// Compliance for a course: resolve rules, run the engine.
// Imported courses store staffing as counts/flags (the operations spreadsheet);
// native courses derive it from named, non-declined staffing assignments.
export async function complianceFor(course) {
  const rules = await resolveCurrentRules(course.course_type_id);
  if (course.imported) {
    return evaluate({
      ruleSet: rules,
      groups: course.groups,
      enrolled: course.confirmed_students,
      instructors: course.instructors_assigned,
      courseDirector: Boolean(course.course_director_assigned) && course.cd_qualified !== false,
      medicalDirector: Boolean(course.medical_director_assigned) && course.md_doctor !== false,
    });
  }
  const assigned = await query(
    `SELECT role FROM course_staffing WHERE course_id = $1 AND invitation_status <> 'declined'`,
    [course.id]
  );
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

// Recompute + persist course status without a request context (used by the
// public invitation flow). Returns the fresh compliance result.
export async function recomputeStatus(courseId, actorUserId = null) {
  const c = await query(`SELECT * FROM courses WHERE id = $1`, [courseId]);
  const course = c.rows[0];
  if (!course) return null;
  const compliance = await complianceFor(course);
  if (PLANNING_STATES.includes(course.status) && course.status !== compliance.status) {
    await query(`UPDATE courses SET status = $1 WHERE id = $2`, [compliance.status, course.id]);
    await query(
      `INSERT INTO audit_events (organisation_id, actor_user_id, action, target_type, target_id, from_state, to_state, metadata)
       VALUES ($1, $2, 'course.status', 'course', $3, $4, $5, $6)`,
      [course.organisation_id, actorUserId, course.id, course.status, compliance.status, JSON.stringify({ reason: 'invitation_response' })]
    );
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

// GET /api/courses/:courseId/staffing/candidates?role=
// Ranked staffing suggestions with local → regional → emergency escalation.
export async function suggestCandidates(req, res, next) {
  try {
    const course = await courseInOrg(req.params.courseId, req.user.organisationId);
    if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND', status: 404 });
    const role = req.query.role;
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `a valid role query (${VALID_ROLES.join(', ')}) is required`, code: 'VALIDATION_ERROR', status: 400 });
    }

    // Instructors in this org with a credential granting the role for this course
    // type (or any type), credential unexpired. Include their availability on the
    // course start date and whether they're already assigned this role.
    const r = await query(
      `SELECT i.*,
              EXISTS (
                SELECT 1 FROM instructor_credentials c
                WHERE c.instructor_id = i.id
                  AND $2 = ANY (c.eligible_roles)
                  AND (c.expires_at IS NULL OR c.expires_at > NOW())
                  AND (cardinality(c.eligible_course_type_ids) = 0
                       OR $3::text IS NULL OR $3 = ANY (c.eligible_course_type_ids))
              ) AS eligible,
              (SELECT status FROM instructor_availability a
                 WHERE a.instructor_id = i.id AND a.available_on = $4::date) AS avail_status,
              EXISTS (SELECT 1 FROM course_staffing s
                 WHERE s.course_id = $5 AND s.instructor_id = i.id AND s.role = $2) AS already_assigned
       FROM instructors i
       WHERE i.organisation_id = $1 AND i.status <> 'inactive'`,
      [req.user.organisationId, role, course.course_type_id, course.start_date, course.id]
    );

    const isCandidateRole = role === 'instructor_candidate';
    const candidates = r.rows
      .filter((i) => i.eligible || isCandidateRole)
      .filter((i) => i.avail_status !== 'unavailable')
      .filter((i) => !i.already_assigned)
      .map((i) => {
        const availability = i.avail_status || 'unknown';
        let tier;
        if (i.status === 'candidate') tier = 'emergency';
        else if (course.region && i.region && course.region.toLowerCase() === i.region.toLowerCase()) tier = 'local';
        else tier = 'regional';
        return {
          instructorId: i.id,
          name: `${i.first_name} ${i.last_name}`,
          region: i.region,
          status: i.status,
          employmentType: i.employment_type,
          email: i.email,
          eligible: i.eligible,
          availability,
          tier,
        };
      });

    const tierRank = { local: 0, regional: 1, emergency: 2 };
    const availRank = { available: 0, unknown: 1, tentative: 2 };
    candidates.sort((a, b) =>
      (tierRank[a.tier] - tierRank[b.tier]) ||
      (availRank[a.availability] - availRank[b.availability]) ||
      a.name.localeCompare(b.name)
    );

    res.json({ role, courseDate: course.start_date, candidates });
  } catch (err) { next(err); }
}

// GET /api/organisations/:orgId/dashboard — courses needing attention.
export async function opsDashboard(req, res, next) {
  try {
    if (req.params.orgId !== req.user.organisationId) {
      return res.status(403).json({ error: 'Cannot read another organisation', code: 'FORBIDDEN', status: 403 });
    }
    const courses = await query(
      `SELECT c.*, ct.name AS course_type_name, ct.code AS course_type_code FROM courses c
       LEFT JOIN course_types ct ON ct.id = c.course_type_id
       WHERE c.organisation_id = $1 AND c.status NOT IN ('closed', 'cancelled')
       ORDER BY c.start_date NULLS LAST`,
      [req.params.orgId]
    );
    const rows = [];
    for (const c of courses.rows) {
      const compliance = await complianceFor(c);
      const req = compliance.required; const asg = compliance.assigned;
      const requiredTotal = req.instructors + req.course_director + req.medical_lead + req.doctor;
      const assignedTotal = Math.min(asg.instructors, req.instructors) + Math.min(asg.course_director, req.course_director)
        + Math.min(asg.medical_lead + (asg.course_director > 0 ? 1 : 0), req.medical_lead) + Math.min(asg.doctor, req.doctor);
      rows.push({
        id: c.id,
        name: c.name,
        courseType: c.course_type_name,
        courseTypeCode: c.course_type_code,
        region: c.region,
        capacity: c.capacity,
        startDate: c.start_date,
        confirmedStudents: c.confirmed_students,
        status: c.status,
        crew: { assigned: assignedTotal, required: requiredTotal, groups: compliance.groups },
        compliance: { status: compliance.status, missing: compliance.missing, explanation: compliance.explanation },
      });
    }
    // Surface at-risk first.
    const rank = { compliance_risk: 0, staffing_risk: 1, viability_risk: 2, planning: 3, ready: 4 };
    rows.sort((a, b) => (rank[a.compliance.status] ?? 9) - (rank[b.compliance.status] ?? 9));
    res.json({ courses: rows });
  } catch (err) { next(err); }
}
