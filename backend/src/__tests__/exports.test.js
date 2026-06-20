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
  await query(`DELETE FROM cohorts WHERE name = 'Export Test Cohort'`);
});

afterAll(async () => {
  await query(`DELETE FROM cohorts WHERE name = 'Export Test Cohort'`);
  await getPool().end();
});

const auth = (r) => r.set('Authorization', `Bearer ${token}`);

describe('cohort exports + audit', () => {
  let cohortId;

  it('produces a scores CSV and records the export job', async () => {
    const cohort = await auth(request(app).post(`/api/courses/${COURSE}/cohorts`)).send({
      name: 'Export Test Cohort',
      learnerIds: ['learner_001'],
    });
    cohortId = cohort.body.id;
    const session = await auth(request(app).post(`/api/cohorts/${cohortId}/sessions`)).send({ scenarioId: 'scenario_vf_adult' });
    const detail = await auth(request(app).get(`/api/sessions/${session.body.id}`));
    const pid = detail.body.participants[0].id;
    await auth(request(app).put(`/api/sessions/${session.body.id}/participants/${pid}/role`)).send({ role: 'team_lead' });
    const score = await auth(request(app).post(`/api/sessions/${session.body.id}/participants/${pid}/rubric-scores`)).send({
      rubricId: 'rubric_als_vf_adult_team_lead',
      scores: { criterion_001: { points: 5 }, criterion_002: { points: 7 }, criterion_003: { points: 8 } },
    });
    await auth(request(app).put(`/api/rubric-scores/${score.body.id}/approve`)).send({});
    await auth(request(app).put(`/api/rubric-scores/${score.body.id}/release`)).send({});

    const csv = await auth(request(app).get(`/api/cohorts/${cohortId}/exports/scores.csv`));
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toMatch(/Learner,Email/);
    expect(csv.text).toMatch(/released/);

    const history = await auth(request(app).get(`/api/cohorts/${cohortId}/exports`));
    expect(history.body.exports.length).toBeGreaterThanOrEqual(1);
    expect(history.body.exports[0].type).toBe('full_course');
  });

  it('returns the cohort audit trail', async () => {
    const audit = await auth(request(app).get(`/api/cohorts/${cohortId}/audit`));
    const actions = audit.body.audit.map((a) => a.action);
    expect(actions).toContain('approved');
    expect(actions).toContain('released');
  });

  it('404s exporting an unknown cohort', async () => {
    const r = await auth(request(app).get(`/api/cohorts/nope_123/exports/scores.csv`));
    expect(r.status).toBe(404);
  });
});
