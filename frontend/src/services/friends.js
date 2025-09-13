// frontend/src/services/friends.js
/**
 * Friend API helper — single source of truth for all friend actions.
 * Endpoints expected:
 *  GET  /api/users/friends/status?userId=&username=
 *  POST /api/users/friends/request   { toUserId?, username? }
 *  POST /api/users/friends/cancel    { toUserId?, username? }
 *  POST /api/users/friends/accept    { fromUserId?, username? }
 *  POST /api/users/friends/decline   { fromUserId?, username? }
 *  POST /api/users/friends/unfriend  { userId?, username? }
 *  GET  /api/users/friends/counts
 *  GET  /api/users/friends/incoming
 *  GET  /api/users/friends/outgoing
 *  GET  /api/users/friends/list
 */

const isLocal = /localhost|127\.0\.0\.1/.test(window.location.hostname);

// --- Match api.js behavior so prod points to https://api.<apex> ---
function deriveProdBase() {
  const host = window.location.hostname; // e.g., netspacezone.com | www.netspacezone.com
  if (!host) return "";
  const parts = host.split(".").filter(Boolean);
  if (parts.length >= 2) {
    const apex = parts.slice(-2).join(".");
    return `https://api.${apex}`;
  }
  return "";
}

const ENV_BASE =
  (typeof import.meta !== "undefined" &&
    (import.meta?.env?.VITE_API_BASE_URL || import.meta?.env?.VITE_API_BASE)) || "";

const API_BASE = (ENV_BASE || (isLocal ? "http://localhost:5000" : deriveProdBase())).replace(/\/$/, "");

if (!API_BASE) {
  // eslint-disable-next-line no-console
  console.warn("[friends] API_BASE could not be resolved; requests will be relative to origin.");
}

export const FRIEND_STATUS = /** @type {const} */ ({
  SELF: "self",
  NONE: "none",
  PENDING: "pending",   // you sent a request
  INCOMING: "incoming", // they sent you a request
  FRIENDS: "friends",
});

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

/* ---------- token bridge: recover JWT from httpOnly cookie on 401 ---------- */
async function primeAuthFromCookie() {
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

/**
 * requestJSON
 * - For GET: do NOT send custom headers (Authorization, Content-Type) → avoid CORS preflight; use cookies.
 * - On 401, prime token via token-bridge and retry ONCE with Authorization header.
 * - For mutating requests (POST/etc): keep JSON + Authorization.
 */
async function requestJSON(path, { method = "GET", headers, body, qs } = {}, _retried = false) {
  const url = new URL(`${API_BASE}${path}`);
  if (qs && typeof qs === "object") {
    Object.entries(qs).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).length > 0) {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const isGet = String(method || "GET").toUpperCase() === "GET";
  const token = getToken();

  // Build headers conservatively
  const baseHeaders = {};
  if (!isGet) {
    if (!(body instanceof FormData)) baseHeaders["Content-Type"] = "application/json";
    if (token) baseHeaders["Authorization"] = `Bearer ${token}`;
  }
  Object.assign(baseHeaders, headers || {});

  const res = await fetch(url.toString(), {
    method,
    credentials: "include",
    headers: baseHeaders,
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });

  // If a GET still hits 401, try token-bridge then retry once WITH Authorization
  if (isGet && res.status === 401 && !_retried) {
    const ok = await primeAuthFromCookie();
    if (ok) {
      const retryHeaders = { ...(headers || {}) };
      const t2 = getToken();
      if (t2) retryHeaders["Authorization"] = `Bearer ${t2}`;
      return requestJSON(path, { method, headers: retryHeaders, body, qs }, true);
    }
  }

  const text = await res.text().catch(() => "");
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  return { ok: res.ok, status: res.status, data, raw: text };
}

function normalizeStatus(value) {
  const v = String(value || "").toLowerCase();
  if (v === "self") return FRIEND_STATUS.SELF;
  if (v === "friends" || v === "friend") return FRIEND_STATUS.FRIENDS;
  if (v === "incoming" || v === "received") return FRIEND_STATUS.INCOMING;
  if (v === "pending" || v === "sent" || v === "requested") return FRIEND_STATUS.PENDING;
  return FRIEND_STATUS.NONE;
}

/** ---------- Public API ---------- */

export async function getStatus({ userId, username }) {
  const { ok, status, data, raw } = await requestJSON(
    "/api/users/friends/status",
    { qs: { userId, username } }
  );
  if (!ok) return { ok, status, statusText: normalizeStatus(), error: raw || "Failed" };
  return { ok, status, statusText: normalizeStatus(data?.status), data };
}

export async function requestFriend({ toUserId, username }) {
  const { ok, status, data, raw } = await requestJSON(
    "/api/users/friends/request",
    { method: "POST", body: { toUserId, username } }
  );
  return { ok, status, statusText: normalizeStatus(data?.status || "pending"), data, error: ok ? null : raw };
}

export async function cancelRequest({ toUserId, username }) {
  const { ok, status, data, raw } = await requestJSON(
    "/api/users/friends/cancel",
    { method: "POST", body: { toUserId, username } }
  );
  return { ok, status, statusText: normalizeStatus(data?.status || "none"), data, error: ok ? null : raw };
}

export async function acceptRequest({ fromUserId, username }) {
  const { ok, status, data, raw } = await requestJSON(
    "/api/users/friends/accept",
    { method: "POST", body: { fromUserId, username } }
  );
  return { ok, status, statusText: normalizeStatus(data?.status || "friends"), data, error: ok ? null : raw };
}

export async function declineRequest({ fromUserId, username }) {
  const { ok, status, data, raw } = await requestJSON(
    "/api/users/friends/decline",
    { method: "POST", body: { fromUserId, username } }
  );
  return { ok, status, statusText: normalizeStatus(data?.status || "none"), data, error: ok ? null : raw };
}

export async function unfriend({ userId, username }) {
  const { ok, status, data, raw } = await requestJSON(
    "/api/users/friends/unfriend",
    { method: "POST", body: { userId, username } }
  );
  return { ok, status, statusText: normalizeStatus(data?.status || "none"), data, error: ok ? null : raw };
}

export async function getCounts() {
  const { ok, status, data, raw } = await requestJSON("/api/users/friends/counts");
  if (!ok) return { ok, status, data: { incoming: 0, outgoing: 0, friends: 0 }, error: raw || "Failed" };
  const incoming = Number(data?.incoming || 0);
  const outgoing = Number(data?.outgoing || 0);
  const friends = Number(data?.friends || 0);
  return { ok, status, data: { incoming, outgoing, friends } };
}

export async function listIncoming() {
  const { ok, status, data, raw } = await requestJSON("/api/users/friends/incoming");
  return { ok, status, data: Array.isArray(data) ? data : data?.results || [], error: ok ? null : raw };
}
export async function listOutgoing() {
  const { ok, status, data, raw } = await requestJSON("/api/users/friends/outgoing");
  return { ok, status, data: Array.isArray(data) ? data : data?.results || [], error: ok ? null : raw };
}
export async function listFriends() {
  const { ok, status, data, raw } = await requestJSON("/api/users/friends/list");
  return { ok, status, data: Array.isArray(data) ? data : data?.results || [], error: ok ? null : raw };
}

const FriendsAPI = {
  FRIEND_STATUS,
  normalizeStatus,

  getStatus,
  requestFriend,
  cancelRequest,
  acceptRequest,
  declineRequest,
  unfriend,

  getCounts,
  listIncoming,
  listOutgoing,
  listFriends,
};

export default FriendsAPI;
