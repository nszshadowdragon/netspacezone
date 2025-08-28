// frontend/src/pages/SignUpPage.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const SIGNUP_URL = "https://api.netspacezone.com/api/auth/signup";

const INTERESTS = [
  "Tech","Gaming","Music","Movies","Fitness","Travel",
  "Anime","Fashion","Food","Art","Science","Education",
  "Coding","Sports","Business","News","Photography",
  "Writing","DIY","Parenting","Finance","Comics",
  "Streaming","Pets","History"
];

const SECTIONS = [
  { label: "Basic Info",  key: "basic"   },
  { label: "Security",    key: "security"},
  { label: "Profile",     key: "profile" },
  { label: "Referral",    key: "referral"},
  { label: "Interests",   key: "interests"},
];

export default function SignUpPage() {
  const navigate = useNavigate();

  // sticky anchors (left nav buttons)
  const refs = {
    basic: useRef(null),
    security: useRef(null),
    profile: useRef(null),
    referral: useRef(null),
    interests: useRef(null),
  };

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
    firstName: "",
    lastName: "",
    birthday: "",
    referral: "",
  });
  const [interests, setInterests] = useState([]);
  const [profilePic, setProfilePic] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => (document.documentElement.style.scrollBehavior = "");
  }, []);

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const toggleInterest = (name) =>
    setInterests((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );

  // Password rules (live)
  const pw = form.password || "";
  const pwRules = useMemo(() => ({
    length: pw.length >= 8 && pw.length <= 64,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /\d/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
    match: form.confirm && form.confirm === pw,
  }), [pw, form.confirm]);

  const allPwOk = pwRules.length && pwRules.upper && pwRules.lower && pwRules.digit && pwRules.special && pwRules.match;

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    // basic client checks similar to your original behavior
    if (!form.username.trim() || !form.email.trim() || !pw) {
      setError("Please complete all required fields.");
      return;
    }
    if (!allPwOk) {
      setError("Please meet the password requirements.");
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim() || !form.birthday) {
      setError("Please fill your profile details.");
      return;
    }
    if (!profilePic) {
      setError("Please choose a profile image.");
      return;
    }

    // Build multipart body (do NOT set Content-Type manually)
    const fd = new FormData();
    fd.append("username", form.username.trim());
    fd.append("email", form.email.trim());
    fd.append("password", form.password);
    fd.append("firstName", form.firstName.trim());
    fd.append("lastName", form.lastName.trim());
    fd.append("birthday", form.birthday);
    fd.append("referral", form.referral.trim());
    fd.append("interests", interests.join(",")); // server splits by comma
    fd.append("profilePic", profilePic);         // key must be profilePic

    try {
      setSubmitting(true);

      const res = await fetch(SIGNUP_URL, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Signup failed (${res.status})`);
      }

      await res.json().catch(() => null);
      // ✅ Success → PROFILE page (not landing)
      navigate("/profile", { replace: true });
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="signup-root"
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#000",
        color: "#ffe259",
        display: "flex",
        gap: 16,
        padding: 16,
      }}
    >
      {/* Left: Section jump nav */}
      <nav
        style={{
          position: "sticky",
          top: 24,
          alignSelf: "flex-start",
          width: 140,
          background: "#15151a",
          borderRadius: 10,
          boxShadow: "0 2px 10px #444a",
          padding: 10,
          height: "fit-content",
        }}
      >
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {SECTIONS.map((s) => (
            <li key={s.key} style={{ marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => refs[s.key].current?.scrollIntoView({ block: "start" })}
                style={navBtn}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Right: Form */}
      <div style={{ flex: 1, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ margin: "8px 0 16px 0", fontSize: "2rem", fontWeight: 800 }}>
          Create your account
        </h1>

        <form onSubmit={submit} className="signup-form" autoComplete="off">
          {/* Step 1: Basic Info */}
          <section ref={refs.basic} style={sectionStyle}>
            <h2 style={sectionTitle}>Step 1: Basic Info</h2>

            <Field label="Username">
              <input
                name="username"
                value={form.username}
                onChange={onChange}
                style={inputStyle}
                autoComplete="username"
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                style={inputStyle}
                autoComplete="email"
              />
            </Field>
          </section>

          {/* Step 2: Security */}
          <section ref={refs.security} style={sectionStyle}>
            <h2 style={sectionTitle}>Step 2: Security</h2>

            <Field label="Password">
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={onChange}
                style={inputStyle}
                autoComplete="new-password"
              />
            </Field>

            <Field label="Confirm password">
              <input
                type="password"
                name="confirm"
                value={form.confirm}
                onChange={onChange}
                style={inputStyle}
                autoComplete="new-password"
              />
            </Field>

            {/* Password requirements */}
            <div style={pwHelpWrap}>
              <PwRule ok={pwRules.length} text="8–64 characters" />
              <PwRule ok={pwRules.upper} text="At least one uppercase (A–Z)" />
              <PwRule ok={pwRules.lower} text="At least one lowercase (a–z)" />
              <PwRule ok={pwRules.digit} text="At least one number (0–9)" />
              <PwRule ok={pwRules.special} text="At least one symbol (!@#$…)" />
              <PwRule ok={pwRules.match} text="Passwords match" />
            </div>
          </section>

          {/* Step 3: Profile */}
          <section ref={refs.profile} style={sectionStyle}>
            <h2 style={sectionTitle}>Step 3: Profile</h2>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <Field label="First name">
                <input
                  name="firstName"
                  value={form.firstName}
                  onChange={onChange}
                  style={inputStyle}
                />
              </Field>
              <Field label="Last name">
                <input
                  name="lastName"
                  value={form.lastName}
                  onChange={onChange}
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <Field label="Birthday">
                <input
                  type="date"
                  name="birthday"
                  value={form.birthday}
                  onChange={onChange}
                  style={inputStyle}
                />
              </Field>

              <Field label="Profile Image">
                <input
                  type="file"
                  name="profilePic"
                  accept="image/*"
                  onChange={(e) => setProfilePic(e.target.files?.[0] || null)}
                  style={{
                    ...inputStyle,
                    padding: 8,
                    border: "1.5px solid #3c3836",
                    background: "#000",
                    color: "#ffe259",
                  }}
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
              </Field>
            </div>
          </section>

          {/* Step 4: Referral */}
          <section ref={refs.referral} style={sectionStyle}>
            <h2 style={sectionTitle}>Step 4: Referral</h2>
            <Field label="Referral Code">
              <input
                name="referral"
                value={form.referral}
                onChange={onChange}
                style={inputStyle}
              />
            </Field>
          </section>

          {/* Step 5: Interests */}
          <section ref={refs.interests} style={{ ...sectionStyle, paddingBottom: 8 }}>
            <h2 style={sectionTitle}>Step 5: Interests</h2>
            <div
              className="interests-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0,1fr))",
                gap: 10,
                padding: 10,
                border: "1px solid #2d2d32",
                borderRadius: 10,
                background: "#0b0b0e",
              }}
            >
              {INTERESTS.map((i) => (
                <label key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={interests.includes(i)}
                    onChange={() => toggleInterest(i)}
                    style={{ accentColor: "#ffe259" }}
                  />
                  {i}
                </label>
              ))}
            </div>
          </section>

          {/* Errors */}
          {error && (
            <p style={{ color: "salmon", marginTop: 6, fontWeight: 600 }}>{error}</p>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button type="submit" disabled={submitting} style={primaryBtn(submitting)}>
              {submitting ? "Creating..." : "Create Account"}
            </button>

            {/* Cancel → landing */}
            <button
              type="button"
              onClick={() => navigate("/")}
              disabled={submitting}
              style={secondaryBtn}
            >
              Cancel
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

function PwRule({ ok, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        aria-hidden
        style={{
          width: 10, height: 10, borderRadius: 9999,
          background: ok ? "#39d98a" : "#555",
          border: "1px solid #2d2d32",
          display: "inline-block"
        }}
      />
      <span style={{ color: ok ? "#c6ffdd" : "#aaa" }}>{text}</span>
    </div>
  );
}

const navBtn = {
  width: "100%",
  padding: "8px 0",
  color: "#ffe259",
  fontWeight: 700,
  background: "#232326",
  border: "1px solid #2d2d32",
  borderRadius: 8,
  cursor: "pointer",
};

const sectionStyle = {
  padding: "0 0 18px 0",
  marginBottom: 28,
  background: "none",
  border: "none",
  boxShadow: "none",
};

const sectionTitle = {
  fontSize: "1.35rem",
  fontWeight: 800,
  marginBottom: 14,
  color: "#ffe259",
  letterSpacing: 0.5,
};

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

const pwHelpWrap = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 8,
  padding: "8px 10px",
  border: "1px dashed #2d2d32",
  borderRadius: 10,
  background: "#0b0b0e",
  marginTop: 8,
};

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
  transition: "opacity .15s",
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
