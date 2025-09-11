// src/context/NotificationContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import socket from "../socket";
import api from "../api";
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
    // Common fields across different backends
    const direct =
      row.fromUserId || row.requestedBy || row.senderId || row.sender || row.from ||
      row.userId || row.by || row.a || row.userA || row.user || row.actorId;

    if (direct) return String(direct);

    // Nested user objects
    const nested =
      (row.fromUser && (row.fromUser._id || row.fromUser.id)) ||
      (row.user && (row.user._id || row.user.id)) ||
      (row.actor && (row.actor._id || row.actor.id));

    if (nested) return String(nested);

    // Fallback: pairKey like "minId:maxId" — pick the one that's not me
    if (row.pairKey && typeof row.pairKey === "string" && row.pairKey.includes(":")) {
      const [a, b] = row.pairKey.split(":");
      if (String(a) === myId) return String(b);
      if (String(b) === myId) return String(a);
      // no match → pick the second as a last resort
      return String(b || a || "");
    }

    return "";
  }

  function buildFriendRequestNotif(row) {
    const actorId = resolveActorIdFromIncoming(row);
    if (!actorId) return null;

    const actorObj =
      row.fromUser || row.user || row.actor || null;

    const username =
      (actorObj && (actorObj.username || actorObj.userName)) || row.fromUsername || row.username || "";

    const profileImage =
      (actorObj && (actorObj.profileImage || actorObj.profilePic)) || row.profileImage || "";

    return {
      _id: `frq:${actorId}:${row.id || row._id || Date.now()}`,
      type: "friend_request",
      actor: { _id: String(actorId), username, profileImage },
      message: " sent you a friend request",
      link: username ? `/profile/${username}` : "",
      createdAt: row.createdAt || new Date().toISOString(),
      read: false,
    };
  }

  /* ---------- Always backfill from Friends (even if /notifications 404) ---------- */
  async function backfillFromFriends() {
    try {
      const inc = await FriendsAPI.listIncoming();
      const rows = inc.ok
        ? Array.isArray(inc.data)
          ? inc.data
          : inc.data?.results || inc.data?.items || []
        : [];

      rows.forEach((r) => {
        const n = buildFriendRequestNotif(r);
        if (n) { addOne(n); cacheAdd(n); }
      });
    } catch {/* ignore */}
  }

  /* ---------- Fetch and merge ---------- */
  const fetchNotifications = async () => {
    // Merge cached friend requests immediately
    readCache().forEach(addOne);

    // Try REST store (fine if 404)
    const r = await api.get("/api/notifications");
    if (r.ok && Array.isArray(r.data?.items)) {
      setNotifications((prev) => {
        const merged = dedupe([...r.data.items, ...prev]).sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        recomputeUnread(merged);
        return merged;
      });
    } else {
      // eslint-disable-next-line no-console
      console.warn("Notifications fetch error; using friends backfill.", r.status);
    }

    // Always backfill incoming requests from Friends
    await backfillFromFriends();
  };

  /* ---------- Join per-user socket room ---------- */
  useEffect(() => {
    if (!myId || loading) return;
    try { socket.connect?.(); } catch {}
    try { socket.emit("presence:join", { userId: myId }); } catch {}
    return () => { try { socket.emit("presence:leave"); } catch {} };
  }, [myId, loading]);

  /* ---------- Sockets + synth + cache (tolerant to payloads) ---------- */
  useEffect(() => {
    if (!user || loading) return;

    // hydrate (cache + /notifications + friends backfill)
    fetchNotifications();

    const onNotification = (raw) => {
      const n = raw?.payload ? raw.payload : raw;
      if (raw?.toUserId && String(raw.toUserId) !== myId) return;
      if (!n) return;
      addOne(n);
      if (n.type === "friend_request") cacheAdd(n);
    };

    const onFriendRequestCreated = (payload = {}) => {
      // payload might be { fromUserId, toUserId } or more legacy fields
      // Only consider if it's addressed to me
      const toId = String(
        payload.toUserId || payload.requestedTo || payload.to || payload.b || payload.userB || ""
      );
      if (toId && toId !== myId) return;

      // Build a synthetic notif using whatever we have
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
      // Remove cached request so it won't reappear on refresh
      const a = String(payload.a || payload.userA || payload.fromUserId || "");
      const b = String(payload.b || payload.userB || payload.toUserId || "");
      const other = a === myId ? b : b === myId ? a : "";
      if (other) cacheRemoveByActor(other);
    };

    socket.on("notification:new", onNotification);
    socket.on("notification:update", onNotification);
    socket.on("notification:remove", onNotification);
    socket.on("friend:request:created", onFriendRequestCreated);
    socket.on("friend:accepted", onFriendAccepted);

    return () => {
      socket.off("notification:new", onNotification);
      socket.off("notification:update", onNotification);
      socket.off("notification:remove", onNotification);
      socket.off("friend:request:created", onFriendRequestCreated);
      socket.off("friend:accepted", onFriendAccepted);
    };
  }, [user, loading, myId]);

  /* ---------- Actions (tolerate missing REST) ---------- */
  const markOneRead = async (id) => {
    try { await api.patch(`/api/notifications/${id}/read`); } catch {}
    setNotifications((prev) => {
      const next = prev.map((n) => (n._id === id ? { ...n, read: true } : n));
      recomputeUnread(next);
      return next;
    });
  };

  const markAllRead = async () => {
    try { await api.post("/api/notifications/read-all"); } catch {}
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      recomputeUnread(next);
      return next;
    });
  };

  const clearOne = async (id) => {
    try { await api.del(`/api/notifications/${id}`); } catch {}
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
    try { await api.del("/api/notifications"); } catch {}
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
      fetchNotifications,
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
