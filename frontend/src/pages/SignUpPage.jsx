import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

// Runtime-safe URL fixer: always send to api.netspacezone.com in prod
function apiUrl(path) {
  try {
    const u = new URL(path, window.location.origin);
    // If weâ€™re on the web app host, rewrite to API host
    if (/^(www\.)?netspacezone\.com$/i.test(u.hostname)) {
      u.protocol = "https:";
      u.hostname = "api.netspacezone.com";
    }
    return u.toString();
  } catch {
    return `https://api.netspacezone.com${path}`;
  }
}

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
  const [profilePic, setProfilePic] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const toggleInterest = (name) =>
    setInterests((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );

  const handleFile = (e) => setProfilePic(e.target.files?.[0] || null);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!profilePic) {
      setError("Please choose a profile image.");
      return;
    }

    const fd = new FormData();
    fd.append("username", form.username.trim());
    fd.append("email", form.email.trim());
    fd.append("password", form.password);
    fd.append("firstName", form.firstName.trim());
    fd.append("lastName", form.lastName.trim());
    fd.append("birthday", form.birthday);
    fd.append("referral", form.referral.trim());
    fd.append("interests", interests.join(",")); // server splits by comma
    fd.append("profilePic", profilePic); // key must be profilePic

    const url = "https://api.netspacezone.com/api/auth/signup";

    try {
      setSubmitting(true);

      const res = await fetch(url, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Signup failed (${res.status})`);
      }

      // success -> go straight to profile page
      // If your route is /profile/:username, swap to:
      // const data = await res.json(); navigate(`/profile/${data?.user?.username || form.username}`, { replace: true });
      await res.json().catch(() => null);
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
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>Create your account</h1>

      <form onSubmit={submit}>
        <h2>Step 1: Basic Info</h2>
        <label>
          Username
          <input name="username" value={form.username} onChange={onChange} />
        </label>

        <label>
          Email
          <input type="email" name="email" value={form.email} onChange={onChange} />
        </label>

        <h2>Step 2: Security</h2>
        <label>
          Password
          <input type="password" name="password" value={form.password} onChange={onChange} />
        </label>

        <h2>Step 3: Profile</h2>
        <label>
          First name
          <input name="firstName" value={form.firstName} onChange={onChange} />
        </label>

        <label>
          Last name
          <input name="lastName" value={form.lastName} onChange={onChange} />
        </label>

        <label>
          Birthday
          <input type="date" name="birthday" value={form.birthday} onChange={onChange} />
        </label>

        <label>
          Profile Image
          <input type="file" accept="image/*" onChange={handleFile} />
        </label>

        <h2>Step 4: Referral</h2>
        <label>
          Referral Code
          <input name="referral" value={form.referral} onChange={onChange} />
        </label>

        <h2>Step 5: Interests</h2>
        <fieldset style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
          {ALL_INTERESTS.map((i) => (
            <label key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={interests.includes(i)}
                onChange={() => toggleInterest(i)}
              />
              {i}
            </label>
          ))}
        </fieldset>

        {error && <p style={{ color: "salmon" }}>{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}

