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
  await query(`DELETE FROM cohorts WHERE name = 'Cohort Test Batch'`);
});

afterAll(async () => {
  await query(`DELETE FROM cohorts WHERE name = 'Cohort Test Batch'`);
  await getPool().end();
});

const auth = (r) => r.set('Authorization', `Bearer ${token}`);

describe('cohorts endpoints', () => {
  let cohortId;

  it('lists courses for the org', async () => {
    const res = await auth(request(app).get(`/api/organisations/parasol-emt/courses`));
    expect(res.status).toBe(200);
    expect(res.body.courses.some((c) => c.id === COURSE)).toBe(true);
  });

  it('creates a cohort with learners + QR token', async () => {
    const res = await auth(request(app).post(`/api/courses/${COURSE}/cohorts`)).send({
      name: 'Cohort Test Batch',
      learnerIds: ['learner_001', 'learner_002'],
    });
    expect(res.status).toBe(201);
    expect(res.body.learnerCount).toBe(2);
    expect(res.body.qrCode).toMatch(/^COHORT_/);
    cohortId = res.body.id;
  });

  it('gets cohort detail with roster', async () => {
    const res = await auth(request(app).get(`/api/cohorts/${cohortId}`));
    expect(res.status).toBe(200);
    expect(res.body.learners.length).toBe(2);
    expect(res.body.qrCode).toMatch(/^COHORT_/);
  });

  it('requires a name', async () => {
    const res = await auth(request(app).post(`/api/courses/${COURSE}/cohorts`)).send({});
    expect(res.status).toBe(400);
  });

  it('404s for an unknown course', async () => {
    const res = await auth(request(app).post(`/api/courses/course_nope/cohorts`)).send({ name: 'x' });
    expect(res.status).toBe(404);
  });
});
