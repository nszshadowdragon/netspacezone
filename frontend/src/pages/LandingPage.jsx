import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";   // ✅ global auth

// ✅ Ensure API_BASE is consistent across pages
const API_BASE =
  import.meta.env.MODE === "production"
    ? "https://api.netspacezone.com"
    : import.meta.env.VITE_API_BASE || "http://localhost:5000";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(`/profile/${user.username}`, { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim() || !password) {
      setError("Username/email and password are required");
      return;
    }

    setLoading(true);
    try {
      // ✅ Login via AuthContext, which already uses API_BASE under the hood
      const loggedInUser = await login(identifier.trim(), password);
      if (loggedInUser) {
        navigate(`/profile/${loggedInUser.username}`, { replace: true });
      }
    } catch (err) {
      setError(err.message || "Login failed");
    }
    setLoading(false);
  };

  return (
    <div style={wrap}>
      <div style={shell}>
        {/* Left side */}
        <div style={leftCol}>
          <img src="/assets/nsz-logo.png" alt="NetSpace Zone" style={logo} />
          <h1 style={{ fontSize: "2rem", color: "#facc15", fontWeight: "bold" }}>
            NetSpace Zone
          </h1>
          <p style={{ fontSize: "1.3rem", color: "#ccc" }}>
            Where connection meets cosmos
          </p>
        </div>

        {/* Right side: login */}
        <div style={rightCol}>
          <h2 style={{ fontSize: "1.6rem", marginBottom: "1.5rem" }}>
            Login to your account
          </h2>

          <form onSubmit={handleLogin}>
            <label>Username or Email</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter your username or email"
              style={input}
              autoComplete="username"
            />

            <label style={{ marginTop: "1rem" }}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={input}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={showBtn}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <div style={row}>
              <label style={{ display: "flex", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                Remember me
              </label>
              <a href="#" style={{ color: "#0ff", fontSize: "0.9rem" }}>
                Forgot password?
              </a>
            </div>

            <button type="submit" style={loginBtn} disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>

            {error && (
              <p style={{ color: "#f87171", marginTop: "0.8rem" }}>{error}</p>
            )}
          </form>

          <hr style={{ margin: "2rem 0", borderColor: "#333" }} />

          <button
            onClick={() => navigate("/signup")}
            style={{ ...loginBtn, backgroundColor: "#0ff" }}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- styles ---- */
const wrap = {
  minHeight: "100vh",
  width: "100vw",
  background: "#000",
  color: "#facc15",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontFamily: "Arial, sans-serif",
  padding: "2rem",
  overflowX: "hidden",
};
const shell = {
  display: "flex",
  flexDirection: "row",
  width: "100%",
  maxWidth: "1000px",
  background: "#111",
  borderRadius: "12px",
  boxShadow: "0 0 20px #facc15",
  overflow: "hidden",
};
const leftCol = {
  flex: 1,
  background: "linear-gradient(to bottom right, #000, #111)",
  padding: "3rem",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  textAlign: "center",
};
const rightCol = {
  flex: 1,
  background: "#000",
  padding: "3rem",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};
const logo = {
  height: "180px",
  marginBottom: "1rem",
  display: "inline-block",
  objectFit: "contain",
  filter: "drop-shadow(0 0 36px #0ff8) drop-shadow(0 2px 20px #4a00e088)",
  transform: "rotate(-7deg)",
};
const input = {
  width: "100%",
  padding: "0.6rem",
  borderRadius: "6px",
  border: "1px solid #333",
  background: "#000",
  color: "#facc15",
  fontSize: "1rem",
  marginBottom: "0.5rem",
};
const showBtn = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  background: "none",
  border: "none",
  color: "#facc15",
  cursor: "pointer",
};
const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "1rem",
};
const loginBtn = {
  marginTop: "1.5rem",
  padding: "0.75rem",
  width: "100%",
  background: "#facc15",
  color: "#000",
  fontWeight: "bold",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
};
