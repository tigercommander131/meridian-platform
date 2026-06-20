import request from 'supertest';
import { createApp } from '../app.js';
import { getPool, query } from '../config/database.js';

const app = createApp();

const ORG_NAME = 'Student Test Org';
const STAFF_EMAIL = 'studtest_staff@example.com';
const STUDENT_EMAIL = 'studtest_learner@example.com';

async function cleanup() {
  await query(`DELETE FROM certificates WHERE organisation_id IN (SELECT id FROM organisations WHERE name = $1)`, [ORG_NAME]);
  await query(`DELETE FROM learners WHERE email = $1`, [STUDENT_EMAIL]);
  await query(`DELETE FROM users WHERE email = $1`, [STAFF_EMAIL]);
  await query(`DELETE FROM organisations WHERE name = $1`, [ORG_NAME]);
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await getPool().end();
});

describe('student accounts + certificates', () => {
  let staffToken;
  let org;
  let learnerId;
  let studentToken;

  beforeAll(async () => {
    const reg = await request(app).post('/api/auth/register').send({
      organisationName: ORG_NAME, firstName: 'Staff', lastName: 'One', email: STAFF_EMAIL, password: 'supersecret',
    });
    staffToken = reg.body.token;
    org = reg.body.user.organisationId;

    await request(app).post(`/api/organisations/${org}/learners`).set('Authorization', `Bearer ${staffToken}`)
      .send({ data: [{ firstName: 'Stu', lastName: 'Dent', email: STUDENT_EMAIL }] });
    const list = await request(app).get(`/api/organisations/${org}/learners?search=${STUDENT_EMAIL}`)
      .set('Authorization', `Bearer ${staffToken}`);
    learnerId = list.body.learners.find((l) => l.email === STUDENT_EMAIL).id;
  });

  it('lets a learner claim a student account', async () => {
    const res = await request(app).post('/api/auth/student/register').send({ email: STUDENT_EMAIL, password: 'studentpass' });
    expect(res.status).toBe(201);
    expect(res.body.user.kind).toBe('student');
    expect(res.body.token).toBeTruthy();
    studentToken = res.body.token;
  });

  it('rejects a second claim of the same email', async () => {
    const res = await request(app).post('/api/auth/student/register').send({ email: STUDENT_EMAIL, password: 'studentpass' });
    expect(res.status).toBe(409);
  });

  it('rejects a claim for a non-enrolled email', async () => {
    const res = await request(app).post('/api/auth/student/register').send({ email: `nobody_${Date.now()}@example.com`, password: 'studentpass' });
    expect(res.status).toBe(404);
  });

  it('logs the student in via the unified login (kind=student)', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: STUDENT_EMAIL, password: 'studentpass' });
    expect(res.status).toBe(200);
    expect(res.body.user.kind).toBe('student');
  });

  it('blocks a student token from staff endpoints', async () => {
    const res = await request(app).get(`/api/organisations/${org}/learners`).set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it('blocks a staff token from student endpoints', async () => {
    const res = await request(app).get('/api/student/me/sessions').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  it('returns the student timetable + results', async () => {
    const s = await request(app).get('/api/student/me/sessions').set('Authorization', `Bearer ${studentToken}`);
    expect(s.status).toBe(200);
    expect(Array.isArray(s.body.sessions)).toBe(true);

    const r = await request(app).get('/api/student/me/results').set('Authorization', `Bearer ${studentToken}`);
    expect(r.status).toBe(200);
    expect(r.body.learner.email).toBe(STUDENT_EMAIL);
  });

  it('issues a certificate (staff), the student sees it, and it verifies publicly', async () => {
    const issue = await request(app).post(`/api/learners/${learnerId}/certificates`)
      .set('Authorization', `Bearer ${staffToken}`).send({ title: 'ALS Completion' });
    expect(issue.status).toBe(201);
    const code = issue.body.verificationCode;
    expect(code).toBeTruthy();

    const mine = await request(app).get('/api/student/me/certificates').set('Authorization', `Bearer ${studentToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.certificates.map((c) => c.title)).toContain('ALS Completion');

    const verify = await request(app).get(`/api/verify/${code}`);
    expect(verify.status).toBe(200);
    expect(verify.body.valid).toBe(true);
    expect(verify.body.certificate.learnerName).toBe('Stu Dent');
  });
});
