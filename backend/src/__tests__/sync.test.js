import request from 'supertest';
import { createApp } from '../app.js';
import { getPool, query } from '../config/database.js';

const app = createApp();
let token;

async function login() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'instructor@parasol.edu.au', password: 'password' });
  return res.body.token;
}

// Build a finalized (approved) rubric score so we can provoke a conflict.
async function seedApprovedScore() {
  // clean in reverse FK order, then recreate deterministically
  await query(`DELETE FROM rubric_scores WHERE id = 'score_sync_conflict'`);
  await query(`DELETE FROM session_participants WHERE id = 'participant_sync_test'`);
  await query(`DELETE FROM sessions WHERE id = 'session_sync_test'`);
  await query(`DELETE FROM cohorts WHERE id = 'cohort_sync_test'`);
  await query(`DELETE FROM courses WHERE id = 'course_sync_test'`);

  await query(
    `INSERT INTO courses (id, organisation_id, name) VALUES ('course_sync_test', 'parasol-emt', 'Sync Test Course')`
  );
  await query(
    `INSERT INTO cohorts (id, course_id, name) VALUES ('cohort_sync_test', 'course_sync_test', 'Sync Test Cohort')`
  );
  await query(
    `INSERT INTO sessions (id, cohort_id, scenario_id, status) VALUES ('session_sync_test', 'cohort_sync_test', 'scenario_vf_adult', 'completed')`
  );
  await query(
    `INSERT INTO session_participants (id, session_id, learner_id) VALUES ('participant_sync_test', 'session_sync_test', 'learner_001')`
  );
  await query(
    `INSERT INTO rubric_scores (id, session_id, participant_id, learner_id, rubric_id, total_score, state)
     VALUES ('score_sync_conflict', 'session_sync_test', 'participant_sync_test', 'learner_001', 'rubric_als_vf_adult_team_lead', 85, 'approved')`
  );
}

beforeAll(async () => {
  token = await login();
  await query(`DELETE FROM synced_events WHERE event_id IN ('evt_test_learner', 'evt_test_conflict')`);
  await query(`DELETE FROM learners WHERE id = 'learner_sync_test'`);
  await seedApprovedScore();
});

afterAll(async () => {
  await getPool().end();
});

describe('POST /api/sync', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/sync').send({ events: [] });
    expect(res.status).toBe(401);
  });

  it('syncs a learner upsert event', async () => {
    const res = await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [{
          eventId: 'evt_test_learner',
          eventType: 'learners.upsert',
          data: { id: 'learner_sync_test', first_name: 'Sync', last_name: 'Test', email: 'sync.test@local' },
        }],
      });

    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(1);
    expect(res.body.conflicts).toBe(0);
    expect(res.body.events[0].status).toBe('synced');

    // It actually landed in the DB.
    const row = await query(`SELECT * FROM learners WHERE id = 'learner_sync_test'`);
    expect(row.rows[0].organisation_id).toBe('parasol-emt');
  });

  it('is idempotent — re-sending the same event is a no-op', async () => {
    const res = await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [{
          eventId: 'evt_test_learner',
          eventType: 'learners.upsert',
          data: { id: 'learner_sync_test', first_name: 'Sync', last_name: 'Test', email: 'sync.test@local' },
        }],
      });

    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(1);
    expect(res.body.events[0].deduped).toBe(true);
  });

  it('flags a conflict when the server already finalized a score', async () => {
    const res = await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [{
          eventId: 'evt_test_conflict',
          eventType: 'rubric_scores.upsert',
          data: {
            id: 'score_sync_conflict',
            session_id: 'session_sync_test',
            participant_id: 'participant_sync_test',
            learner_id: 'learner_001',
            rubric_id: 'rubric_als_vf_adult_team_lead',
            total_score: 87,
            state: 'pending_approval',
          },
        }],
      });

    expect(res.status).toBe(200);
    expect(res.body.conflicts).toBe(1);
    const ev = res.body.events[0];
    expect(ev.status).toBe('conflict');
    expect(ev.serverVersion.totalScore).toBe(85);
    expect(ev.clientVersion.totalScore).toBe(87);
    expect(ev.resolution).toBe('manual_review_required');

    // Server value must NOT have been overwritten.
    const row = await query(`SELECT total_score FROM rubric_scores WHERE id = 'score_sync_conflict'`);
    expect(row.rows[0].total_score).toBe(85);
  });

  it('applies an override resolution over a finalized score and audits it', async () => {
    const res = await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [{
          eventId: 'evt_test_override',
          eventType: 'rubric_scores.upsert',
          resolution: 'override',
          data: {
            id: 'score_sync_conflict',
            session_id: 'session_sync_test',
            participant_id: 'participant_sync_test',
            learner_id: 'learner_001',
            rubric_id: 'rubric_als_vf_adult_team_lead',
            total_score: 91,
            state: 'pending_approval',
          },
        }],
      });

    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(1);
    expect(res.body.events[0].status).toBe('synced');

    const row = await query(`SELECT total_score FROM rubric_scores WHERE id = 'score_sync_conflict'`);
    expect(row.rows[0].total_score).toBe(91);

    const audit = await query(`SELECT action FROM score_audit WHERE score_id = 'score_sync_conflict' AND action = 'override'`);
    expect(audit.rowCount).toBe(1);

    await query(`DELETE FROM synced_events WHERE event_id = 'evt_test_override'`);
  });
});
