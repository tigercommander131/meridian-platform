const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const TOKEN_KEY = 'parasol_token';
const REFRESH_KEY = 'parasol_refresh';
const USER_KEY = 'parasol_user';

// --- token storage ---
function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}
function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function setSession({ token, refreshToken, user }) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

// --- refresh: called once on 401, returns true if a new token was obtained ---
let refreshing = null;
async function tryRefresh() {
  // Coalesce concurrent refreshes into one in-flight request.
  if (refreshing) return refreshing;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  refreshing = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setToken(data.token);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function request(path, { method = 'GET', body, _retried = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh once on 401 (but never for the auth endpoints themselves).
  if (res.status === 401 && !_retried && !path.startsWith('/auth/')) {
    const ok = await tryRefresh();
    if (ok) return request(path, { method, body, _retried: true });
    clearToken();
  }

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
    setSession(data);
    return data.user;
  },
  logout() {
    clearToken();
  },
  getUser() {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  isAuthenticated() {
    return !!getToken();
  },
};
