import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, refresh, logout, verify } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config/environment.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts', code: 'RATE_LIMITED', status: 429 },
  skip: () => config.nodeEnv === 'test', // rate limiting interferes with the test suite
});

router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.post('/verify', authenticate, verify);

export default router;
