import { query } from '../config/database.js';

function ownsOrg(req) {
  return req.params.orgId === req.user.organisationId;
}

function instructorDTO(r) {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phone: r.phone,
    region: r.region,
    travelRadiusKm: r.travel_radius_km,
    employmentType: r.employment_type,
    status: r.status,
    createdAt: r.created_at,
  };
}

function credentialDTO(r) {
  const expired = r.expires_at ? new Date(r.expires_at) < new Date() : false;
  return {
    id: r.id,
    accreditationOrgId: r.accreditation_org_id,
    eligibleCourseTypeIds: r.eligible_course_type_ids,
    eligibleRoles: r.eligible_roles,
    expiresAt: r.expires_at,
    expired,
    evidenceNote: r.evidence_note,
  };
}

function availabilityDTO(r) {
  return { id: r.id, date: r.available_on, status: r.status, note: r.note };
}

function icDTO(r) {
  return {
    id: r.id,
    stage: r.stage,
    courseId: r.course_id,
    courseName: r.course_name,
    mentorId: r.mentor_id,
    mentorName: r.mentor_name,
    outcome: r.outcome,
    signedOffBy: r.signed_off_by,
    signedOffAt: r.signed_off_at,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

const STATUS = ['active', 'candidate', 'inactive'];
const AVAIL_STATUS = ['available', 'unavailable', 'tentative'];
const IC_STAGES = ['IC1', 'IC2'];
const IC_OUTCOMES = ['passed', 'remediation', 'not_suitable', 'deferred'];

// GET /api/organisations/:orgId/instructors  (optional ?status= , ?search=)
export async function listInstructors(req, res, next) {
  try {
    if (!ownsOrg(req)) return res.status(403).json({ error: 'Cannot read another organisation', code: 'FORBIDDEN', status: 403 });
    const params = [req.params.orgId];
    let where = 'WHERE organisation_id = $1';
    if (req.query.status) { params.push(req.query.status); where += ` AND status = $${params.length}`; }
    if (req.query.search) { params.push(`%${req.query.search.trim()}%`); where += ` AND (first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length})`; }
    const r = await query(`SELECT * FROM instructors ${where} ORDER BY last_name, first_name`, params);
    res.json({ instructors: r.rows.map(instructorDTO), total: r.rowCount });
  } catch (err) { next(err); }
}

// POST /api/organisations/:orgId/instructors
export async function createInstructor(req, res, next) {
  try {
    if (!ownsOrg(req)) return res.status(403).json({ error: 'Cannot modify another organisation', code: 'FORBIDDEN', status: 403 });
    const { firstName, lastName, email, phone, region, travelRadiusKm, employmentType, status } = req.body;
    if (!firstName || !lastName) return res.status(400).json({ error: 'firstName and lastName are required', code: 'VALIDATION_ERROR', status: 400 });
    if (status && !STATUS.includes(status)) return res.status(400).json({ error: `status must be one of ${STATUS.join(', ')}`, code: 'VALIDATION_ERROR', status: 400 });
    const r = await query(
      `INSERT INTO instructors (organisation_id, first_name, last_name, email, phone, region, travel_radius_km, employment_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.params.orgId, firstName.trim(), lastName.trim(), email || null, phone || null, region || null,
       Number.isInteger(travelRadiusKm) ? travelRadiusKm : null, employmentType || null, status || 'active']
    );
    res.status(201).json(instructorDTO(r.rows[0]));
  } catch (err) { next(err); }
}

// Verify instructor belongs to caller's org.
async function instructorInOrg(instructorId, orgId) {
  const r = await query(`SELECT * FROM instructors WHERE id = $1 AND organisation_id = $2`, [instructorId, orgId]);
  return r.rows[0] || null;
}

// GET /api/instructors/:instructorId — instructor + credentials + availability + IC.
export async function getInstructor(req, res, next) {
  try {
    const instr = await instructorInOrg(req.params.instructorId, req.user.organisationId);
    if (!instr) return res.status(404).json({ error: 'Instructor not found', code: 'NOT_FOUND', status: 404 });
    const [creds, avail, ic] = await Promise.all([
      query(`SELECT * FROM instructor_credentials WHERE instructor_id = $1 ORDER BY created_at`, [instr.id]),
      query(`SELECT * FROM instructor_availability WHERE instructor_id = $1 AND available_on >= CURRENT_DATE - INTERVAL '1 day' ORDER BY available_on`, [instr.id]),
      query(`SELECT ip.*, c.name AS course_name, m.first_name || ' ' || m.last_name AS mentor_name
             FROM ic_progress ip
             LEFT JOIN courses c ON c.id = ip.course_id
             LEFT JOIN instructors m ON m.id = ip.mentor_id
             WHERE ip.instructor_id = $1 ORDER BY ip.created_at DESC`, [instr.id]),
    ]);
    res.json({
      ...instructorDTO(instr),
      credentials: creds.rows.map(credentialDTO),
      availability: avail.rows.map(availabilityDTO),
      icProgress: ic.rows.map(icDTO),
    });
  } catch (err) { next(err); }
}

// PUT /api/instructors/:instructorId — partial profile update.
export async function updateInstructor(req, res, next) {
  try {
    const instr = await instructorInOrg(req.params.instructorId, req.user.organisationId);
    if (!instr) return res.status(404).json({ error: 'Instructor not found', code: 'NOT_FOUND', status: 404 });
    const b = req.body;
    if (b.status && !STATUS.includes(b.status)) return res.status(400).json({ error: `status must be one of ${STATUS.join(', ')}`, code: 'VALIDATION_ERROR', status: 400 });
    const pick = (v, fallback) => (v !== undefined ? v : fallback);
    const r = await query(
      `UPDATE instructors SET first_name=$1, last_name=$2, email=$3, phone=$4, region=$5, travel_radius_km=$6, employment_type=$7, status=$8
       WHERE id=$9 RETURNING *`,
      [
        b.firstName?.trim() || instr.first_name,
        b.lastName?.trim() || instr.last_name,
        pick(b.email, instr.email), pick(b.phone, instr.phone), pick(b.region, instr.region),
        Number.isInteger(b.travelRadiusKm) ? b.travelRadiusKm : instr.travel_radius_km,
        pick(b.employmentType, instr.employment_type), b.status || instr.status, instr.id,
      ]
    );
    res.json(instructorDTO(r.rows[0]));
  } catch (err) { next(err); }
}

// --- Availability ----------------------------------------------------------

// GET /api/instructors/:instructorId/availability
export async function listAvailability(req, res, next) {
  try {
    const instr = await instructorInOrg(req.params.instructorId, req.user.organisationId);
    if (!instr) return res.status(404).json({ error: 'Instructor not found', code: 'NOT_FOUND', status: 404 });
    const r = await query(
      `SELECT * FROM instructor_availability WHERE instructor_id = $1 AND available_on >= CURRENT_DATE - INTERVAL '1 day' ORDER BY available_on`,
      [instr.id]
    );
    res.json({ availability: r.rows.map(availabilityDTO) });
  } catch (err) { next(err); }
}

// POST /api/instructors/:instructorId/availability — upsert one date.
export async function setAvailability(req, res, next) {
  try {
    const instr = await instructorInOrg(req.params.instructorId, req.user.organisationId);
    if (!instr) return res.status(404).json({ error: 'Instructor not found', code: 'NOT_FOUND', status: 404 });
    const { date, status = 'available', note } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required', code: 'VALIDATION_ERROR', status: 400 });
    if (!AVAIL_STATUS.includes(status)) return res.status(400).json({ error: `status must be one of ${AVAIL_STATUS.join(', ')}`, code: 'VALIDATION_ERROR', status: 400 });
    const r = await query(
      `INSERT INTO instructor_availability (instructor_id, available_on, status, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (instructor_id, available_on) DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note
       RETURNING *`,
      [instr.id, date, status, note || null]
    );
    res.status(201).json(availabilityDTO(r.rows[0]));
  } catch (err) { next(err); }
}

// DELETE /api/instructors/:instructorId/availability/:date
export async function removeAvailability(req, res, next) {
  try {
    const instr = await instructorInOrg(req.params.instructorId, req.user.organisationId);
    if (!instr) return res.status(404).json({ error: 'Instructor not found', code: 'NOT_FOUND', status: 404 });
    await query(`DELETE FROM instructor_availability WHERE instructor_id = $1 AND available_on = $2`, [instr.id, req.params.date]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// --- IC1 / IC2 candidate pathway ------------------------------------------

// POST /api/instructors/:instructorId/ic-progress — log/sign off a stage.
export async function addIcProgress(req, res, next) {
  try {
    const instr = await instructorInOrg(req.params.instructorId, req.user.organisationId);
    if (!instr) return res.status(404).json({ error: 'Instructor not found', code: 'NOT_FOUND', status: 404 });
    const { stage, courseId, mentorId, outcome, notes } = req.body;
    if (!IC_STAGES.includes(stage)) return res.status(400).json({ error: `stage must be one of ${IC_STAGES.join(', ')}`, code: 'VALIDATION_ERROR', status: 400 });
    if (outcome && !IC_OUTCOMES.includes(outcome)) return res.status(400).json({ error: `outcome must be one of ${IC_OUTCOMES.join(', ')}`, code: 'VALIDATION_ERROR', status: 400 });
    const signedOff = outcome ? { by: req.user.sub, at: new Date().toISOString() } : { by: null, at: null };
    const r = await query(
      `INSERT INTO ic_progress (instructor_id, stage, course_id, mentor_id, outcome, signed_off_by, signed_off_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [instr.id, stage, courseId || null, mentorId || null, outcome || null, signedOff.by, signedOff.at, notes || null]
    );
    // A passed IC2 promotes the candidate to an active instructor.
    if (stage === 'IC2' && outcome === 'passed') {
      await query(`UPDATE instructors SET status = 'active' WHERE id = $1 AND status = 'candidate'`, [instr.id]);
    }
    res.status(201).json(icDTO(r.rows[0]));
  } catch (err) { next(err); }
}

// POST /api/instructors/:instructorId/credentials
export async function addCredential(req, res, next) {
  try {
    const instr = await instructorInOrg(req.params.instructorId, req.user.organisationId);
    if (!instr) return res.status(404).json({ error: 'Instructor not found', code: 'NOT_FOUND', status: 404 });
    const { accreditationOrgId, eligibleCourseTypeIds = [], eligibleRoles = [], expiresAt, evidenceNote } = req.body;
    if (!Array.isArray(eligibleRoles) || eligibleRoles.length === 0) {
      return res.status(400).json({ error: 'eligibleRoles is required', code: 'VALIDATION_ERROR', status: 400 });
    }
    const r = await query(
      `INSERT INTO instructor_credentials (instructor_id, accreditation_org_id, eligible_course_type_ids, eligible_roles, expires_at, evidence_note)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [instr.id, accreditationOrgId || null, eligibleCourseTypeIds, eligibleRoles, expiresAt || null, evidenceNote || null]
    );
    res.status(201).json(credentialDTO(r.rows[0]));
  } catch (err) { next(err); }
}
