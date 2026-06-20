import { query } from '../config/database.js';
import { broadcast } from '../realtime.js';
import { buildReport } from './reportsController.js';

const learnerId = (req) => req.user.sub;

// GET /api/student/me/sessions — the learner's sessions (timetable).
export async function mySessions(req, res, next) {
  try {
    const r = await query(
      `SELECT s.id, s.scenario_name, s.scenario_id, s.status, s.scheduled_start,
              p.id AS participant_id, p.role, p.checkin_status,
              co.name AS cohort_name, c.name AS course_name
       FROM session_participants p
       JOIN sessions s ON s.id = p.session_id
       JOIN cohorts co ON co.id = s.cohort_id
       JOIN courses c ON c.id = co.course_id
       WHERE p.learner_id = $1
       ORDER BY COALESCE(s.scheduled_start, s.created_at) DESC`,
      [learnerId(req)]
    );
    res.json({
      sessions: r.rows.map((s) => ({
        id: s.id,
        participantId: s.participant_id,
        scenario: s.scenario_name || s.scenario_id,
        status: s.status,
        scheduledStart: s.scheduled_start,
        role: s.role,
        checkinStatus: s.checkin_status,
        cohort: s.cohort_name,
        course: s.course_name,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/student/sessions/:sessionId/checkin — learner checks themselves in.
export async function selfCheckin(req, res, next) {
  try {
    const { sessionId } = req.params;
    const r = await query(
      `UPDATE session_participants
       SET checkin_status = 'checked_in', checkin_time = NOW(), checkin_method = 'self'
       WHERE session_id = $1 AND learner_id = $2
       RETURNING id, checkin_status, checkin_time`,
      [sessionId, learnerId(req)]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ error: 'You are not on this session roster', code: 'NOT_FOUND', status: 404 });
    }
    broadcast('participant.checkin', { sessionId, participantId: r.rows[0].id, self: true });
    res.json({ id: r.rows[0].id, checkinStatus: r.rows[0].checkin_status, checkinTime: r.rows[0].checkin_time });
  } catch (err) {
    next(err);
  }
}

// GET /api/student/me/results — released scores for the logged-in learner.
export async function myResults(req, res, next) {
  try {
    const report = await buildReport(learnerId(req));
    if (!report) return res.status(404).json({ error: 'Learner not found', code: 'NOT_FOUND', status: 404 });
    res.json(report);
  } catch (err) {
    next(err);
  }
}

// GET /api/student/me/certificates — issued certificates for the learner.
export async function myCertificates(req, res, next) {
  try {
    const r = await query(
      `SELECT ce.id, ce.title, ce.status, ce.verification_code, ce.issued_at, ce.expires_at,
              c.name AS course_name, o.name AS org_name, l.first_name, l.last_name
       FROM certificates ce
       JOIN learners l ON l.id = ce.learner_id
       JOIN organisations o ON o.id = ce.organisation_id
       LEFT JOIN courses c ON c.id = ce.course_id
       WHERE ce.learner_id = $1 AND ce.status = 'issued'
       ORDER BY ce.issued_at DESC`,
      [learnerId(req)]
    );
    res.json({
      certificates: r.rows.map((ce) => ({
        id: ce.id,
        title: ce.title,
        verificationCode: ce.verification_code,
        issuedAt: ce.issued_at,
        expiresAt: ce.expires_at,
        course: ce.course_name || null,
        organisation: ce.org_name,
        learnerName: `${ce.first_name} ${ce.last_name}`,
      })),
    });
  } catch (err) {
    next(err);
  }
}
