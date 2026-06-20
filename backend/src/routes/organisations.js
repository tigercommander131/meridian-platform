import { Router } from 'express';
import { createLearners, listLearners } from '../controllers/learnersController.js';
import { listCourses } from '../controllers/coursesController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/:orgId/learners', authenticate, listLearners);
router.post('/:orgId/learners', authenticate, createLearners);
router.get('/:orgId/courses', authenticate, listCourses);

export default router;
