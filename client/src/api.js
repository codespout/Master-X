const TOKEN_KEY = 'mx_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function onUnauthorized(cb) {
  window.__mxUnauthorized = cb;
}

async function request(path, { method = 'GET', body, formData, token = true } = {}) {
  const headers = {};
  const t = getToken();
  if (token && t) headers['Authorization'] = `Bearer ${t}`;

  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(path, { method, headers, body: payload });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const code = json && json.code;
    if (res.status === 401 && code !== '2FA_REQUIRED' && window.__mxUnauthorized) window.__mxUnauthorized();
    const err = new Error((json && json.error) || `Request failed (${res.status})`);
    err.code = code;
    throw err;
  }
  return json && json.data !== undefined ? json.data : json;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  upload: (p, formData) => request(p, { method: 'POST', formData })
};

export function fmtMoney(n, digits = 2) {
  const v = Number(n || 0);
  return v.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export function fmtSigned(n, digits = 2) {
  const v = Number(n || 0);
  return `${v >= 0 ? '+' : ''}${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
