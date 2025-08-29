// frontend/src/pages/SignUpPage.jsx
import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Runtime-aware API base: local dev → http://localhost:5000, prod → https://api.netspacezone.com
function apiBase() {
  try {
    const h = window.location.hostname;
    const isLocal = h === "localhost" || h === "127.0.0.1" || h === "::1";
    return isLocal ? "http://localhost:5000" : "https://api.netspacezone.com";
  } catch {
    return "https://api.netspacezone.com";
  }
}
const API_BASE = apiBase();
const SIGNUP_URL = `${API_BASE}/api/auth/signup`;
const ME_URL = `${API_BASE}/api/auth/me`;

const INTERESTS = [
  "Tech","Gaming","Music","Movies","Fitness","Travel","Anime","Fashion",
  "Food","Art","Science","Education","Coding","Sports","Business","News",
  "Photography","Writing","DIY","Parenting","Finance","Comics","Streaming","Pets","History"
];

const SECTIONS = [
  { label: "Basic Info",  key: "basic"   },
  { label: "Security",    key: "security"},
  { label: "Profile",     key: "profile" },
  { label: "Referral",    key: "referral"},
];

export default function SignUpPage() {
  const navigate = useNavigate();

  const refs = {
    basic: useRef(null),
    security: useRef(null),
    profile: useRef(null),
    referral: useRef(null),
  };

  const [form, setForm] = useState({
    username: "",
    usernameAvailable: null,
    email: "",
    birthday: "",
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
    securityQuestion: "",
    securityAnswer: "",
    favoriteQuote: "",
    referral: "",
  });
  const [interests, setInterests] = useState([]);
  const [profilePic, setProfilePic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // optional username availability check (ignored if endpoint not present)
  async function checkUsername(username) {
    if (username.length < 3) {
      setForm((f) => ({ ...f, usernameAvailable: null }));
      return;
    }
    try {
      const r = await fetch(
        `${API_BASE}/api/check-username?username=${encodeURIComponent(username)}`,
        { credentials: "include" }
      );
      if (!r.ok) return setForm((f) => ({ ...f, usernameAvailable: null }));
      const j = await r.json();
      setForm((f) => ({ ...f, usernameAvailable: !!j?.available }));
    } catch {
      setForm((f) => ({ ...f, usernameAvailable: null }));
    }
  }

  const onChange = (e) => {
    const { name, value, type, files, checked } = e.target;
    if (type === "file") {
      setProfilePic(files?.[0] || null);
      return;
    }
    if (type === "checkbox" && name === "interests") {
      setInterests((prev) => (checked ? [...prev, value] : prev.filter((x) => x !== value)));
      return;
    }
    setForm((f) => ({ ...f, [name]: value }));
    if (name === "username") {
      setForm((f) => ({ ...f, usernameAvailable: null }));
      checkUsername(value);
    }
  };

  const age =
    form.birthday
      ? Math.max(
          0,
          new Date(Date.now() - new Date(form.birthday).getTime()).getUTCFullYear() - 1970
        )
      : "";

  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const pw = form.password || "";
  const pwRules = [
    { ok: pw.length >= 8, label: "8+ characters" },
    { ok: /[A-Z]/.test(pw), label: "1 uppercase" },
    { ok: /[a-z]/.test(pw), label: "1 lowercase" },
    { ok: /\d/.test(pw), label: "1 number" },
    { ok: /[^A-Za-z0-9]/.test(pw), label: "1 symbol" },
  ];
  const pwOK = pwRules.every((r) => r.ok) && form.confirmPassword === pw;

  function validate() {
    const e = {};
    if (!form.username) e.username = "Username required";
    else if (form.username.length < 3) e.username = "Min 3 chars";
    else if (form.usernameAvailable === false) e.username = "Not available";

    if (!form.email) e.email = "Email required";
    if (!form.birthday) e.birthday = "Birthday required";
    else if (age && +age < 18) e.birthday = "18+ only";

    if (!form.password) e.password = "Required";
    else if (!pwOK) e.password = "Password requirements not met";

    if (!form.confirmPassword) e.confirmPassword = "Required";
    else if (form.confirmPassword !== form.password) e.confirmPassword = "Does not match";

    if (!profilePic) e.profilePic = "Profile image required";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("username", form.username.trim());
      fd.append("email", form.email.trim());
      fd.append("password", form.password);
      fd.append("firstName", form.firstName.trim());
      fd.append("lastName", form.lastName.trim());
      fd.append("birthday", form.birthday);
      fd.append("referral", form.referral.trim());
      fd.append("interests", interests.join(","));
      fd.append("profilePic", profilePic);
      // optional extras (safe to include even if backend ignores)
      fd.append("securityQuestion", form.securityQuestion);
      fd.append("securityAnswer", form.securityAnswer);
      fd.append("favoriteQuote", form.favoriteQuote);

      const res = await fetch(SIGNUP_URL, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Signup failed (${res.status})`);

      // ensure cookie/session is recognized to avoid flicker
      try {
        await fetch(ME_URL, { credentials: "include" });
      } catch {}

      const dest = data?.user?.username ? `/profile/${data.user.username}` : "/profile";
      // hard navigation prevents a momentary redirect to landing
      window.location.replace(dest);
    } catch (err) {
      setErrors((p) => ({ ...p, submit: err.message || "Signup failed" }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#000", color: "#ffe259", display: "flex", gap: 16, padding: 16 }}>
      {/* Left nav */}
      <nav style={{ position: "sticky", top: 24, alignSelf: "flex-start", width: 140, background: "#15151a", borderRadius: 10, boxShadow: "0 2px 10px #444a", padding: 10, height: "fit-content" }}>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {SECTIONS.map((s) => (
            <li key={s.key} style={{ marginBottom: 10 }}>
              <button type="button" onClick={() => refs[s.key].current?.scrollIntoView({ block: "start" })} style={navBtn}>
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Form */}
      <div style={{ flex: 1, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ margin: "8px 0 16px 0", fontSize: "2rem", fontWeight: 800 }}>Create your account</h1>

        <form onSubmit={submit} autoComplete="off" style={{ color: "#ffe259" }}>
          {/* Step 1 */}
          <section ref={refs.basic} style={sectionStyle}>
            <h2 style={sectionTitle}>Step 1: Basic Info</h2>

            <Field label="Username (required)">
              <input name="username" value={form.username} onChange={onChange} style={inputStyle} autoComplete="username" />
            </Field>
            {form.username.length > 2 && (
              <div style={{ color: form.usernameAvailable === null ? "#aaa" : form.usernameAvailable ? "#16ff80" : "#fa6c6c", fontWeight: 700, fontSize: "0.96rem", marginTop: -8, marginBottom: 8 }}>
                {form.usernameAvailable === null ? "" : form.usernameAvailable ? "Available" : "Not available"}
              </div>
            )}
            {errors.username && <Err>{errors.username}</Err>}

            <Field label="Email (required)">
              <input type="email" name="email" value={form.email} onChange={onChange} style={inputStyle} autoComplete="email" />
            </Field>
            {errors.email && <Err>{errors.email}</Err>}

            <Field label="Birthday (required, 18+)">
              <input type="date" name="birthday" value={form.birthday} onChange={onChange} style={inputStyle} />
            </Field>
            {!!form.birthday && (
              <div style={{ fontSize: "0.98rem", marginTop: -4, color: +age < 18 ? "#f87171" : "#16ff80" }}>
                Age: {age}
              </div>
            )}
            {errors.birthday && <Err>{errors.birthday}</Err>}

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <Field label="First Name">
                <input name="firstName" value={form.firstName} onChange={onChange} style={inputStyle} />
              </Field>
              <Field label="Last Name">
                <input name="lastName" value={form.lastName} onChange={onChange} style={inputStyle} />
              </Field>
            </div>
          </section>

          {/* Step 2 */}
          <section ref={refs.security} style={sectionStyle}>
            <h2 style={sectionTitle}>Step 2: Security</h2>

            <div style={{ position: "relative", marginBottom: 6 }}>
              <Field label="Password (required)">
                <input type={showPass ? "text" : "password"} name="password" value={form.password} onChange={onChange} style={inputStyle} autoComplete="new-password" />
              </Field>
              <button type="button" onClick={() => setShowPass((v) => !v)} style={showBtn} tabIndex={-1}>
                {showPass ? "Hide" : "Show"}
              </button>
            </div>

            <ul style={pwList}>
              {pwRules.map((r) => (
                <li key={r.label} style={{ color: r.ok ? "#16ff80" : "#fa6c6c" }}>
                  {r.ok ? "✓" : "○"} {r.label}
                </li>
              ))}
            </ul>

            <div style={{ position: "relative" }}>
              <Field label="Confirm Password (required)">
                <input type={showConf ? "text" : "password"} name="confirmPassword" value={form.confirmPassword} onChange={onChange} style={inputStyle} autoComplete="new-password" />
              </Field>
              <button type="button" onClick={() => setShowConf((v) => !v)} style={showBtn} tabIndex={-1}>
                {showConf ? "Hide" : "Show"}
              </button>
            </div>

            <Field label="Security Question">
              <input name="securityQuestion" value={form.securityQuestion} onChange={onChange} style={inputStyle} />
            </Field>
            <Field label="Security Answer">
              <input name="securityAnswer" value={form.securityAnswer} onChange={onChange} style={inputStyle} />
            </Field>

            {errors.password && <Err>{errors.password}</Err>}
            {errors.confirmPassword && <Err>{errors.confirmPassword}</Err>}
          </section>

          {/* Step 3 */}
          <section ref={refs.profile} style={sectionStyle}>
            <h2 style={sectionTitle}>Step 3: Profile</h2>

            <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>Profile Image (required)</label>
            <input
              type="file"
              name="profilePic"
              accept="image/*"
              onChange={onChange}
              style={{ ...inputStyle, padding: 8, border: "1.5px solid #3c3836" }}
            />
            {profilePic && (
              <div style={{ marginTop: 8 }}>
                <img
                  src={URL.createObjectURL(profilePic)}
                  alt="Preview"
                  width={96}
                  height={96}
                  style={{ objectFit: "cover", borderRadius: 10, border: "1px solid #2d2d32" }}
                />
              </div>
            )}
            {errors.profilePic && <Err>{errors.profilePic}</Err>}

            <Field label="Favorite Quote">
              <input name="favoriteQuote" value={form.favoriteQuote} onChange={onChange} style={inputStyle} />
            </Field>

            <div style={{ marginTop: 8 }}>
              <label style={{ fontWeight: 700 }}>Choose up to 25 Interests</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 7 }}>
                {INTERESTS.map((i) => (
                  <label
                    key={i}
                    style={{
                      background: interests.includes(i) ? "#0ff" : "#232326",
                      color: "#121214",
                      borderRadius: 7,
                      fontWeight: 700,
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      name="interests"
                      value={i}
                      checked={interests.includes(i)}
                      onChange={(ev) => {
                        if (ev.target.checked && interests.length >= 25) return;
                        onChange(ev);
                      }}
                      style={{ marginRight: 4, accentColor: "#ffe259" }}
                    />
                    {i}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: "0.95rem", color: interests.length > 25 ? "#f87171" : "#ffe259" }}>
                {interests.length}/25 selected
              </div>
            </div>
          </section>

          {/* Step 4 */}
          <section ref={refs.referral} style={sectionStyle}>
            <h2 style={sectionTitle}>Step 4: Referral</h2>
            <Field label="Referral Code (optional)">
              <input name="referral" value={form.referral} onChange={onChange} style={inputStyle} />
            </Field>
          </section>

          {errors.submit && <Err>{errors.submit}</Err>}

          <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
            <button type="button" onClick={() => navigate("/")} disabled={loading} style={secondaryBtn}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={primaryBtn(loading)}>
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- UI helpers ---------- */
function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ marginBottom: 6, fontWeight: 700 }}>{label}</div>
      {children}
    </label>
  );
}
const Err = ({ children }) => (
  <div style={{ color: "#f87171", fontSize: "0.98rem", marginTop: 4 }}>{children}</div>
);

const navBtn = {
  width: "100%",
  padding: "8px 0",
  color: "#ffe259",
  fontWeight: 700,
  background: "#232326",
  border: "1px solid #2d2d32",
  borderRadius: 8,
  cursor: "pointer",
  boxShadow: "0 1px 4px #2228",
};

const sectionStyle = { padding: "0 0 18px 0", marginBottom: 28, background: "none", border: "none" };
const sectionTitle = { fontSize: "1.35rem", fontWeight: 800, marginBottom: 14, color: "#ffe259", letterSpacing: 0.5 };
const inputStyle = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: 8,
  border: "1.5px solid #3c3836",
  backgroundColor: "#000",
  color: "#ffe259",
  fontSize: "1.05rem",
  outline: "none",
};
const pwList = { fontSize: "0.95rem", margin: "6px 0 14px 0", padding: 0, listStyle: "none" };
const showBtn = { position: "absolute", right: 18, top: 31, background: "none", color: "#ffe259", border: "none", cursor: "pointer", fontWeight: 700 };
const primaryBtn = (disabled) => ({
  background: "#ffe259",
  color: "#111",
  fontWeight: 800,
  padding: "12px 22px",
  fontSize: "1.05rem",
  border: "none",
  borderRadius: 9,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.65 : 1,
});
const secondaryBtn = {
  background: "#232326",
  color: "#ffe259",
  fontWeight: 800,
  padding: "11px 18px",
  fontSize: "1.02rem",
  border: "2px solid #ffe259",
  borderRadius: 9,
  cursor: "pointer",
};
