import bcrypt from 'bcrypt';
import { query } from '../config/database.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ['admin', 'educator', 'instructor', 'observer'];

// Guards that the caller is acting within their own organisation.
function ownsOrg(req) {
  return req.user.organisationId === req.params.orgId;
}

// GET /api/organisations/:orgId/users — admin only.
export async function listUsers(req, res, next) {
  try {
    if (!ownsOrg(req)) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN', status: 403 });
    const r = await query(
      `SELECT id, email, first_name, last_name, roles, created_at
       FROM users WHERE organisation_id = $1 ORDER BY created_at`,
      [req.params.orgId]
    );
    res.json({
      users: r.rows.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        roles: u.roles,
        createdAt: u.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/organisations/:orgId/users — admin only. Adds a staff user.
export async function createUser(req, res, next) {
  try {
    if (!ownsOrg(req)) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN', status: 403 });
    const { firstName, lastName, email, password, roles } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required', code: 'VALIDATION_ERROR', status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address', code: 'VALIDATION_ERROR', status: 400 });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters', code: 'VALIDATION_ERROR', status: 400 });
    }

    const cleanRoles = Array.isArray(roles) ? roles.filter((r) => VALID_ROLES.includes(r)) : [];
    const finalRoles = cleanRoles.length ? cleanRoles : ['educator'];

    const exists = await query(`SELECT 1 FROM users WHERE email = $1`, [email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ error: 'An account with this email already exists', code: 'EMAIL_TAKEN', status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const u = await query(
      `INSERT INTO users (organisation_id, email, password_hash, first_name, last_name, roles)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, roles`,
      [req.params.orgId, email, hash, firstName, lastName, finalRoles]
    );
    const row = u.rows[0];
    res.status(201).json({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      roles: row.roles,
    });
  } catch (err) {
    next(err);
  }
}
