// src/pages/SettingsPage.jsx
import React, { useRef, useState, useEffect, Fragment } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

/* ---------- Runtime-aware CSS for mobile like SignUp ---------- */
const MOBILE_CSS = `
:root{ --gold:#ffe259; --ink:#111; --text:#ffe259; --muted:#bdbdbd; --panel:#15151a; }
html,body{ background:#000; color:var(--text); }
*{ box-sizing:border-box; }
input, select, textarea, button { font-size:16px; } /* avoid iOS zoom */

/* Grid similar to SignUp: left nav (desktop) + content */
.set-wrap{ min-height:100vh; min-height:100dvh; width:100%; background:#000; color:var(--text); padding:16px; padding-bottom:max(16px, env(safe-area-inset-bottom)); }
.set-grid{ display:grid; gap:16px; grid-template-columns: 150px 1fr; align-items:start; }

/* Desktop left nav */
.side-nav{ position:sticky; top:84px; align-self:flex-start; width:150px; background:#15151a; border-radius:10px; box-shadow:0 2px 10px #444a; padding:10px; height:fit-content; }

/* Mobile sticky pills (hidden on desktop) */
.mobile-steps{ display:none; }
.pills{ display:flex; gap:8px; overflow-x:auto; -webkit-overflow-scrolling:touch; padding:8px; background:#0b0b0b; border:1px solid #222; border-radius:10px; position:sticky; top:8px; z-index:5; box-shadow:0 2px 12px rgba(0,0,0,.35); }
.pill-btn{ white-space:nowrap; padding:10px 14px; border-radius:999px; border:1px solid #2d2d32; background:#232326; color:var(--text); font-weight:800; cursor:pointer; }
.pill-btn:active{ transform:translateY(1px); }

/* Content column */
.settings-col{ flex:1; max-width:900px; margin:0 auto; }

/* Responsive breakpoints */
@media (max-width: 900px){
  .set-grid{ grid-template-columns: 1fr; }
  .side-nav{ display:none; }
  .mobile-steps{ display:block; margin-bottom:10px; }
}
`;

/* ---------- API base (works in prod & dev) ---------- */
const API_HOST =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://api.netspacezone.com" : "http://localhost:5000");
const API_BASE = `${API_HOST}/api/auth`;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

/* ---------- Broadcast channel for cross-tab updates ---------- */
const BC =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("nsz_auth")
    : null;

/* ---------- Theme ---------- */
const THEME = {
  pageBackground: "#000000",
  sectionBackground: "rgba(5, 5, 5, 0.65)",
  sectionBorder: "#ffe25955",
  sectionTextColor: "#ffe259",
  goldTextColor: "#ffe259",
  goldBorderColor: "#ffe259",
};

/* ---------- Helpers ---------- */
function toInputDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [m, d, y] = value.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  try {
    const dt = new Date(value);
    if (!isNaN(dt)) return dt.toISOString().slice(0, 10);
  } catch (_) {}
  return "";
}

function getProfileImageSrc(user) {
  if (!user) return "/profilepic.jpg";
  if (user.username === "DeVante") return "/assets/avatar-shadow-dragon.png";

  const img = user.profilePic || user.profileImage;
  if (img) {
    if (img.startsWith("http")) return img;
    if (img.startsWith("/uploads")) return API_HOST + img;
    if (img.startsWith("/")) return img;
    return "/" + img;
  }
  const name = encodeURIComponent(user.username || "U");
  return `https://ui-avatars.com/api/?name=${name}`;
}

const INTERESTS = [
  "Tech","Gaming","Music","Movies","Fitness","Travel",
  "Anime","Fashion","Food","Art","Science","Education",
  "Coding","Sports","Business","News","Photography",
  "Writing","DIY","Parenting","Finance","Comics",
  "Streaming","Cosplay","History",
];

const SECTION_LIST = [
  { label: "Basic Info", refKey: "basicInfoRef" },
  { label: "Security", refKey: "securityRef" },
  { label: "Profile", refKey: "profileRef" },
  { label: "Referral", refKey: "referralRef" },
];

/* ---------- Username utilities ---------- */
const isValidUsername = (v = "") => /^[a-zA-Z0-9._-]{3,20}$/.test(v.trim());

