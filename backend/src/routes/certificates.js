import { Router } from 'express';
import { issueCertificate, listLearnerCertificates, verifyCertificate } from '../controllers/certificatesController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Staff: issue + list certificates for a learner.
router.post('/learners/:learnerId/certificates', authenticate, requireRole('educator', 'admin'), issueCertificate);
router.get('/learners/:learnerId/certificates', authenticate, listLearnerCertificates);

// Public: verify a certificate by its code (no auth).
router.get('/verify/:code', verifyCertificate);

export default router;
