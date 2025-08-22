import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";   // ✅ global auth

const API_BASE = import.meta.env.VITE_API_BASE || "";

const INTERESTS = [
  "Tech","Gaming","Music","Movies","Fitness","Travel","Anime","Fashion",
  "Food","Art","Science","Education","Coding","Sports","Business","News",
  "Photography","Writing","DIY","Parenting","Finance","Comics","Streaming","Pets","History"
];

const SECTION_LIST = [
  { label: "Basic Info", refKey: "basicInfoRef" },
  { label: "Security", refKey: "securityRef" },
  { label: "Profile", refKey: "profileRef" },
  { label: "Referral", refKey: "referralRef" },
];

export default function SignUpPage() {
  const navigate = useNavigate();
  const { login } = useAuth();   // ✅ use global login after signup

  const basicInfoRef = useRef();
  const securityRef = useRef();
  const profileRef = useRef();
  const referralRef = useRef();

  const [form, setForm] = useState({
    username: "",
    email: "",
    birthday: "",
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
    profilePic: null,
    referral: "",
    interests: []
  });
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading] = useState(false);

  const sectionRefs = { basicInfoRef, securityRef, profileRef, referralRef };

  const validate = () => {
    const newErrors = {};
    if (!form.username) newErrors.username = "Username required";
    if (!form.email) newErrors.email = "Email required";
    if (!form.password) newErrors.password = "Password required";
    if (form.password !== form.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, files, checked } = e.target;
    setForm((f) => {
      if (type === "file") {
        return { ...f, [name]: files[0] };
      }
      if (type === "checkbox" && name === "interests") {
        if (checked) return { ...f, interests: [...f.interests, value] };
        return { ...f, interests: f.interests.filter((i) => i !== value) };
      }
      return { ...f, [name]: value };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Handle profilePic (convert to base64 if uploading file)
      let profilePicData = "";
      if (form.profilePic) {
        const reader = new FileReader();
        profilePicData = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(form.profilePic);
        });
      }

      // Step 1: Create account with all fields
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          birthday: form.birthday,
          profilePic: profilePicData,
          referral: form.referral,
          interests: form.interests,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Signup failed");
      } else {
        // Step 2: Immediately log them in via AuthContext
        await login(form.username, form.password);
        navigate(`/profile/${form.username}`, { replace: true });
      }
    } catch {
      alert("Network error during signup");
    }
    setLoading(false);
  };

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div style={{ minHeight: "100vh", width: "100vw", background: "#000", display: "flex" }}>
      {/* Left: Sticky Sidebar Nav */}
      <nav style={{
        width: 140,
        padding: "2rem 1rem",
        position: "sticky",
        top: 0,
        alignSelf: "flex-start"
      }}>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {SECTION_LIST.map((section) => (
            <li key={section.refKey} style={{ marginBottom: 10 }}>
              <button
                type="button"
                onClick={() =>
                  sectionRefs[section.refKey].current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
                style={{
                  width: "100%",
                  padding: "0.6rem",
                  color: "#ffe259",
                  background: "#232326",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Form */}
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-start", padding: "2rem" }}>
        <form style={{ width: "100%", maxWidth: 500, color: "#ffe259" }} onSubmit={handleSubmit}>
          {/* Step 1 */}
          <section ref={basicInfoRef} style={sectionStyle}>
            <h2 style={sectionTitle}>Step 1: Basic Info</h2>
            <Input label="Username" name="username" value={form.username} onChange={handleChange} error={errors.username} />
            <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} error={errors.email} />
            <Input label="Birthday" name="birthday" type="date" value={form.birthday} onChange={handleChange} />
            <Input label="First Name" name="firstName" value={form.firstName} onChange={handleChange} />
            <Input label="Last Name" name="lastName" value={form.lastName} onChange={handleChange} />
          </section>

          {/* Step 2 */}
          <section ref={securityRef} style={sectionStyle}>
            <h2 style={sectionTitle}>Step 2: Security</h2>
            <Input label="Password" name="password" type={showPass ? "text" : "password"} value={form.password} onChange={handleChange} error={errors.password} />
            <button type="button" onClick={() => setShowPass((v) => !v)} style={toggleBtn}>{showPass ? "Hide" : "Show"}</button>
            <Input label="Confirm Password" name="confirmPassword" type={showConf ? "text" : "password"} value={form.confirmPassword} onChange={handleChange} error={errors.confirmPassword} />
            <button type="button" onClick={() => setShowConf((v) => !v)} style={toggleBtn}>{showConf ? "Hide" : "Show"}</button>
          </section>

          {/* Step 3 */}
          <section ref={profileRef} style={sectionStyle}>
            <h2 style={sectionTitle}>Step 3: Profile</h2>
            <input type="file" name="profilePic" accept="image/*" onChange={handleChange} />
            {form.profilePic && <img src={URL.createObjectURL(form.profilePic)} alt="preview" width={88} style={{ borderRadius: 12, marginTop: 10 }} />}
          </section>

          {/* Step 4 */}
          <section ref={referralRef} style={sectionStyle}>
            <h2 style={sectionTitle}>Step 4: Referral</h2>
            <Input label="Referral Code" name="referral" value={form.referral} onChange={handleChange} />
          </section>

          {/* Step 5 */}
          <section style={sectionStyle}>
            <h2 style={sectionTitle}>Step 5: Interests</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {INTERESTS.map((interest) => (
                <label key={interest} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    name="interests"
                    value={interest}
                    checked={form.interests.includes(interest)}
                    onChange={handleChange}
                  />
                  {interest}
                </label>
              ))}
            </div>
          </section>

          <div style={{ textAlign: "left", marginTop: 20 }}>
            <button type="button" onClick={() => navigate("/")} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={submitBtn}>
              {loading ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>

      {/* Right: Logo background */}
      {windowWidth >= 900 && (
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(to bottom right, #000, #111)"
        }}>
          <img src="/assets/nsz-logo.png" alt="NSZ Logo" style={{ width: "50%", maxWidth: "320px", objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}

function Input({ label, name, value, onChange, type = "text", error }) {
  return (
    <div style={{ marginBottom: 15 }}>
      <label style={{ display: "block", marginBottom: 5 }}>{label}</label>
      <input name={name} value={value} onChange={onChange} type={type} style={inputStyle} />
      {error && <span style={{ color: "#f87171", fontSize: "0.85rem" }}>{error}</span>}
    </div>
  );
}

/* ---- Styles ---- */
const sectionStyle = { marginBottom: 30 };
const sectionTitle = { fontSize: "1.3rem", fontWeight: 700, marginBottom: 15 };
const inputStyle = { width: "100%", padding: "10px", borderRadius: 6, border: "1px solid #333", background: "#000", color: "#ffe259" };
const toggleBtn = { margin: "0.3rem 0 0.8rem 0", padding: "4px 8px", fontSize: "0.8rem", border: "none", borderRadius: 4, background: "#333", color: "#ffe259", cursor: "pointer" };
const cancelBtn = { marginRight: 10, padding: "0.6rem 1.2rem", background: "#444", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer" };
const submitBtn = { padding: "0.6rem 1.2rem", background: "#ffe259", border: "none", borderRadius: 6, color: "#000", fontWeight: "bold", cursor: "pointer" };
