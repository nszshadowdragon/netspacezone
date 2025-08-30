// src/api.js
import axios from 'axios';

/**
 * Axios instance — cookie-first auth. We do NOT send a stale Authorization header by default.
 * Toggle USE_BEARER=true only if you absolutely need to send a token from localStorage.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // send/receive httpOnly cookies
});

// Transition flag — keep false to avoid the "login flips to another user" issue.
const USE_BEARER = false;

api.interceptors.request.use((config) => {
  if (USE_BEARER) {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } else if (config.headers && 'Authorization' in config.headers) {
    // Ensure we DO NOT send a stale Authorization header
    delete config.headers.Authorization;
  }
  return config;
});

// Optional: if server returns 401, clear any stray tokens
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      try { localStorage.removeItem('token'); } catch {}
    }
    return Promise.reject(err);
  }
);

export default api;
