import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from '../config/environment.js';
import { query, getPool } from '../config/database.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn });
}

// Shapes the auth response (token + refresh + user) shared by login and register.
function authResponse(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    roles: user.roles,
    organisationId: user.organisation_id,
    iss: 'parasol-ems',
  };
  return {
    token: signToken(payload),
    refreshToken: signRefreshToken({ sub: user.id }),
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      organisationId: user.organisation_id,
      roles: user.roles,
    },
    expiresIn: 3600,
  };
}

// POST /api/auth/register — self-serve signup. Creates a new organisation and
// its first user (admin + educator), then auto-logs them in.
export async function register(req, res, next) {
  const client = await getPool().connect();
  try {
    const { organisationName, firstName, lastName, email, password } = req.body;
    if (!organisationName || !firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required', code: 'VALIDATION_ERROR', status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address', code: 'VALIDATION_ERROR', status: 400 });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters', code: 'VALIDATION_ERROR', status: 400 });
    }

    const exists = await query(`SELECT 1 FROM users WHERE email = $1`, [email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ error: 'An account with this email already exists', code: 'EMAIL_TAKEN', status: 409 });
    }

    const orgId = 'org_' + crypto.randomBytes(8).toString('hex');
    const hash = await bcrypt.hash(password, 10);

    await client.query('BEGIN');
    await client.query(`INSERT INTO organisations (id, name) VALUES ($1, $2)`, [orgId, organisationName]);
    const u = await client.query(
      `INSERT INTO users (organisation_id, email, password_hash, first_name, last_name, roles)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, organisation_id, email, first_name, last_name, roles`,
      [orgId, email, hash, firstName, lastName, ['admin', 'educator']]
    );
    await client.query('COMMIT');

    res.status(201).json(authResponse(u.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

export async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password required',
        code: 'VALIDATION_ERROR',
        status: 400,
      });
    }

    const result = await query(
      `SELECT id, organisation_id, email, password_hash, first_name, last_name, roles
       FROM users WHERE email = $1`,
      [username]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      organisationId: user.organisation_id,
      iss: 'parasol-ems',
    };

    res.json({
      token: signToken(payload),
      refreshToken: signRefreshToken({ sub: user.id }),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        organisationId: user.organisation_id,
        roles: user.roles,
      },
      expiresIn: 3600,
    });
  } catch (err) {
    next(err);
  }
}

export function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required', code: 'VALIDATION_ERROR' });
    }

    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
    const token = signToken({ sub: decoded.sub, iss: 'parasol-ems' });
    res.json({ token, expiresIn: 3600 });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token', code: 'UNAUTHORIZED' });
  }
}

export function logout(req, res) {
  // JWT is stateless — client drops the token. Future: add to blocklist.
  res.json({ success: true, message: 'Logged out successfully' });
}

export function verify(req, res) {
  res.json({
    valid: true,
    user: {
      id: req.user.sub,
      email: req.user.email,
      roles: req.user.roles,
    },
  });
}
