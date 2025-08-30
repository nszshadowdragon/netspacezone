// frontend/src/pages/LandingPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// API base (dev/prod)
const API_BASE =
  import.meta.env.MODE === "production"
    ? "https://api.netspacezone.com"
    : (import.meta.env.VITE_API_BASE || "http://localhost:5000");

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth() || {};

  const [identifier, setIdentifier] = useState(""); // username OR email
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already signed in? go in-app
  useEffect(() => {
    if (user?.username) navigate("/spacehub", { replace: true });
  }, [user?.username, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const id = identifier.trim();
    const pw = password;
    if (!id || !pw) {
      setError("Username/email and password are required");
      return;
    }

    setLoading(true);
    try {
      // Backend expects: { identifier, password }
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: id, password: pw, remember }),
      });

      if (!res.ok) {
        let msg = `Login failed (${res.status})`;
        try {
          const j = await res.json();
          if (j?.error || j?.message) msg = j.error || j.message;
        } catch {}
        throw new Error(msg);
      }

      // Get username from response (various shapes supported)
      let data = {};
      try { data = await res.json(); } catch {}
      const u = data?.user || data || {};
      const uname = u.username || u.handle || u.name;

      // Hard navigation so the cookie session is picked up immediately
      if (uname) {
        window.location.assign(`/profile/${encodeURIComponent(uname)}`);
      } else {
        window.location.assign("/spacehub");
      }
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        :root { --gold: #facc15; }
        .landing-wrap {
          min-height: 100vh; width: 100%; background: #000; color: var(--gold);
          display: grid; place-items: center; padding: clamp(16px, 4vw, 48px); overflow-x: hidden;
        }
        .landing-shell { display: grid; grid-template-columns: 1fr 1fr; width: 100%; max-width: 1100px;
          background: #111; border-radius: 16px; box-shadow: 0 0 24px rgba(250,204,21,.35); overflow: hidden; }
        .landing-left, .landing-right { padding: clamp(20px, 4vw, 48px); }
        .landing-left {
          background: radial-gradient(1200px 600px at 10% -10%, rgba(0,255,255,.12), transparent 60%),
                      radial-gradient(800px 400px at 110% 10%, rgba(74,0,224,.15), transparent 60%),
                      linear-gradient(180deg,#000 0%, #111 100%);
          display: grid; align-content: center; text-align: center; gap: clamp(10px, 2vw, 16px);
        }
        .landing-logo { width: clamp(140px, 30vw, 220px); height: auto; margin: 0 auto; display: block; object-fit: contain;
                        filter: drop-shadow(0 0 36px rgba(0,255,255,.5)) drop-shadow(0 2px 20px rgba(74,0,224,.53));
                        transform: rotate(-6deg); }
        .landing-title { font-size: clamp(24px, 4vw, 36px); font-weight: 800; color: var(--gold); margin: 0; }
        .landing-subtitle { font-size: clamp(16px, 2.5vw, 20px); color: #ccc; margin: 0; }
        .landing-right { background: #000; display: grid; gap: clamp(12px, 2.5vw, 20px); }
        .landing-form { display: grid; gap: 10px; margin-top: 8px; }
        .landing-input { width: 100%; padding: 12px 14px; background: #0d0d0d; color: #eee; border: 1px solid #333; border-radius: 10px; outline: none; }
        .landing-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(250,204,21,.2); }
        .pw-wrap { position: relative; }
        .show-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #0ff; cursor: pointer; font-weight: 700; padding: 0 4px; }
        .landing-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 10px; flex-wrap: wrap; }
        .login-btn, .signup-btn { margin-top: 16px; padding: clamp(10px, 3vw, 14px); width: 100%; font-weight: 800; border: none; border-radius: 10px; cursor: pointer; font-size: clamp(14px, 2.8vw, 16px); }
        .login-btn { background: var(--gold); color: #111; }
        .signup-btn { background: #0ff; color: #111; }
        .divider { margin: clamp(16px, 3vw, 28px) 0; border: 0; border-top: 1px solid #333; }
        @media (max-width: 980px) { .landing-shell { grid-template-columns: 1fr; } .landing-left { order: 1; } .landing-right { order: 2; } }
        @media (max-width: 520px) { .landing-shell { border-radius: 12px; box-shadow: 0 0 16px rgba(250,204,21,.25); } .landing-row { justify-content: flex-start; } }
      `}</style>

      <div className="landing-wrap">
        <div className="landing-shell">
          <div className="landing-left">
            <img src="/assets/nsz-logo.png" alt="NetSpace Zone" className="landing-logo" />
            <h1 className="landing-title">NetSpace Zone</h1>
            <p className="landing-subtitle">Where connection meets cosmos</p>
          </div>

          <div className="landing-right">
            <h2 style={{ fontSize: "clamp(18px, 3.8vw, 26px)", margin: 0 }}>Login to your account</h2>

            <form className="landing-form" onSubmit={handleLogin}>
              <label>Username or Email</label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter your username or email"
                className="landing-input"
                autoComplete="username"
                inputMode="email"
              />

              <label style={{ marginTop: 12 }}>Password</label>
              <div className="pw-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="landing-input"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="show-btn"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <div className="landing-row">
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  style={{ background: "none", border: "none", color: "#0ff", cursor: "pointer", padding: 0, fontSize: "0.95rem" }}
                >
                  Forgot password?
                </button>
              </div>

              {error && <div style={{ color: "#f87171", marginTop: 8, fontWeight: 600 }}>{error}</div>}

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </button>

              <hr className="divider" />

              <button type="button" onClick={() => navigate("/signup")} className="signup-btn">
                Sign Up
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
