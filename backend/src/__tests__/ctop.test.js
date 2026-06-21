import request from 'supertest';
import { createApp } from '../app.js';
import { getPool, query } from '../config/database.js';

const app = createApp();
const ORG_NAME = 'CTOP Test Org';
const EMAIL = 'ctop_test_admin@example.com';

async function cleanup() {
  await query(`DELETE FROM users WHERE email = $1`, [EMAIL]);
  await query(`DELETE FROM organisations WHERE name = $1`, [ORG_NAME]);
}

beforeAll(cleanup);
afterAll(async () => { await cleanup(); await getPool().end(); });

describe('CTOP compliance core', () => {
  let token; let org;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const r = await request(app).post('/api/auth/register').send({
      organisationName: ORG_NAME, firstName: 'Ops', lastName: 'Mgr', email: EMAIL, password: 'supersecret',
    });
    token = r.body.token; org = r.body.user.organisationId;
  });

  let accredId; let courseTypeId; let courseId;
  const instructorIds = [];

  it('creates an accreditation org + course type + rule set', async () => {
    const a = await request(app).post(`/api/organisations/${org}/accreditation`).set(auth()).send({ name: 'Australian Resuscitation Council', code: 'ARC' });
    expect(a.status).toBe(201);
    accredId = a.body.id;

    const ct = await request(app).post(`/api/organisations/${org}/course-types`).set(auth()).send({ name: 'ALS2', accreditationOrgId: accredId });
    expect(ct.status).toBe(201);
    courseTypeId = ct.body.id;

    const rs = await request(app).post(`/api/course-types/${courseTypeId}/rule-sets`).set(auth()).send({
      rules: { groupSize: 6, instructorsPerGroup: 2, courseDirectorRequired: true, medicalLeadRequired: true, courseDirectorCanBeMedicalLead: true, extraDoctorWhenGroupsExceed: 2 },
    });
    expect(rs.status).toBe(201);
    expect(rs.body.version).toBe(1);
  });

  it('creates instructors and a course (12 students)', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post(`/api/organisations/${org}/instructors`).set(auth())
        .send({ firstName: `Instr${i}`, lastName: 'Test', region: 'Sydney' });
      expect(r.status).toBe(201);
      instructorIds.push(r.body.id);
    }
    const c = await request(app).post(`/api/organisations/${org}/courses`).set(auth())
      .send({ name: 'ALS2 June', accreditationOrgId: accredId, courseTypeId, capacity: 18, confirmedStudents: 12 });
    expect(c.status).toBe(201);
    courseId = c.body.id;
  });

  it('reports compliance_risk before staffing (2 groups → 4 instructors + CD + ML)', async () => {
    const r = await request(app).get(`/api/courses/${courseId}/staffing`).set(auth());
    expect(r.status).toBe(200);
    expect(r.body.compliance.groups).toBe(2);
    expect(r.body.compliance.required.instructors).toBe(4);
    expect(r.body.compliance.status).not.toBe('ready');
  });

  it('becomes ready once fully staffed (CD covers ML)', async () => {
    for (let i = 0; i < 4; i++) {
      await request(app).post(`/api/courses/${courseId}/staffing`).set(auth()).send({ instructorId: instructorIds[i], role: 'instructor' });
    }
    const last = await request(app).post(`/api/courses/${courseId}/staffing`).set(auth()).send({ instructorId: instructorIds[4], role: 'course_director' });
    expect(last.status).toBe(201);
    expect(last.body.compliance.status).toBe('ready');
    expect(last.body.compliance.compliant).toBe(true);
  });

  it('surfaces the course on the ops dashboard', async () => {
    const r = await request(app).get(`/api/organisations/${org}/dashboard`).set(auth());
    expect(r.status).toBe(200);
    const found = r.body.courses.find((c) => c.id === courseId);
    expect(found).toBeTruthy();
    expect(found.compliance.status).toBe('ready');
  });

  it('blocks another organisation from reading accreditation', async () => {
    const other = await request(app).post('/api/auth/register').send({
      organisationName: 'Other CTOP Org', firstName: 'X', lastName: 'Y', email: 'other_ctop@example.com', password: 'supersecret',
    });
    const res = await request(app).get(`/api/organisations/${org}/accreditation`).set({ Authorization: `Bearer ${other.body.token}` });
    expect(res.status).toBe(403);
    await query(`DELETE FROM users WHERE email = 'other_ctop@example.com'`);
    await query(`DELETE FROM organisations WHERE name = 'Other CTOP Org'`);
  });
});
