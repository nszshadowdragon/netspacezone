// src/context/NotificationContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import socket from "../socket";
import api from "../api";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user, loading } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterState, setFilterState] = useState({});

  // Fetch from backend
  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications");
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setNotifications(items);
      setUnreadCount(items.filter(n => !n.read).length);
    } catch (err) {
      console.error("Fetch notifications failed:", err);
    }
  };

  // Socket listeners
  useEffect(() => {
    if (!user || loading) return;

    fetchNotifications();

    const handleNew = (n) => {
      setNotifications(prev => {
        const exists = prev.some(
          p => p.type === n.type && p.requestId === n.requestId && p.actor?._id === n.actor?._id
        );
        return exists ? prev : [n, ...prev];
      });
      if (!n.read) setUnreadCount(prev => prev + 1);
    };

    const handleUpdate = (patch) => {
      if (patch?.allRead) {
        setNotifications(prev =>
          prev.map(n =>
            n.type === "friend_request" && n.requestId ? n : { ...n, read: true }
          )
        );
        setUnreadCount(0);
        return;
      }
      if (patch?._id) {
        setNotifications(prev =>
          prev.map(n => (n._id === patch._id ? { ...n, ...patch } : n))
        );
        if (patch.read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    };

    const handleRemove = (id) => {
      setNotifications(prev => prev.filter(n => String(n._id) !== String(id)));
      setUnreadCount(prev => Math.max(0, prev - 1));
    };

    socket.on("notification:new", handleNew);
    socket.on("notification:update", handleUpdate);
    socket.on("notification:remove", handleRemove);

    return () => {
      socket.off("notification:new", handleNew);
      socket.off("notification:update", handleUpdate);
      socket.off("notification:remove", handleRemove);
    };
  }, [user, loading]);

  // Actions
  const markOneRead = async (id) => {
    try {
      const notif = notifications.find(n => n._id === id);
      if (notif?.type === "friend_request" && notif?.requestId) return;
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Mark one read failed:", err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setNotifications(prev =>
        prev.map(n =>
          n.type === "friend_request" && n.requestId ? n : { ...n, read: true }
        )
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Mark all read failed:", err);
    }
  };

  const clearOne = async (id) => {
    try {
      const notif = notifications.find(n => n._id === id);
      if (notif?.type === "friend_request" && notif?.requestId) return;
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (err) {
      console.error("Clear one failed:", err);
    }
  };

  const clearAll = async () => {
    try {
      const toDelete = notifications.filter(
        n => !(n.type === "friend_request" && n.requestId)
      );
      await Promise.allSettled(
        toDelete.map(n => api.delete(`/notifications/${n._id}`))
      );
      setNotifications(prev =>
        prev.filter(n => n.type === "friend_request" && n.requestId)
      );
    } catch (err) {
      console.error("Clear all failed:", err);
    }
  };

  const acceptRequest = async (notif) => {
    try {
      await api.post(`/friend-requests/${notif.requestId}/accept`);
      clearOne(notif._id);
    } catch (err) {
      console.error("Accept friend request failed:", err);
    }
  };

  const declineRequest = async (notif) => {
    try {
      await api.post(`/friend-requests/${notif.requestId}/reject`);
      clearOne(notif._id);
    } catch (err) {
      console.error("Decline friend request failed:", err);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount: unreadCount >= 51 ? "50+" : unreadCount,
        filterState,
        setFilterState,
        fetchNotifications,
        markOneRead,
        markAllRead,
        clearOne,
        clearAll,
        acceptRequest,
        declineRequest
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
