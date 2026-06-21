import { api, auth } from './api';

function orgId() {
  return auth.getUser()?.organisationId;
}

// Students (learners).
export const learnersApi = {
  list({ search = '', limit = 50, offset = 0 } = {}) {
    const qs = new URLSearchParams({ search, limit, offset }).toString();
    return api.get(`/organisations/${orgId()}/learners?${qs}`);
  },
  create(record) {
    return api.post(`/organisations/${orgId()}/learners`, record);
  },
  createBatch(data) {
    return api.post(`/organisations/${orgId()}/learners`, { data });
  },
};

export const usersApi = {
  list() { return api.get(`/organisations/${orgId()}/users`); },
  create(record) { return api.post(`/organisations/${orgId()}/users`, record); },
};

// Accreditation organisations + course types + versioned rule sets.
export const accreditationApi = {
  list() { return api.get(`/organisations/${orgId()}/accreditation`); },
  create(payload) { return api.post(`/organisations/${orgId()}/accreditation`, payload); },
  listCourseTypes(accreditationId) {
    const qs = accreditationId ? `?accreditationId=${accreditationId}` : '';
    return api.get(`/organisations/${orgId()}/course-types${qs}`);
  },
  createCourseType(payload) { return api.post(`/organisations/${orgId()}/course-types`, payload); },
  listRuleSets(courseTypeId) { return api.get(`/course-types/${courseTypeId}/rule-sets`); },
  createRuleSet(courseTypeId, rules) { return api.post(`/course-types/${courseTypeId}/rule-sets`, { rules }); },
};

export const instructorsApi = {
  list({ status = '', search = '' } = {}) {
    const qs = new URLSearchParams({ status, search }).toString();
    return api.get(`/organisations/${orgId()}/instructors?${qs}`);
  },
  create(record) { return api.post(`/organisations/${orgId()}/instructors`, record); },
  get(id) { return api.get(`/instructors/${id}`); },
  addCredential(id, payload) { return api.post(`/instructors/${id}/credentials`, payload); },
};

export const coursesApi = {
  list(status) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return api.get(`/organisations/${orgId()}/courses${qs}`);
  },
  get(courseId) { return api.get(`/organisations/${orgId()}/courses/${courseId}`); },
  create(payload) { return api.post(`/organisations/${orgId()}/courses`, payload); },
  update(courseId, payload) { return api.put(`/organisations/${orgId()}/courses/${courseId}`, payload); },
};

export const staffingApi = {
  get(courseId) { return api.get(`/courses/${courseId}/staffing`); },
  assign(courseId, payload) { return api.post(`/courses/${courseId}/staffing`, payload); },
  remove(courseId, staffingId) { return api.del(`/courses/${courseId}/staffing/${staffingId}`); },
};

export const dashboardApi = {
  get() { return api.get(`/organisations/${orgId()}/dashboard`); },
};

// Staffing roles + display labels.
export const STAFF_ROLES = [
  { value: 'course_director', label: 'Course Director' },
  { value: 'medical_lead', label: 'Medical Lead' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'instructor_candidate', label: 'Instructor Candidate' },
  { value: 'assessor', label: 'Assessor' },
];
export const roleLabel = (v) => STAFF_ROLES.find((r) => r.value === v)?.label || v;

// Course / compliance status display (neutral + teal accent; risk = amber/rose).
export const STATUS_STYLE = {
  draft: 'bg-neutral-100 text-neutral-600',
  planning: 'bg-neutral-100 text-neutral-600',
  staffing_risk: 'bg-amber-50 text-amber-700',
  compliance_risk: 'bg-rose-50 text-rose-700',
  viability_risk: 'bg-amber-50 text-amber-700',
  ready: 'bg-teal-50 text-teal-700',
  delivered: 'bg-neutral-900 text-white',
  closed: 'bg-neutral-200 text-neutral-500',
  cancelled: 'bg-neutral-200 text-neutral-500',
};
export const statusLabel = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Minimal CSV parser for the students import (header row + comma values).
export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] || ''; });
    return row;
  });
}
