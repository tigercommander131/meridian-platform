import { api, auth } from './api';

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
