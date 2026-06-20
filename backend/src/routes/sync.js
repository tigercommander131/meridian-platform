import { Router } from 'express';
import { sync, syncStatus } from '../controllers/syncController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/', authenticate, sync);
router.get('/status', authenticate, syncStatus);

export default router;
