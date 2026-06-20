import { api, auth, apiDownload } from './api';

function orgId() {
  return auth.getUser()?.organisationId;
}

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

export const coursesApi = {
  list() {
    return api.get(`/organisations/${orgId()}/courses`);
  },
};

export const cohortsApi = {
  listForCourse(courseId) {
    return api.get(`/courses/${courseId}/cohorts`);
  },
  create(courseId, payload) {
    return api.post(`/courses/${courseId}/cohorts`, payload);
  },
  get(cohortId) {
    return api.get(`/cohorts/${cohortId}`);
  },
};

export const sessionsApi = {
  listForCohort(cohortId) {
    return api.get(`/cohorts/${cohortId}/sessions`);
  },
  create(cohortId, payload) {
    return api.post(`/cohorts/${cohortId}/sessions`, payload);
  },
  get(sessionId) {
    return api.get(`/sessions/${sessionId}`);
  },
  checkin(sessionId, participantId, method = 'manual') {
    return api.put(`/sessions/${sessionId}/participants/${participantId}/checkin`, { method });
  },
  assignRole(sessionId, participantId, role) {
    return api.put(`/sessions/${sessionId}/participants/${participantId}/role`, { role });
  },
  start(sessionId) {
    return api.post(`/sessions/${sessionId}/start`, {});
  },
  end(sessionId) {
    return api.post(`/sessions/${sessionId}/end`, {});
  },
  ingestEvent(sessionId, payload) {
    return api.post(`/sessions/${sessionId}/flight-recorder-events`, payload);
  },
  scores(sessionId) {
    return api.get(`/sessions/${sessionId}/rubric-scores`);
  },
};

export const scoringApi = {
  context(sessionId, participantId) {
    return api.get(`/sessions/${sessionId}/participants/${participantId}/scoring-context`);
  },
  submit(sessionId, participantId, payload) {
    return api.post(`/sessions/${sessionId}/participants/${participantId}/rubric-scores`, payload);
  },
  detail(scoreId) {
    return api.get(`/rubric-scores/${scoreId}`);
  },
  approve(scoreId) {
    return api.put(`/rubric-scores/${scoreId}/approve`, {});
  },
  release(scoreId) {
    return api.put(`/rubric-scores/${scoreId}/release`, {});
  },
  dispute(scoreId, reason) {
    return api.put(`/rubric-scores/${scoreId}/dispute`, { reason });
  },
  reopen(scoreId) {
    return api.put(`/rubric-scores/${scoreId}/reopen`, {});
  },
};

// Score states + their display treatment (neutral palette + teal accent).
export const SCORE_STATES = {
  pending_approval: { label: 'Pending approval', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-teal-50 text-teal-700' },
  released: { label: 'Released', cls: 'bg-neutral-900 text-white' },
  disputed: { label: 'Disputed', cls: 'bg-rose-50 text-rose-700' },
};

export const reportsApi = {
  forLearner(learnerId) {
    return api.get(`/learners/${learnerId}/report`);
  },
};

export const exportsApi = {
  list(cohortId) {
    return api.get(`/cohorts/${cohortId}/exports`);
  },
  audit(cohortId) {
    return api.get(`/cohorts/${cohortId}/audit`);
  },
  downloadScores(cohortId) {
    return apiDownload(`/cohorts/${cohortId}/exports/scores.csv`, `cohort_scores_${cohortId}.csv`);
  },
  downloadFlightRecorder(cohortId) {
    return apiDownload(`/cohorts/${cohortId}/exports/flight-recorder.csv`, `flight_recorder_${cohortId}.csv`);
  },
};

export const ROLES = ['team_lead', 'airway_manager', 'compressor', 'documentation'];

// Minimal CSV parser: header row + comma-separated values.
// Recognised headers: firstName, lastName, email, externalId, phone.
export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] || '';
    });
    return row;
  });
}
