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
  await query(`DELETE FROM cohorts WHERE name = 'Report Test Cohort'`);
});

afterAll(async () => {
  await query(`DELETE FROM cohorts WHERE name = 'Report Test Cohort'`);
  await getPool().end();
});

const auth = (r) => r.set('Authorization', `Bearer ${token}`);

describe('learner report', () => {
  it('aggregates released scores into a candidate report', async () => {
    const cohort = await auth(request(app).post(`/api/courses/${COURSE}/cohorts`)).send({
      name: 'Report Test Cohort',
      learnerIds: ['learner_002'],
    });
    const session = await auth(request(app).post(`/api/cohorts/${cohort.body.id}/sessions`)).send({
      scenarioId: 'scenario_vf_adult',
    });
    const detail = await auth(request(app).get(`/api/sessions/${session.body.id}`));
    const pid = detail.body.participants[0].id;
    await auth(request(app).put(`/api/sessions/${session.body.id}/participants/${pid}/role`)).send({ role: 'team_lead' });

    const score = await auth(request(app).post(`/api/sessions/${session.body.id}/participants/${pid}/rubric-scores`)).send({
      rubricId: 'rubric_als_vf_adult_team_lead',
      scores: { criterion_001: { points: 4 }, criterion_002: { points: 8 }, criterion_003: { points: 9 } },
    });
    await auth(request(app).put(`/api/rubric-scores/${score.body.id}/approve`)).send({});
    await auth(request(app).put(`/api/rubric-scores/${score.body.id}/release`)).send({});

    const report = await auth(request(app).get(`/api/learners/learner_002/report`));
    expect(report.status).toBe(200);
    const match = report.body.results.find((r) => r.scoreId === score.body.id);
    expect(match).toBeTruthy();
    expect(match.total).toBe(21);
    expect(match.criteria.length).toBe(3);
    expect(report.body.summary.assessed).toBeGreaterThanOrEqual(1);
  });

  it('404s for an unknown learner', async () => {
    const r = await auth(request(app).get(`/api/learners/nope_123/report`));
    expect(r.status).toBe(404);
  });
});
