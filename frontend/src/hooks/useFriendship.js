// frontend/src/hooks/useFriendship.js
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import socket from "../socket";
import FriendsAPI, {
  FRIEND_STATUS,
  getStatus,
  requestFriend,
  cancelRequest,
  acceptRequest,
  declineRequest,
  unfriend as unfriendApi,
} from "../services/friends";

/**
 * useFriendship — single hook to track and mutate friendship status
 *
 * Usage:
 *   const { status, busy, request, cancel, accept, decline, unfriend, refresh } =
 *     useFriendship({ userId: profileUser._id, username: profileUser.username });
 */

// ------------ cache (module-scope) ------------
const CACHE = new Map(); // key -> { status, ts }
const TTL_MS = 30_000;

function keyFor({ userId, username }) {
  const id = userId ? String(userId) : "";
  const uname = (username || "").toLowerCase();
  return `id:${id}|u:${uname}`;
}
function getCached(k) {
  const v = CACHE.get(k);
  if (!v) return null;
  if (Date.now() - (v.ts || 0) > TTL_MS) {
    CACHE.delete(k);
    return null;
  }
  return v.status || null;
}
function setCached(k, status) {
  CACHE.set(k, { status, ts: Date.now() });
}

// ------------ hook ------------
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

  // initial & reactive load
  const refresh = useCallback(async () => {
    if (isSelf || !me || (!targetId && !targetUsername)) {
      setStatus(isSelf ? FRIEND_STATUS.SELF : FRIEND_STATUS.NONE);
      return { ok: true, status: isSelf ? FRIEND_STATUS.SELF : FRIEND_STATUS.NONE };
    }
    const res = await getStatus({ userId: targetId, username: targetUsername });
    const next = res.ok ? res.statusText : FRIEND_STATUS.NONE;
    setStatus(next);
    setCached(k, next);
    return { ok: res.ok, status: next };
  }, [isSelf, me, targetId, targetUsername, k]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = getCached(k);
      if (cached !== null) {
        setStatus(isSelf ? FRIEND_STATUS.SELF : cached);
      } else {
        const r = await refresh();
        if (!alive) return;
        if (!r.ok) setStatus((s) => (s === FRIEND_STATUS.SELF ? s : FRIEND_STATUS.NONE));
      }
    })();
    return () => {
      alive = false;
    };
  }, [k, isSelf, refresh]);

  // socket live updates
  useEffect(() => {
    if (!me) return;
    const myId = String(me._id || "");
    const theirId = String(targetId || ""); // can be empty if only username is known

    function matchPair(a, b) {
      // a and b are ids as strings
      return a && b && a === b;
    }

    function onReqCreated(payload = {}) {
      // two scenarios:
      // 1) I sent to them  -> pending
      // 2) They sent to me -> incoming
      const from = String(payload.fromUserId || payload.from || "");
      const to = String(payload.toUserId || payload.to || "");
      if (matchPair(from, myId) && (matchPair(to, theirId) || !theirId)) {
        setStatus(FRIEND_STATUS.PENDING);
        setCached(k, FRIEND_STATUS.PENDING);
      } else if ((matchPair(from, theirId) || !theirId) && matchPair(to, myId)) {
        setStatus(FRIEND_STATUS.INCOMING);
        setCached(k, FRIEND_STATUS.INCOMING);
      }
    }
    function onReqCanceled(payload = {}) {
      const from = String(payload.fromUserId || payload.from || "");
      const to = String(payload.toUserId || payload.to || "");
      if (
        (matchPair(from, myId) && (matchPair(to, theirId) || !theirId)) ||
        ((matchPair(from, theirId) || !theirId) && matchPair(to, myId))
      ) {
        setStatus(FRIEND_STATUS.NONE);
        setCached(k, FRIEND_STATUS.NONE);
      }
    }
    function onAccepted(payload = {}) {
      const a = String(payload.a || payload.userA || payload.fromUserId || "");
      const b = String(payload.b || payload.userB || payload.toUserId || "");
      // Order may vary; if the pair includes both me and them -> friends
      if ([a, b].includes(myId) && ([a, b].includes(theirId) || !theirId)) {
        setStatus(FRIEND_STATUS.FRIENDS);
        setCached(k, FRIEND_STATUS.FRIENDS);
      }
    }
    function onDeclined(payload = {}) {
      const from = String(payload.fromUserId || payload.from || "");
      const to = String(payload.toUserId || payload.to || "");
      if (
        (matchPair(from, theirId) && matchPair(to, myId)) ||
        (matchPair(from, myId) && matchPair(to, theirId))
      ) {
        setStatus(FRIEND_STATUS.NONE);
        setCached(k, FRIEND_STATUS.NONE);
      }
    }
    function onRemoved(payload = {}) {
      const a = String(payload.a || payload.userA || "");
      const b = String(payload.b || payload.userB || "");
      if ([a, b].includes(myId) && ([a, b].includes(theirId) || !theirId)) {
        setStatus(FRIEND_STATUS.NONE);
        setCached(k, FRIEND_STATUS.NONE);
      }
    }

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
  }, [me?._id, targetId, k]);

  // --------- actions (optimistic) ---------
  const request = useCallback(async () => {
    if (isSelf || busy) return { ok: false, error: "self" };
    const prev = status;
    setBusy(true);
    setStatus(FRIEND_STATUS.PENDING);
    setCached(k, FRIEND_STATUS.PENDING);
    const res = await requestFriend({ toUserId: targetId, username: targetUsername });
    if (!res.ok) {
      setStatus(prev);
      setCached(k, prev);
    }
    setBusy(false);
    return res;
  }, [isSelf, busy, status, targetId, targetUsername, k]);

  const cancel = useCallback(async () => {
    if (isSelf || busy) return { ok: false, error: "self" };
    const prev = status;
    setBusy(true);
    setStatus(FRIEND_STATUS.NONE);
    setCached(k, FRIEND_STATUS.NONE);
    const res = await cancelRequest({ toUserId: targetId, username: targetUsername });
    if (!res.ok) {
      setStatus(prev);
      setCached(k, prev);
    }
    setBusy(false);
    return res;
  }, [isSelf, busy, status, targetId, targetUsername, k]);

  const accept = useCallback(async () => {
    if (isSelf || busy) return { ok: false, error: "self" };
    const prev = status;
    setBusy(true);
    setStatus(FRIEND_STATUS.FRIENDS);
    setCached(k, FRIEND_STATUS.FRIENDS);
    const res = await acceptRequest({ fromUserId: targetId, username: targetUsername });
    if (!res.ok) {
      setStatus(prev);
      setCached(k, prev);
    }
    setBusy(false);
    return res;
  }, [isSelf, busy, status, targetId, targetUsername, k]);

  const decline = useCallback(async () => {
    if (isSelf || busy) return { ok: false, error: "self" };
    const prev = status;
    setBusy(true);
    setStatus(FRIEND_STATUS.NONE);
    setCached(k, FRIEND_STATUS.NONE);
    const res = await declineRequest({ fromUserId: targetId, username: targetUsername });
    if (!res.ok) {
      setStatus(prev);
      setCached(k, prev);
    }
    setBusy(false);
    return res;
  }, [isSelf, busy, status, targetId, targetUsername, k]);

  const unfriend = useCallback(async () => {
    if (isSelf || busy) return { ok: false, error: "self" };
    const prev = status;
    setBusy(true);
    setStatus(FRIEND_STATUS.NONE);
    setCached(k, FRIEND_STATUS.NONE);
    const res = await unfriendApi({ userId: targetId, username: targetUsername });
    if (!res.ok) {
      setStatus(prev);
      setCached(k, prev);
    }
    setBusy(false);
    return res;
  }, [isSelf, busy, status, targetId, targetUsername, k]);

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
