import { Router } from 'express';
import { createLearners, listLearners } from '../controllers/learnersController.js';
import { listCourses } from '../controllers/coursesController.js';
import { listUsers, createUser } from '../controllers/usersController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/:orgId/learners', authenticate, listLearners);
router.post('/:orgId/learners', authenticate, createLearners);
router.get('/:orgId/courses', authenticate, listCourses);

// Admin user management
router.get('/:orgId/users', authenticate, requireRole('admin'), listUsers);
router.post('/:orgId/users', authenticate, requireRole('admin'), createUser);

export default router;