async function checkUsername(username, { signal } = {}) {
  if (!username || !isValidUsername(username)) return { available: false, reason: "invalid" };
  const url = `${API_BASE}/check-username?username=${encodeURIComponent(username)}`;
  const res = await fetch(url, { credentials: "include", signal });
  if (!res.ok) throw new Error("bad-response");
  return res.json(); // { available: boolean }
}

const pwRules = [
  { test: (v) => v.length >= 8, label: "8+ characters" },
  { test: (v) => /[A-Z]/.test(v), label: "1 uppercase" },
  { test: (v) => /[a-z]/.test(v), label: "1 lowercase" },
  { test: (v) => /\d/.test(v), label: "1 number" },
  { test: (v) => /[^A-Za-z0-9]/.test(v), label: "1 symbol" },
];

export default function SettingsPage() {
  // Some apps expose only { user, logout }. We keep a local user mirror.
  const auth = useAuth();
  const ctxUser = auth?.user;
  const [localUser, setLocalUser] = useState(ctxUser);
  useEffect(() => setLocalUser(ctxUser), [ctxUser]);
  const baseUser = localUser || ctxUser;

  // Anchors
  const basicInfoRef = useRef();
  const securityRef = useRef();
  const profileRef = useRef();
  const referralRef = useRef();

  // Form state
  const [form, setForm] = useState({
    username: "",
    usernameAvailable: null,
    email: "",
    birthday: "",
    firstName: "",
    lastName: "",
    currentPassword: "",
    password: "",
    confirmPassword: "",
    profilePic: "",
    interests: [],
    referral: "",
    codeRedeem: "",
  });

  const [originalSection, setOriginalSection] = useState({});
  const [editingSection, setEditingSection] = useState(null);
  const [errors, setErrors] = useState({});
  const [checkingUsername, setCheckingUsername] = useState(false);

  // UX: saving + toasts
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ type: "", msg: "" });

  // ---- apply updates -> try context adapters, also broadcast to navbar
  const applyUserUpdate = (payload) => {
    const u = payload?.user ?? payload;
    if (!u || typeof u !== "object") return;

    // Update our local mirror immediately
    setLocalUser(u);

    // Best-effort: call whatever updater the AuthContext might expose
    try {
      if (typeof auth?.updateUser === "function") auth.updateUser(u);
      else if (typeof auth?.setUser === "function") auth.setUser(u);
      else if (typeof auth?.setAuthUser === "function") auth.setAuthUser(u);
      else if (typeof auth?.setCurrentUser === "function") auth.setCurrentUser(u);
    } catch (_) {}

    // Fan out to anything else (Navbar listens to these)
    try {
      window.dispatchEvent(new CustomEvent("nsz:user-updated", { detail: u }));
      BC?.postMessage?.({ type: "user-updated", user: u });
    } catch (_) {}
  };

  const fetchLatestUser = async () => {
    try {
      const { data } = await api.get("/me");
      if (data?.user) applyUserUpdate(data);
    } catch (e) {
      showToast("error", "You may be signed out. Please log in again.");
    }
  };

  useEffect(() => {
    document.body.style.overflowX = "hidden";
    fetchLatestUser();
    return () => {
      document.body.style.overflowX = "";
    };
  }, []);

  useEffect(() => {
    if (!baseUser) return;
    setForm({
      username: baseUser.username || "",
      usernameAvailable: null,
      email: baseUser.email || "",
      birthday: toInputDate(baseUser.birthday),
      firstName: baseUser.firstName || "",
      lastName: baseUser.lastName || "",
      currentPassword: "",
      password: "",
      confirmPassword: "",
      profilePic: baseUser.profilePic || "",
      interests: Array.isArray(baseUser.interests) ? baseUser.interests : [],
      referral: baseUser.referral || baseUser.referralCode || "",
      codeRedeem: "",
    });
    setEditingSection(null);
    setOriginalSection({});
    setErrors({});
    clearToast();
  }, [baseUser]);

  const sectionRefs = { basicInfoRef, securityRef, profileRef, referralRef };
  const scrollToSection = (refKey) => {
    sectionRefs[refKey].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const sectionFields = {
    basic: [
      { label: "Username", name: "username" },
      { label: "Email", name: "email", type: "email" },
      { label: "Birthday", name: "birthday", type: "date", disabled: true },
      { label: "First Name", name: "firstName" },
      { label: "Last Name", name: "lastName" },
    ],
    security: [
      { label: "Current Password", name: "currentPassword", type: "password" },
      { label: "New Password", name: "password", type: "password" },
      { label: "Confirm New Password", name: "confirmPassword", type: "password" },
    ],
    profile: [
      { label: "Profile Image", name: "profilePic", type: "file" },
      { label: "Interests", name: "interests", type: "interests" },
    ],
    referral: [],
  };

  function handleEdit(section) {
    setOriginalSection((prev) => ({
      ...prev,
      [section]: Object.fromEntries(
        sectionFields[section]?.map((f) => [f.name, form[f.name]]) || []
      ),
    }));
    setEditingSection(section);
    setErrors({});
    clearToast();
  }

  function handleCancel() {
    if (!editingSection) return;
    if (baseUser) {
      setForm((f) => ({
        ...f,
        ...Object.fromEntries(
          sectionFields[editingSection]?.map((fld) => [fld.name, baseUser[fld.name] || ""]) || []
        ),
        currentPassword: "",
        password: "",
        confirmPassword: "",
        codeRedeem: "",
        usernameAvailable: null,
      }));
    }
    setEditingSection(null);
    setErrors({});
    setCheckingUsername(false);
    clearToast();
  }

  function handleUndo() {
    if (!editingSection) return;
    setForm((f) => ({
      ...f,
      ...originalSection[editingSection],
      usernameAvailable: null,
    }));
    setErrors({});
    clearToast();
  }

  function handleChange(e) {
    const { name, value, type, checked, files } = e.target;
    setForm((f) => {
      const updated = { ...f };
      if (type === "checkbox" && name === "interests") {
        if (checked) updated.interests = [...f.interests, value];
        else updated.interests = f.interests.filter((i) => i !== value);
      } else if (type === "file") {
        if (files && files[0]) updated[name] = files[0];
      } else {
        updated[name] = type === "checkbox" ? checked : value;
      }
      if (name === "username" && editingSection === "basic") {
        updated.usernameAvailable = null; // debounced effect will re-check
      }
      return updated;
    });

    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  }

  /* ---------- Debounced live username check ---------- */
  useEffect(() => {
    if (editingSection !== "basic") return;
    const value = (form.username || "").trim();
    const current = (baseUser?.username || "").trim();
    const sameAsCurrent = value.toLowerCase() === current.toLowerCase();

    if (!value || !isValidUsername(value) || sameAsCurrent) {
      setCheckingUsername(false);
      setForm((f) => ({ ...f, usernameAvailable: null }));
      return;
    }

    const controller = new AbortController();
    setCheckingUsername(true);

    const t = setTimeout(async () => {
      try {
        const { available } = await checkUsername(value, { signal: controller.signal });
        setForm((f) =>
          (f.username || "").trim().toLowerCase() === value.toLowerCase()
            ? { ...f, usernameAvailable: !!available }
            : f
        );
      } catch {
        setForm((f) => ({ ...f, usernameAvailable: null }));
      } finally {
        setCheckingUsername(false);
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.username, editingSection, baseUser?.username]);

  function renderField(f) {
    if (f.name === "profilePic") return null;

    // BASIC — USERNAME (edit mode)
    if (editingSection === "basic" && f.name === "username") {
      const sameAsCurrent =
        (form.username || "").trim().toLowerCase() ===
        (baseUser?.username || "").trim().toLowerCase();

      return (
        <div style={{ marginBottom: 13 }}>
          <label>{f.label}</label>
          <input
            name="username"
            type="text"
            value={form.username || ""}
            onChange={handleChange}
            style={inputStyle}
            autoComplete="off"
          />
          <div style={{ fontSize: "0.95rem", marginTop: 6 }}>
            {sameAsCurrent ? (
              <span style={{ color: "#aaa" }}>Current username</span>
            ) : !isValidUsername(form.username || "") ? (
              <span style={{ color: "#fa6c6c" }}>
                3–20 chars: letters, numbers, . _ -
              </span>
            ) : checkingUsername ? (
              <span style={{ color: "#aaa" }}>Checking…</span>
            ) : form.usernameAvailable === true ? (
              <span style={{ color: "#16ff80" }}>Available ✓</span>
            ) : form.usernameAvailable === false ? (
              <span style={{ color: "#fa6c6c" }}>Taken ✕</span>
            ) : (
              <span style={{ color: "#aaa" }}> </span>
            )}
          </div>
          {errors.username && (
            <span style={{ color: "#f87171", fontSize: "0.97rem" }}>
              {errors.username}
            </span>
          )}
        </div>
      );
    }

    // BASIC — EMAIL (edit mode)
    if (editingSection === "basic" && f.name === "email") {
      return (
        <div style={{ marginBottom: 13 }}>
          <label>{f.label}</label>
          <input
            name="email"
            type="email"
            value={form.email || ""}
            onChange={handleChange}
            style={inputStyle}
            autoComplete="off"
          />
          {errors.email && (
            <span style={{ color: "#f87171", fontSize: "0.97rem" }}>
              {errors.email}
            </span>
          )}
        </div>
      );
    }

    // BASIC — BIRTHDAY (read-only in settings)
    if (editingSection === "basic" && f.name === "birthday") {
      return (
        <div style={{ marginBottom: 13 }}>
          <label>{f.label}</label>
          <input
            name="birthday"
            type="date"
            value={form.birthday || ""}
            style={{ ...inputStyle, background: "#222", color: "#ffe259" }}
            disabled
          />
        </div>
      );
    }

    if (f.name === "birthday" && editingSection !== "basic") {
      return (
        <div style={{ marginBottom: 13 }}>
          <label>{f.label}</label>
          <span style={{ color: THEME.goldTextColor, marginLeft: 9 }}>
            {form.birthday ? form.birthday : <span style={{ color: "#aaa" }}>—</span>}
          </span>
        </div>
      );
    }

    // INTERESTS
    if (f.type === "interests") {
      if (editingSection === "profile") {
        return (
          <div style={{ marginBottom: 18 }}>
            <label>Choose up to 25 Interests</label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 7,
                marginTop: 7,
                marginBottom: 4,
              }}
            >
              {INTERESTS.map((interest) => (
                <label
                  key={interest}
                  style={{
                    background: form.interests.includes(interest) ? "#0ff" : "#232326",
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
                    value={interest}
                    checked={form.interests.includes(interest)}
                    onChange={(e) => {
                      if (e.target.checked && form.interests.length >= 25) return;
                      handleChange(e);
                    }}
                    style={{ marginRight: 4, accentColor: "#ffe259" }}
                  />
                  {interest}
                </label>
              ))}
            </div>
            <div
              style={{
                fontSize: "0.95rem",
                color: form.interests.length > 25 ? "#f87171" : THEME.goldTextColor,
              }}
            >
              {form.interests.length}/25 selected
            </div>
          </div>
        );
      } else {
        return (
          <div style={{ marginBottom: 13 }}>
            <label>{f.label}</label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 7,
                marginTop: 7,
                marginBottom: 4,
              }}
            >
              {form.interests.length ? (
                form.interests.map((interest) => (
                  <span
                    key={interest}
                    style={{
                      background: "#0ff",
                      color: "#121214",
                      borderRadius: 7,
                      fontWeight: 700,
                      padding: "4px 10px",
                    }}
                  >
                    {interest}
                  </span>
                ))
              ) : (
                <span style={{ color: "#aaa", marginLeft: 9 }}>—</span>
              )}
            </div>
          </div>
        );
      }
    }

    // SECURITY FIELDS
    if (
      editingSection &&
      (f.name === "password" || f.name === "confirmPassword" || f.name === "currentPassword")
    ) {
      if (f.name === "currentPassword") {
        return (
          <div style={{ position: "relative", marginBottom: 13 }}>
            <label>Current Password</label>
            <input
              name="currentPassword"
              type="password"
              value={form.currentPassword || ""}
              onChange={handleChange}
              style={inputStyle}
              autoComplete="current-password"
            />
          </div>
        );
      }
      if (f.name === "password") {
        return (
          <div style={{ position: "relative", marginBottom: 13 }}>
            <label>New Password</label>
            <input
              name="password"
              type="password"
              value={form.password || ""}
              onChange={handleChange}
              style={inputStyle}
              autoComplete="new-password"
            />
            <ul
              style={{
                fontSize: "0.95rem",
                color: THEME.goldTextColor,
                margin: "8px 0 0 0",
                padding: 0,
                listStyle: "none",
              }}
            >
              {pwRules.map((r) => (
                <li
                  key={r.label}
                  style={{ color: r.test(form.password) ? "#16ff80" : "#fa6c6c" }}
                >
                  {r.test(form.password) ? "✓" : "○"} {r.label}
                </li>
              ))}
            </ul>
          </div>
        );
      }
      if (f.name === "confirmPassword") {
        return (
          <div style={{ position: "relative", marginBottom: 13 }}>
            <label>Confirm New Password</label>
            <input
              name="confirmPassword"
              type="password"
              value={form.confirmPassword || ""}
              onChange={handleChange}
              style={inputStyle}
              autoComplete="new-password"
            />
            <div
              style={{
                fontSize: "0.97rem",
                marginTop: 6,
                color:
                  form.confirmPassword.length === 0
                    ? "#aaa"
                    : form.confirmPassword === form.password
                    ? "#16ff80"
                    : "#fa6c6c",
              }}
            >
              {form.confirmPassword.length === 0
                ? ""
                : form.confirmPassword === form.password
                ? "Passwords match"
                : "Passwords do not match"}
            </div>
          </div>
        );
      }
    }

    if (editingSection !== "security" && f.name === "password") {
      return (
        <div style={{ marginBottom: 13 }}>
          <label>Password</label>
          <input
            type="password"
            value="********"
            readOnly
            style={{ ...inputStyle, width: "70%", letterSpacing: 2, background: "#222" }}
            tabIndex={-1}
          />
        </div>
      );
    }

    if (editingSection !== "security" && f.name === "confirmPassword") {
      return null;
    }

    // Default (view mode)
    if (editingSection) {
      return (
        <div style={{ marginBottom: 13 }}>
          <label>{f.label}</label>
          <input
            name={f.name}
            type={f.type || "text"}
            value={form[f.name] || ""}
            onChange={handleChange}
            style={inputStyle}
            autoComplete="off"
            disabled={f.disabled}
          />
          {errors[f.name] && (
            <span style={{ color: "#f87171", fontSize: "0.97rem" }}>
              {errors[f.name]}
            </span>
          )}
        </div>
      );
    }

    return (
      <div style={{ marginBottom: 13 }}>
        <label>{f.label}</label>
        <span style={{ color: THEME.goldTextColor, marginLeft: 9 }}>
          {form[f.name] || <span style={{ color: "#aaa" }}>—</span>}
        </span>
      </div>
    );
  }

  function isValidEmail(v) {
    return /^\S+@\S+\.\S+$/.test(v);
  }

  function clearToast() {
    setToast({ type: "", msg: "" });
  }
  function showToast(type, msg) {
    setToast({ type, msg });
    window.clearTimeout((showToast._t || 0));
    showToast._t = window.setTimeout(() => setToast({ type: "", msg: "" }), 3000);
  }

  async function handleSave(section) {
    if (saving) return; // prevent double-saves
    setErrors({});
    clearToast();
    setSaving(true);

    try {
      if (section === "basic") {
        const payload = {
          firstName: form.firstName || "",
          lastName: form.lastName || "",
        };

        // Username
        const currentLower = (baseUser?.username || "").toLowerCase();
        const desiredLower = (form.username || "").toLowerCase();
        const sameAsCurrent = desiredLower === currentLower;

        if (!sameAsCurrent) {
          if (!isValidUsername(form.username)) {
            setErrors((e) => ({
              ...e,
              username: "3–20 chars; letters, numbers, . _ -",
            }));
            setSaving(false);
            return;
          }
          if (form.usernameAvailable === false) {
            setErrors((e) => ({ ...e, username: "Username not available." }));
            setSaving(false);
            return;
          }
          payload.username = form.username;
        }

        // Email
        if ((form.email || "") !== (baseUser?.email || "")) {
          if (!isValidEmail(form.email)) {
            setErrors((e) => ({ ...e, email: "Enter a valid email address." }));
            setSaving(false);
            return;
          }
          payload.email = form.email;
        }

        const { data } = await api.patch("/profile", payload);
        applyUserUpdate(data); // instant navbar + local user update
        showToast("success", "Basic info saved.");
      } else if (section === "profile") {
        const fd = new FormData();
        if (form.profilePic && typeof form.profilePic === "object") {
          fd.append("profilePic", form.profilePic);
        }
        fd.append("interests", (form.interests || []).join(","));
        const { data } = await api.patch("/profile", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        // cache-bust avatars
        try {
          localStorage.setItem("nsz:avatar:v", String(Date.now()));
        } catch (_) {}
        applyUserUpdate(data);
        showToast("success", "Profile updated.");
      } else if (section === "referral") {
        const payload = { referral: form.referral || "" };
        const { data } = await api.patch("/profile", payload);
        applyUserUpdate(data);
        showToast("success", "Referral updated.");
      } else if (section === "security") {
        if (!form.currentPassword) {
          setErrors((e) => ({ ...e, currentPassword: "Enter your current password." }));
          setSaving(false);
          return;
        }
        if (!form.password) {
          setErrors((e) => ({ ...e, password: "Enter a new password." }));
          setSaving(false);
          return;
        }
        if (form.password !== form.confirmPassword) {
          setErrors((e) => ({ ...e, confirmPassword: "Passwords do not match." }));
          setSaving(false);
          return;
        }
        await api.patch("/password", {
          currentPassword: form.currentPassword,
          newPassword: form.password,
        });
        setForm((f) => ({ ...f, currentPassword: "", password: "", confirmPassword: "" }));
        showToast("success", "Password changed.");
      }

      // exit edit mode on success
      setEditingSection(null);
      setOriginalSection({});
    } catch (err) {
      const status = err?.response?.status;
      const msg = (err?.response?.data?.error || "").toLowerCase?.() || "";

      if (section === "basic" && status === 409 && msg.includes("username")) {
        setErrors((e) => ({ ...e, username: "Username already taken." }));
        showToast("error", "Username already taken.");
      } else if (section === "basic" && status === 409 && msg.includes("email")) {
        setErrors((e) => ({ ...e, email: "Email already in use." }));
        showToast("error", "Email already in use.");
      } else if (status === 401) {
        showToast("error", "You are signed out. Please log in again.");
      } else {
        console.error("Save error:", err);
        showToast("error", "Could not save. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCopyCode() {
    if (!form.referral) return;
    navigator.clipboard.writeText(form.referral).then(() => {
      showToast("success", "Referral code copied!");
    });
  }

  /* ---------- Styles ---------- */
  const cardSectionStyle = {
    padding: "0 22px 18px 22px",
    marginBottom: 36,
    background: THEME.sectionBackground,
    border:
      THEME.sectionBorder === "transparent"
        ? undefined
        : `2.5px solid ${THEME.sectionBorder}`,
    borderRadius: 13,
    boxShadow: "0 2px 16px 0 rgba(255, 231, 88, 0.15)",
    backdropFilter: "blur(1.5px)",
    transition: "background .2s",
  };

  const sectionTitle = {
    fontSize: "1.37rem",
    fontWeight: 800,
    marginBottom: 18,
    color: THEME.goldTextColor,
    letterSpacing: 1,
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 13px",
    borderRadius: 8,
    border: "1.5px solid #3c3836",
    backgroundColor: "#000",
    color: THEME.sectionTextColor,
    fontSize: "1.07rem",
    outline: "none",
  };

  const buttonStyleEdit = {
    background: THEME.goldTextColor,
    color: "#111",
    fontWeight: 700,
    padding: "10px 28px",
    fontSize: "1.08rem",
    border: "none",
    borderRadius: 7,
    cursor: "pointer",
    marginRight: 16,
    marginTop: 6,
  };
  const buttonStyleUndo = {
    background: "#232326",
    color: THEME.goldTextColor,
    fontWeight: 700,
    padding: "8px 18px",
    border: `2px solid ${THEME.goldBorderColor}`,
    borderRadius: 7,
    cursor: "pointer",
    marginRight: 10,
  };
  const buttonStyleCancel = {
    background: "#bbb",
    color: "#444",
    fontWeight: 600,
    padding: "8px 18px",
    border: "none",
    borderRadius: 7,
    cursor: "pointer",
    marginRight: 10,
  };
  const buttonStyleSave = {
    background: saving ? "#84f3b4" : "#16ff80",
    color: "#111",
    fontWeight: 700,
    padding: "10px 28px",
    border: "none",
    borderRadius: 7,
    cursor: saving ? "not-allowed" : "pointer",
    opacity: saving ? 0.8 : 1,
  };

  /* ---------- Render ---------- */
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        background: THEME.pageBackground,
        overflowX: "hidden",
        overflowY: "auto",
        position: "relative",
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          if (editingSection) handleSave(editingSection);
        }
      }}
    >
      {/* Inject mobile CSS (mirrors SignUp) */}
      <style dangerouslySetInnerHTML={{ __html: MOBILE_CSS }} />

      {/* Toast */}
      {toast.msg && (
        <div
          role="status"
          style={{
            position: "fixed",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: toast.type === "error" ? "#7f1d1d" : "#064e3b",
            border: `2px solid ${toast.type === "error" ? "#ef4444" : "#16ff80"}`,
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 10,
            zIndex: 2000,
            boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
            fontWeight: 700,
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Watermark (kept subtle; auto-hides behind content on mobile due to grid) */}
      <img
        src="/assets/nsz-logo.png"
        alt="NSZ Logo"
        style={{
          position: "fixed",
          top: "50%",
          left: "70%",
          transform: "translate(-50%, -50%)",
          width: "29vw",
          maxWidth: "380px",
          minWidth: "170px",
          opacity: 0.26,
          zIndex: 0,
          pointerEvents: "none",
          filter: "drop-shadow(0 0 55px #00ffe1) brightness(1.13)",
        }}
      />

      {/* Mobile step pills (sticky) */}
      <div className="mobile-steps">
        <div className="pills">
          {SECTION_LIST.map((s) => (
            <button
              key={s.refKey}
              type="button"
              className="pill-btn"
              onClick={() => scrollToSection(s.refKey)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid similar to SignUp (left nav hidden on mobile) */}
      <div className="set-wrap">
        <div className="set-grid">
          {/* Side quick-nav (desktop) */}
          <nav className="side-nav">
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {SECTION_LIST.map((section) => (
                <li key={section.refKey} style={{ marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(section.refKey)}
                    style={{
                      width: "100%",
                      padding: "11px 0",
                      color: THEME.goldTextColor,
                      fontWeight: 700,
                      background: "#232326",
                      border: "1px solid #2d2d32",
                      borderRadius: 9,
                      cursor: "pointer",
                      boxShadow: "0 1px 4px #2228",
                      fontSize: "1.05rem",
                      letterSpacing: 0.4,
                    }}
                  >
                    {section.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content column */}
          <div className="settings-col" style={{ zIndex: 1 }}>
            <form
              className="max-w-xl"
              style={{ color: THEME.goldTextColor, paddingTop: 8, paddingBottom: 60 }}
              autoComplete="off"
              onSubmit={(e) => e.preventDefault()}
            >
              {/* Basic Info */}
              <section ref={basicInfoRef} style={cardSectionStyle}>
                <h2 style={sectionTitle}>Step 1: Basic Info</h2>
                {sectionFields.basic.map((f) => (
                  <Fragment key={f.name}>{renderField(f)}</Fragment>
                ))}
                {editingSection === "basic" ? (
                  <div style={{ marginTop: 24 }}>
                    <button type="button" onClick={handleUndo} style={buttonStyleUndo} disabled={saving}>
                      Undo Changes
                    </button>
                    <button type="button" onClick={handleCancel} style={buttonStyleCancel} disabled={saving}>
                      Cancel
                    </button>
                    <button type="button" onClick={() => handleSave("basic")} style={buttonStyleSave} disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => handleEdit("basic")} style={buttonStyleEdit}>
                    Edit
                  </button>
                )}
              </section>

              {/* Security */}
              <section ref={securityRef} style={cardSectionStyle}>
                <h2 style={sectionTitle}>Step 2: Security</h2>

                {editingSection === "security" &&
                  sectionFields.security
                    .filter((f) => ["currentPassword", "password", "confirmPassword"].includes(f.name))
                    .map((f) => <Fragment key={f.name}>{renderField(f)}</Fragment>)}

                {editingSection === "security" ? (
                  <div style={{ marginTop: 24 }}>
                    <button type="button" onClick={handleUndo} style={buttonStyleUndo} disabled={saving}>
                      Undo Changes
                    </button>
                    <button type="button" onClick={handleCancel} style={buttonStyleCancel} disabled={saving}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave("security")}
                      style={buttonStyleSave}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingSection("security")}
                    style={buttonStyleEdit}
                  >
                    Edit
                  </button>
                )}
              </section>

              {/* Profile */}
              <section ref={profileRef} style={cardSectionStyle}>
                <h2 style={sectionTitle}>Step 3: Profile</h2>

                <div style={{ marginBottom: 17 }}>
                  <label
                    style={{
                      fontWeight: 700,
                      color: THEME.goldTextColor,
                      fontSize: 16,
                      display: "block",
                      marginBottom: 5,
                    }}
                  >
                    Profile Image
                  </label>
                  <div>
                    {editingSection === "profile" &&
                    form.profilePic &&
                    typeof form.profilePic === "object" ? (
                      <img
                        src={URL.createObjectURL(form.profilePic)}
                        alt="Preview"
                        width={98}
                        style={{ borderRadius: 15, marginBottom: 7, background: "#111" }}
                      />
                    ) : (
                      <img
                        src={getProfileImageSrc(baseUser)}
                        alt="Profile"
                        width={98}
                        style={{ borderRadius: 15, marginBottom: 7, background: "#111" }}
                      />
                    )}
                  </div>
                  {editingSection === "profile" && (
                    <input
                      type="file"
                      name="profilePic"
                      accept="image/*"
                      onChange={handleChange}
                      style={{ marginBottom: 10 }}
                    />
                  )}
                </div>

                {editingSection === "profile" ? (
                  <>
                    {/* Interests editor */}
                    <Fragment key="interests">{renderField({ label: "Interests", name: "interests", type: "interests" })}</Fragment>
                    <div style={{ marginTop: 24 }}>
                      <button type="button" onClick={handleUndo} style={buttonStyleUndo} disabled={saving}>
                        Undo Changes
                      </button>
                      <button type="button" onClick={handleCancel} style={buttonStyleCancel} disabled={saving}>
                        Cancel
                      </button>
                      <button type="button" onClick={() => handleSave("profile")} style={buttonStyleSave} disabled={saving}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Interests viewer */}
                    <Fragment key="interests-view">{renderField({ label: "Interests", name: "interests", type: "interests" })}</Fragment>
                    <button type="button" onClick={() => setEditingSection("profile")} style={buttonStyleEdit}>
                      Edit
                    </button>
                  </>
                )}
              </section>

              {/* Referral */}
              <section ref={referralRef} style={cardSectionStyle}>
                <h2 style={sectionTitle}>Step 4: Referral</h2>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontWeight: 700 }}>Your Referral Code</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 5 }}>
                    <input
                      type="text"
                      value={form.referral || ""}
                      readOnly
                      style={{
                        ...inputStyle,
                        width: "60%",
                        background: "#232326",
                        color: THEME.goldTextColor,
                        cursor: "copy",
                      }}
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      style={{
                        ...buttonStyleEdit,
                        padding: "7px 13px",
                        fontSize: "1rem",
                        marginTop: 0,
                        marginRight: 0,
                      }}
                      onClick={handleCopyCode}
                      disabled={saving}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontWeight: 700 }}>Redeem a Code</label>
                  {editingSection === "referral" ? (
                    <input
                      name="codeRedeem"
                      value={form.codeRedeem}
                      onChange={handleChange}
                      style={inputStyle}
                      autoComplete="off"
                      placeholder="Enter a code"
                    />
                  ) : (
                    <span style={{ color: THEME.goldTextColor, marginLeft: 9 }}>
                      {form.codeRedeem || <span style={{ color: "#aaa" }}>—</span>}
                    </span>
                  )}
                </div>

                {editingSection === "referral" ? (
                  <div style={{ marginTop: 24 }}>
                    <button type="button" onClick={handleUndo} style={buttonStyleUndo} disabled={saving}>
                      Undo Changes
                    </button>
                    <button type="button" onClick={handleCancel} style={buttonStyleCancel} disabled={saving}>
                      Cancel
                    </button>
                    <button type="button" onClick={() => handleSave("referral")} style={buttonStyleSave} disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setEditingSection("referral")} style={buttonStyleEdit}>
                    Edit
                  </button>
                )}
              </section>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
