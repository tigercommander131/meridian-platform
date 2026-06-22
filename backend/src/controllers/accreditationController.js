import { query } from '../config/database.js';

// --- Accreditation organisations (ARC, RA) ---

function accredDTO(r) {
  return { id: r.id, name: r.name, code: r.code, createdAt: r.created_at };
}

function ownsOrg(req) {
  return req.params.orgId === req.user.organisationId;
}

// GET /api/organisations/:orgId/accreditation
export async function listAccreditation(req, res, next) {
  try {
    if (!ownsOrg(req)) return res.status(403).json({ error: 'Cannot read another organisation', code: 'FORBIDDEN', status: 403 });
    const r = await query(
      `SELECT * FROM accreditation_organisations WHERE organisation_id = $1 ORDER BY name`,
      [req.params.orgId]
    );
    res.json({ accreditation: r.rows.map(accredDTO) });
  } catch (err) { next(err); }
}

// POST /api/organisations/:orgId/accreditation
export async function createAccreditation(req, res, next) {
  try {
    if (!ownsOrg(req)) return res.status(403).json({ error: 'Cannot modify another organisation', code: 'FORBIDDEN', status: 403 });
    const { name, code } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'name and code are required', code: 'VALIDATION_ERROR', status: 400 });
    const r = await query(
      `INSERT INTO accreditation_organisations (organisation_id, name, code) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.orgId, name.trim(), code.trim()]
    );
    res.status(201).json(accredDTO(r.rows[0]));
  } catch (err) { next(err); }
}

// --- Course types ---

function courseTypeDTO(r) {
  return { id: r.id, name: r.name, code: r.code, accreditationOrgId: r.accreditation_org_id, accreditationName: r.accreditation_name };
}

// GET /api/organisations/:orgId/course-types  (optional ?accreditationId=)
export async function listCourseTypes(req, res, next) {
  try {
    if (!ownsOrg(req)) return res.status(403).json({ error: 'Cannot read another organisation', code: 'FORBIDDEN', status: 403 });
    const params = [req.params.orgId];
    let where = 'WHERE ct.organisation_id = $1';
    if (req.query.accreditationId) { params.push(req.query.accreditationId); where += ` AND ct.accreditation_org_id = $2`; }
    const r = await query(
      `SELECT ct.*, a.name AS accreditation_name
       FROM course_types ct JOIN accreditation_organisations a ON a.id = ct.accreditation_org_id
       ${where} ORDER BY ct.name`,
      params
    );
    res.json({ courseTypes: r.rows.map(courseTypeDTO) });
  } catch (err) { next(err); }
}

// POST /api/organisations/:orgId/course-types
export async function createCourseType(req, res, next) {
  try {
    if (!ownsOrg(req)) return res.status(403).json({ error: 'Cannot modify another organisation', code: 'FORBIDDEN', status: 403 });
    const { name, code, accreditationOrgId } = req.body;
    if (!name || !accreditationOrgId) return res.status(400).json({ error: 'name and accreditationOrgId are required', code: 'VALIDATION_ERROR', status: 400 });
    const a = await query(`SELECT 1 FROM accreditation_organisations WHERE id = $1 AND organisation_id = $2`, [accreditationOrgId, req.params.orgId]);
    if (a.rowCount === 0) return res.status(400).json({ error: 'Accreditation org not found in your organisation', code: 'VALIDATION_ERROR', status: 400 });
    const r = await query(
      `INSERT INTO course_types (organisation_id, accreditation_org_id, name, code) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.orgId, accreditationOrgId, name.trim(), code || null]
    );
    res.status(201).json(courseTypeDTO(r.rows[0]));
  } catch (err) { next(err); }
}

// --- Rule sets (versioned) ---

function ruleSetDTO(r) {
  return { id: r.id, courseTypeId: r.course_type_id, version: r.version, effectiveFrom: r.effective_from, rules: r.rules, createdAt: r.created_at };
}

// Verify the course type belongs to the caller's org.
async function courseTypeInOrg(courseTypeId, orgId) {
  const r = await query(`SELECT 1 FROM course_types WHERE id = $1 AND organisation_id = $2`, [courseTypeId, orgId]);
  return r.rowCount > 0;
}

// GET /api/course-types/:courseTypeId/rule-sets
export async function listRuleSets(req, res, next) {
  try {
    if (!(await courseTypeInOrg(req.params.courseTypeId, req.user.organisationId))) {
      return res.status(404).json({ error: 'Course type not found', code: 'NOT_FOUND', status: 404 });
    }
    const r = await query(`SELECT * FROM rule_sets WHERE course_type_id = $1 ORDER BY version DESC`, [req.params.courseTypeId]);
    res.json({ ruleSets: r.rows.map(ruleSetDTO) });
  } catch (err) { next(err); }
}

// POST /api/course-types/:courseTypeId/rule-sets — adds a new version.
export async function createRuleSet(req, res, next) {
  try {
    const { courseTypeId } = req.params;
    if (!(await courseTypeInOrg(courseTypeId, req.user.organisationId))) {
      return res.status(404).json({ error: 'Course type not found', code: 'NOT_FOUND', status: 404 });
    }
    const { rules, effectiveFrom } = req.body;
    if (!rules || typeof rules !== 'object') return res.status(400).json({ error: 'rules object is required', code: 'VALIDATION_ERROR', status: 400 });
    const v = await query(`SELECT COALESCE(MAX(version), 0) + 1 AS next FROM rule_sets WHERE course_type_id = $1`, [courseTypeId]);
    const r = await query(
      `INSERT INTO rule_sets (course_type_id, version, effective_from, rules, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [courseTypeId, v.rows[0].next, effectiveFrom || new Date().toISOString(), JSON.stringify(rules), req.user.sub]
    );
    clearRulesCache();
    res.status(201).json(ruleSetDTO(r.rows[0]));
  } catch (err) { next(err); }
}

// Resolve the rules in force for a course type now (latest effective version).
// Returns {} when none configured — the staffing engine applies its defaults.
// Short-lived cache: the ops dashboard resolves rules once per course, so a
// 500/2000-course org would otherwise fire one query per course. Rules rarely
// change; cleared on rule-set writes (see clearRulesCache).
const _rulesCache = new Map(); // courseTypeId -> { rules, at }
const RULES_TTL = 30_000;
export function clearRulesCache() { _rulesCache.clear(); }

export async function resolveCurrentRules(courseTypeId) {
  if (!courseTypeId) return {};
  const hit = _rulesCache.get(courseTypeId);
  if (hit && Date.now() - hit.at < RULES_TTL) return hit.rules;
  const r = await query(
    `SELECT rules FROM rule_sets
     WHERE course_type_id = $1 AND effective_from <= NOW()
     ORDER BY effective_from DESC, version DESC LIMIT 1`,
    [courseTypeId]
  );
  const rules = r.rows[0]?.rules || {};
  _rulesCache.set(courseTypeId, { rules, at: Date.now() });
  return rules;
}
