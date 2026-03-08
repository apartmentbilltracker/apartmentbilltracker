import { API_BASE_URL } from '../config';

const TOKEN_KEY = 'authToken';

let _cachedToken = null;

const getToken = () => {
  if (_cachedToken === null) {
    _cachedToken = localStorage.getItem(TOKEN_KEY) ?? '';
  }
  return _cachedToken || null;
};

export const setToken = (token) => {
  _cachedToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

export const clearToken = () => {
  _cachedToken = null;
  localStorage.removeItem(TOKEN_KEY);
};

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = isFormData ? {} : { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body instanceof FormData ? options.body
      : options.body !== undefined ? JSON.stringify(options.body)
      : undefined,
  });

  const contentType = res.headers.get('content-type');
  let data;
  if (contentType?.includes('application/json')) {
    data = await res.json();
  } else if (options.responseType === 'blob') {
    data = await res.blob();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const err = new Error(data?.message || 'API Error');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const api = {
  get: (url) => request(url, { method: 'GET' }),
  post: (url, body, isFormData = false) => request(url, { method: 'POST', body }),
  put: (url, body) => request(url, { method: 'PUT', body }),
  patch: (url, body) => request(url, { method: 'PATCH', body }),
  delete: (url) => request(url, { method: 'DELETE' }),
  blob: (url) => request(url, { method: 'GET', responseType: 'blob' }),
};

export default api;
