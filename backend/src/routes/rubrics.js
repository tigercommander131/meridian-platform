import { Router } from 'express';
import { getRubric } from '../controllers/rubricsController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/:rubricId', authenticate, getRubric);

export default router;
