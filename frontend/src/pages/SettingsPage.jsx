import React, { useRef, useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

/* ---------- Local axios client (works in dev & prod) ---------- */
const API_BASE =
  import.meta.env.PROD
    ? "https://api.netspacezone.com/api/auth"
    : "http://localhost:5000/api/auth";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

/* ---------- Static theme palette (no ThemeContext needed) ---------- */
const THEME = {
  pageBackground: "#000000",
  sectionBackground: "rgba(5, 5, 5, 0.65)",
  sectionBorder: "#ffe25955",
  sectionTextColor: "#ffe259",
  goldTextColor: "#ffe259",
  goldBorderColor: "#ffe259",
};

/* ---------- Helpers ---------- */
function getProfileImageSrc(user) {
  if (!user) return "/profilepic.jpg";
  if (user.username === "DeVante") return "/assets/avatar-shadow-dragon.png";

  const img = user.profilePic || user.profileImage;
  if (img) {
    if (img.startsWith("http")) return img;
    if (img.startsWith("/uploads")) {
      const host = import.meta.env.PROD
        ? "https://api.netspacezone.com"
        : "http://localhost:5000";
      return host + img;
    }
    if (img.startsWith("/")) return img;
    return "/" + img;
  }
  const name = encodeURIComponent(user.username || "U");
  return `https://ui-avatars.com/api/?name=${name}`;
}

const INTERESTS = [
  "Tech", "Gaming", "Music", "Movies", "Fitness", "Travel",
  "Anime", "Fashion", "Food", "Art", "Science", "Education",
  "Coding", "Sports", "Business", "News", "Photography",
  "Writing", "DIY", "Parenting", "Finance", "Comics",
  "Streaming", "Cosplay", "History",
];

const SECTION_LIST = [
  { label: "Basic Info", refKey: "basicInfoRef" },
  { label: "Security", refKey: "securityRef" },
  { label: "Profile", refKey: "profileRef" },
  { label: "Referral", refKey: "referralRef" },
];

const checkUsernameAPI = async (username) => {
  if (!username || username.length < 3) return null;
  try {
    const res = await fetch(
      `/api/check-username?username=${encodeURIComponent(username)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.available;
  } catch {
    return null;
  }
};

const pwRules = [
  { test: (v) => v.length >= 8, label: "8+ characters" },
  { test: (v) => /[A-Z]/.test(v), label: "1 uppercase" },
  { test: (v) => /[a-z]/.test(v), label: "1 lowercase" },
  { test: (v) => /\d/.test(v), label: "1 number" },
  { test: (v) => /[^A-Za-z0-9]/.test(v), label: "1 symbol" },
];

export default function SettingsPage() {
  const { user, updateUser } = useAuth();

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
    password: "",
    confirmPassword: "",
    securityQuestion: "",
    securityAnswer: "",
    profilePic: "",
    favoriteQuote: "",
    interests: [],
    referral: "",
    codeRedeem: "",
  });

  const [originalSection, setOriginalSection] = useState({});
  const [editingSection, setEditingSection] = useState(null);
  const [errors, setErrors] = useState({});
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchLatestUser = async () => {
    try {
      const { data } = await api.get("/me");
      if (data) updateUser(data);
    } catch {}
  };

  useEffect(() => {
    document.body.style.overflowX = "hidden";
    fetchLatestUser();
    return () => {
      document.body.style.overflowX = "";
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    setForm({
      username: user.username || "",
      usernameAvailable: null,
      email: user.email || "",
      birthday: user.birthday ? user.birthday.slice(0, 10) : "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      password: "",
      confirmPassword: "",
      securityQuestion: user.securityQuestion || "",
      securityAnswer: user.securityAnswer || "",
      profilePic: user.profilePic || "",
      favoriteQuote: user.favoriteQuote || "",
      interests: Array.isArray(user.interests) ? user.interests : [],
      referral: user.referralCode || "",
      codeRedeem: "",
    });
    setEditingSection(null);
    setOriginalSection({});
    setErrors({});
    setCopied(false);
    setShowPasswordFields(false);
  }, [user]);

  const sectionRefs = { basicInfoRef, securityRef, profileRef, referralRef };
  const scrollToSection = (refKey) => {
    sectionRefs[refKey].current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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
      { label: "New Password", name: "password", type: "password" },
      { label: "Confirm New Password", name: "confirmPassword", type: "password" },
      { label: "Security Question", name: "securityQuestion" },
      { label: "Security Answer", name: "securityAnswer" },
    ],
    profile: [
      { label: "Profile Image", name: "profilePic", type: "file" },
      { label: "Favorite Quote", name: "favoriteQuote" },
      { label: "Interests", name: "interests", type: "interests" },
    ],
    referral: [],
  };

  function handleEdit(section) {
    setOriginalSection((prev) => ({
      ...prev,
      [section]: Object.fromEntries(
        sectionFields[section] && sectionFields[section].length
          ? sectionFields[section].map((f) => [f.name, form[f.name]])
          : []
      ),
    }));
    setEditingSection(section);
    setErrors({});
    if (section === "security") setShowPasswordFields(false);
  }

  function handleCancel() {
    if (!editingSection) return;
    if (user) {
      setForm((f) => ({
        ...f,
        ...Object.fromEntries(
          sectionFields[editingSection] && sectionFields[editingSection].length
            ? sectionFields[editingSection].map((f) => [f.name, user[f.name] || ""])
            : []
        ),
        codeRedeem: "",
      }));
    }
    setEditingSection(null);
    setErrors({});
    setShowPasswordFields(false);
  }

  function handleUndo() {
    if (!editingSection) return;
    setForm((f) => ({
      ...f,
      ...originalSection[editingSection],
    }));
    setErrors({});
    if (editingSection === "security") setShowPasswordFields(false);
  }

  function handleChange(e) {
    const { name, value, type, checked, files } = e.target;
    setForm((f) => {
      const updated = { ...f };
      if (type === "checkbox" && name === "interests") {
        if (checked) updated.interests = [...f.interests, value];
        else updated.interests = f.interests.filter((i) => i !== value);
      } else if (type === "checkbox") {
        updated[name] = checked;
      } else if (type === "file") {
        if (files && files[0]) updated[name] = files[0];
      } else {
        updated[name] = value;
      }
      if (name === "username" && editingSection === "basic") {
        updated.usernameAvailable = null;
        if (value.length >= 3 && value !== user.username) {
          checkUsernameAPI(value).then((result) =>
            setForm((f2) => ({ ...f2, usernameAvailable: result }))
          );
        } else if (value === user.username) {
          updated.usernameAvailable = true;
        }
      }
      return updated;
    });
  }

  function renderField(f) {
    if (f.name === "profilePic") return null;

    if (editingSection === "basic" && f.name === "username") {
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
          {form.username.length > 2 && (
            <div
              style={{
                color:
                  form.username === user.username
                    ? "#16ff80"
                    : form.usernameAvailable === null
                    ? "#aaa"
                    : form.usernameAvailable
                    ? "#16ff80"
                    : "#fa6c6c",
                fontWeight: 700,
                fontSize: "0.97rem",
                marginTop: 2,
                marginBottom: 2,
              }}
            >
              {form.username === user.username
                ? "Current username"
                : form.usernameAvailable === null
                ? ""
                : form.usernameAvailable
                ? "Available"
                : "Not available"}
            </div>
          )}
          {errors.username && (
            <span style={{ color: "#f87171", fontSize: "0.97rem" }}>
              {errors.username}
            </span>
          )}
        </div>
      );
    }

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
            {form.birthday ? (
              form.birthday
            ) : (
              <span style={{ color: "#aaa" }}>—</span>
            )}
          </span>
        </div>
      );
    }

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
                    background: form.interests.includes(interest)
                      ? "#0ff"
                      : "#232326",
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

    if (editingSection && (f.name === "password" || f.name === "confirmPassword")) {
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
            style={{
              ...inputStyle,
              width: "70%",
              letterSpacing: 2,
              background: "#222",
            }}
            tabIndex={-1}
          />
        </div>
      );
    }

    if (editingSection !== "security" && f.name === "confirmPassword") {
      return null;
    }

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

  async function handleSave(section) {
    let updatePayload = {};

    if (section === "referral") {
      updatePayload = { referralCode: form.referral, codeRedeem: form.codeRedeem };
    } else if (section === "profile") {
      let profilePicUrl = form.profilePic;

      if (form.profilePic && typeof form.profilePic === "object") {
        const imgData = new FormData();
        imgData.append("profileImage", form.profilePic);
        try {
          const res = await api.post("/upload", imgData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          profilePicUrl = res.data.url;
        } catch {
          setErrors((prev) => ({ ...prev, profilePic: "Image upload failed." }));
          return;
        }
      }

      updatePayload = {
        profilePic: profilePicUrl,
        favoriteQuote: form.favoriteQuote,
        interests: form.interests,
      };
    } else {
      sectionFields[section].forEach((f) => {
        updatePayload[f.name] = form[f.name];
      });
      if (section === "security" && !showPasswordFields) {
        delete updatePayload.password;
        delete updatePayload.confirmPassword;
      }
    }

    try {
      await api.put("/me", updatePayload);
      await fetchLatestUser();
    } catch {}

    setEditingSection(null);
    setOriginalSection({});
    setCopied(false);
    setShowPasswordFields(false);
  }

  function handleCopyCode() {
    if (!form.referral) return;
    navigator.clipboard.writeText(form.referral).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  /* ---------- Styles ---------- */
  const cardSectionStyle = {
    padding: "0 22px 18px 22px",
    marginBottom: 36,
    marginLeft: "10%",
    marginRight: "auto",
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
    background: "#16ff80",
    color: "#111",
    fontWeight: 700,
    padding: "10px 28px",
    border: "none",
    borderRadius: 7,
    cursor: "pointer",
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
    >
      {/* Left quick-nav */}
      <aside
        style={{
          position: "fixed",
          top: 84,
          left: 0,
          width: 150,
          zIndex: 20,
          background: "#15151a",
          borderRadius: 13,
          boxShadow: "0 2px 16px #222a",
          padding: "16px 8px",
          marginLeft: 18,
        }}
      >
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {SECTION_LIST.map((section) => (
            <li key={section.refKey} style={{ marginBottom: 18 }}>
              <button
                type="button"
                onClick={() => scrollToSection(section.refKey)}
                style={{
                  width: "100%",
                  padding: "11px 0",
                  color: THEME.goldTextColor,
                  fontWeight: 700,
                  background: "#232326",
                  border: "none",
                  borderRadius: 9,
                  cursor: "pointer",
                  boxShadow: "0 1px 4px #2228",
                  fontSize: "1.11rem",
                  letterSpacing: 0.4,
                }}
              >
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* watermark */}
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
          zIndex: 9,
          pointerEvents: "none",
          filter: "drop-shadow(0 0 55px #00ffe1) brightness(1.13)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 11,
          marginLeft: "13vw",
          marginRight: "13vw",
          width: "clamp(330px, 48vw, 670px)",
          maxWidth: "100%",
          minHeight: "100vh",
          paddingTop: 38,
          paddingBottom: 60,
          overflowX: "hidden",
        }}
      >
        <form className="max-w-xl" style={{ color: THEME.goldTextColor }} autoComplete="off">
          {/* Basic Info */}
          <section ref={basicInfoRef} style={cardSectionStyle}>
            <h2 style={sectionTitle}>Step 1: Basic Info</h2>
            {sectionFields.basic.map((f) => renderField(f))}
            {editingSection === "basic" ? (
              <div style={{ marginTop: 24 }}>
                <button type="button" onClick={handleUndo} style={buttonStyleUndo}>
                  Undo Changes
                </button>
                <button type="button" onClick={handleCancel} style={buttonStyleCancel}>
                  Cancel
                </button>
                <button type="button" onClick={() => handleSave("basic")} style={buttonStyleSave}>
                  Save
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

            {editingSection === "security" && !showPasswordFields && (
              <button
                type="button"
                style={{
                  ...buttonStyleEdit,
                  marginBottom: 15,
                  background: "#222",
                  color: THEME.goldTextColor,
                  border: `2px solid ${THEME.goldBorderColor}`,
                }}
                onClick={() => setShowPasswordFields(true)}
              >
                Update Password?
              </button>
            )}

            {editingSection === "security" && showPasswordFields && (
              <>
                {sectionFields.security
                  .filter((f) => f.name === "password" || f.name === "confirmPassword")
                  .map((f) => renderField(f))}
              </>
            )}

            {sectionFields.security
              .filter((f) =>
                editingSection === "security"
                  ? f.name !== "password" && f.name !== "confirmPassword"
                  : f.name !== "password" && f.name !== "confirmPassword"
              )
              .map((f) => renderField(f))}

            {editingSection === "security" ? (
              <div style={{ marginTop: 24 }}>
                <button type="button" onClick={handleUndo} style={buttonStyleUndo}>
                  Undo Changes
                </button>
                <button type="button" onClick={handleCancel} style={buttonStyleCancel}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordFields(false);
                    handleSave("security");
                  }}
                  style={buttonStyleSave}
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingSection("security");
                  setShowPasswordFields(false);
                }}
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
                    src={getProfileImageSrc(user)}
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

            {sectionFields.profile
              .filter((f) => f.name !== "profilePic")
              .map((f) => renderField(f))}

            {editingSection === "profile" ? (
              <div style={{ marginTop: 24 }}>
                <button type="button" onClick={handleUndo} style={buttonStyleUndo}>
                  Undo Changes
                </button>
                <button type="button" onClick={handleCancel} style={buttonStyleCancel}>
                  Cancel
                </button>
                <button type="button" onClick={() => handleSave("profile")} style={buttonStyleSave}>
                  Save
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => handleEdit("profile")} style={buttonStyleEdit}>
                Edit
              </button>
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
                >
                  {copied ? "Copied!" : "Copy"}
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
                <button type="button" onClick={handleUndo} style={buttonStyleUndo}>
                  Undo Changes
                </button>
                <button type="button" onClick={handleCancel} style={buttonStyleCancel}>
                  Cancel
                </button>
                <button type="button" onClick={() => handleSave("referral")} style={buttonStyleSave}>
                  Save
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => handleEdit("referral")} style={buttonStyleEdit}>
                Edit
              </button>
            )}
          </section>
        </form>
      </div>
    </div>
  );
}
