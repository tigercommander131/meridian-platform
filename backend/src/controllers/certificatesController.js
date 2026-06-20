import crypto from 'crypto';
import { query } from '../config/database.js';

function certDTO(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    verificationCode: row.verification_code,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    course: row.course_name || null,
    learnerName: row.first_name ? `${row.first_name} ${row.last_name}` : undefined,
  };
}

// POST /api/learners/:learnerId/certificates  (staff: educator/admin)
export async function issueCertificate(req, res, next) {
  try {
    const { learnerId } = req.params;
    const { courseId, title, expiresAt } = req.body;

    const l = await query(
      `SELECT id, first_name, last_name FROM learners WHERE id = $1 AND organisation_id = $2`,
      [learnerId, req.user.organisationId]
    );
    if (l.rowCount === 0) return res.status(404).json({ error: 'Learner not found', code: 'NOT_FOUND', status: 404 });

    let courseName = null;
    if (courseId) {
      const c = await query(`SELECT name FROM courses WHERE id = $1 AND organisation_id = $2`, [courseId, req.user.organisationId]);
      if (c.rowCount === 0) return res.status(400).json({ error: 'Course not found in your organisation', code: 'VALIDATION_ERROR', status: 400 });
      courseName = c.rows[0].name;
    }

    const certTitle = (title && title.trim())
      || (courseName ? `Certificate of Completion — ${courseName}` : 'Certificate of Completion');
    const code = crypto.randomBytes(9).toString('hex');

    const r = await query(
      `INSERT INTO certificates (organisation_id, learner_id, course_id, title, verification_code, issued_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.organisationId, learnerId, courseId || null, certTitle, code, req.user.sub, expiresAt || null]
    );
    res.status(201).json(certDTO({ ...r.rows[0], course_name: courseName, first_name: l.rows[0].first_name, last_name: l.rows[0].last_name }));
  } catch (err) {
    next(err);
  }
}

// GET /api/learners/:learnerId/certificates  (staff)
export async function listLearnerCertificates(req, res, next) {
  try {
    const { learnerId } = req.params;
    const r = await query(
      `SELECT ce.*, c.name AS course_name
       FROM certificates ce LEFT JOIN courses c ON c.id = ce.course_id
       WHERE ce.learner_id = $1 AND ce.organisation_id = $2
       ORDER BY ce.issued_at DESC`,
      [learnerId, req.user.organisationId]
    );
    res.json({ certificates: r.rows.map(certDTO) });
  } catch (err) {
    next(err);
  }
}

// GET /api/verify/:code  (PUBLIC — anyone can verify a certificate's validity)
export async function verifyCertificate(req, res, next) {
  try {
    const r = await query(
      `SELECT ce.title, ce.status, ce.issued_at, ce.expires_at, c.name AS course_name,
              l.first_name, l.last_name, o.name AS org_name
       FROM certificates ce
       JOIN learners l ON l.id = ce.learner_id
       JOIN organisations o ON o.id = ce.organisation_id
       LEFT JOIN courses c ON c.id = ce.course_id
       WHERE ce.verification_code = $1`,
      [req.params.code]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ valid: false, error: 'Certificate not found', code: 'NOT_FOUND', status: 404 });
    }
    const c = r.rows[0];
    const expired = c.expires_at && new Date(c.expires_at) < new Date();
    res.json({
      valid: c.status === 'issued' && !expired,
      certificate: {
        title: c.title,
        status: expired ? 'expired' : c.status,
        learnerName: `${c.first_name} ${c.last_name}`,
        course: c.course_name || null,
        organisation: c.org_name,
        issuedAt: c.issued_at,
        expiresAt: c.expires_at,
      },
    });
  } catch (err) {
    next(err);
  }
}
