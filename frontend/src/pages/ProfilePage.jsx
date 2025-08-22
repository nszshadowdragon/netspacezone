import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";   // ✅ global auth

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();   // ✅ logged-in user from global state

  // ✅ Redirect to landing if not logged in
  useEffect(() => {
    if (!user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  if (!user) {
    return null; // avoid flashing empty profile before redirect
  }

  return (
    <div style={{ minHeight: "100vh", width: "100vw", background: "#000", color: "#ffe259", position: "relative" }}>
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
        {/* HEADER BOX (only avatar + username shown) */}
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
            position: "relative",
            flexDirection: "column",
          }}
        >
          {/* CENTER: Avatar + Username */}
          <img
            src={user?.profilePic || "https://via.placeholder.com/120"}
            alt="avatar"
            style={{
              borderRadius: "50%",
              border: "3px solid #000",
              height: 120,
              width: 120,
              display: "block",
              marginBottom: "0.5rem",
            }}
          />
          <h1 style={{ margin: "0" }}>{user?.username}</h1>

          {/* 🚫 Temporarily hidden: Quote, buttons, highlights, edit */}
          {false && (
            <>
              <div>Favorite Quote / Stats / Buttons</div>
              <div>Highlights / Edit Profile</div>
            </>
          )}
        </div>

        {/* 🚫 Temporarily hidden: All other sections */}
        {false && (
          <div>
            <div>Feed / Gallery / Activity / Interests / Friends</div>
          </div>
        )}
      </div>
    </div>
  );
}
