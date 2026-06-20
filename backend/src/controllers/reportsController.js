import { query } from '../config/database.js';

// GET /api/learners/:learnerId/report
// Aggregates a learner's RELEASED rubric scores into a candidate report:
// per-scenario results with criterion-level breakdown + an overall summary.
export async function learnerReport(req, res, next) {
  try {
    const { learnerId } = req.params;

    const learnerRes = await query(
      `SELECT id, first_name, last_name, email, external_id
       FROM learners WHERE id = $1 AND organisation_id = $2`,
      [learnerId, req.user.organisationId]
    );
    const learner = learnerRes.rows[0];
    if (!learner) return res.status(404).json({ error: 'Learner not found', code: 'NOT_FOUND', status: 404 });

    const scoreRes = await query(
      `SELECT rs.id, rs.session_id, rs.rubric_id, rs.scores, rs.total_score, rs.state,
              rs.assessor_notes, rs.released_at, rs.scored_at,
              s.scenario_id, s.scenario_name, p.role, r.name AS rubric_name
       FROM rubric_scores rs
       JOIN sessions s ON s.id = rs.session_id
       JOIN session_participants p ON p.id = rs.participant_id
       JOIN rubrics r ON r.id = rs.rubric_id
       WHERE rs.learner_id = $1 AND rs.state = 'released'
       ORDER BY rs.released_at DESC NULLS LAST`,
      [learnerId]
    );

    // Criteria per rubric (cached so repeated rubrics don't re-query).
    const critCache = {};
    async function criteriaFor(rubricId) {
      if (!critCache[rubricId]) {
        const c = await query(
          `SELECT id, name, max_points, ordering FROM rubric_criteria WHERE rubric_id = $1 ORDER BY ordering`,
          [rubricId]
        );
        critCache[rubricId] = c.rows;
      }
      return critCache[rubricId];
    }

    const results = [];
    let percentSum = 0;
    for (const row of scoreRes.rows) {
      const crit = await criteriaFor(row.rubric_id);
      const maxPoints = crit.reduce((sum, c) => sum + c.max_points, 0);
      const breakdown = crit.map((c) => {
        const entry = (row.scores || {})[c.id] || {};
        return {
          name: c.name,
          points: Number(entry.points) || 0,
          maxPoints: c.max_points,
          notes: entry.notes || null,
        };
      });
      const percent = maxPoints > 0 ? Math.round((row.total_score / maxPoints) * 100) : 0;
      percentSum += percent;
      results.push({
        scoreId: row.id,
        sessionId: row.session_id,
        scenarioId: row.scenario_id,
        scenarioName: row.scenario_name || row.scenario_id,
        role: row.role,
        rubricName: row.rubric_name,
        total: row.total_score,
        maxPoints,
        percent,
        assessorNotes: row.assessor_notes,
        releasedAt: row.released_at,
        criteria: breakdown,
      });
    }

    res.json({
      learner: {
        id: learner.id,
        name: `${learner.first_name} ${learner.last_name}`,
        email: learner.email,
        externalId: learner.external_id,
      },
      summary: {
        assessed: results.length,
        averagePercent: results.length ? Math.round(percentSum / results.length) : 0,
      },
      results,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
