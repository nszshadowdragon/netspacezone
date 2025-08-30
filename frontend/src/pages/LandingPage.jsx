// frontend/src/pages/LandingPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_BASE =
  import.meta.env.MODE === "production"
    ? "https://api.netspacezone.com"
    : (import.meta.env.VITE_API_BASE || "http://localhost:5000");

const CSS = `
:root{
  --bg:#000; --card:#0d0d0d; --text:#eee; --muted:#bdbdbd; --gold:#facc15; --cyan:#00f5ff;
}
html,body{ background:var(--bg); color:var(--text); }
*{ box-sizing:border-box; }

.wrap{
  min-height:100vh; min-height:100dvh;
  display:grid; place-items:center;
  padding:clamp(16px,4vw,32px);
  padding-bottom:max(16px, env(safe-area-inset-bottom));
  overflow-x:hidden;
}
.shell{
  width:100%;
  max-width:1000px;
  display:grid;
  grid-template-columns: 1fr 1fr;
  background:#101010;
  border-radius:16px;
  overflow:hidden;
  box-shadow:0 0 24px rgba(250,204,21,.25);
}

.left{
  padding:clamp(20px,4vw,48px);
  background:
    radial-gradient(900px 450px at 15% -10%, rgba(0,255,255,.12), transparent 60%),
    radial-gradient(700px 350px at 110% 10%, rgba(74,0,224,.15), transparent 60%),
    linear-gradient(180deg,#000 0%,#111 100%);
  display:grid; align-content:center; gap:clamp(10px,2vw,16px);
  text-align:center;
}
.logo{
  width: clamp(140px, 42vw, 220px);
  margin:0 auto 6px;
  display:block;
  filter: drop-shadow(0 0 24px rgba(0,255,255,.5)) drop-shadow(0 2px 16px rgba(74,0,224,.45));
  transform: rotate(-6deg);
}
.title{ margin:0; font-weight:800; color:var(--gold); font-size:clamp(24px,4.5vw,36px); }
.subtitle{ margin:0; color:#cfcfcf; font-size:clamp(15px,2.5vw,20px); }

.right{ padding:clamp(20px,4vw,40px); background:var(--bg); }
.card{
  width:100%; max-width:560px; margin:0 auto;
  background:transparent;
}
h2{ margin:0 0 12px; color:var(--gold); font-size:clamp(18px,4.2vw,26px); font-weight:800; }

.form{ display:grid; gap:12px; }
label{ color:var(--muted); font-size:.95rem; }

.input{
  width:100%;
  padding:14px 14px;
  background:var(--card);
  color:var(--text);
  border:1px solid #2c2c2c;
  border-radius:12px;
  outline:none;
  font-size:16px; /* stop iOS zoom */
  line-height:1.2;
}
.input:focus-visible{
  border-color:var(--gold);
  box-shadow:0 0 0 3px rgba(250,204,21,.25);
}

.pw{ position:relative; }
.show{
  position:absolute; right:10px; top:50%; transform:translateY(-50%);
  background:none; border:none; color:var(--cyan);
  font-weight:800; cursor:pointer; padding:4px 6px; font-size:.95rem;
}

.row{ display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-top:6px; }
.link{ background:none; border:none; color:var(--cyan); cursor:pointer; padding:0; font-size:.95rem; }

.btn{
  width:100%; min-height:48px; border:none; border-radius:12px;
  font-weight:800; cursor:pointer; font-size:1rem; margin-top:8px;
}
.btn-gold{ background:var(--gold); color:#111; }
.btn-cyan{ background:var(--cyan); color:#111; }
.divider{ margin:clamp(14px,3vw,24px) 0; border-top:1px solid #2c2c2c; border-bottom:0; }

.err{ color:#f87171; font-weight:700; }

@media (max-width: 860px){
  .shell{ grid-template-columns:1fr; }
  .left{ order:1; padding:28px 20px; }
  .right{ order:2; padding:22px 16px; }
}
`;

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth() || {};

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (user?.username) navigate("/spacehub", { replace: true });
  }, [user?.username, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    const id = identifier.trim();
    if (!id || !password) {
      setErr("Username/email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: id, password, remember }),
      });

      if (!res.ok) {
        let msg = `Login failed (${res.status})`;
        try {
          const j = await res.json();
          if (j?.error || j?.message) msg = j.error || j.message;
        } catch {}
        throw new Error(msg);
      }

      const data = await res.json().catch(() => ({}));
      const u = data?.user || data || {};
      const uname = u.username || u.handle || u.name;
      window.location.assign(uname ? `/profile/${encodeURIComponent(uname)}` : "/spacehub");
    } catch (error) {
      setErr(error?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="wrap">
        <div className="shell">
          {/* Left / hero */}
          <div className="left">
            <img className="logo" src="/assets/nsz-logo.png" alt="NetSpace Zone" />
            <h1 className="title">NetSpace Zone</h1>
            <p className="subtitle">Where connection meets cosmos</p>
          </div>

          {/* Right / auth card */}
          <div className="right">
            <div className="card">
              <h2>Login to your account</h2>

              <form className="form" onSubmit={onSubmit}>
                <label htmlFor="id">Username or Email</label>
                <input
                  id="id"
                  className="input"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter your username or email"
                  autoComplete="username"
                  inputMode="email"
                />

                <label htmlFor="pw" style={{ marginTop: 6 }}>Password</label>
                <div className="pw">
                  <input
                    id="pw"
                    className="input"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="show"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>

                <div className="row">
                  <label style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e)=>setRemember(e.target.checked)}
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    className="link"
                    onClick={() => navigate("/forgot-password")}
                  >
                    Forgot password?
                  </button>
                </div>

                {err && <div className="err">{err}</div>}

                <button type="submit" className="btn btn-gold" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </button>

                <hr className="divider" />

                <button
                  type="button"
                  className="btn btn-cyan"
                  onClick={() => navigate("/signup")}
                >
                  Sign Up
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
