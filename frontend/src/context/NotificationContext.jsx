// src/context/NotificationContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import socket from "../socket";
import { useAuth } from "./AuthContext";
import FriendsAPI from "../services/friends";

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user, loading } = useAuth();
  const myId = String(user?._id || "");

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterState, setFilterState] = useState({});

  const recomputeUnread = (list) =>
    setUnreadCount(list.reduce((acc, n) => acc + (n?.read ? 0 : 1), 0));

  const sigOf = (n) =>
    n?._id ||
    `${n?.type || ""}:${n?.requestId || ""}:${n?.actor?._id || ""}:${n?.link || ""}`;

  const dedupe = (list) => {
    const seen = new Set();
    const out = [];
    for (const n of list) {
      const s = sigOf(n);
      if (!seen.has(s)) {
        seen.add(s);
        out.push(n);
      }
    }
    return out;
  };

  const addOne = (n) => {
    if (!n) return;
    setNotifications((prev) => {
      const next = dedupe([n, ...prev]).sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      recomputeUnread(next);
      return next;
    });
  };

  /* ---------- Local cache to survive refresh ---------- */
  const STORE_KEY = myId ? `nsz:notif:friendreq:${myId}` : "";
  const readCache = () => {
    if (!STORE_KEY) return [];
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch { return []; }
  };
  const writeCache = (arr) => {
    if (!STORE_KEY) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(arr)); } catch {}
  };
  const cacheAdd = (item) => {
    const arr = readCache();
    const sig = sigOf(item);
    if (!arr.some((x) => sigOf(x) === sig)) { arr.unshift(item); writeCache(arr); }
  };
  const cacheRemoveByActor = (actorId) => {
    const next = readCache().filter((x) => String(x?.actor?._id || "") !== String(actorId || ""));
    writeCache(next);
  };

  /* ---------- Normalize various incoming row shapes ---------- */
  function resolveActorIdFromIncoming(row) {
    // 1) direct id on the row (common when API returns plain user objects)
    if (row && (row._id || row.id)) return String(row._id || row.id);

    // 2) common flat id fields
    const direct =
      row?.fromUserId || row?.requestedBy || row?.senderId || row?.sender || row?.from ||
      row?.userId || row?.by || row?.a || row?.userA || row?.user || row?.actorId;
    if (direct) return String(direct);

    // 3) nested user objects
    const nested =
      (row?.fromUser && (row.fromUser._id || row.fromUser.id)) ||
      (row?.user && (row.user._id || row.user.id)) ||
      (row?.actor && (row.actor._id || row.actor.id));
    if (nested) return String(nested);

    // 4) fallback: pairKey like "minId:maxId"
    if (row?.pairKey && typeof row.pairKey === "string" && row.pairKey.includes(":")) {
      const [a, b] = row.pairKey.split(":");
      if (String(a) === myId) return String(b);
      if (String(b) === myId) return String(a);
      return String(b || a || "");
    }
    return "";
  }

  function buildFriendRequestNotif(row) {
    const actorId = resolveActorIdFromIncoming(row);
    if (!actorId) return null;

    // Support both "row is a user" and "row has nested user"
    const actorObj =
      row?.fromUser || row?.user || row?.actor || (row?._id || row?.id ? row : null);

    const username =
      (actorObj && (actorObj.username || actorObj.userName)) ||
      row?.fromUsername || row?.username || "";

    const profileImage =
      (actorObj && (actorObj.profileImage || actorObj.profilePic)) ||
      row?.profileImage || "";

    return {
      _id: `frq:${actorId}:${row?.id || row?._id || Date.now()}`,
      type: "friend_request",
      actor: { _id: String(actorId), username, profileImage },
      message: " sent you a friend request",
      link: username ? `/profile/${username}` : "",
      createdAt: row?.createdAt || new Date().toISOString(),
      read: false,
    };
  }

  /* ---------- Backfill from Friends (single source of truth) ---------- */
  async function backfillFromFriends() {
    try {
      const [inc, cnt] = await Promise.all([FriendsAPI.listIncoming(), FriendsAPI.getCounts()]);
      const rows = inc.ok
        ? Array.isArray(inc.data)
          ? inc.data
          : inc.data?.results || inc.data?.items || []
        : [];

      const mapped = [];
      rows.forEach((r) => {
        const n = buildFriendRequestNotif(r);
        if (n) { mapped.push(n); cacheAdd(n); }
      });

      setNotifications((prev) => {
        const merged = dedupe([...mapped, ...readCache(), ...prev]).sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        recomputeUnread(merged);
        return merged;
      });

      // use server counts if available; otherwise fall back to mapped length
      const incomingCount = Number(cnt?.data?.incoming ?? mapped.length ?? 0);
      setUnreadCount((prev) => {
        // unread = at least the incoming count; keep "read" flags respected
        return Math.max(
          incomingCount,
          prev
        );
      });
    } catch {
      // ignore silently; sockets will still add live items
    }
  }

  /* ---------- Hydrate on login (cache + friends backfill) ---------- */
  useEffect(() => {
    if (!myId || loading) return;
    try { socket.connect?.(); } catch {}
    try { socket.emit("presence:join", { userId: myId }); } catch {}
    // seed from cache immediately
    readCache().forEach(addOne);
    // then fetch from Friends
    backfillFromFriends();
    return () => { try { socket.emit("presence:leave"); } catch {} };
  }, [myId, loading]);

  /* ---------- Sockets + cache ---------- */
  useEffect(() => {
    if (!myId || loading) return;

    const onFriendRequestCreated = (payload = {}) => {
      const toId = String(
        payload.toUserId || payload.requestedTo || payload.to || payload.b || payload.userB || ""
      );
      if (toId && toId !== myId) return;

      const r = {
        fromUserId:
          payload.fromUserId || payload.requestedBy || payload.from || payload.a || payload.userA || "",
        fromUser: payload.fromUser || payload.user || null,
        createdAt: new Date().toISOString(),
        pairKey: payload.pairKey,
      };
      const n = buildFriendRequestNotif(r);
      if (n) { addOne(n); cacheAdd(n); }
    };

    const onFriendAccepted = (payload = {}) => {
      const a = String(payload.a || payload.userA || payload.fromUserId || "");
      const b = String(payload.b || payload.userB || payload.toUserId || "");
      const other = a === myId ? b : b === myId ? a : "";
      if (other) cacheRemoveByActor(other);
      // also refresh counts to keep badge honest
      FriendsAPI.getCounts().then(({ data }) => {
        if (data) setUnreadCount(Number(data.incoming || 0));
      }).catch(()=>{});
    };

    socket.on("friend:request:created", onFriendRequestCreated);
    socket.on("friend:accepted", onFriendAccepted);

    return () => {
      socket.off("friend:request:created", onFriendRequestCreated);
      socket.off("friend:accepted", onFriendAccepted);
    };
  }, [myId, loading]);

  /* ---------- Actions (safe if REST endpoints are missing) ---------- */
  const markOneRead = async (id) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n._id === id ? { ...n, read: true } : n));
      recomputeUnread(next);
      return next;
    });
  };

  const markAllRead = async () => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      recomputeUnread(next);
      return next;
    });
  };

  const clearOne = async (id) => {
    setNotifications((prev) => {
      const target = prev.find((n) => n._id === id);
      if (target?.type === "friend_request") {
        const actorId = target?.actor?._id;
        if (actorId) cacheRemoveByActor(actorId);
      }
      const next = prev.filter((n) => n._id !== id);
      recomputeUnread(next);
      return next;
    });
  };

  const clearAll = async () => {
    setNotifications([]);
    setUnreadCount(0);
    // keep cached incoming; they reflect real pending requests
  };

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: unreadCount >= 51 ? "50+" : unreadCount,
      filterState,
      setFilterState,
      fetchNotifications: backfillFromFriends, // expose for manual refresh
      markOneRead,
      markAllRead,
      clearOne,
      clearAll,
    }),
    [notifications, unreadCount, filterState]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => useContext(NotificationContext);
