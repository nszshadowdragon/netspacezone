import React, { useState } from "react";

/** 
 * Always hit the API host in prod to avoid 405s from the Vercel frontend.
 * Local dev stays relative so it goes to your dev server/proxy.
 */
const API_BASE =
  window.location.hostname.endsWith("netspacezone.com")
    ? "https://api.netspacezone.com"
    : "";

export default function SignUpPage() {
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
      setError("Profile picture is required.");
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
    fd.append("profilePic", profilePic); // <— field name the server expects

    const url = `${API_BASE}/api/auth/signup`;
    try {
      setSubmitting(true);
      // (Optional) helpful during debugging:
      // console.log("POST →", url);

      const res = await fetch(url, {
        method: "POST",
        body: fd,
        credentials: "include", // send/receive auth cookie
      });

      // Try to read a message if possible
      let data = null;
      try {
        data = await res.json();
      } catch {
        /* ignore non-JSON */
      }

      if (!res.ok) {
        // 405 here typically means we posted to the wrong origin
        if (res.status === 405) {
          throw new Error(
            "Signup endpoint returned 405. Make sure requests go to https://api.netspacezone.com."
          );
        }
        throw new Error(data?.error || "Signup failed");
      }

      // Success: you’re logged in via cookie; send user to home or profile
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="signup">
      <h1>Create Account</h1>

      <form onSubmit={submit} encType="multipart/form-data">
        <label>
          Username
          <input
            name="username"
            value={form.username}
            onChange={onChange}
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            required
          />
        </label>

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
          Referral Code
          <input name="referral" value={form.referral} onChange={onChange} />
        </label>

        <label>
          Profile picture (required)
          <input type="file" accept="image/*" onChange={handleFile} required />
        </label>

        {/* Minimal interests UI (checkboxes) */}
        <fieldset>
          <legend>Interests</legend>
          {[
            "Tech","Gaming","Music","Movies","Fitness","Travel",
            "Anime","Fashion","Food","Art","Science","Education",
            "Coding","Sports","Business","News","Photography","Writing",
            "DIY","Parenting","Finance","Comics","Streaming","Pets","History",
          ].map((i) => (
            <label key={i} style={{ marginRight: 12 }}>
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
