import { query } from '../config/database.js';
import { broadcast } from '../realtime.js';

async function loadRubricWithCriteria(rubricId, orgId) {
  const rub = await query(`SELECT * FROM rubrics WHERE id = $1 AND organisation_id = $2`, [rubricId, orgId]);
  if (rub.rowCount === 0) return null;
  const crit = await query(`SELECT * FROM rubric_criteria WHERE rubric_id = $1 ORDER BY ordering`, [rubricId]);
  return {
    id: rub.rows[0].id,
    name: rub.rows[0].name,
    scenarioId: rub.rows[0].scenario_id,
    role: rub.rows[0].role,
    version: rub.rows[0].version,
    maxScore: rub.rows[0].max_score,
    criteria: crit.rows.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      maxPoints: c.max_points,
      evidenceField: c.evidence_field,
      order: c.ordering,
    })),
  };
}

// GET /api/rubrics/:rubricId
export async function getRubric(req, res, next) {
  try {
    const rubric = await loadRubricWithCriteria(req.params.rubricId, req.user.organisationId);
    if (!rubric) return res.status(404).json({ error: 'Rubric not found', code: 'NOT_FOUND', status: 404 });
    res.json(rubric);
  } catch (err) {
    next(err);
  }
}

// GET /api/sessions/:sessionId/participants/:participantId/scoring-context
// Resolves the right rubric (by scenario + role) and the participant's flight
// recorder evidence in one call for the scoring UI.
export async function scoringContext(req, res, next) {
  try {
    const { sessionId, participantId } = req.params;

    const partRes = await query(
      `SELECT p.*, l.first_name, l.last_name, s.scenario_id
       FROM session_participants p
       JOIN learners l ON l.id = p.learner_id
       JOIN sessions s ON s.id = p.session_id
       WHERE p.id = $1 AND p.session_id = $2`,
      [participantId, sessionId]
    );
    const part = partRes.rows[0];
    if (!part) return res.status(404).json({ error: 'Participant not found', code: 'NOT_FOUND', status: 404 });

    // Best-matching rubric: scenario + role, else scenario only.
    let rubricRes = await query(
      `SELECT id FROM rubrics WHERE organisation_id = $1 AND scenario_id = $2 AND role = $3 LIMIT 1`,
      [req.user.organisationId, part.scenario_id, part.role]
    );
    if (rubricRes.rowCount === 0) {
      rubricRes = await query(
        `SELECT id FROM rubrics WHERE organisation_id = $1 AND scenario_id = $2 LIMIT 1`,
        [req.user.organisationId, part.scenario_id]
      );
    }
    const rubric = rubricRes.rowCount > 0
      ? await loadRubricWithCriteria(rubricRes.rows[0].id, req.user.organisationId)
      : null;

    const events = await query(
      `SELECT event_type, parameters, timestamp FROM flight_recorder_events
       WHERE session_id = $1 AND participant_id = $2 ORDER BY timestamp`,
      [sessionId, participantId]
    );

    // Flatten event parameters into an evidence map for quick lookup by the UI.
    const evidence = {};
    for (const e of events.rows) {
      for (const [k, v] of Object.entries(e.parameters || {})) {
        evidence[`flightRecorder.${k}`] = v;
      }
    }

    res.json({
      participant: {
        id: part.id,
        learnerName: `${part.first_name} ${part.last_name}`,
        role: part.role,
      },
      rubric,
      evidence,
      events: events.rows.map((e) => ({ eventType: e.event_type, parameters: e.parameters, timestamp: e.timestamp })),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/sessions/:sessionId/participants/:participantId/rubric-scores
export async function submitScore(req, res, next) {
  try {
    const { sessionId, participantId } = req.params;
    const { rubricId, scores = {}, assessorNotes } = req.body;
    if (!rubricId) return res.status(400).json({ error: 'rubricId is required', code: 'VALIDATION_ERROR', status: 400 });

    const part = await query(
      `SELECT learner_id FROM session_participants WHERE id = $1 AND session_id = $2`,
      [participantId, sessionId]
    );
    if (part.rowCount === 0) return res.status(404).json({ error: 'Participant not found', code: 'NOT_FOUND', status: 404 });

    // Total = sum of awarded points.
    const total = Object.values(scores).reduce((sum, s) => sum + (Number(s.points) || 0), 0);

    const r = await query(
      `INSERT INTO rubric_scores
         (session_id, participant_id, learner_id, rubric_id, scores, total_score, assessor_notes, assessor_id, state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_approval') RETURNING *`,
      [sessionId, participantId, part.rows[0].learner_id, rubricId, JSON.stringify(scores), total, assessorNotes || null, req.user.sub]
    );

    broadcast('score.submitted', { sessionId, participantId, totalScore: total, by: req.user.email });
    res.status(201).json({
      id: r.rows[0].id,
      participantId,
      totalScore: total,
      state: 'pending_approval',
      scoredAt: r.rows[0].scored_at,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/sessions/:sessionId/rubric-scores
export async function listSessionScores(req, res, next) {
  try {
    const r = await query(
      `SELECT rs.*, l.first_name, l.last_name, p.role
       FROM rubric_scores rs
       JOIN learners l ON l.id = rs.learner_id
       JOIN session_participants p ON p.id = rs.participant_id
       WHERE rs.session_id = $1 ORDER BY rs.scored_at DESC`,
      [req.params.sessionId]
    );
    res.json({
      scores: r.rows.map((s) => ({
        id: s.id,
        participantId: s.participant_id,
        learnerName: `${s.first_name} ${s.last_name}`,
        role: s.role,
        totalScore: s.total_score,
        state: s.state,
      })),
    });
  } catch (err) {
    next(err);
  }
}
