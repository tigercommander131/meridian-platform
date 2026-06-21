import { Router } from 'express';
import { createLearners, listLearners } from '../controllers/learnersController.js';
import { listCourses, createCourse, getCourse, updateCourse } from '../controllers/coursesController.js';
import { listAccreditation, createAccreditation, listCourseTypes, createCourseType } from '../controllers/accreditationController.js';
import { listInstructors, createInstructor } from '../controllers/instructorsController.js';
import { opsDashboard } from '../controllers/staffingController.js';
import { listUsers, createUser } from '../controllers/usersController.js';
import { getOrganisation, updateOrganisation } from '../controllers/organisationsController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const WRITE = ['admin', 'organisation_admin', 'course_operations_manager', 'course_coordinator', 'educator'];

const router = Router();

// Students (learners).
router.get('/:orgId/learners', authenticate, listLearners);
router.post('/:orgId/learners', authenticate, createLearners);

// Accreditation organisations + course types.
router.get('/:orgId/accreditation', authenticate, listAccreditation);
router.post('/:orgId/accreditation', authenticate, requireRole(...WRITE), createAccreditation);
router.get('/:orgId/course-types', authenticate, listCourseTypes);
router.post('/:orgId/course-types', authenticate, requireRole(...WRITE), createCourseType);

// Courses (operations).
router.get('/:orgId/courses', authenticate, listCourses);
router.post('/:orgId/courses', authenticate, requireRole(...WRITE), createCourse);
router.get('/:orgId/courses/:courseId', authenticate, getCourse);
router.put('/:orgId/courses/:courseId', authenticate, requireRole(...WRITE), updateCourse);

// Instructors.
router.get('/:orgId/instructors', authenticate, listInstructors);
router.post('/:orgId/instructors', authenticate, requireRole(...WRITE), createInstructor);

// Operations dashboard (courses needing attention).
router.get('/:orgId/dashboard', authenticate, opsDashboard);

// Organisation profile (settings).
router.get('/:orgId/profile', authenticate, getOrganisation);
router.put('/:orgId/profile', authenticate, requireRole('admin', 'organisation_admin'), updateOrganisation);

// Admin user management.
router.get('/:orgId/users', authenticate, requireRole('admin', 'organisation_admin'), listUsers);
router.post('/:orgId/users', authenticate, requireRole('admin', 'organisation_admin'), createUser);

export default router;
