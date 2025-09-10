// frontend/src/context/FriendsContext.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import socket from "../socket";
import FriendsAPI from "../services/friends";

/**
 * FriendsContext
 * - Holds incoming/outgoing/friends counts
 * - Exposes refreshCounts() to manually sync
 * - Subscribes to socket friend events and auto-refreshes (debounced)
 */

const FriendsCtx = createContext({
  counts: { incoming: 0, outgoing: 0, friends: 0 },
  loading: false,
  refreshCounts: () => Promise.resolve(),
  setCounts: () => {},
});

export function useFriends() {
  return useContext(FriendsCtx);
}

function useDebounced(fn, delay = 400) {
  const tRef = useRef(null);
  const cbRef = useRef(fn);
  cbRef.current = fn;
  return useCallback((...args) => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => cbRef.current(...args), delay);
  }, [delay]);
}

export function FriendsProvider({ children }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState({ incoming: 0, outgoing: 0, friends: 0 });
  const [loading, setLoading] = useState(false);

  const loggedIn = !!user?._id;

  const refreshCounts = useCallback(async () => {
    if (!loggedIn) {
      setCounts({ incoming: 0, outgoing: 0, friends: 0 });
      return;
    }
    setLoading(true);
    try {
      const { ok, data } = await FriendsAPI.getCounts();
      if (ok && data) setCounts(data);
    } finally {
      setLoading(false);
    }
  }, [loggedIn]);

  // Initial fetch
  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  // Socket-driven refresh (debounced to avoid thrash)
  const debouncedRefresh = useDebounced(refreshCounts, 350);

  useEffect(() => {
    if (!loggedIn) return;

    function onReqCreated() {
      debouncedRefresh();
    }
    function onReqCanceled() {
      debouncedRefresh();
    }
    function onAccepted() {
      debouncedRefresh();
    }
    function onDeclined() {
      debouncedRefresh();
    }
    function onRemoved() {
      debouncedRefresh();
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
  }, [loggedIn, debouncedRefresh]);

  const value = useMemo(
    () => ({
      counts,
      loading,
      refreshCounts,
      setCounts,
    }),
    [counts, loading, refreshCounts]
  );

  return <FriendsCtx.Provider value={value}>{children}</FriendsCtx.Provider>;
}
