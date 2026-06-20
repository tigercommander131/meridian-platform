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

    await writeAudit(r.rows[0].id, 'submitted', null, 'pending_approval', req.user, assessorNotes);

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

// ---------------------------------------------------------------------------
// Approval workflow (Week 11)
// State machine:
//   pending_approval --approve--> approved --release--> released
//   {approved, released} --dispute--> disputed --reopen--> pending_approval
// Every transition is recorded in score_audit (immutable trail).
// ---------------------------------------------------------------------------

const TRANSITIONS = {
  approve: { from: ['pending_approval', 'disputed'], to: 'approved', audit: 'approved' },
  release: { from: ['approved'], to: 'released', audit: 'released' },
  dispute: { from: ['approved', 'released'], to: 'disputed', audit: 'disputed' },
  reopen: { from: ['disputed'], to: 'pending_approval', audit: 'reopened' },
};

async function writeAudit(scoreId, action, fromState, toState, user, note) {
  await query(
    `INSERT INTO score_audit (score_id, action, from_state, to_state, actor_id, actor_email, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [scoreId, action, fromState, toState, user.sub, user.email, note || null]
  );
}

// Loads a score scoped to the caller's org (via learner), or null.
async function loadScoreForOrg(scoreId, orgId) {
  const r = await query(
    `SELECT rs.* FROM rubric_scores rs
     JOIN learners l ON l.id = rs.learner_id
     WHERE rs.id = $1 AND l.organisation_id = $2`,
    [scoreId, orgId]
  );
  return r.rows[0] || null;
}

// Builds a PUT handler for one transition.
function makeTransition(action) {
  const def = TRANSITIONS[action];
  return async function transitionHandler(req, res, next) {
    try {
      const score = await loadScoreForOrg(req.params.scoreId, req.user.organisationId);
      if (!score) return res.status(404).json({ error: 'Score not found', code: 'NOT_FOUND', status: 404 });

      if (!def.from.includes(score.state)) {
        return res.status(409).json({
          error: `Cannot ${action} a score in state '${score.state}'`,
          code: 'INVALID_TRANSITION',
          status: 409,
          details: { currentState: score.state, allowedFrom: def.from },
        });
      }

      const note = req.body?.reason || req.body?.note || null;
      if (action === 'dispute' && !note) {
        return res.status(400).json({ error: 'A reason is required to dispute a score', code: 'VALIDATION_ERROR', status: 400 });
      }

      // Stamp the relevant audit columns per action.
      const stamps = {
        approve: `approved_by = $2, approved_at = NOW()`,
        release: `released_by = $2, released_at = NOW()`,
        dispute: `disputed_by = $2, disputed_at = NOW(), dispute_reason = $3`,
        reopen: `dispute_reason = NULL, disputed_by = NULL, disputed_at = NULL`,
      }[action];

      const params = action === 'dispute'
        ? [def.to, req.user.sub, note, score.id]
        : action === 'reopen'
          ? [def.to, score.id]
          : [def.to, req.user.sub, score.id];
      const idParam = action === 'dispute' ? '$4' : action === 'reopen' ? '$2' : '$3';

      const upd = await query(
        `UPDATE rubric_scores SET state = $1, ${stamps} WHERE id = ${idParam} RETURNING *`,
        params
      );

      await writeAudit(score.id, def.audit, score.state, def.to, req.user, note);

      broadcast('score.' + def.audit, {
        scoreId: score.id, sessionId: score.session_id, state: def.to, by: req.user.email,
      });

      res.json({ id: score.id, state: def.to, previousState: score.state });
    } catch (err) {
      next(err);
    }
  };
}

export const approveScore = makeTransition('approve');
export const releaseScore = makeTransition('release');
export const disputeScore = makeTransition('dispute');
export const reopenScore = makeTransition('reopen');

// GET /api/rubric-scores/:scoreId — full detail incl. audit trail, for the
// approval UI.
export async function getScoreDetail(req, res, next) {
  try {
    const score = await loadScoreForOrg(req.params.scoreId, req.user.organisationId);
    if (!score) return res.status(404).json({ error: 'Score not found', code: 'NOT_FOUND', status: 404 });

    const meta = await query(
      `SELECT l.first_name, l.last_name, p.role, r.name AS rubric_name
       FROM rubric_scores rs
       JOIN learners l ON l.id = rs.learner_id
       JOIN session_participants p ON p.id = rs.participant_id
       JOIN rubrics r ON r.id = rs.rubric_id
       WHERE rs.id = $1`,
      [score.id]
    );
    const audit = await query(
      `SELECT action, from_state, to_state, actor_email, note, created_at
       FROM score_audit WHERE score_id = $1 ORDER BY created_at ASC`,
      [score.id]
    );
    const m = meta.rows[0] || {};
    res.json({
      id: score.id,
      sessionId: score.session_id,
      participantId: score.participant_id,
      learnerName: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
      role: m.role,
      rubricName: m.rubric_name,
      scores: score.scores,
      totalScore: score.total_score,
      assessorNotes: score.assessor_notes,
      state: score.state,
      disputeReason: score.dispute_reason,
      scoredAt: score.scored_at,
      approvedAt: score.approved_at,
      releasedAt: score.released_at,
      audit: audit.rows.map((a) => ({
        action: a.action,
        fromState: a.from_state,
        toState: a.to_state,
        actor: a.actor_email,
        note: a.note,
        at: a.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}
