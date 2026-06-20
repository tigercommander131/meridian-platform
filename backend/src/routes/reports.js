import { Router } from 'express';
import { learnerReport } from '../controllers/reportsController.js';
import { authenticate } from '../middleware/auth.js';

// Mounted at /api.
const router = Router();

router.get('/learners/:learnerId/report', authenticate, learnerReport);

export default router;
