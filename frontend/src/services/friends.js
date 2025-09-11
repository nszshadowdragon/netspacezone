// frontend/src/services/friends.js
const isLocal = /localhost|127\.0\.0\.1/.test(window.location.hostname);
const API_BASE =
  (import.meta?.env?.VITE_API_BASE_URL ||
    import.meta?.env?.VITE_API_BASE ||
    (isLocal ? "http://localhost:5000" : ""))?.replace?.(/\/$/, "") || "";

export const FRIEND_STATUS = {
  SELF: "self",
  NONE: "none",
  PENDING: "pending",   // you sent a request
  INCOMING: "incoming", // they sent you a request
  FRIENDS: "friends",
};

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    ""
  );
}
function authHeaders(extra = {}) {
  const token = getToken();
  const h = { ...(extra || {}) };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
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

async function requestJSON(path, { method = "GET", headers, body, qs } = {}, _retried = false) {
  const url = new URL(`${API_BASE}${path}`);
  if (qs && typeof qs === "object") {
    Object.entries(qs).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).length > 0) {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const res = await fetch(url.toString(), {
    method,
    credentials: "include",
    headers: authHeaders({
      "Content-Type": body instanceof FormData ? undefined : "application/json",
      ...headers,
    }),
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });

  // If unauthorized, try token-bridge once and retry the call
  if (res.status === 401 && !_retried) {
    const ok = await primeAuthFromCookie();
    if (ok) {
      return requestJSON(path, { method, headers, body, qs }, true);
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
