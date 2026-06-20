import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../app.js';
import { getPool } from '../config/database.js';

const app = createApp();

afterAll(async () => {
  await getPool().end();
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token + user for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'instructor@parasol.edu.au', password: 'password' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.email).toBe('instructor@parasol.edu.au');
    expect(res.body.user.roles).toContain('educator');
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'instructor@parasol.edu.au', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an unknown user with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ghost@nowhere.com', password: 'x' });
    expect(res.status).toBe(401);
  });

  it('validates missing fields with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/refresh', () => {
  it('issues a new token from a valid refresh token', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'instructor@parasol.edu.au', password: 'password' });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('rejects an invalid refresh token with 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'garbage' });
    expect(res.status).toBe(401);
  });
});

describe('protected route', () => {
  it('rejects /api/auth/verify without a token', async () => {
    const res = await request(app).post('/api/auth/verify').send({});
    expect(res.status).toBe(401);
  });

  it('accepts /api/auth/verify with a valid token', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'instructor@parasol.edu.au', password: 'password' });

    const res = await request(app)
      .post('/api/auth/verify')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });
});
