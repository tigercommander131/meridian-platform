import { Router } from 'express';
import { listRuleSets, createRuleSet } from '../controllers/accreditationController.js';
import {
  getInstructor, updateInstructor, addCredential,
  listAvailability, setAvailability, removeAvailability, addIcProgress,
} from '../controllers/instructorsController.js';
import { getStaffing, assignStaff, removeStaff, suggestCandidates } from '../controllers/staffingController.js';
import { sendInvitation } from '../controllers/invitationsController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

// Roles allowed to make operational writes.
const WRITE = ['admin', 'organisation_admin', 'course_operations_manager', 'course_coordinator', 'educator'];

const router = Router();

// Rule sets (versioned) per course type.
router.get('/course-types/:courseTypeId/rule-sets', authenticate, listRuleSets);
router.post('/course-types/:courseTypeId/rule-sets', authenticate, requireRole(...WRITE), createRuleSet);

// Instructor detail + profile + credentials.
router.get('/instructors/:instructorId', authenticate, getInstructor);
router.put('/instructors/:instructorId', authenticate, requireRole(...WRITE), updateInstructor);
router.post('/instructors/:instructorId/credentials', authenticate, requireRole(...WRITE), addCredential);

// Instructor availability (rostering).
router.get('/instructors/:instructorId/availability', authenticate, listAvailability);
router.post('/instructors/:instructorId/availability', authenticate, requireRole(...WRITE), setAvailability);
router.delete('/instructors/:instructorId/availability/:date', authenticate, requireRole(...WRITE), removeAvailability);

// IC1 / IC2 candidate pathway.
router.post('/instructors/:instructorId/ic-progress', authenticate, requireRole(...WRITE), addIcProgress);

// Course staffing + live compliance.
router.get('/courses/:courseId/staffing', authenticate, getStaffing);
router.get('/courses/:courseId/staffing/candidates', authenticate, suggestCandidates);
router.post('/courses/:courseId/staffing', authenticate, requireRole(...WRITE), assignStaff);
router.delete('/courses/:courseId/staffing/:staffingId', authenticate, requireRole(...WRITE), removeStaff);

// Invitation workflow (send / resend).
router.post('/courses/:courseId/staffing/:staffingId/invite', authenticate, requireRole(...WRITE), sendInvitation);

export default router;
