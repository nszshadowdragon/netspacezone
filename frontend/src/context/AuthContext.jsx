// frontend/src/context/AuthContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import socket, { connectSocket, disconnectSocket } from "../socket";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Extract user/token from various shapes
function extractUser(obj) {
  if (!obj) return null;
  return obj.user ?? obj.profile ?? obj.data?.user ?? obj.data?.profile ?? null;
}
function extractToken(obj) {
  if (!obj) return null;
  return obj.token ?? obj.accessToken ?? obj.data?.token ?? obj.data?.accessToken ?? null;
}
const userIdOf = (u) => (u && (u._id || u.id)) || null;
const usernameOf = (u) => u?.username || u?.name || u?.handle || "User";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);   // bootstrapping /api/auth/me
  const [error, setError] = useState("");

  // ---- bootstrap session on first mount ----
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/auth/me`, {
          method: "GET",
          credentials: "include",      // send cookie
          cache: "no-store",
        });

        if (!res.ok) {
          // 401 = not logged in (fine)
          if (res.status !== 401) {
            try {
              const msg = await res.text();
              console.debug("[auth] /me non-401:", res.status, msg);
            } catch {}
          }
          if (!cancelled) setUser(null);
        } else {
          let data = null;
          try { data = await res.json(); } catch {}
          const u = extractUser(data) ?? data ?? null;
          if (!cancelled) setUser(u);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to reach auth service");
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    boot();
    return () => { cancelled = true; };
  }, []);

  // ---- login & logout helpers (always include credentials) ----
  const login = useCallback(async (identifier, password) => {
    setError("");
    const body = { identifier, password };
    const res = await fetch(`/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = `Login failed (${res.status})`;
      try {
        const j = await res.json();
        if (j?.error || j?.message) msg = j.error || j.message;
      } catch {}
      throw new Error(msg);
    }
    let data = {};
    try { data = await res.json(); } catch {}
    const u = extractUser(data) ?? data ?? null;
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
    } catch {}
    setUser(null);
  }, []);

  // ---- socket lifecycle: connect when authed, disconnect otherwise ----
  // Also: join/leave presence so others can see this user online.
  useEffect(() => {
    if (loading) return;

    const uid = userIdOf(user);
    const uname = usernameOf(user);

    if (uid) {
      connectSocket();

      const joinPresence = () => {
        try {
          socket.emit("presence:join", { userId: String(uid), username: uname });
        } catch {}
      };
      // join now + on reconnect
      joinPresence();
      socket.on("connect", joinPresence);

      const beforeUnload = () => {
        try { socket.emit("presence:leave"); } catch {}
      };
      window.addEventListener("beforeunload", beforeUnload);

      return () => {
        // cleanup on logout/user change/unmount
        try { socket.emit("presence:leave"); } catch {}
        socket.off("connect", joinPresence);
        window.removeEventListener("beforeunload", beforeUnload);
      };
    } else {
      // no user -> ensure socket is closed
      disconnectSocket();
    }
  }, [loading, user && userIdOf(user)]);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      setUser,
      login,
      logout,
    }),
    [user, loading, error, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
