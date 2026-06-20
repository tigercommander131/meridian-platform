import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from '../config/environment.js';
import { query } from '../config/database.js';

function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn });
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
