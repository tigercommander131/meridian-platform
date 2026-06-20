import request from 'supertest';
import { createApp } from '../app.js';
import { getPool, query } from '../config/database.js';

const app = createApp();
let token;
const COURSE = 'course_als_2026_01';

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'instructor@parasol.edu.au', password: 'password' });
  token = res.body.token;
  await query(`DELETE FROM cohorts WHERE name = 'Approval Test Cohort'`);
});

afterAll(async () => {
  await query(`DELETE FROM cohorts WHERE name = 'Approval Test Cohort'`);
  await getPool().end();
});

const auth = (r) => r.set('Authorization', `Bearer ${token}`);

describe('approval workflow', () => {
  let sessionId, participantId, scoreId;

  it('sets up a scored participant', async () => {
    const cohort = await auth(request(app).post(`/api/courses/${COURSE}/cohorts`)).send({
      name: 'Approval Test Cohort',
      learnerIds: ['learner_001'],
    });
    const session = await auth(request(app).post(`/api/cohorts/${cohort.body.id}/sessions`)).send({
      scenarioId: 'scenario_vf_adult',
    });
    sessionId = session.body.id;
    const detail = await auth(request(app).get(`/api/sessions/${sessionId}`));
    participantId = detail.body.participants[0].id;
    await auth(request(app).put(`/api/sessions/${sessionId}/participants/${participantId}/role`)).send({ role: 'team_lead' });

    const score = await auth(request(app).post(`/api/sessions/${sessionId}/participants/${participantId}/rubric-scores`)).send({
      rubricId: 'rubric_als_vf_adult_team_lead',
      scores: { criterion_001: { points: 5 }, criterion_002: { points: 9 }, criterion_003: { points: 10 } },
    });
    scoreId = score.body.id;
    expect(score.body.state).toBe('pending_approval');
  });

  it('rejects release before approval (invalid transition)', async () => {
    const r = await auth(request(app).put(`/api/rubric-scores/${scoreId}/release`)).send({});
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('INVALID_TRANSITION');
  });

  it('approves then releases the score', async () => {
    const a = await auth(request(app).put(`/api/rubric-scores/${scoreId}/approve`)).send({});
    expect(a.status).toBe(200);
    expect(a.body.state).toBe('approved');

    const rel = await auth(request(app).put(`/api/rubric-scores/${scoreId}/release`)).send({});
    expect(rel.body.state).toBe('released');
  });

  it('requires a reason to dispute', async () => {
    const r = await auth(request(app).put(`/api/rubric-scores/${scoreId}/dispute`)).send({});
    expect(r.status).toBe(400);
  });

  it('disputes, reopens, and re-approves', async () => {
    const d = await auth(request(app).put(`/api/rubric-scores/${scoreId}/dispute`)).send({ reason: 'Learner contests airway timing' });
    expect(d.body.state).toBe('disputed');

    const ro = await auth(request(app).put(`/api/rubric-scores/${scoreId}/reopen`)).send({});
    expect(ro.body.state).toBe('pending_approval');

    const a = await auth(request(app).put(`/api/rubric-scores/${scoreId}/approve`)).send({});
    expect(a.body.state).toBe('approved');
  });

  it('exposes the full audit trail in score detail', async () => {
    const detail = await auth(request(app).get(`/api/rubric-scores/${scoreId}`));
    expect(detail.status).toBe(200);
    const actions = detail.body.audit.map((a) => a.action);
    expect(actions).toEqual(['submitted', 'approved', 'released', 'disputed', 'reopened', 'approved']);
    expect(detail.body.state).toBe('approved');
  });
});
