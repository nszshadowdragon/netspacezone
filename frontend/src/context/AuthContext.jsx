import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

const API_BASE =
  import.meta.env.MODE === "production"
    ? "https://api.netspacezone.com"
    : "";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);      // ✅ loading while checking session
  const [loggingOut, setLoggingOut] = useState(false); // ✅ loading while logging out

  // Check with backend on mount
  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          localStorage.setItem("user", JSON.stringify(data.user));
        } else {
          setUser(null);
          localStorage.removeItem("user");
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        setUser(null);
        localStorage.removeItem("user");
      } finally {
        setLoading(false); // ✅ finished checking
      }
    };
    checkUser();
  }, []);

  // Login using backend + immediately sync user
  const login = async (identifier, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data.error || "Login failed");

    const meRes = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: "include",
    });

    if (meRes.ok) {
      const meData = await meRes.json();
      setUser(meData.user);
      localStorage.setItem("user", JSON.stringify(meData.user));
      return meData.user;
    } else {
      throw new Error("Failed to fetch user after login");
    }
  };

  // Logout with smoother handling
  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout request failed:", err);
    }
    setUser(null);
    localStorage.removeItem("user");
    setLoggingOut(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, loggingOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
