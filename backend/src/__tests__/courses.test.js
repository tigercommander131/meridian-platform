import request from 'supertest';
import { createApp } from '../app.js';
import { getPool, query } from '../config/database.js';

const app = createApp();

const EMAIL = 'courses_test_founder@example.com';
const ORG_NAME = 'Courses Test Org';

async function cleanup() {
  await query(
    `DELETE FROM courses WHERE organisation_id IN (SELECT id FROM organisations WHERE name = $1)`,
    [ORG_NAME]
  );
  await query(`DELETE FROM users WHERE email = $1`, [EMAIL]);
  await query(`DELETE FROM organisations WHERE name = $1`, [ORG_NAME]);
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await getPool().end();
});

describe('courses', () => {
  let token;
  let org;
  let courseId;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send({
      organisationName: ORG_NAME,
      firstName: 'Cora',
      lastName: 'Founder',
      email: EMAIL,
      password: 'supersecret',
    });
    token = res.body.token;
    org = res.body.user.organisationId;
  });

  it('creates a course', async () => {
    const res = await request(app)
      .post(`/api/organisations/${org}/courses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'ALS — Test Batch', maxLearners: 12, status: 'active' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('ALS — Test Batch');
    expect(res.body.maxLearners).toBe(12);
    courseId = res.body.id;
  });

  it('rejects a course with no name', async () => {
    const res = await request(app)
      .post(`/api/organisations/${org}/courses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ maxLearners: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid status', async () => {
    const res = await request(app)
      .post(`/api/organisations/${org}/courses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad status', status: 'banana' });
    expect(res.status).toBe(400);
  });

  it('lists courses with a cohort count', async () => {
    const res = await request(app)
      .get(`/api/organisations/${org}/courses`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = res.body.courses.find((c) => c.id === courseId);
    expect(found).toBeTruthy();
    expect(found.cohortCount).toBe(0);
  });

  it('gets a single course', async () => {
    const res = await request(app)
      .get(`/api/organisations/${org}/courses/${courseId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(courseId);
  });

  it('updates a course (archive)', async () => {
    const res = await request(app)
      .put(`/api/organisations/${org}/courses/${courseId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'archived', maxLearners: 30 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('archived');
    expect(res.body.maxLearners).toBe(30);
  });

  it('forbids reading another organisation’s courses', async () => {
    const login = await request(app).post('/api/auth/login')
      .send({ username: 'instructor@parasol.edu.au', password: 'password' });
    const res = await request(app)
      .get(`/api/organisations/${org}/courses`)
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(403);
  });
});
