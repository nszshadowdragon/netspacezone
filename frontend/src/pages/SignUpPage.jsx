import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const SIGNUP_URL = "https://api.netspacezone.com/api/auth/signup";

export default function SignUpPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    birthday: "",
    referral: "",
  });
  const [interests, setInterests] = useState([]);
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const toggleInterest = (name) =>
    setInterests((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!profilePicFile) {
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
    fd.append("profilePic", profilePicFile);     // must be "profilePic"

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
      // success: route to profile
      navigate("/profile", { replace: true });

    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  const ALL_INTERESTS = [
    "Tech","Gaming","Music","Movies","Fitness","Travel",
    "Anime","Fashion","Food","Art","Science","Education",
    "Coding","Sports","Business","News","Photography",
    "Writing","DIY","Parenting","Finance","Comics",
    "Streaming","Pets","History"
  ];

  return (
    <div className="signup-container" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 className="signup-title">Create your account</h1>

      <form onSubmit={submit} className="signup-form">
        {/* Step 1 */}
        <section className="signup-section">
          <h2 className="signup-step">Step 1: Basic Info</h2>
          <label className="field">
            Username
            <input name="username" value={form.username} onChange={onChange} />
          </label>
          <label className="field">
            Email
            <input type="email" name="email" value={form.email} onChange={onChange} />
          </label>
        </section>

        {/* Step 2 */}
        <section className="signup-section">
          <h2 className="signup-step">Step 2: Security</h2>
          <label className="field">
            Password
            <input type="password" name="password" value={form.password} onChange={onChange} />
          </label>
        </section>

        {/* Step 3 */}
        <section className="signup-section">
          <h2 className="signup-step">Step 3: Profile</h2>
          <label className="field">
            First name
            <input name="firstName" value={form.firstName} onChange={onChange} />
          </label>
          <label className="field">
            Last name
            <input name="lastName" value={form.lastName} onChange={onChange} />
          </label>
          <label className="field">
            Birthday
            <input type="date" name="birthday" value={form.birthday} onChange={onChange} />
          </label>
          <label className="field">
            Profile Image
            <input
              type="file"
              name="profilePic"
              accept="image/*"
              onChange={(e) => setProfilePicFile(e.target.files?.[0] || null)}
            />
          </label>
        </section>

        {/* Step 4 */}
        <section className="signup-section">
          <h2 className="signup-step">Step 4: Referral</h2>
          <label className="field">
            Referral Code
            <input name="referral" value={form.referral} onChange={onChange} />
          </label>
        </section>

        {/* Step 5 */}
        <section className="signup-section">
          <h2 className="signup-step">Step 5: Interests</h2>
          <fieldset
            className="interests-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}
          >
            {ALL_INTERESTS.map((i) => (
              <label key={i} className="interest-item" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={interests.includes(i)}
                  onChange={() => toggleInterest(i)}
                />
                {i}
              </label>
            ))}
          </fieldset>
        </section>

        {error && <p className="signup-error" style={{ color: "salmon" }}>{error}</p>}

        {/* Actions: Create + Cancel */}
        <div className="signup-actions" style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating..." : "Create Account"}
          </button>

          {/* Cancel button back to landing */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/")}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
