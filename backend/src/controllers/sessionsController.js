import { getPool, query } from '../config/database.js';
import { broadcast } from '../realtime.js';

async function loadSessionForOrg(sessionId, orgId) {
  const r = await query(
    `SELECT s.*, co.organisation_id
     FROM sessions s
     JOIN cohorts c ON c.id = s.cohort_id
     JOIN courses co ON co.id = c.course_id
     WHERE s.id = $1`,
    [sessionId]
  );
  const row = r.rows[0];
  if (!row || row.organisation_id !== orgId) return null;
  return row;
}

// POST /api/cohorts/:cohortId/sessions — create + auto-roster from the cohort.
export async function createSession(req, res, next) {
  try {
    const cohortId = req.params.cohortId;
    const { scenarioId, scenarioName, scheduledStart, instructorId, maxParticipants } = req.body;
    if (!scenarioId) {
      return res.status(400).json({ error: 'scenarioId is required', code: 'VALIDATION_ERROR', status: 400 });
    }

    const cohort = await query(
      `SELECT c.id FROM cohorts c JOIN courses co ON co.id = c.course_id
       WHERE c.id = $1 AND co.organisation_id = $2`,
      [cohortId, req.user.organisationId]
    );
    if (cohort.rowCount === 0) {
      return res.status(404).json({ error: 'Cohort not found', code: 'NOT_FOUND', status: 404 });
    }

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const sRes = await client.query(
        `INSERT INTO sessions (cohort_id, scenario_id, scenario_name, instructor_id, status, scheduled_start, max_participants)
         VALUES ($1, $2, $3, $4, 'created', $5, $6) RETURNING *`,
        [cohortId, scenarioId, scenarioName || null, instructorId || req.user.sub, scheduledStart || null, maxParticipants || 24]
      );
      const session = sRes.rows[0];
      await client.query(`UPDATE sessions SET qr_code = $1 WHERE id = $2`, [`SESSION_${session.id}`, session.id]);

      // Pre-create participants from the cohort roster.
      await client.query(
        `INSERT INTO session_participants (session_id, learner_id)
         SELECT $1, learner_id FROM cohort_learners WHERE cohort_id = $2`,
        [session.id, cohortId]
      );
      await client.query('COMMIT');

      broadcast('session.created', { sessionId: session.id, by: req.user.email });
      res.status(201).json({ id: session.id, cohortId, scenarioId, status: 'created', qrCode: `SESSION_${session.id}` });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
}

// GET /api/cohorts/:cohortId/sessions — list sessions for a cohort.
export async function listCohortSessions(req, res, next) {
  try {
    const r = await query(
      `SELECT s.*,
        (SELECT COUNT(*)::int FROM session_participants p WHERE p.session_id = s.id AND p.checkin_status = 'checked_in') AS checked_in,
        (SELECT COUNT(*)::int FROM session_participants p WHERE p.session_id = s.id) AS total
       FROM sessions s
       JOIN cohorts c ON c.id = s.cohort_id
       JOIN courses co ON co.id = c.course_id
       WHERE s.cohort_id = $1 AND co.organisation_id = $2
       ORDER BY s.created_at DESC`,
      [req.params.cohortId, req.user.organisationId]
    );
    res.json({
      sessions: r.rows.map((s) => ({
        id: s.id,
        scenarioId: s.scenario_id,
        scenarioName: s.scenario_name,
        status: s.status,
        checkedIn: s.checked_in,
        total: s.total,
        created_at: s.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/sessions/:sessionId — detail + roster.
export async function getSession(req, res, next) {
  try {
    const session = await loadSessionForOrg(req.params.sessionId, req.user.organisationId);
    if (!session) return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND', status: 404 });

    const parts = await query(
      `SELECT p.*, l.first_name, l.last_name
       FROM session_participants p JOIN learners l ON l.id = p.learner_id
       WHERE p.session_id = $1 ORDER BY l.last_name`,
      [session.id]
    );
    const evCount = await query(`SELECT COUNT(*)::int AS n FROM flight_recorder_events WHERE session_id = $1`, [session.id]);

    res.json({
      id: session.id,
      cohortId: session.cohort_id,
      scenarioId: session.scenario_id,
      scenarioName: session.scenario_name,
      status: session.status,
      actualStart: session.actual_start,
      actualEnd: session.actual_end,
      participants: parts.rows.map((p) => ({
        id: p.id,
        learnerId: p.learner_id,
        learnerName: `${p.first_name} ${p.last_name}`,
        role: p.role,
        checkinStatus: p.checkin_status,
        checkinTime: p.checkin_time,
        checkinMethod: p.checkin_method,
      })),
      flightRecorderEventCount: evCount.rows[0].n,
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/sessions/:sessionId/participants/:participantId/checkin
export async function checkin(req, res, next) {
  try {
    const session = await loadSessionForOrg(req.params.sessionId, req.user.organisationId);
    if (!session) return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND', status: 404 });
    if (session.status !== 'created') {
      return res.status(409).json({ error: 'Roster is frozen (session started)', code: 'CONFLICT', status: 409 });
    }

    const r = await query(
      `UPDATE session_participants
       SET checkin_status = 'checked_in', checkin_time = NOW(), checkin_method = $1
       WHERE id = $2 AND session_id = $3 RETURNING *`,
      [req.body.method || 'manual', req.params.participantId, session.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Participant not found', code: 'NOT_FOUND', status: 404 });

    broadcast('participant.checkin', { sessionId: session.id, participantId: req.params.participantId });
    const p = r.rows[0];
    res.json({ id: p.id, checkinStatus: p.checkin_status, checkinTime: p.checkin_time, checkinMethod: p.checkin_method });
  } catch (err) {
    next(err);
  }
}

// PUT /api/sessions/:sessionId/participants/:participantId/role
export async function assignRole(req, res, next) {
  try {
    const session = await loadSessionForOrg(req.params.sessionId, req.user.organisationId);
    if (!session) return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND', status: 404 });

    const r = await query(
      `UPDATE session_participants SET role = $1 WHERE id = $2 AND session_id = $3 RETURNING *`,
      [req.body.role || null, req.params.participantId, session.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Participant not found', code: 'NOT_FOUND', status: 404 });

    broadcast('participant.role', { sessionId: session.id, participantId: req.params.participantId, role: req.body.role });
    res.json({ id: r.rows[0].id, role: r.rows[0].role });
  } catch (err) {
    next(err);
  }
}

// POST /api/sessions/:sessionId/start  and  /end
export async function startSession(req, res, next) {
  try {
    const session = await loadSessionForOrg(req.params.sessionId, req.user.organisationId);
    if (!session) return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND', status: 404 });

    const r = await query(
      `UPDATE sessions SET status = 'active', actual_start = NOW() WHERE id = $1 RETURNING *`,
      [session.id]
    );
    broadcast('session.started', { sessionId: session.id });
    res.json({ id: session.id, status: 'active', actualStart: r.rows[0].actual_start, flightRecorderActive: true });
  } catch (err) {
    next(err);
  }
}

export async function endSession(req, res, next) {
  try {
    const session = await loadSessionForOrg(req.params.sessionId, req.user.organisationId);
    if (!session) return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND', status: 404 });

    const r = await query(
      `UPDATE sessions SET status = 'completed', actual_end = NOW() WHERE id = $1 RETURNING *`,
      [session.id]
    );
    const evCount = await query(`SELECT COUNT(*)::int AS n FROM flight_recorder_events WHERE session_id = $1`, [session.id]);
    broadcast('session.ended', { sessionId: session.id });
    res.json({ id: session.id, status: 'completed', actualEnd: r.rows[0].actual_end, eventCount: evCount.rows[0].n });
  } catch (err) {
    next(err);
  }
}

// POST /api/sessions/:sessionId/flight-recorder-events — ingest from simulator.
export async function ingestEvent(req, res, next) {
  try {
    const { participantId, eventType, timestamp, parameters } = req.body;
    if (!eventType) return res.status(400).json({ error: 'eventType is required', code: 'VALIDATION_ERROR', status: 400 });

    const r = await query(
      `INSERT INTO flight_recorder_events (session_id, participant_id, event_type, timestamp, parameters)
       VALUES ($1, $2, $3, COALESCE($4, NOW()), $5) RETURNING *`,
      [req.params.sessionId, participantId || null, eventType, timestamp || null, JSON.stringify(parameters || {})]
    );
    res.status(201).json({ id: r.rows[0].id, eventType, received_at: r.rows[0].received_at });
  } catch (err) {
    next(err);
  }
}

// GET /api/sessions/:sessionId/participants/:participantId/flight-recorder-events
export async function getParticipantEvents(req, res, next) {
  try {
    const r = await query(
      `SELECT * FROM flight_recorder_events
       WHERE session_id = $1 AND participant_id = $2 ORDER BY timestamp`,
      [req.params.sessionId, req.params.participantId]
    );
    res.json({
      events: r.rows.map((e) => ({ id: e.id, eventType: e.event_type, timestamp: e.timestamp, parameters: e.parameters })),
      eventCount: r.rows.length,
    });
  } catch (err) {
    next(err);
  }
}
