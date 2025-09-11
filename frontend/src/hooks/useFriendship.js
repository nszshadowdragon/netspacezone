// frontend/src/hooks/useFriendship.js
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import socket from "../socket";
import {
  FRIEND_STATUS,
  getStatus,
  requestFriend,
  cancelRequest,
  acceptRequest,
  declineRequest,
  unfriend as unfriendApi,
} from "../services/friends";

/**
 * Tracks & mutates friendship status with:
 * - Optimistic guard (prevents weaker stale updates from overriding stronger local state)
 * - Dual-channel local signals (BroadcastChannel + window event)
 * - Delayed reconcile refresh so slow sockets/server can't regress the UI
 */

const CACHE = new Map();           // key -> { status, ts }
const TTL_MS = 30_000;

// Strength order to resolve races (higher wins)
const RANK = {
  [FRIEND_STATUS.NONE]: 0,
  [FRIEND_STATUS.INCOMING]: 1,
  [FRIEND_STATUS.PENDING]: 1,
  [FRIEND_STATUS.FRIENDS]: 2,
  [FRIEND_STATUS.SELF]: 3,
};

function keyFor({ userId, username }) {
  const id = userId ? String(userId) : "";
  const uname = (username || "").toLowerCase();
  return `id:${id}|u:${uname}`;
}
function getCached(k) {
  const v = CACHE.get(k);
  if (!v) return null;
  if (Date.now() - (v.ts || 0) > TTL_MS) { CACHE.delete(k); return null; }
  return v.status || null;
}
function setCached(k, status) { CACHE.set(k, { status, ts: Date.now() }); }

