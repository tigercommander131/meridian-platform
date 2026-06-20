import { Router } from 'express';
import { mySessions, selfCheckin, myResults, myCertificates } from '../controllers/studentController.js';
import { authenticateStudent } from '../middleware/auth.js';

// Student portal API — all routes require a student (learner) token.
const router = Router();

router.get('/me/sessions', authenticateStudent, mySessions);
router.post('/sessions/:sessionId/checkin', authenticateStudent, selfCheckin);
router.get('/me/results', authenticateStudent, myResults);
router.get('/me/certificates', authenticateStudent, myCertificates);

export default router;
