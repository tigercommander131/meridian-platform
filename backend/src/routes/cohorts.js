import { Router } from 'express';
import { createCohort, getCohort, listCohorts } from '../controllers/cohortsController.js';
import {
  exportCohortScores, exportFlightRecorder, listExports, cohortAudit,
} from '../controllers/exportsController.js';
import { authenticate } from '../middleware/auth.js';

// Mounted at /api — covers both /courses/:id/cohorts and /cohorts/:id.
const router = Router();

router.post('/courses/:courseId/cohorts', authenticate, createCohort);
router.get('/courses/:courseId/cohorts', authenticate, listCohorts);
router.get('/cohorts/:cohortId', authenticate, getCohort);

// Exports + audit (Week 13)
router.get('/cohorts/:cohortId/exports/scores.csv', authenticate, exportCohortScores);
router.get('/cohorts/:cohortId/exports/flight-recorder.csv', authenticate, exportFlightRecorder);
router.get('/cohorts/:cohortId/exports', authenticate, listExports);
router.get('/cohorts/:cohortId/audit', authenticate, cohortAudit);

export default router;
