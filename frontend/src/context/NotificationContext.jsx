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

  /* ---------- helpers ---------- */
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

  /* ---------- local cache (survives refresh) ---------- */
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
    const arr = readCache().filter((x) => String(x?.actor?._id || "") !== String(actorId || ""));
    writeCache(arr);
  };

  /* ---------- backfill from Friends (always) ---------- */
  async function backfillFromFriends() {
    try {
      const inc = await FriendsAPI.listIncoming();
      if (inc.ok) {
        (inc.data || []).forEach((r) => {
          const item = {
            _id: `frq:${r.fromUserId}:${r.id || Date.now()}`,
            type: "friend_request",
            actor: {
              _id: String(r.fromUserId || ""),
              username: r.fromUser?.username || "",
              profileImage: r.fromUser?.profileImage || r.fromUser?.profilePic || "",
            },
            message: " sent you a friend request",
            link: r.fromUser?.username ? `/profile/${r.fromUser.username}` : "",
            createdAt: r.createdAt || new Date().toISOString(),
            read: false,
          };
          addOne(item);
          cacheAdd(item);
        });
      }
    } catch {/* ignore */}
  }

  /* ---------- fetch notifications (merge) ---------- */
  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications");
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setNotifications((prev) => {
        const merged = dedupe([...items, ...prev]).sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        recomputeUnread(merged);
        return merged;
      });
    } catch (err) {
      // Any error (401, 5xx, etc) → keep what we have and still backfill friends
      // eslint-disable-next-line no-console
      console.warn("Notifications fetch error; using friends backfill.", err?.response?.status || err?.message);
    } finally {
      // Always merge cached friend requests, then backfill live from friends
      const cached = readCache();
      if (cached.length) cached.forEach(addOne);
      await backfillFromFriends();
    }
  };

  /* ---------- join per-user room ---------- */
  useEffect(() => {
    if (!myId || loading) return;
    try { socket.connect?.(); } catch {}
    try { socket.emit("presence:join", { userId: myId }); } catch {}
    return () => { try { socket.emit("presence:leave"); } catch {} };
  }, [myId, loading]);

  /* ---------- sockets + synth + cache ---------- */
  useEffect(() => {
    if (!user || loading) return;

    // first load (merge REST + cache + backfill)
    fetchNotifications();

    const acceptIfMine = (raw) => {
      const n = raw?.payload ? raw.payload : raw;
      if (raw?.toUserId && String(raw.toUserId) !== myId) return;
      if (!n) return;
      addOne(n);
      if (n.type === "friend_request") cacheAdd(n);
    };

    const onFriendRequest = ({ fromUserId, toUserId }) => {
      if (String(toUserId) !== myId) return;
      const item = {
        _id: `frq:${fromUserId}:${Date.now()}`,
        type: "friend_request",
        actor: { _id: String(fromUserId) },
        message: " sent you a friend request",
        link: "",
        createdAt: new Date().toISOString(),
        read: false,
      };
      addOne(item);
      cacheAdd(item);
    };

    const onFriendAccept = ({ a, b }) => {
      const other =
        String(a) === myId ? String(b) : String(b) === myId ? String(a) : "";
      if (!other) return;
      // remove cached request from that actor
      cacheRemoveByActor(other);
    };

    socket.on("notification:new", acceptIfMine);
    socket.on("notification:update", acceptIfMine);
    socket.on("notification:remove", acceptIfMine);
    socket.on("friend:request:created", onFriendRequest);
    socket.on("friend:accepted", onFriendAccept);

    return () => {
      socket.off("notification:new", acceptIfMine);
      socket.off("notification:update", acceptIfMine);
      socket.off("notification:remove", acceptIfMine);
      socket.off("friend:request:created", onFriendRequest);
      socket.off("friend:accepted", onFriendAccept);
    };
  }, [user, loading, myId]);

  /* ---------- actions (tolerate missing REST) ---------- */
  const markOneRead = async (id) => {
    try { await api.patch(`/notifications/${id}/read`); } catch {}
    setNotifications((prev) => {
      const next = prev.map((n) => (n._id === id ? { ...n, read: true } : n));
      recomputeUnread(next);
      return next;
    });
  };

  const markAllRead = async () => {
    try { await api.post("/notifications/read-all"); } catch {}
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      recomputeUnread(next);
      return next;
    });
  };

  const clearOne = async (id) => {
    try { await api.delete(`/notifications/${id}`); } catch {}
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
    try { await api.delete(`/notifications`); } catch {}
    setNotifications([]);
    setUnreadCount(0);
    // do not clear cached incoming; they represent real pending requests
  };

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: unreadCount >= 51 ? "50+" : unreadCount,
      filterState,
      setFilterState,
      fetchNotifications, // bell calls this on open
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
