import { query } from '../config/database.js';

// CSV helpers -------------------------------------------------------------
function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers, rows) {
  const head = headers.map(csvCell).join(',');
  const body = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  return body ? `${head}\n${body}\n` : `${head}\n`;
}

// Confirms a cohort belongs to the caller's org; returns the cohort row or null.
async function cohortForOrg(cohortId, orgId) {
  const r = await query(
    `SELECT c.* FROM cohorts c
     JOIN courses co ON co.id = c.course_id
     WHERE c.id = $1 AND co.organisation_id = $2`,
    [cohortId, orgId]
  );
  return r.rows[0] || null;
}

async function recordExport(cohortId, type, format, fileSize) {
  const r = await query(
    `INSERT INTO exports (cohort_id, type, format, status, file_size, expires_at)
     VALUES ($1, $2, $3, 'completed', $4, NOW() + INTERVAL '30 days') RETURNING id`,
    [cohortId, type, format, fileSize]
  );
  return r.rows[0].id;
}

function sizeLabel(str) {
  const bytes = Buffer.byteLength(str, 'utf8');
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

// GET /api/cohorts/:cohortId/exports/scores.csv
// One row per rubric score in the cohort, with computed percentage.
export async function exportCohortScores(req, res, next) {
  try {
    const cohort = await cohortForOrg(req.params.cohortId, req.user.organisationId);
    if (!cohort) return res.status(404).json({ error: 'Cohort not found', code: 'NOT_FOUND', status: 404 });

    const scores = await query(
      `SELECT rs.id, rs.scores, rs.total_score, rs.state, rs.assessor_notes, rs.scored_at, rs.released_at,
              rs.rubric_id, l.first_name, l.last_name, l.email, l.external_id,
              s.scenario_id, s.scenario_name, p.role, r.name AS rubric_name
       FROM rubric_scores rs
       JOIN sessions s ON s.id = rs.session_id
       JOIN session_participants p ON p.id = rs.participant_id
       JOIN learners l ON l.id = rs.learner_id
       JOIN rubrics r ON r.id = rs.rubric_id
       WHERE s.cohort_id = $1
       ORDER BY l.last_name, s.scenario_id`,
      [req.params.cohortId]
    );

    // Max points per rubric (sum of criteria), cached.
    const maxCache = {};
    for (const row of scores.rows) {
      if (maxCache[row.rubric_id] === undefined) {
        const c = await query(`SELECT COALESCE(SUM(max_points),0) AS m FROM rubric_criteria WHERE rubric_id = $1`, [row.rubric_id]);
        maxCache[row.rubric_id] = Number(c.rows[0].m);
      }
    }

    const headers = ['Learner', 'Email', 'External ID', 'Scenario', 'Role', 'Rubric',
      'Total', 'Max', 'Percent', 'State', 'Scored', 'Released', 'Assessor notes'];
    const rows = scores.rows.map((row) => {
      const max = maxCache[row.rubric_id] || 0;
      const pct = max > 0 ? Math.round((row.total_score / max) * 100) : 0;
      return [
        `${row.first_name} ${row.last_name}`, row.email, row.external_id || '',
        row.scenario_name || row.scenario_id, row.role || '', row.rubric_name,
        row.total_score, max, `${pct}%`, row.state,
        row.scored_at ? new Date(row.scored_at).toISOString() : '',
        row.released_at ? new Date(row.released_at).toISOString() : '',
        row.assessor_notes || '',
      ];
    });

    const csv = toCsv(headers, rows);
    await recordExport(req.params.cohortId, 'full_course', 'csv', sizeLabel(csv));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cohort_scores_${req.params.cohortId}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

// GET /api/cohorts/:cohortId/exports/flight-recorder.csv
// Raw simulator events for every session in the cohort.
export async function exportFlightRecorder(req, res, next) {
  try {
    const cohort = await cohortForOrg(req.params.cohortId, req.user.organisationId);
    if (!cohort) return res.status(404).json({ error: 'Cohort not found', code: 'NOT_FOUND', status: 404 });

    const ev = await query(
      `SELECT fre.event_type, fre.timestamp, fre.parameters,
              s.scenario_id, l.first_name, l.last_name
       FROM flight_recorder_events fre
       JOIN sessions s ON s.id = fre.session_id
       LEFT JOIN session_participants p ON p.id = fre.participant_id
       LEFT JOIN learners l ON l.id = p.learner_id
       WHERE s.cohort_id = $1
       ORDER BY fre.timestamp`,
      [req.params.cohortId]
    );

    const headers = ['Scenario', 'Learner', 'Event', 'Timestamp', 'Parameters'];
    const rows = ev.rows.map((e) => [
      e.scenario_id,
      e.first_name ? `${e.first_name} ${e.last_name}` : '',
      e.event_type,
      e.timestamp ? new Date(e.timestamp).toISOString() : '',
      JSON.stringify(e.parameters || {}),
    ]);

    const csv = toCsv(headers, rows);
    await recordExport(req.params.cohortId, 'raw_data', 'csv', sizeLabel(csv));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="flight_recorder_${req.params.cohortId}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

// GET /api/cohorts/:cohortId/exports — history of export jobs.
export async function listExports(req, res, next) {
  try {
    const cohort = await cohortForOrg(req.params.cohortId, req.user.organisationId);
    if (!cohort) return res.status(404).json({ error: 'Cohort not found', code: 'NOT_FOUND', status: 404 });
    const r = await query(
      `SELECT id, type, format, status, file_size, created_at, expires_at
       FROM exports WHERE cohort_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.params.cohortId]
    );
    res.json({ exports: r.rows.map((e) => ({
      id: e.id, type: e.type, format: e.format, status: e.status,
      fileSize: e.file_size, createdAt: e.created_at, expiresAt: e.expires_at,
    })) });
  } catch (err) {
    next(err);
  }
}

// GET /api/cohorts/:cohortId/audit — recent score state changes across the cohort.
export async function cohortAudit(req, res, next) {
  try {
    const cohort = await cohortForOrg(req.params.cohortId, req.user.organisationId);
    if (!cohort) return res.status(404).json({ error: 'Cohort not found', code: 'NOT_FOUND', status: 404 });
    const r = await query(
      `SELECT a.action, a.from_state, a.to_state, a.actor_email, a.note, a.created_at,
              l.first_name, l.last_name
       FROM score_audit a
       JOIN rubric_scores rs ON rs.id = a.score_id
       JOIN sessions s ON s.id = rs.session_id
       JOIN learners l ON l.id = rs.learner_id
       WHERE s.cohort_id = $1
       ORDER BY a.created_at DESC LIMIT 50`,
      [req.params.cohortId]
    );
    res.json({ audit: r.rows.map((a) => ({
      action: a.action, fromState: a.from_state, toState: a.to_state,
      actor: a.actor_email, note: a.note, at: a.created_at,
      learnerName: `${a.first_name} ${a.last_name}`,
    })) });
  } catch (err) {
    next(err);
  }
}
