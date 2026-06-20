const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('parasol_token');
}

export function setToken(token) {
  localStorage.setItem('parasol_token', token);
}

export function clearToken() {
  localStorage.removeItem('parasol_token');
  localStorage.removeItem('parasol_user');
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
};

export const auth = {
  async login(username, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    setToken(data.token);
    localStorage.setItem('parasol_user', JSON.stringify(data.user));
    return data;
  },
  logout() {
    clearToken();
  },
  getUser() {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('parasol_user');
    return raw ? JSON.parse(raw) : null;
  },
  isAuthenticated() {
    return !!getToken();
  },
};
