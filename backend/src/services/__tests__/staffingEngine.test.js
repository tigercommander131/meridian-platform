import { computeStaffing } from '../staffingEngine.js';

// ARC ALS2 default rules: groups of 6, 2 instructors/group, CD + ML required,
// CD may double as ML, extra doctor when > 2 groups.
const full = (n, extra = []) => [
  ...Array.from({ length: n }, () => ({ role: 'instructor' })),
  { role: 'course_director' },
  { role: 'medical_lead' },
  ...extra,
];

describe('staffing engine (ARC ALS2 defaults)', () => {
  it('6 students → 1 group, needs 2 instructors', () => {
    const r = computeStaffing(6, {}, full(2));
    expect(r.groups).toBe(1);
    expect(r.required.instructors).toBe(2);
    expect(r.status).toBe('ready');
    expect(r.compliant).toBe(true);
  });

  it('12 students → 2 groups, needs 4 instructors, no extra doctor', () => {
    const r = computeStaffing(12, {}, full(4));
    expect(r.groups).toBe(2);
    expect(r.required.instructors).toBe(4);
    expect(r.required.doctor).toBe(0);
    expect(r.compliant).toBe(true);
  });

  it('13 students → 3 groups, needs 6 instructors AND an extra doctor', () => {
    const without = computeStaffing(13, {}, full(6));
    expect(without.groups).toBe(3);
    expect(without.required.instructors).toBe(6);
    expect(without.required.doctor).toBe(1);
    expect(without.status).toBe('compliance_risk');
    expect(without.missing.some((m) => m.role === 'doctor')).toBe(true);

    const withDoc = computeStaffing(13, {}, full(6, [{ role: 'doctor' }]));
    expect(withDoc.compliant).toBe(true);
    expect(withDoc.status).toBe('ready');
  });

  it('18 students → 3 groups', () => {
    expect(computeStaffing(18, {}, full(6, [{ role: 'doctor' }])).groups).toBe(3);
  });

  it('detects an instructor shortfall (staffing_risk)', () => {
    const r = computeStaffing(6, {}, [{ role: 'instructor' }, { role: 'course_director' }, { role: 'medical_lead' }]);
    expect(r.status).toBe('staffing_risk');
    expect(r.missing).toEqual([{ role: 'instructor', short: 1 }]);
  });

  it('course director can double as medical lead', () => {
    const r = computeStaffing(6, {}, [{ role: 'instructor' }, { role: 'instructor' }, { role: 'course_director' }]);
    expect(r.compliant).toBe(true);
    expect(r.explanation.join(' ')).toMatch(/covered by the course director/i);
  });

  it('excludes instructor candidates from the instructor count by default', () => {
    const r = computeStaffing(6, {}, [
      { role: 'instructor' }, { role: 'instructor_candidate' },
      { role: 'course_director' }, { role: 'medical_lead' },
    ]);
    expect(r.assigned.instructors).toBe(1);
    expect(r.status).toBe('staffing_risk');
  });

  it('counts ICs as instructors when the rule allows it', () => {
    const r = computeStaffing(6, { countICsAsInstructors: true }, [
      { role: 'instructor' }, { role: 'instructor_candidate' },
      { role: 'course_director' }, { role: 'medical_lead' },
    ]);
    expect(r.assigned.instructors).toBe(2);
    expect(r.compliant).toBe(true);
  });

  it('reports planning when there are no students', () => {
    expect(computeStaffing(0, {}, []).status).toBe('planning');
  });
});
