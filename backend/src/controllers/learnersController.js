import { getPool, query } from '../config/database.js';
import { broadcast } from '../realtime.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toDTO(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    externalId: row.external_id,
    phone: row.phone,
    created_at: row.created_at,
  };
}

function validate(record) {
  if (!record || typeof record !== 'object') return 'Invalid record';
  if (!record.firstName) return 'firstName is required';
  if (!record.lastName) return 'lastName is required';
  if (!record.email) return 'email is required';
  if (!EMAIL_RE.test(record.email)) return 'invalid email format';
  return null;
}

// POST /api/organisations/:orgId/learners  — single or batch ({ data: [...] }).
export async function createLearners(req, res, next) {
  try {
    const orgId = req.params.orgId;
    if (orgId !== req.user.organisationId) {
      return res.status(403).json({ error: 'Cannot modify another organisation', code: 'FORBIDDEN', status: 403 });
    }

    const incoming = Array.isArray(req.body?.data) ? req.body.data : [req.body];

    // Validate all first; report row-level failures.
    const failures = [];
    incoming.forEach((rec, i) => {
      const issue = validate(rec);
      if (issue) failures.push({ row: i, field: issue.split(' ')[0], issue });
    });
    if (failures.length > 0) {
      return res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', failures });
    }

    const client = await getPool().connect();
    const created = [];
    const skipped = [];
    try {
      await client.query('BEGIN');
      for (const rec of incoming) {
        const result = await client.query(
          `INSERT INTO learners (organisation_id, first_name, last_name, email, external_id, phone)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (organisation_id, email) DO NOTHING
           RETURNING *`,
          [orgId, rec.firstName, rec.lastName, rec.email, rec.externalId || null, rec.phone || null]
        );
        if (result.rows[0]) created.push(toDTO(result.rows[0]));
        else skipped.push({ email: rec.email, issue: 'Duplicate email' });
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    if (created.length > 0) {
      broadcast('learners.created', { count: created.length, by: req.user.email });
    }

    res.status(201).json({
      created: created.length,
      failed: skipped.length,
      learners: created,
      skipped,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/organisations/:orgId/learners — pagination + search.
export async function listLearners(req, res, next) {
  try {
    const orgId = req.params.orgId;
    if (orgId !== req.user.organisationId) {
      return res.status(403).json({ error: 'Cannot read another organisation', code: 'FORBIDDEN', status: 403 });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const search = (req.query.search || '').trim();

    const params = [orgId];
    let where = 'WHERE organisation_id = $1';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2)`;
    }

    const totalRes = await query(`SELECT COUNT(*)::int AS total FROM learners ${where}`, params);
    const rowsRes = await query(
      `SELECT * FROM learners ${where} ORDER BY created_at DESC, last_name
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({
      learners: rowsRes.rows.map(toDTO),
      total: totalRes.rows[0].total,
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
}
