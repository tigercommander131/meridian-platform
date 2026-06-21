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

// --- Milestone 2: rostering, escalation, invitations, IC pathway -----------
const M2_ORG = 'CTOP M2 Org';
const M2_EMAIL = 'ctop_m2_admin@example.com';

describe('CTOP M2 — rostering & invitations', () => {
  let token; let org; const auth = () => ({ Authorization: `Bearer ${token}` });
  let accredId; let courseTypeId; let courseId;
  const COURSE_DATE = '2026-09-01';
  const ids = {};

  beforeAll(async () => {
    await query(`DELETE FROM users WHERE email = $1`, [M2_EMAIL]);
    await query(`DELETE FROM organisations WHERE name = $1`, [M2_ORG]);
    const r = await request(app).post('/api/auth/register').send({
      organisationName: M2_ORG, firstName: 'Ops', lastName: 'Mgr', email: M2_EMAIL, password: 'supersecret',
    });
    token = r.body.token; org = r.body.user.organisationId;

    accredId = (await request(app).post(`/api/organisations/${org}/accreditation`).set(auth()).send({ name: 'ARC', code: 'ARC' })).body.id;
    courseTypeId = (await request(app).post(`/api/organisations/${org}/course-types`).set(auth()).send({ name: 'ALS2', accreditationOrgId: accredId })).body.id;
    courseId = (await request(app).post(`/api/organisations/${org}/courses`).set(auth())
      .send({ name: 'ALS2 Sep', accreditationOrgId: accredId, courseTypeId, region: 'Sydney', confirmedStudents: 6, startDate: COURSE_DATE })).body.id;

    // A: local + available, B: local + unavailable, C: regional + available, D: candidate.
    const crew = [
      ['A', 'Sydney', 'active', 'available', ['instructor', 'course_director'], 'a@x.test'],
      ['B', 'Sydney', 'active', 'unavailable', ['instructor'], 'b@x.test'],
      ['C', 'Melbourne', 'active', 'available', ['instructor'], 'c@x.test'],
      ['D', 'Sydney', 'candidate', 'available', ['instructor'], 'd@x.test'],
    ];
    for (const [key, region, status, avail, roles, email] of crew) {
      const i = (await request(app).post(`/api/organisations/${org}/instructors`).set(auth()).send({ firstName: key, lastName: 'Crew', region, status, email })).body;
      ids[key] = i.id;
      await request(app).post(`/api/instructors/${i.id}/credentials`).set(auth()).send({ eligibleRoles: roles });
      await request(app).post(`/api/instructors/${i.id}/availability`).set(auth()).send({ date: COURSE_DATE, status: avail });
    }
  });

  afterAll(async () => {
    await query(`DELETE FROM users WHERE email = $1`, [M2_EMAIL]);
    await query(`DELETE FROM organisations WHERE name = $1`, [M2_ORG]);
  });

  it('ranks candidates local → regional and hides unavailable crew', async () => {
    const r = await request(app).get(`/api/courses/${courseId}/staffing/candidates?role=instructor`).set(auth());
    expect(r.status).toBe(200);
    const names = r.body.candidates.map((c) => c.name);
    expect(names).toContain('A Crew');     // local, available
    expect(names).toContain('C Crew');     // regional, available
    expect(names).not.toContain('B Crew'); // unavailable → hidden
    const a = r.body.candidates.find((c) => c.name === 'A Crew');
    const c = r.body.candidates.find((c) => c.name === 'C Crew');
    expect(a.tier).toBe('local');
    expect(c.tier).toBe('regional');
    expect(r.body.candidates.indexOf(a)).toBeLessThan(r.body.candidates.indexOf(c));
  });

  it('assigns, invites (token issued), and a decline drops the count', async () => {
    await request(app).post(`/api/courses/${courseId}/staffing`).set(auth()).send({ instructorId: ids.A, role: 'course_director' });
    await request(app).post(`/api/courses/${courseId}/staffing`).set(auth()).send({ instructorId: ids.C, role: 'instructor' });

    const list = await request(app).get(`/api/courses/${courseId}/staffing`).set(auth());
    const cAssign = list.body.staffing.find((s) => s.instructorId === ids.C);

    const inv = await request(app).post(`/api/courses/${courseId}/staffing/${cAssign.id}/invite`).set(auth()).send({ message: 'Please join' });
    expect(inv.status).toBe(200);
    expect(inv.body.ok).toBe(true);
    expect(inv.body.emailSkipped).toBe(true); // no provider configured in test

    const withToken = await request(app).get(`/api/courses/${courseId}/staffing`).set(auth());
    const token2 = withToken.body.staffing.find((s) => s.instructorId === ids.C).inviteToken;
    expect(token2).toBeTruthy();

    // Public view (no auth).
    const pub = await request(app).get(`/api/invitations/${token2}`);
    expect(pub.status).toBe(200);
    expect(pub.body.roleLabel).toBe('Instructor');

    // Public decline removes C from the count.
    const before = (await request(app).get(`/api/courses/${courseId}/staffing`).set(auth())).body.compliance.assigned.instructors;
    const resp = await request(app).post(`/api/invitations/${token2}/respond`).send({ response: 'decline', reason: 'busy' });
    expect(resp.status).toBe(200);
    const after = (await request(app).get(`/api/courses/${courseId}/staffing`).set(auth())).body.compliance.assigned.instructors;
    expect(after).toBe(before - 1);
  });

  it('passing IC2 promotes a candidate to active', async () => {
    const ic = await request(app).post(`/api/instructors/${ids.D}/ic-progress`).set(auth()).send({ stage: 'IC2', outcome: 'passed' });
    expect(ic.status).toBe(201);
    const d = await request(app).get(`/api/instructors/${ids.D}`).set(auth());
    expect(d.body.status).toBe('active');
    expect(Array.isArray(d.body.availability)).toBe(true);
    expect(Array.isArray(d.body.icProgress)).toBe(true);
  });

  it('rejects an invalid invitation response', async () => {
    const r = await request(app).post(`/api/invitations/anytoken/respond`).send({ response: 'maybe' });
    expect(r.status).toBe(400);
  });
});
