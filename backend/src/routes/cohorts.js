import { Router } from 'express';
import { createCohort, getCohort, listCohorts } from '../controllers/cohortsController.js';
import { authenticate } from '../middleware/auth.js';

// Mounted at /api — covers both /courses/:id/cohorts and /cohorts/:id.
const router = Router();

router.post('/courses/:courseId/cohorts', authenticate, createCohort);
router.get('/courses/:courseId/cohorts', authenticate, listCohorts);
router.get('/cohorts/:cohortId', authenticate, getCohort);

export default router;
