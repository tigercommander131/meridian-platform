import { Router } from 'express';
import { createLearners, listLearners } from '../controllers/learnersController.js';
import { listCourses, createCourse, getCourse, updateCourse } from '../controllers/coursesController.js';
import { listScenarios } from '../controllers/rubricsController.js';
import { listUsers, createUser } from '../controllers/usersController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/:orgId/learners', authenticate, listLearners);
router.post('/:orgId/learners', authenticate, createLearners);
router.get('/:orgId/scenarios', authenticate, listScenarios);
router.get('/:orgId/courses', authenticate, listCourses);
router.post('/:orgId/courses', authenticate, requireRole('educator', 'admin'), createCourse);
router.get('/:orgId/courses/:courseId', authenticate, getCourse);
router.put('/:orgId/courses/:courseId', authenticate, requireRole('educator', 'admin'), updateCourse);

// Admin user management
router.get('/:orgId/users', authenticate, requireRole('admin'), listUsers);
router.post('/:orgId/users', authenticate, requireRole('admin'), createUser);

export default router;
