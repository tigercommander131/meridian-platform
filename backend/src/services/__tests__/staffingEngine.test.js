import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluate, computeStaffing, ALS1_RULES, ALS2_RULES } from '../staffingEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('evaluate() — ALS 1 (instructors only)', () => {
  const base = { ruleSet: ALS1_RULES, groups: 1 };
  test('1 group, 4 enrolled, 1 instructor → ready', () => {
    const r = evaluate({ ...base, enrolled: 4, instructors: 1 });
    expect(r.capacity).toBe(6);
    expect(r.required.instructors).toBe(1);
    expect(r.canRun).toBe(true);
    expect(r.status).toBe('ready');
  });
  test('3 enrolled (under min 4) → viability_risk, cannot run', () => {
    const r = evaluate({ ...base, enrolled: 3, instructors: 1 });
    expect(r.viable).toBe(false);
    expect(r.canRun).toBe(false);
    expect(r.status).toBe('viability_risk');
  });
  test('no instructor → staffing_risk', () => {
    const r = evaluate({ ...base, enrolled: 5, instructors: 0 });
    expect(r.status).toBe('staffing_risk');
  });
  test('3 groups need 3 instructors', () => {
    expect(evaluate({ ruleSet: ALS1_RULES, groups: 3, enrolled: 12, instructors: 3 }).canRun).toBe(true);
    expect(evaluate({ ruleSet: ALS1_RULES, groups: 3, enrolled: 12, instructors: 2 }).status).toBe('staffing_risk');
  });
});

describe('evaluate() — ALS 2 (CD + MD mandatory, min 2 groups)', () => {
  const ok = { ruleSet: ALS2_RULES, groups: 2, enrolled: 8, instructors: 2, courseDirector: true, medicalDirector: true };
  test('fully staffed + viable → ready', () => {
    expect(evaluate(ok).status).toBe('ready');
    expect(evaluate(ok).canRun).toBe(true);
  });
  test('missing medical director → compliance_risk', () => {
    expect(evaluate({ ...ok, medicalDirector: false }).status).toBe('compliance_risk');
  });
  test('missing course director → compliance_risk', () => {
    expect(evaluate({ ...ok, courseDirector: false }).status).toBe('compliance_risk');
  });
  test('instructor shortage → staffing_risk', () => {
    expect(evaluate({ ...ok, instructors: 1 }).status).toBe('staffing_risk');
  });
  test('7 enrolled across 2 groups (under min 8) → viability_risk', () => {
    expect(evaluate({ ...ok, enrolled: 7 }).status).toBe('viability_risk');
  });
  test('single-group ALS 2 is not permitted → not viable', () => {
    expect(evaluate({ ...ok, groups: 1, enrolled: 6 }).viable).toBe(false);
  });
});

describe('computeStaffing() — named-crew flow (groups derived)', () => {
  test('ALS 2, 12 students, 2 instructors + CD (CD covers MD) → ready', () => {
    const r = computeStaffing(12, ALS2_RULES, [
      { role: 'instructor' }, { role: 'instructor' }, { role: 'course_director' },
    ]);
    expect(r.groups).toBe(2);
    expect(r.required.instructors).toBe(2);
    expect(r.compliant).toBe(true);
    expect(r.status).toBe('ready');
  });
  test('ALS 2, 12 students, 2 instructors, no CD → compliance_risk', () => {
    const r = computeStaffing(12, ALS2_RULES, [{ role: 'instructor' }, { role: 'instructor' }]);
    expect(r.status).toBe('compliance_risk');
    expect(r.missing.some((m) => m.role === 'course_director')).toBe(true);
  });
});

describe('parity with the 500-course operations spreadsheet', () => {
  const file = path.join(__dirname, '..', '..', 'seeders', 'resus-courses.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));

  test('500 rows loaded', () => expect(data.length).toBe(500));

  test('engine Can-Run matches the sheet for every course', () => {
    const mismatches = data.filter((c) => {
      const als2 = c.type === 'ALS 2';
      const r = evaluate({
        ruleSet: als2 ? ALS2_RULES : ALS1_RULES,
        groups: c.groups,
        enrolled: c.enrolled,
        instructors: c.instructors,
        courseDirector: Boolean(c.cd) && Boolean(c.cdQualified),
        medicalDirector: Boolean(c.md) && Boolean(c.mdDoctor),
      });
      return r.canRun !== (c.canRun === 'Yes');
    });
    expect(mismatches).toEqual([]);
  });
});
