import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Authentication token is missing or invalid',
      code: 'UNAUTHORIZED',
      status: 401,
    });
  }

  try {
    const user = jwt.verify(token, config.jwtSecret);
    // Staff endpoints: student tokens are not allowed here. Because every staff
    // route uses this middleware, this one check fences the whole staff app off
    // from student accounts.
    if (user.kind === 'student') {
      return res.status(403).json({ error: 'This area is for staff accounts', code: 'FORBIDDEN', status: 403 });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({
      error: 'Authentication token is missing or invalid',
      code: 'UNAUTHORIZED',
      status: 401,
    });
  }
}

// Student endpoints: require a student token (and reject staff tokens).
export function authenticateStudent(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication token is missing or invalid', code: 'UNAUTHORIZED', status: 401 });
  }
  try {
    const user = jwt.verify(token, config.jwtSecret);
    if (user.kind !== 'student') {
      return res.status(403).json({ error: 'Student account required', code: 'FORBIDDEN', status: 403 });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Authentication token is missing or invalid', code: 'UNAUTHORIZED', status: 401 });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    const hasRole = roles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({
        error: 'You do not have permission to perform this action',
        code: 'FORBIDDEN',
        status: 403,
        details: { requiredRoles: roles, userRoles },
      });
    }
    next();
  };
}
