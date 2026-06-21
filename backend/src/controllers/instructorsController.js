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
  return {
    id: r.id,
    accreditationOrgId: r.accreditation_org_id,
    eligibleCourseTypeIds: r.eligible_course_type_ids,
    eligibleRoles: r.eligible_roles,
    expiresAt: r.expires_at,
    evidenceNote: r.evidence_note,
  };
}

const STATUS = ['active', 'candidate', 'inactive'];

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

// GET /api/instructors/:instructorId — instructor + credentials.
export async function getInstructor(req, res, next) {
  try {
    const instr = await instructorInOrg(req.params.instructorId, req.user.organisationId);
    if (!instr) return res.status(404).json({ error: 'Instructor not found', code: 'NOT_FOUND', status: 404 });
    const creds = await query(`SELECT * FROM instructor_credentials WHERE instructor_id = $1 ORDER BY created_at`, [instr.id]);
    res.json({ ...instructorDTO(instr), credentials: creds.rows.map(credentialDTO) });
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
