import crypto from 'crypto';
import { query } from '../config/database.js';
import { config } from '../config/environment.js';
import { sendEmail, invitationTemplate, reminderTemplate } from '../services/emailService.js';
import { recomputeStatus } from './staffingController.js';

const ROLE_LABELS = {
  course_director: 'Course Director',
  medical_lead: 'Medical Lead',
  doctor: 'Doctor',
  instructor: 'Instructor',
  instructor_candidate: 'Instructor Candidate',
  assessor: 'Assessor',
};
const roleLabel = (v) => ROLE_LABELS[v] || v;

const genToken = () => crypto.randomBytes(24).toString('hex');

// Load a staffing assignment with course + instructor context, scoped to org.
async function loadAssignment(staffingId, courseId, orgId) {
  const r = await query(
    `SELECT cs.*, c.name AS course_name, c.start_date, c.organisation_id, c.region,
            i.first_name, i.last_name, i.email AS instructor_email
     FROM course_staffing cs
     JOIN courses c ON c.id = cs.course_id
     JOIN instructors i ON i.id = cs.instructor_id
     WHERE cs.id = $1 AND cs.course_id = $2 AND c.organisation_id = $3`,
    [staffingId, courseId, orgId]
  );
  return r.rows[0] || null;
}

// POST /api/courses/:courseId/staffing/:staffingId/invite  { message?, escalationTier? }
// Sends (or resends) an invitation email with a tokenised accept/decline link.
export async function sendInvitation(req, res, next) {
  try {
    const a = await loadAssignment(req.params.staffingId, req.params.courseId, req.user.organisationId);
    if (!a) return res.status(404).json({ error: 'Assignment not found', code: 'NOT_FOUND', status: 404 });

    const isResend = Boolean(a.invite_token);
    const token = a.invite_token || genToken();
    const { message, escalationTier } = req.body || {};

    await query(
      `UPDATE course_staffing SET
         invite_token = $1,
         invitation_status = 'invited',
         message = COALESCE($2, message),
         escalation_tier = COALESCE($3, escalation_tier),
         invited_at = COALESCE(invited_at, NOW()),
         reminder_count = reminder_count + $4,
         last_reminder_at = CASE WHEN $4 = 1 THEN NOW() ELSE last_reminder_at END
       WHERE id = $5`,
      [token, message ?? null, escalationTier ?? null, isResend ? 1 : 0, a.id]
    );

    const base = `${config.appUrl.replace(/\/$/, '')}/invite/${token}`;
    const tpl = (isResend ? reminderTemplate : invitationTemplate)({
      instructorName: a.first_name,
      courseName: a.course_name,
      roleLabel: roleLabel(a.role),
      startDate: a.start_date,
      message: message ?? a.message,
      acceptUrl: `${base}?r=accept`,
      declineUrl: `${base}?r=decline`,
    });

    let email = { ok: false, skipped: true };
    if (a.instructor_email) {
      email = await sendEmail({ to: a.instructor_email, ...tpl });
    }

    res.json({
      ok: true,
      resend: isResend,
      emailSent: email.ok && !email.skipped,
      emailSkipped: Boolean(email.skipped),
      noEmail: !a.instructor_email,
      link: base,
    });
  } catch (err) { next(err); }
}

// --- Public (no auth) ------------------------------------------------------

// GET /api/invitations/:token — public invitation view.
export async function getInvitation(req, res, next) {
  try {
    const r = await query(
      `SELECT cs.role, cs.invitation_status, cs.responded_at, cs.message,
              c.name AS course_name, c.start_date,
              ct.name AS course_type_name,
              i.first_name, i.last_name
       FROM course_staffing cs
       JOIN courses c ON c.id = cs.course_id
       LEFT JOIN course_types ct ON ct.id = c.course_type_id
       JOIN instructors i ON i.id = cs.instructor_id
       WHERE cs.invite_token = $1`,
      [req.params.token]
    );
    const a = r.rows[0];
    if (!a) return res.status(404).json({ error: 'Invitation not found', code: 'NOT_FOUND', status: 404 });
    res.json({
      instructorName: `${a.first_name} ${a.last_name}`,
      courseName: a.course_name,
      courseType: a.course_type_name,
      role: a.role,
      roleLabel: roleLabel(a.role),
      startDate: a.start_date,
      message: a.message,
      status: a.invitation_status,
      respondedAt: a.responded_at,
    });
  } catch (err) { next(err); }
}

// POST /api/invitations/:token/respond  { response: 'accept'|'decline', reason? }
export async function respondInvitation(req, res, next) {
  try {
    const { response, reason } = req.body || {};
    if (!['accept', 'decline'].includes(response)) {
      return res.status(400).json({ error: "response must be 'accept' or 'decline'", code: 'VALIDATION_ERROR', status: 400 });
    }
    const status = response === 'accept' ? 'accepted' : 'declined';
    const r = await query(
      `UPDATE course_staffing
       SET invitation_status = $1, responded_at = NOW(), decline_reason = $2
       WHERE invite_token = $3
       RETURNING course_id, role`,
      [status, response === 'decline' ? (reason || null) : null, req.params.token]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Invitation not found', code: 'NOT_FOUND', status: 404 });
    await recomputeStatus(r.rows[0].course_id);
    res.json({ ok: true, status });
  } catch (err) { next(err); }
}
