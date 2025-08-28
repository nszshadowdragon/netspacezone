// frontend/src/pages/ProfilePage.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// If backend returns /uploads/..., we must serve it from the API origin
const API_ORIGIN = "https://api.netspacezone.com";

function resolveImage(src) {
  if (!src) return "";
  // already absolute or data URL
  if (/^(https?:\/\/|data:)/i.test(src)) return src;
  // ensure a single leading slash
  const path = src.startsWith("/") ? src : `/${src}`;
  return `${API_ORIGIN}${path}`;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth(); // { username, profilePic, ... }

  // Redirect to landing if not logged in (same as your current behavior)
  useEffect(() => {
    if (!user) navigate("/", { replace: true });
  }, [user, navigate]);

  if (!user) return null;

  const avatar = resolveImage(user.profilePic) || "https://via.placeholder.com/120";

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        background: "#000",
        color: "#ffe259",
        position: "relative",
      }}
    >
      {/* BACKGROUND IMAGE */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "url('/assets/nsz-logo.png') center/cover no-repeat",
          opacity: 0.07,
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1, padding: "2rem" }}>
        {/* HEADER: avatar + username */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "1.5rem",
            marginBottom: "2rem",
            border: "1px solid #333",
            borderRadius: 8,
            background: "rgba(17,17,17,0.6)",
            flexDirection: "column",
          }}
        >
          <img
            src={avatar}
            alt="avatar"
            crossOrigin="anonymous"
            style={{
              borderRadius: "50%",
              border: "3px solid #000",
              height: 120,
              width: 120,
              objectFit: "cover",
              display: "block",
              marginBottom: "0.5rem",
            }}
          />
          <h1 style={{ margin: 0 }}>{user.username}</h1>
        </div>

        {/* (You can add more profile sections here later) */}
      </div>
    </div>
  );
}
