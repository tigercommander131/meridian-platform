import { getPool, query } from '../config/database.js';
import { broadcast } from '../realtime.js';

// Apply one offline event inside a transaction. Returns a per-event result.
async function applyEvent(client, event, user) {
  const { eventId, eventType, data = {} } = event;

  // Idempotency: already accepted this event_id → no-op success.
  const seen = await client.query('SELECT 1 FROM synced_events WHERE event_id = $1', [eventId]);
  if (seen.rowCount > 0) {
    return { eventId, status: 'synced', deduped: true };
  }

  switch (eventType) {
    case 'learners.upsert':
    case 'LearnerUpserted': {
      await client.query(
        `INSERT INTO learners (id, organisation_id, first_name, last_name, email)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE
           SET first_name = EXCLUDED.first_name,
               last_name  = EXCLUDED.last_name,
               email      = EXCLUDED.email`,
        [data.id, user.organisationId, data.first_name, data.last_name, data.email]
      );
      break;
    }

    case 'rubric_scores.upsert':
    case 'RubricScored': {
      // Conflict: the server already finalized this score (approved/released).
      const override = event.resolution === 'override';
      const existing = await client.query(
        `SELECT total_score, state FROM rubric_scores WHERE id = $1`,
        [data.id]
      );
      const row = existing.rows[0];
      if (row && (row.state === 'approved' || row.state === 'released') && row.total_score !== data.total_score && !override) {
        return {
          eventId,
          status: 'conflict',
          conflictType: 'RubricScoreUpdated',
          scoreId: data.id,
          serverVersion: { state: row.state, totalScore: row.total_score },
          clientVersion: { state: data.state, totalScore: data.total_score },
          resolution: 'manual_review_required',
        };
      }
      // An accepted override of a finalized score is recorded in the audit trail.
      if (override && row) {
        await client.query(
          `INSERT INTO score_audit (score_id, action, from_state, to_state, actor_id, actor_email, note)
           VALUES ($1, 'override', $2, $3, $4, $5, $6)`,
          [data.id, row.state, data.state || 'pending_approval', user.sub, user.email, 'Offline edit forced over server version on sync']
        );
      }
      await client.query(
        `INSERT INTO rubric_scores
           (id, session_id, participant_id, learner_id, rubric_id, scores, total_score, assessor_notes, state, scored_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, NOW()))
         ON CONFLICT (id) DO UPDATE
           SET scores = EXCLUDED.scores,
               total_score = EXCLUDED.total_score,
               assessor_notes = EXCLUDED.assessor_notes,
               state = EXCLUDED.state`,
        [
          data.id, data.session_id, data.participant_id, data.learner_id, data.rubric_id,
          JSON.stringify(data.scores || {}), data.total_score, data.assessor_notes,
          data.state || 'pending_approval', data.scored_at,
        ]
      );
      break;
    }

    default:
      // Unknown type — accept and log it, but apply nothing to domain tables.
      break;
  }

  // Record acceptance for idempotency.
  await client.query(
    `INSERT INTO synced_events (event_id, event_type, payload, user_id)
     VALUES ($1, $2, $3, $4)`,
    [eventId, eventType, JSON.stringify(data), user.sub]
  );

  return { eventId, status: 'synced' };
}

export async function sync(req, res, next) {
  try {
    const { events } = req.body;
    if (!Array.isArray(events)) {
      return res.status(400).json({
        error: 'events must be an array',
        code: 'VALIDATION_ERROR',
        status: 400,
      });
    }

    const results = [];
    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    for (const event of events) {
      const client = await getPool().connect();
      try {
        await client.query('BEGIN');
        const result = await applyEvent(client, event, req.user);
        if (result.status === 'conflict') {
          await client.query('ROLLBACK');
          conflicts++;
        } else {
          await client.query('COMMIT');
          synced++;
        }
        results.push(result);
      } catch (err) {
        await client.query('ROLLBACK');
        failed++;
        results.push({ eventId: event.eventId, status: 'failed', reason: err.message });
      } finally {
        client.release();
      }
    }

    // Notify connected clients about what just landed, so other instructors'
    // screens update live (e.g. a score or check-in done elsewhere).
    if (synced > 0) {
      broadcast('events.synced', {
        count: synced,
        types: results.filter((r) => r.status === 'synced').map((r) => r.eventId),
        by: req.user.email || req.user.sub,
      });
    }

    res.json({ synced, failed, conflicts, events: results });
  } catch (err) {
    next(err);
  }
}

// Debug helper: how many events this user has synced.
export async function syncStatus(req, res, next) {
  try {
    const r = await query('SELECT COUNT(*)::int AS total FROM synced_events WHERE user_id = $1', [req.user.sub]);
    res.json({ totalSynced: r.rows[0].total });
  } catch (err) {
    next(err);
  }
}
