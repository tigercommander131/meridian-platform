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
  await query(`DELETE FROM cohorts WHERE name = 'Session Test Cohort'`);
});

afterAll(async () => {
  await query(`DELETE FROM cohorts WHERE name = 'Session Test Cohort'`);
  await getPool().end();
});

const auth = (r) => r.set('Authorization', `Bearer ${token}`);

describe('session lifecycle + scoring', () => {
  let cohortId, sessionId, participantId;

  it('creates a cohort and a session with an auto-roster', async () => {
    const cohort = await auth(request(app).post(`/api/courses/${COURSE}/cohorts`)).send({
      name: 'Session Test Cohort',
      learnerIds: ['learner_001', 'learner_002'],
    });
    cohortId = cohort.body.id;

    const session = await auth(request(app).post(`/api/cohorts/${cohortId}/sessions`)).send({
      scenarioId: 'scenario_vf_adult',
    });
    expect(session.status).toBe(201);
    sessionId = session.body.id;

    const detail = await auth(request(app).get(`/api/sessions/${sessionId}`));
    expect(detail.body.participants.length).toBe(2);
    expect(detail.body.status).toBe('created');
    participantId = detail.body.participants[0].id;
  });

  it('checks in a participant and assigns a role', async () => {
    const ci = await auth(request(app).put(`/api/sessions/${sessionId}/participants/${participantId}/checkin`))
      .send({ method: 'qr_scan' });
    expect(ci.status).toBe(200);
    expect(ci.body.checkinStatus).toBe('checked_in');

    const role = await auth(request(app).put(`/api/sessions/${sessionId}/participants/${participantId}/role`))
      .send({ role: 'team_lead' });
    expect(role.body.role).toBe('team_lead');
  });

  it('ingests a flight recorder event and starts the session', async () => {
    const ev = await auth(request(app).post(`/api/sessions/${sessionId}/flight-recorder-events`)).send({
      participantId,
      eventType: 'compression_detected',
      parameters: { compressionDepthMM: 52, rateBPM: 108 },
    });
    expect(ev.status).toBe(201);

    const start = await auth(request(app).post(`/api/sessions/${sessionId}/start`)).send({});
    expect(start.body.status).toBe('active');
  });

  it('builds scoring context with the right rubric + evidence', async () => {
    const ctx = await auth(request(app).get(`/api/sessions/${sessionId}/participants/${participantId}/scoring-context`));
    expect(ctx.status).toBe(200);
    expect(ctx.body.rubric.id).toBe('rubric_als_vf_adult_team_lead');
    expect(ctx.body.rubric.criteria.length).toBe(3);
    expect(ctx.body.evidence['flightRecorder.compressionDepthMM']).toBe(52);
  });

  it('submits a rubric score with a computed total', async () => {
    const score = await auth(request(app).post(`/api/sessions/${sessionId}/participants/${participantId}/rubric-scores`)).send({
      rubricId: 'rubric_als_vf_adult_team_lead',
      scores: {
        criterion_001: { points: 5 },
        criterion_002: { points: 9, notes: 'CPR at 11s' },
        criterion_003: { points: 10 },
      },
      assessorNotes: 'Strong performance',
    });
    expect(score.status).toBe(201);
    expect(score.body.totalScore).toBe(24);
    expect(score.body.state).toBe('pending_approval');

    const list = await auth(request(app).get(`/api/sessions/${sessionId}/rubric-scores`));
    expect(list.body.scores.length).toBe(1);
    expect(list.body.scores[0].totalScore).toBe(24);
  });

  it('ends the session', async () => {
    const end = await auth(request(app).post(`/api/sessions/${sessionId}/end`)).send({});
    expect(end.body.status).toBe('completed');
  });

  it('exposes a rubric template directly', async () => {
    const rub = await auth(request(app).get(`/api/rubrics/rubric_als_vf_adult_team_lead`));
    expect(rub.status).toBe(200);
    expect(rub.body.criteria.length).toBe(3);
    expect(rub.body.maxScore).toBe(100);
  });
});
