import request from 'supertest';
import { createApp } from '../app.js';
import { getPool, query } from '../config/database.js';

const app = createApp();
let token;
const ORG = 'parasol-emt';

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'instructor@parasol.edu.au', password: 'password' });
  token = res.body.token;
  await query(`DELETE FROM learners WHERE email LIKE '%@learnertest.local'`);
});

afterAll(async () => {
  await query(`DELETE FROM learners WHERE email LIKE '%@learnertest.local'`);
  await getPool().end();
});

const auth = (r) => r.set('Authorization', `Bearer ${token}`);

describe('learners endpoints', () => {
  it('requires auth', async () => {
    const res = await request(app).get(`/api/organisations/${ORG}/learners`);
    expect(res.status).toBe(401);
  });

  it('creates a single learner', async () => {
    const res = await auth(request(app).post(`/api/organisations/${ORG}/learners`)).send({
      firstName: 'Alice', lastName: 'Anderson', email: 'alice@learnertest.local',
    });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(1);
    expect(res.body.learners[0].firstName).toBe('Alice');
  });

  it('rejects invalid email with 400', async () => {
    const res = await auth(request(app).post(`/api/organisations/${ORG}/learners`)).send({
      firstName: 'Bob', lastName: 'Brown', email: 'not-an-email',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('batch-creates and skips duplicates', async () => {
    const res = await auth(request(app).post(`/api/organisations/${ORG}/learners`)).send({
      data: [
        { firstName: 'Carol', lastName: 'Clark', email: 'carol@learnertest.local' },
        { firstName: 'Alice', lastName: 'Anderson', email: 'alice@learnertest.local' }, // dup
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(1);
    expect(res.body.failed).toBe(1);
  });

  it('lists with search', async () => {
    const res = await auth(request(app).get(`/api/organisations/${ORG}/learners?search=carol`));
    expect(res.status).toBe(200);
    expect(res.body.learners.some((l) => l.email === 'carol@learnertest.local')).toBe(true);
  });

  it('blocks access to another org', async () => {
    const res = await auth(request(app).get(`/api/organisations/other-org/learners`));
    expect(res.status).toBe(403);
  });
});
