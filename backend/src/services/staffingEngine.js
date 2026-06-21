// Staffing compliance calculator — the heart of CTOP. Pure function, no DB.
//
// Given a course's confirmed student count, the resolved rule set, and the list
// of assigned staff, it computes the required staff, what's missing, an overall
// status, and a deterministic plain-English explanation (the "AI" summary).

export const DEFAULT_RULES = {
  groupSize: 6,
  instructorsPerGroup: 2,
  courseDirectorRequired: true,
  medicalLeadRequired: true,
  courseDirectorCanBeMedicalLead: true,
  extraDoctorWhenGroupsExceed: 2,
  countICsAsInstructors: false,
};

// assigned: array of { role } — one entry per staffing assignment.
// roles: instructor | course_director | medical_lead | doctor | assessor | instructor_candidate
export function computeStaffing(confirmedStudents, ruleSet = {}, assigned = []) {
  const r = { ...DEFAULT_RULES, ...(ruleSet || {}) };
  const students = Math.max(0, Number(confirmedStudents) || 0);
  const groups = students > 0 ? Math.ceil(students / r.groupSize) : 0;

  const required = {
    instructors: groups * r.instructorsPerGroup,
    course_director: r.courseDirectorRequired ? 1 : 0,
    medical_lead: r.medicalLeadRequired ? 1 : 0,
    doctor: groups > r.extraDoctorWhenGroupsExceed ? 1 : 0,
  };

  const count = (role) => assigned.filter((a) => a.role === role).length;
  const icCount = count('instructor_candidate');
  const assignedCounts = {
    instructors: count('instructor') + (r.countICsAsInstructors ? icCount : 0),
    course_director: count('course_director'),
    medical_lead: count('medical_lead'),
    doctor: count('doctor'),
  };

  // Role overlap: a course director may also satisfy the medical lead requirement.
  const medicalLeadSatisfied =
    assignedCounts.medical_lead >= required.medical_lead ||
    (r.courseDirectorCanBeMedicalLead && required.medical_lead > 0 && assignedCounts.course_director > 0);

  const missing = [];
  const explanation = [];

  if (groups === 0) {
    explanation.push('No confirmed students yet.');
  } else {
    explanation.push(`${students} student${students === 1 ? '' : 's'} → ${groups} group${groups === 1 ? '' : 's'}.`);
  }

  const instrShort = required.instructors - assignedCounts.instructors;
  if (instrShort > 0) {
    missing.push({ role: 'instructor', short: instrShort });
    explanation.push(`Need ${required.instructors} instructors; ${assignedCounts.instructors} assigned (${instrShort} short).`);
  } else if (required.instructors > 0) {
    explanation.push(`Instructors: ${assignedCounts.instructors}/${required.instructors} ✓`);
  }

  if (assignedCounts.course_director < required.course_director) {
    missing.push({ role: 'course_director', short: required.course_director - assignedCounts.course_director });
    explanation.push('No course director assigned; 1 required.');
  }

  if (required.medical_lead > 0 && !medicalLeadSatisfied) {
    missing.push({ role: 'medical_lead', short: 1 });
    explanation.push('No medical lead assigned; 1 required.');
  } else if (required.medical_lead > 0 && assignedCounts.medical_lead === 0 && assignedCounts.course_director > 0) {
    explanation.push('Medical lead covered by the course director.');
  }

  if (required.doctor > 0 && assignedCounts.doctor < required.doctor) {
    missing.push({ role: 'doctor', short: required.doctor - assignedCounts.doctor });
    explanation.push(`Additional doctor required (more than ${r.extraDoctorWhenGroupsExceed} groups); none assigned.`);
  }

  let status;
  if (groups === 0) status = 'planning';
  else if (missing.length === 0) status = 'ready';
  else if (missing.some((m) => ['course_director', 'medical_lead', 'doctor'].includes(m.role))) status = 'compliance_risk';
  else status = 'staffing_risk';

  return {
    groups,
    required,
    assigned: assignedCounts,
    missing,
    compliant: missing.length === 0 && groups > 0,
    status,
    explanation,
  };
}
