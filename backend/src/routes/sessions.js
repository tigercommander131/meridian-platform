import { Router } from 'express';
import {
  createSession, listCohortSessions, getSession, checkin, assignRole, startSession, endSession,
  ingestEvent, getParticipantEvents,
} from '../controllers/sessionsController.js';
import {
  scoringContext, submitScore, listSessionScores,
} from '../controllers/rubricsController.js';
import { authenticate } from '../middleware/auth.js';

// Mounted at /api.
const router = Router();

router.post('/cohorts/:cohortId/sessions', authenticate, createSession);
router.get('/cohorts/:cohortId/sessions', authenticate, listCohortSessions);
router.get('/sessions/:sessionId', authenticate, getSession);
router.post('/sessions/:sessionId/start', authenticate, startSession);
router.post('/sessions/:sessionId/end', authenticate, endSession);

router.put('/sessions/:sessionId/participants/:participantId/checkin', authenticate, checkin);
router.put('/sessions/:sessionId/participants/:participantId/role', authenticate, assignRole);

router.post('/sessions/:sessionId/flight-recorder-events', authenticate, ingestEvent);
router.get('/sessions/:sessionId/participants/:participantId/flight-recorder-events', authenticate, getParticipantEvents);

router.get('/sessions/:sessionId/participants/:participantId/scoring-context', authenticate, scoringContext);
router.post('/sessions/:sessionId/participants/:participantId/rubric-scores', authenticate, submitScore);
router.get('/sessions/:sessionId/rubric-scores', authenticate, listSessionScores);

export default router;
