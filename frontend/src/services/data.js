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
  update(id, payload) { return api.put(`/instructors/${id}`, payload); },
  addCredential(id, payload) { return api.post(`/instructors/${id}/credentials`, payload); },
  // Availability (rostering).
  listAvailability(id) { return api.get(`/instructors/${id}/availability`); },
  setAvailability(id, payload) { return api.post(`/instructors/${id}/availability`, payload); },
  removeAvailability(id, date) { return api.del(`/instructors/${id}/availability/${date}`); },
  // IC1 / IC2 pathway.
  addIcProgress(id, payload) { return api.post(`/instructors/${id}/ic-progress`, payload); },
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
  candidates(courseId, role) { return api.get(`/courses/${courseId}/staffing/candidates?role=${role}`); },
  invite(courseId, staffingId, payload = {}) { return api.post(`/courses/${courseId}/staffing/${staffingId}/invite`, payload); },
};

// Public invitation accept/decline (no auth required).
export const invitationsApi = {
  get(token) { return api.get(`/invitations/${token}`); },
  respond(token, payload) { return api.post(`/invitations/${token}/respond`, payload); },
};

export const dashboardApi = {
  get() { return api.get(`/organisations/${orgId()}/dashboard`); },
};

export const reportApi = {
  get() { return api.get(`/organisations/${orgId()}/ops-report`); },
};

export const orgApi = {
  get() { return api.get(`/organisations/${orgId()}/profile`); },
  update(payload) { return api.put(`/organisations/${orgId()}/profile`, payload); },
};

// Course status → airline "departures board" presentation.
// lamp ∈ go|warn|stop|idle|departed   tone = Badge tone
export const FLIGHT_STATUS = {
  ready:           { label: 'CLEARED',   lamp: 'go',   tone: 'teal' },
  staffing_risk:   { label: 'STAFFING',  lamp: 'warn', tone: 'amber' },
  compliance_risk: { label: 'AT RISK',   lamp: 'stop', tone: 'rose' },
  viability_risk:  { label: 'VIABILITY', lamp: 'warn', tone: 'amber' },
  planning:        { label: 'SCHEDULED', lamp: 'idle', tone: 'blue' },
  draft:           { label: 'DRAFT',     lamp: 'idle', tone: 'neutral' },
  delivered:       { label: 'DEPARTED',  lamp: 'departed', tone: 'dark' },
  closed:          { label: 'CLOSED',    lamp: 'idle', tone: 'neutral' },
  cancelled:       { label: 'CANCELLED', lamp: 'stop', tone: 'rose' },
};
export const flight = (s) => FLIGHT_STATUS[s] || FLIGHT_STATUS.planning;

// IATA-ish 3-letter "station" code from a region name (for board flavour).
export const station = (region) => (region ? region.slice(0, 3).toUpperCase() : 'TBD');

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

// Course / compliance status → Badge tone (neutral + teal; risk = amber/rose).
export const STATUS_TONE = {
  draft: 'neutral',
  planning: 'neutral',
  staffing_risk: 'amber',
  compliance_risk: 'rose',
  viability_risk: 'amber',
  ready: 'teal',
  delivered: 'dark',
  closed: 'neutral',
  cancelled: 'neutral',
};
export const statusTone = (s) => STATUS_TONE[s] || 'neutral';
export const statusLabel = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Escalation tiers for staffing suggestions.
export const TIER_META = {
  local: { label: 'Local', tone: 'teal', hint: 'Same region' },
  regional: { label: 'Regional', tone: 'blue', hint: 'Other region' },
  emergency: { label: 'Emergency', tone: 'amber', hint: 'Candidate / last resort' },
};

// Availability badge meta.
export const AVAIL_META = {
  available: { label: 'Available', tone: 'teal' },
  unavailable: { label: 'Unavailable', tone: 'rose' },
  tentative: { label: 'Tentative', tone: 'amber' },
  unknown: { label: 'Unknown', tone: 'neutral' },
};

// Invitation status badge meta.
export const INVITE_META = {
  invited: { label: 'Invited', tone: 'blue' },
  accepted: { label: 'Accepted', tone: 'teal' },
  confirmed: { label: 'Confirmed', tone: 'teal' },
  declined: { label: 'Declined', tone: 'rose' },
  no_response: { label: 'No response', tone: 'amber' },
};

export const IC_OUTCOME_META = {
  passed: { label: 'Passed', tone: 'teal' },
  remediation: { label: 'Remediation', tone: 'amber' },
  not_suitable: { label: 'Not suitable', tone: 'rose' },
  deferred: { label: 'Deferred', tone: 'neutral' },
};

export function fmtDate(d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', opts);
}

// "27 – 28 Jun 2026" for a multi-day course; single date otherwise.
export function fmtDateRange(start, end) {
  if (!start) return '—';
  const s = new Date(start);
  if (!end || new Date(end).toDateString() === s.toDateString()) return fmtDate(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) return `${s.getDate()} – ${e.getDate()} ${e.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}`;
  return `${fmtDate(start, { day: 'numeric', month: 'short' })} – ${fmtDate(end)}`;
}

// Course filtering (shared by the Courses page + the dashboard board).
export const COURSE_WINDOWS = [
  { key: 'all', label: 'Any time', days: null },
  { key: 'w1', label: 'Next 7 days', days: 7 },
  { key: 'w2', label: 'Next 2 weeks', days: 14 },
  { key: 'w4', label: 'Next 4 weeks', days: 28 },
  { key: 'w6', label: 'Next 6 weeks', days: 42 },
];

export const emptyCourseFilter = () => ({ q: '', type: '', region: '', status: '', when: 'all' });
export const courseFilterActive = (f) => Boolean(f && (f.q || f.type || f.region || f.status || (f.when && f.when !== 'all')));

// Distinct, sorted values for a select (skips blanks).
export function distinct(items, fn) {
  return [...new Set((items || []).map(fn).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

// Apply a filter object to a course list. `acc` supplies field accessors so the
// same logic serves both the card list (courseTypeName) and the board (courseTypeCode).
export function filterCourses(courses, f, acc) {
  const { q = '', type = '', region = '', status = '', when = 'all' } = f || {};
  const days = COURSE_WINDOWS.find((w) => w.key === when)?.days ?? null;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const cutoff = days != null ? start.getTime() + days * 86400000 : null;
  const ql = q.trim().toLowerCase();
  return (courses || []).filter((c) => {
    if (type && acc.type(c) !== type) return false;
    if (region && acc.region(c) !== region) return false;
    if (status && acc.status(c) !== status) return false;
    if (cutoff != null) {
      const d = acc.date(c);
      if (!d) return false;
      const t = new Date(d).getTime();
      if (t < start.getTime() || t > cutoff) return false;
    }
    if (ql && !acc.search(c).toLowerCase().includes(ql)) return false;
    return true;
  });
}

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
