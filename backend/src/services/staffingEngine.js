// Staffing & viability engine — the heart of CTOP. Pure, no DB.
//
// Encodes the Fictional Resuscitation Course Management Rules:
//   • Group = max 6 students, min 4 to be viable. Capacity = groups × 6.
//   • ALS 1: 1–3 groups, 1 instructor per group, no Course/Medical Director.
//   • ALS 2: 2–3 groups only, 1 instructor per group, PLUS a Course Director
//     (must be an accredited instructor) and a Medical Director (must be a
//     doctor). CD may also be an instructor and may also be the MD.
//   • A course can run only when viable (student numbers) AND staffed.

export const DEFAULT_RULES = {
  groupSize: 6,
  minStudentsPerGroup: 4,
  instructorsPerGroup: 1,
  minGroups: 1,
  courseDirectorRequired: false,
  medicalDirectorRequired: false,
  courseDirectorCanBeMedicalDirector: true,
};

// Canonical rule sets per course type.
export const ALS1_RULES = { ...DEFAULT_RULES };
export const ALS2_RULES = {
  ...DEFAULT_RULES, minGroups: 2, courseDirectorRequired: true, medicalDirectorRequired: true,
};

const cap = (n) => Math.max(0, Number(n) || 0);

/**
 * Core evaluator. Works off PLANNED groups + assigned counts/flags.
 * @returns { groups, capacity, minStudents, required, assigned, viable, staffed,
 *            canRun, status, explanation }
 */
export function evaluate({
  ruleSet = {}, groups, enrolled = 0,
  instructors = 0, courseDirector = false, medicalDirector = false,
}) {
  const r = { ...DEFAULT_RULES, ...(ruleSet || {}) };
  enrolled = cap(enrolled);
  const g = cap(groups);
  const capacity = g * r.groupSize;
  const minStudents = g * r.minStudentsPerGroup;

  const required = {
    instructors: g * r.instructorsPerGroup,
    course_director: r.courseDirectorRequired ? 1 : 0,
    medical_lead: r.medicalDirectorRequired ? 1 : 0,
    doctor: 0,
  };

  // `courseDirector`/`medicalDirector` are already "effective" booleans
  // (assigned AND appropriately qualified). Strict: both required separately
  // for ALS 2 — any CD-covers-MD overlap is resolved by the caller.
  const cdOk = !r.courseDirectorRequired || Boolean(courseDirector);
  const mdOk = !r.medicalDirectorRequired || Boolean(medicalDirector);

  const instrCount = cap(instructors);
  const assigned = {
    instructors: instrCount,
    course_director: Boolean(courseDirector) ? 1 : 0,
    medical_lead: Boolean(medicalDirector) ? 1 : 0,
    doctor: 0,
  };

  const instrOk = instrCount >= required.instructors;
  const groupsOk = g >= (r.minGroups || 1);
  const viable = enrolled > 0 && enrolled >= minStudents && enrolled <= capacity && groupsOk;
  const staffed = instrOk && cdOk && mdOk;
  const canRun = viable && staffed;

  const explanation = [];
  if (enrolled === 0) explanation.push('No students enrolled yet.');
  else explanation.push(`${enrolled} enrolled · ${g} group${g === 1 ? '' : 's'} (min ${minStudents}, capacity ${capacity}).`);
  if (!groupsOk) explanation.push(`This course type needs at least ${r.minGroups} groups.`);
  if (enrolled > 0 && enrolled < minStudents) explanation.push(`Under minimum — needs ${minStudents - enrolled} more student${minStudents - enrolled === 1 ? '' : 's'}.`);
  if (enrolled > capacity) explanation.push(`Over capacity by ${enrolled - capacity} — move extras to the waitlist.`);
  if (!instrOk) explanation.push(`Need ${required.instructors} instructor${required.instructors === 1 ? '' : 's'}; ${instrCount} assigned.`);
  else if (required.instructors > 0) explanation.push(`Instructors ${instrCount}/${required.instructors} ✓`);
  if (r.courseDirectorRequired && !cdOk) explanation.push('Course Director not assigned / not accredited.');
  if (r.medicalDirectorRequired && !mdOk) explanation.push('Medical Director not assigned / not a doctor.');
  if (canRun) explanation.push('Cleared to run.');

  let status;
  if (enrolled === 0) status = 'planning';
  else if (!cdOk || !mdOk) status = 'compliance_risk';
  else if (!instrOk) status = 'staffing_risk';
  else if (!viable) status = 'viability_risk';
  else status = 'ready';

  return { groups: g, capacity, minStudents, required, assigned, viable, staffed, canRun, status, explanation };
}

/**
 * Legacy / named-crew entry point used by the live staffing flow. Derives
 * groups from the enrolled count (ceil to groupSize) and folds the assigned
 * role rows into counts, then defers to evaluate().
 *
 * assigned: array of { role } — instructor | course_director | medical_lead |
 * doctor | assessor | instructor_candidate.
 */
export function computeStaffing(confirmedStudents, ruleSet = {}, assigned = []) {
  const r = { ...DEFAULT_RULES, ...(ruleSet || {}) };
  const enrolled = cap(confirmedStudents);
  const groups = enrolled > 0 ? Math.max(r.minGroups || 1, Math.ceil(enrolled / r.groupSize)) : 0;

  const count = (role) => assigned.filter((a) => a.role === role).length;
  const ics = count('instructor_candidate');
  const instructors = count('instructor') + (r.countICsAsInstructors ? ics : 0);
  const hasCD = count('course_director') > 0;
  const hasMD = count('medical_lead') > 0 || count('doctor') > 0;

  const out = evaluate({
    ruleSet: r,
    groups,
    enrolled,
    instructors,
    courseDirector: hasCD,
    // CD may cover MD in the named flow (qualification gated by credentials).
    medicalDirector: hasMD || (r.courseDirectorCanBeMedicalDirector && hasCD),
  });
  // Preserve the historical `compliant` flag + a missing[] list.
  const missing = [];
  if (instructors < out.required.instructors) missing.push({ role: 'instructor', short: out.required.instructors - instructors });
  if (out.required.course_director && !hasCD) missing.push({ role: 'course_director', short: 1 });
  if (out.required.medical_lead && !hasMD && !(r.courseDirectorCanBeMedicalDirector && hasCD)) missing.push({ role: 'medical_lead', short: 1 });
  return { ...out, missing, compliant: out.canRun };
}
