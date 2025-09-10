// src/context/NotificationContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import socket from "../socket";
import api from "../api";
import { useAuth } from "./AuthContext";
import FriendsAPI from "../services/friends"; // ← backfill when /notifications is 404

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user, loading } = useAuth();
  const myId = String(user?._id || "");

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterState, setFilterState] = useState({});

  /* ---------------- helpers ---------------- */
  const recomputeUnread = (list) =>
    setUnreadCount(list.reduce((acc, n) => acc + (n?.read ? 0 : 1), 0));

  // prefer _id; otherwise use a stable signature
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

  /* ---------------- backfill from friends if no REST store ---------------- */
  async function backfillFromFriends() {
    try {
      // Incoming: they sent to me → "friend_request" in All
      const inc = await FriendsAPI.listIncoming();
      if (inc.ok) {
        (inc.data || []).forEach((r) => {
          addOne({
            _id: `frq:${r.fromUserId}:${r.id || Date.now()}`, // synthetic id
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
          });
        });
      }
    } catch {
      /* ignore */
    }
  }

  /* ---------------- initial fetch (MERGE + tolerate 404) ---------------- */
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
      // 404 means you don’t have a REST notifications store — keep live items and backfill from friends
      if (String(err?.response?.status || "") !== "404") {
        // eslint-disable-next-line no-console
        console.error("Fetch notifications failed:", err?.message || err);
      }
      await backfillFromFriends();
    }
  };

  /* ---------------- join per-user room ---------------- */
  useEffect(() => {
    if (!myId || loading) return;
    try { socket.connect?.(); } catch {}
    try { socket.emit("presence:join", { userId: myId }); } catch {}
    return () => {
      try { socket.emit("presence:leave"); } catch {}
    };
  }, [myId, loading]);

  /* ---------------- socket listeners ---------------- */
  useEffect(() => {
    if (!user || loading) return;

    // first fetch/merge (will backfill if 404)
    fetchNotifications();

    const acceptIfMine = (raw) => {
      // server may send {payload, toUserId} or just payload
      const n = raw?.payload ? raw.payload : raw;
      if (raw?.toUserId && String(raw.toUserId) !== myId) return;
      if (!n) return;
      addOne(n);
    };

    // Fallback synthetic notifications for friend events (All tab),
    // so All works even if user wasn't online at request time.
    const synthFriendRequest = ({ fromUserId, toUserId }) => {
      if (String(toUserId) !== myId) return;
      addOne({
        _id: `frq:${fromUserId}:${Date.now()}`,
        type: "friend_request",
        actor: { _id: String(fromUserId) },
        message: " sent you a friend request",
        link: "",
        createdAt: new Date().toISOString(),
        read: false,
      });
    };

    const synthFriendAccept = ({ a, b }) => {
      const other =
        String(a) === myId ? String(b) : String(b) === myId ? String(a) : "";
      if (!other) return;
      addOne({
        _id: `fac:${other}:${Date.now()}`,
        type: "friend_accept",
        actor: { _id: other },
        message: " accepted your friend request",
        link: "",
        createdAt: new Date().toISOString(),
        read: false,
      });
    };

    socket.on("notification:new", acceptIfMine);
    socket.on("notification:update", acceptIfMine);
    socket.on("notification:remove", acceptIfMine);

    socket.on("friend:request:created", synthFriendRequest);
    socket.on("friend:accepted", synthFriendAccept);

    return () => {
      socket.off("notification:new", acceptIfMine);
      socket.off("notification:update", acceptIfMine);
      socket.off("notification:remove", acceptIfMine);

      socket.off("friend:request:created", synthFriendRequest);
      socket.off("friend:accepted", synthFriendAccept);
    };
  }, [user, loading, myId]);

  /* ---------------- actions (tolerate missing REST endpoints) ---------------- */
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
      const next = prev.filter((n) => n._id !== id);
      recomputeUnread(next);
      return next;
    });
  };

  const clearAll = async () => {
    try { await api.delete(`/notifications`); } catch {}
    setNotifications([]);
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount: unreadCount >= 51 ? "50+" : unreadCount,
        filterState,
        setFilterState,
        fetchNotifications, // bell calls this on open
        markOneRead,
        markAllRead,
        clearOne,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