export default function useFriendship({ userId, username }) {
  const { user: me } = useAuth();
  const targetId = userId ? String(userId) : "";
  const targetUsername = (username || "").trim();

  const isSelf = useMemo(() => {
    if (!me) return false;
    if (targetId && me._id) return String(targetId) === String(me._id);
    if (targetUsername && me.username)
      return targetUsername.toLowerCase() === String(me.username).toLowerCase();
    return false;
  }, [me?._id, me?.username, targetId, targetUsername]);

  const k = useMemo(() => keyFor({ userId: targetId, username: targetUsername }), [targetId, targetUsername]);

  const [status, setStatus] = useState(() => (isSelf ? FRIEND_STATUS.SELF : getCached(k) || FRIEND_STATUS.NONE));
  const [busy, setBusy] = useState(false);

  // Optimistic guard window
  const optimisticRef = useRef(null); // { desired, until }
  const setOptimistic = useCallback((desired, holdMs = 2500) => {
    optimisticRef.current = { desired, until: Date.now() + holdMs };
    setTimeout(() => {
      if (optimisticRef.current && Date.now() >= optimisticRef.current.until) {
        optimisticRef.current = null;
      }
    }, holdMs + 60);
  }, []);

  const guardedApply = useCallback((next) => {
    const opt = optimisticRef.current;
    if (opt && Date.now() < opt.until) {
      // Don't allow weaker state to override stronger optimistic state
      if (RANK[next] < RANK[opt.desired]) return;
    }
    setStatus(next);
    setCached(k, next);
  }, [k]);

  const refresh = useCallback(async () => {
    if (isSelf || !me || (!targetId && !targetUsername)) {
      guardedApply(isSelf ? FRIEND_STATUS.SELF : FRIEND_STATUS.NONE);
      return { ok: true, status: isSelf ? FRIEND_STATUS.SELF : FRIEND_STATUS.NONE };
    }
    const res = await getStatus({ userId: targetId, username: targetUsername });
    const next = res.ok ? res.statusText : FRIEND_STATUS.NONE;
    guardedApply(next);
    return { ok: res.ok, status: next };
  }, [isSelf, me, targetId, targetUsername, guardedApply]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = getCached(k);
      if (cached !== null) {
        guardedApply(isSelf ? FRIEND_STATUS.SELF : cached);
      } else {
        const r = await refresh();
        if (!alive) return;
        if (!r.ok) guardedApply(isSelf ? FRIEND_STATUS.SELF : FRIEND_STATUS.NONE);
      }
    })();
    return () => { alive = false; };
  }, [k, isSelf, refresh, guardedApply]);

  // socket live updates (guarded)
  useEffect(() => {
    if (!me) return;
    const myId = String(me._id || "");
    const theirId = String(targetId || "");

    const match = (a, b) => a && b && String(a) === String(b);

    const onReqCreated = (p = {}) => {
      const from = String(p.fromUserId || p.from || "");
      const to   = String(p.toUserId   || p.to   || "");
      if (match(from, myId) && (match(to, theirId) || !theirId)) guardedApply(FRIEND_STATUS.PENDING);
      else if ((match(from, theirId) || !theirId) && match(to, myId)) guardedApply(FRIEND_STATUS.INCOMING);
    };
    const onReqCanceled = (p = {}) => {
      const from = String(p.fromUserId || p.from || "");
      const to   = String(p.toUserId   || p.to   || "");
      if ([from, to].some(id => match(id, theirId) || match(id, myId))) guardedApply(FRIEND_STATUS.NONE);
    };
    const onAccepted = (p = {}) => {
      const a = String(p.a || p.userA || p.fromUserId || "");
      const b = String(p.b || p.userB || p.toUserId   || "");
      if ([a, b].some(id => match(id, theirId)) && [a, b].some(id => match(id, myId))) guardedApply(FRIEND_STATUS.FRIENDS);
    };
    const onDeclined = onReqCanceled;
    const onRemoved  = (p = {}) => onReqCanceled({ fromUserId: p.a, toUserId: p.b });

    socket.on("friend:request:created", onReqCreated);
    socket.on("friend:request:canceled", onReqCanceled);
    socket.on("friend:accepted", onAccepted);
    socket.on("friend:declined", onDeclined);
    socket.on("friend:removed", onRemoved);

    return () => {
      socket.off("friend:request:created", onReqCreated);
      socket.off("friend:request:canceled", onReqCanceled);
      socket.off("friend:accepted", onAccepted);
      socket.off("friend:declined", onDeclined);
      socket.off("friend:removed", onRemoved);
    };
  }, [me?._id, targetId, guardedApply]);

  // 🔸 Dual-channel local signal listener (BroadcastChannel + window event)
  useEffect(() => {
    let bc = null;
    try {
      if ("BroadcastChannel" in window) bc = new BroadcastChannel("nsz:friend");
    } catch {}
    const onLocal = (detail) => {
      const { type, otherId } = detail || {};
      if (!otherId || String(otherId) !== String(targetId)) return;

      if (type === "accepted") {
        setOptimistic(FRIEND_STATUS.FRIENDS);
        guardedApply(FRIEND_STATUS.FRIENDS);
        // delayed reconcile: ensure backend/socket state won't regress
        setTimeout(() => { refresh().catch(() => {}); }, 300);
      } else if (type === "declined" || type === "canceled") {
        setOptimistic(FRIEND_STATUS.NONE);
        guardedApply(FRIEND_STATUS.NONE);
        setTimeout(() => { refresh().catch(() => {}); }, 300);
      }
    };

    const onWindow = (e) => onLocal(e.detail);
    window.addEventListener("nsz:friend", onWindow);
    const onBC = (e) => onLocal(e?.data);
    bc && (bc.onmessage = onBC);

    return () => {
      window.removeEventListener("nsz:friend", onWindow);
      try { bc && bc.close(); } catch {}
    };
  }, [targetId, guardedApply, setOptimistic, refresh]);

  // --------- actions (optimistic + guarded) ---------
  const request = useCallback(async () => {
    if (isSelf || busy) return { ok: false, error: "self" };
    const prev = status;
    setBusy(true);
    setOptimistic(FRIEND_STATUS.PENDING);
    guardedApply(FRIEND_STATUS.PENDING);
    const res = await requestFriend({ toUserId: targetId, username: targetUsername });
    if (!res.ok) guardedApply(prev);
    setBusy(false);
    return res;
  }, [isSelf, busy, status, targetId, targetUsername, guardedApply, setOptimistic]);

  const cancel = useCallback(async () => {
    if (isSelf || busy) return { ok: false, error: "self" };
    const prev = status;
    setBusy(true);
    setOptimistic(FRIEND_STATUS.NONE);
    guardedApply(FRIEND_STATUS.NONE);
    const res = await cancelRequest({ toUserId: targetId, username: targetUsername });
    if (!res.ok) guardedApply(prev);
    setBusy(false);
    return res;
  }, [isSelf, busy, status, targetId, targetUsername, guardedApply, setOptimistic]);

  const accept = useCallback(async () => {
    if (isSelf || busy) return { ok: false, error: "self" };
    const prev = status;
    setBusy(true);
    setOptimistic(FRIEND_STATUS.FRIENDS);
    guardedApply(FRIEND_STATUS.FRIENDS);
    const res = await acceptRequest({ fromUserId: targetId, username: targetUsername });
    if (!res.ok) guardedApply(prev);
    setBusy(false);
    return res;
  }, [isSelf, busy, status, targetId, targetUsername, guardedApply, setOptimistic]);

  const decline = useCallback(async () => {
    if (isSelf || busy) return { ok: false, error: "self" };
    const prev = status;
    setBusy(true);
    setOptimistic(FRIEND_STATUS.NONE);
    guardedApply(FRIEND_STATUS.NONE);
    const res = await declineRequest({ fromUserId: targetId, username: targetUsername });
    if (!res.ok) guardedApply(prev);
    setBusy(false);
    return res;
  }, [isSelf, busy, status, targetId, targetUsername, guardedApply, setOptimistic]);

  const unfriend = useCallback(async () => {
    if (isSelf || busy) return { ok: false, error: "self" };
    const prev = status;
    setBusy(true);
    setOptimistic(FRIEND_STATUS.NONE);
    guardedApply(FRIEND_STATUS.NONE);
    const res = await unfriendApi({ userId: targetId, username: targetUsername });
    if (!res.ok) guardedApply(prev);
    setBusy(false);
    return res;
  }, [isSelf, busy, status, targetId, targetUsername, guardedApply, setOptimistic]);

  return {
    status,
    busy,
    refresh,
    setStatus, // exposed for rare manual overrides
    request,
    cancel,
    accept,
    decline,
    unfriend,
    FRIEND_STATUS,
  };
}
