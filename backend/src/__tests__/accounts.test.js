import request from 'supertest';
import { createApp } from '../app.js';
import { getPool, query } from '../config/database.js';

const app = createApp();

const SIGNUP_EMAIL = 'founder_acct_test@example.com';
const STAFF_EMAIL = 'staff_acct_test@example.com';

async function cleanup() {
  await query(`DELETE FROM users WHERE email IN ($1, $2)`, [SIGNUP_EMAIL, STAFF_EMAIL]);
  await query(`DELETE FROM organisations WHERE name = 'Acct Test Org'`);
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await getPool().end();
});

describe('accounts', () => {
  let token;

  it('registers a new org + admin user and auto-logs in', async () => {
    const res = await request(app).post('/api/auth/register').send({
      organisationName: 'Acct Test Org',
      firstName: 'Ada',
      lastName: 'Founder',
      email: SIGNUP_EMAIL,
      password: 'supersecret',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.roles).toEqual(expect.arrayContaining(['admin', 'educator']));
    token = res.body.token;
  });

  it('rejects a duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      organisationName: 'Acct Test Org 2',
      firstName: 'Ada', lastName: 'Again', email: SIGNUP_EMAIL, password: 'supersecret',
    });
    expect(res.status).toBe(409);
  });

  it('rejects a short password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      organisationName: 'X', firstName: 'A', lastName: 'B', email: 'short_pw_test@example.com', password: 'short',
    });
    expect(res.status).toBe(400);
  });

  it('lets the admin add a staff user and list them', async () => {
    const org = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).organisationId;

    const create = await request(app)
      .post(`/api/organisations/${org}/users`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Grace', lastName: 'Staff', email: STAFF_EMAIL, password: 'staffsecret', roles: ['instructor'] });
    expect(create.status).toBe(201);
    expect(create.body.roles).toEqual(['instructor']);

    const list = await request(app)
      .get(`/api/organisations/${org}/users`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.users.map((u) => u.email)).toEqual(expect.arrayContaining([SIGNUP_EMAIL, STAFF_EMAIL]));
  });

  it('forbids non-admins from managing users', async () => {
    const login = await request(app).post('/api/auth/login')
      .send({ username: 'instructor@parasol.edu.au', password: 'password' });
    const org = login.body.user.organisationId;
    const res = await request(app)
      .get(`/api/organisations/${org}/users`)
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(403);
  });
});
