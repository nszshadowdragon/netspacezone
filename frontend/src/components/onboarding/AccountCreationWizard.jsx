import React, { useState } from "react";

const AccountCreationWizard = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    displayName: "",
    bio: "",
    avatar: ""
  });
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const onChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/account/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) setSubmitted(true);
      else setError(data.message || "Something went wrong.");
    } catch {
      setError("Server unreachable.");
    }
  };

  if (submitted) return <p>Account created successfully!</p>;

  return (
    <>
      <h2>Create an Account</h2>

      <label>
        Username <input name="username" value={formData.username} onChange={onChange} />
      </label>
      <br />
      <label>
        Email <input name="email" value={formData.email} onChange={onChange} />
      </label>
      <br />
      <label>
        Password{" "}
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={onChange}
        />
      </label>
      <br />
      <label>
        Display Name{" "}
        <input name="displayName" value={formData.displayName} onChange={onChange} />
      </label>
      <br />
      <label>
        Avatar URL <input name="avatar" value={formData.avatar} onChange={onChange} />
      </label>
      <br />
      <label>
        Bio
        <textarea name="bio" value={formData.bio} onChange={onChange} />
      </label>
      <br />

      {error && <p style={{ color: "red" }}>{error}</p>}
      <button onClick={handleSubmit}>Create Account</button>
    </>
  );
};

export default AccountCreationWizard;
