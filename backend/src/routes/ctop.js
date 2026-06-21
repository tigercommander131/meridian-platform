import { Router } from 'express';
import { listRuleSets, createRuleSet } from '../controllers/accreditationController.js';
import { getInstructor, addCredential } from '../controllers/instructorsController.js';
import { getStaffing, assignStaff, removeStaff } from '../controllers/staffingController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

// Roles allowed to make operational writes.
const WRITE = ['admin', 'organisation_admin', 'course_operations_manager', 'course_coordinator', 'educator'];

const router = Router();

// Rule sets (versioned) per course type.
router.get('/course-types/:courseTypeId/rule-sets', authenticate, listRuleSets);
router.post('/course-types/:courseTypeId/rule-sets', authenticate, requireRole(...WRITE), createRuleSet);

// Instructor detail + credentials.
router.get('/instructors/:instructorId', authenticate, getInstructor);
router.post('/instructors/:instructorId/credentials', authenticate, requireRole(...WRITE), addCredential);

// Course staffing + live compliance.
router.get('/courses/:courseId/staffing', authenticate, getStaffing);
router.post('/courses/:courseId/staffing', authenticate, requireRole(...WRITE), assignStaff);
router.delete('/courses/:courseId/staffing/:staffingId', authenticate, requireRole(...WRITE), removeStaff);

export default router;
