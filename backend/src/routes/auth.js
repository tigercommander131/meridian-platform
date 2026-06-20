import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, register, studentRegister, refresh, logout, verify } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config/environment.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts', code: 'RATE_LIMITED', status: 429 },
  skip: () => config.nodeEnv === 'test', // rate limiting interferes with the test suite
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many sign-up attempts, try again later', code: 'RATE_LIMITED', status: 429 },
  skip: () => config.nodeEnv === 'test',
});

router.post('/login', loginLimiter, login);
router.post('/register', registerLimiter, register);
router.post('/student/register', registerLimiter, studentRegister);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.post('/verify', authenticate, verify);

export default router;
