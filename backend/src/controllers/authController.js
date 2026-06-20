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
    kind: 'staff',
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
      kind: 'staff',
    },
    expiresIn: 3600,
  };
}

// Auth response for a student (learner) account.
function studentAuthResponse(learner) {
  const payload = {
    sub: learner.id,
    email: learner.email,
    organisationId: learner.organisation_id,
    kind: 'student',
    iss: 'parasol-ems',
  };
  return {
    token: signToken(payload),
    refreshToken: signRefreshToken({ sub: learner.id }),
    user: {
      id: learner.id,
      email: learner.email,
      firstName: learner.first_name,
      lastName: learner.last_name,
      organisationId: learner.organisation_id,
      roles: [],
      kind: 'student',
    },
    expiresIn: 3600,
  };
}

// POST /api/auth/student/register — a learner claims a login. Matches an
// enrolled learner record by email that hasn't been claimed yet, then sets
// their password.
export async function studentRegister(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required', code: 'VALIDATION_ERROR', status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address', code: 'VALIDATION_ERROR', status: 400 });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters', code: 'VALIDATION_ERROR', status: 400 });
    }

    // Find an enrolled learner with this email. Reject if already claimed.
    const found = await query(
      `SELECT id, organisation_id, email, first_name, last_name, password_hash
       FROM learners WHERE lower(email) = lower($1) ORDER BY created_at LIMIT 1`,
      [email]
    );
    const learner = found.rows[0];
    if (!learner) {
      return res.status(404).json({ error: 'No enrolment found for that email. Ask your trainer to add you first.', code: 'NOT_ENROLLED', status: 404 });
    }
    if (learner.password_hash) {
      return res.status(409).json({ error: 'This account is already set up — try logging in.', code: 'ALREADY_CLAIMED', status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const updated = await query(
      `UPDATE learners SET password_hash = $1 WHERE id = $2
       RETURNING id, organisation_id, email, first_name, last_name`,
      [hash, learner.id]
    );
    res.status(201).json(studentAuthResponse(updated.rows[0]));
  } catch (err) {
    next(err);
  }
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

    // Staff accounts first.
    const staff = await query(
      `SELECT id, organisation_id, email, password_hash, first_name, last_name, roles
       FROM users WHERE email = $1`,
      [username]
    );
    const user = staff.rows[0];
    if (user) {
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
      return res.json(authResponse(user));
    }

    // Then a claimed student (learner) account.
    const stud = await query(
      `SELECT id, organisation_id, email, password_hash, first_name, last_name
       FROM learners WHERE lower(email) = lower($1) AND password_hash IS NOT NULL
       ORDER BY created_at LIMIT 1`,
      [username]
    );
    const learner = stud.rows[0];
    if (learner) {
      const valid = await bcrypt.compare(password, learner.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
      return res.json(studentAuthResponse(learner));
    }

    return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required', code: 'VALIDATION_ERROR' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token', code: 'UNAUTHORIZED' });
    }

    // Re-issue a full token by reloading the subject (staff or student), so the
    // refreshed token keeps roles/org/kind rather than being a bare token.
    const staff = await query(`SELECT id, organisation_id, email, roles FROM users WHERE id = $1`, [decoded.sub]);
    if (staff.rows[0]) {
      const u = staff.rows[0];
      const token = signToken({ sub: u.id, email: u.email, roles: u.roles, organisationId: u.organisation_id, kind: 'staff', iss: 'parasol-ems' });
      return res.json({ token, expiresIn: 3600 });
    }
    const stud = await query(`SELECT id, organisation_id, email FROM learners WHERE id = $1`, [decoded.sub]);
    if (stud.rows[0]) {
      const l = stud.rows[0];
      const token = signToken({ sub: l.id, email: l.email, organisationId: l.organisation_id, kind: 'student', iss: 'parasol-ems' });
      return res.json({ token, expiresIn: 3600 });
    }
    return res.status(401).json({ error: 'Invalid or expired refresh token', code: 'UNAUTHORIZED' });
  } catch (err) {
    next(err);
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
