// frontend/src/api.js
const isLocal = /localhost|127\.0\.0\.1/.test(window.location.hostname);

function deriveProdBase() {
  // Derive "https://api.<apex>" from current hostname: www.netspacezone.com -> api.netspacezone.com
  const host = window.location.hostname; // e.g., netspacezone.com | www.netspacezone.com | app.netspacezone.com
  if (!host) return "";
  const parts = host.split(".").filter(Boolean);
  if (parts.length >= 2) {
    const apex = parts.slice(-2).join("."); // example: netspacezone.com
    return `https://api.${apex}`;
  }
  return "";
}

const ENV_BASE =
  (import.meta?.env?.VITE_API_BASE_URL || import.meta?.env?.VITE_API_BASE || "").replace(/\/$/, "");

const API_BASE = ENV_BASE || (isLocal ? "http://localhost:5000" : deriveProdBase());

if (!API_BASE) {
  // eslint-disable-next-line no-console
  console.warn("[api] API_BASE could not be resolved; requests will be relative to origin.");
}

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

async function tokenBridge() {
  try {
    const r = await fetch(`${API_BASE}/api/auth/token-bridge`, {
      method: "GET",
      credentials: "include",
    });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    if (!j?.token) return false;
    try { localStorage.setItem("token", j.token); } catch {}
    return true;
  } catch {
    return false;
  }
}

async function request(path, { method = "GET", headers, body, qs } = {}, _retried = false) {
  const url = new URL(`${API_BASE}${path}`);
  if (qs && typeof qs === "object") {
    Object.entries(qs).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).length > 0) {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const token = getToken();
  const res = await fetch(url.toString(), {
    method,
    credentials: "include",
    headers: {
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });

  if (res.status === 401 && !_retried) {
    // pull token from cookie then retry once
    const ok = await tokenBridge();
    if (ok) return request(path, { method, headers, body, qs }, true);
  }

  const text = await res.text().catch(() => "");
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, data, raw: text };
}

const api = {
  get: (p, o) => request(p, { ...(o || {}), method: "GET" }),
  post: (p, o) => request(p, { ...(o || {}), method: "POST" }),
  patch: (p, o) => request(p, { ...(o || {}), method: "PATCH" }),
  del: (p, o) => request(p, { ...(o || {}), method: "DELETE" }),
  base: API_BASE,
};

export default api;
