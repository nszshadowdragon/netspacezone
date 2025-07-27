export default async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...(options.headers || {}),
    Authorization: token ? `Bearer ${token}` : undefined,
  };

  // Always use backend base for relative URLs
  const baseUrl = 'http://localhost:5000';
  const fullUrl = url.startsWith('http') ? url : baseUrl + url;

  const opts = { ...options, headers };
  const res = await fetch(fullUrl, opts);
  return res;
}
