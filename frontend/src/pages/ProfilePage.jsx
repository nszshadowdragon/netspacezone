// frontend/src/pages/ProfilePage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ---------- helpers to make avatar URLs work in local & prod ----------
function apiHost() {
  const h = window.location.hostname;
  const isLocal = h === "localhost" || h === "127.0.0.1";
  return isLocal ? "http://localhost:5000" : "https://api.netspacezone.com";
}

// inline fallback (no external requests)
const fallbackDataUri =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
      <rect width="100%" height="100%" fill="#111"/>
      <circle cx="60" cy="60" r="56" fill="#222" stroke="#333" stroke-width="4"/>
      <text x="50%" y="55%" text-anchor="middle" fill="#ffe259" font-size="16" font-family="Arial">avatar</text>
    </svg>`
  );

/**
 * Accepts:
 *   - data: / blob: URIs
 *   - absolute http(s) URLs (rewrites api.netspacezone.com → localhost in dev)
 *   - '/uploads/filename' | 'uploads/filename' | 'filename'
 * Returns an absolute URL that works both locally and in production.
 */
function resolveAvatar(raw) {
  let src = (raw || "").trim();
  if (!src) return fallbackDataUri;
  if (/^(data:|blob:)/i.test(src)) return src;

  const local =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const host = apiHost();

  // If it's absolute, try to rewrite api host to local in dev
  if (/^https?:\/\//i.test(src)) {
    try {
      const u = new URL(src);
      // Only rewrite if it's our API host and it's an /uploads/* path
      if (
        /api\.netspacezone\.com$/i.test(u.hostname) &&
        u.pathname.startsWith("/uploads/")
      ) {
        return (local ? "http://localhost:5000" : "https://api.netspacezone.com") + u.pathname;
      }
      return src; // leave any other absolute URLs untouched
    } catch {
      // fall through to path normalize
    }
  }

  // Normalize relative path to /uploads/*
  src = src.replace(/^\.?\/*/, ""); // strip leading ./ or /
  if (!src.startsWith("uploads/")) src = `uploads/${src}`;
  return `${host}/${src}`;
}
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const navigate = useNavigate();
  const { username: routeUsername } = useParams();
  const { user } = useAuth();

  const [isFriend, setIsFriend] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [sections, setSections] = useState({
    friends: true,
    feed: true,
    gallery: true,
    activity: true,
    interests: true,
  });

  // Normalize /profile -> /profile/:me once we know who "me" is.
  // IMPORTANT: Do NOT redirect to home/spacehub from here.
  useEffect(() => {
    if (!routeUsername && user?.username) {
      navigate(`/profile/${user.username}`, { replace: true });
    }
  }, [routeUsername, user?.username, navigate]);

  // Which username to show in UI
  const displayUsername = useMemo(
    () => routeUsername || user?.username || "User",
    [routeUsername, user?.username]
  );

  // Avatar: show the signed-in user's avatar on their own page;
  // for other users (until wired), use a placeholder.
  const avatar = useMemo(() => {
    if (routeUsername && user?.username && routeUsername !== user.username) {
      return fallbackDataUri;
    }
    return resolveAvatar(user?.profilePic || user?.profileImage);
  }, [routeUsername, user?.profilePic, user?.profileImage, user?.username]);

  const toggleSection = (key) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // If not logged in and no :username param, show a friendly gate (no redirect).
  if (!user && !routeUsername) {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100vw",
          background: "#000",
          color: "#ffe259",
          padding: "2rem",
        }}
      >
        <h2 style={{ margin: 0, marginBottom: "0.5rem" }}>Profile</h2>
        <p style={{ color: "#ddd" }}>
          Sign in to view your profile, or open someone’s profile via a URL like{" "}
          <code style={{ color: "#ffe259" }}>/profile/nszshadowdragon</code>.
        </p>
      </div>
    );
  }

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
        {/* HEADER BOX */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: "1.5rem",
            marginBottom: "2rem",
            border: "1px solid #333",
            borderRadius: 8,
            background: "rgba(17,17,17,0.6)",
            position: "relative",
          }}
        >
          {/* LEFT: Favorite Quote */}
          <div style={{ flex: 1 }}>
            <h3 style={{ marginBottom: "0.5rem" }}>Favorite Quote</h3>
            <p>“Where connection meets cosmos.”</p>
            <small style={{ display: "block", marginTop: "1rem" }}>
              123 Friends • 56 Posts • 900 Likes
            </small>
            <div
              style={{ marginTop: "0.8rem", display: "flex", gap: "0.5rem" }}
            >
              <button style={actionBtn} onClick={() => setIsFriend(!isFriend)}>
                {isFriend ? "Unfriend" : "Add"}
              </button>
              <button style={actionBtn}>Message</button>
              <button style={actionBtn}>Share</button>
            </div>
          </div>

          {/* CENTER: Avatar + Username */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <img
              src={avatar}
              alt="avatar"
              style={{
                borderRadius: "50%",
                border: "3px solid #000",
                height: 120,
                width: 120,
                display: "block",
                margin: "0 auto 0.5rem",
                objectFit: "cover",
              }}
              onError={(e) => {
                if (!e.currentTarget.dataset.fallback) {
                  e.currentTarget.dataset.fallback = "1";
                  e.currentTarget.src = fallbackDataUri;
                }
              }}
            />
            <h1 style={{ margin: "0" }}>@{displayUsername}</h1>
          </div>

          {/* RIGHT: Highlights + Edit */}
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ marginBottom: "1rem" }}>
              <button
                onClick={() => setEditMode((e) => !e)}
                style={{
                  background: "#ffe259",
                  border: "none",
                  color: "#000",
                  padding: "0.4rem 0.8rem",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                {editMode ? "Close Editor" : "Edit Profile"}
              </button>
            </div>
            <h3 style={{ marginBottom: "0.5rem" }}>Highlights</h3>
            <p>
              <strong>Featured In:</strong> Top Creators
            </p>
            <p>
              <strong>Achievements:</strong> 1000+ Likes • Creator of the Month
            </p>
          </div>
        </div>

        {/* EDIT MODE PANEL */}
        {editMode && (
          <div
            style={{
              marginBottom: "2rem",
              background: "rgba(30,20,5,0.9)",
              padding: "1.5rem",
              borderRadius: 8,
              border: "1px solid #b8860b",
              boxShadow: "0 0 10px rgba(255,226,89,0.5)",
            }}
          >
            <h2 style={{ marginTop: 0, color: "#ffe259" }}>
              ⚡ Profile Customization
            </h2>
            <p style={{ marginBottom: "1rem", color: "#aaa" }}>
              Toggle sections and adjust your layout:
            </p>
            {Object.keys(sections).map((key) => (
              <div key={key} style={{ marginBottom: "0.5rem" }}>
                <label>
                  <input
                    type="checkbox"
                    checked={sections[key]}
                    onChange={() => toggleSection(key)}
                    style={{ marginRight: "0.5rem" }}
                  />
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </label>
              </div>
            ))}
            <button
              style={{
                marginTop: "1rem",
                background: "#ffe259",
                color: "#000",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: 6,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Save Changes
            </button>
          </div>
        )}

        {/* MAIN LAYOUT */}
        <div style={{ display: "flex", gap: "2rem" }}>
          {/* LEFT COLUMN */}
          <div style={{ flex: 2 }}>
            {sections.feed && (
              <div style={sectionBox}>
                <textarea
                  placeholder="What's on your mind?"
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: 6,
                    background: "transparent",
                    border: "1px solid #333",
                    color: "#ffe259",
                    marginBottom: "0.5rem",
                  }}
                />
                <button style={{ ...btn, background: "#ffe259", color: "#000" }}>
                  Post
                </button>
                <div style={{ marginTop: "1rem" }}>
                  {["First post!", "Excited to join NSZ!"].map((post, i) => (
                    <div
                      key={i}
                      style={{
                        marginBottom: "1rem",
                        padding: "0.8rem",
                        border: "1px solid #333",
                        borderRadius: 6,
                        background: "rgba(17,17,17,0.6)",
                      }}
                    >
                      <strong>@{displayUsername}</strong>
                      <p style={{ margin: "0.3rem 0" }}>{post}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sections.gallery && (
              <div style={sectionBox}>
                <h2>Photos</h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  {Array.from({ length: 6 }).map((_, i) => (
                    <img
                      key={i}
                      src="https://via.placeholder.com/300"
                      alt="gallery"
                      style={{
                        borderRadius: 8,
                        width: "100%",
                        height: 150,
                        objectFit: "cover",
                        border: "1px solid #333",
                      }}
                      onError={(e) => {
                        // local inline fallback
                        e.currentTarget.src =
                          "data:image/svg+xml;utf8," +
                          encodeURIComponent(
                            `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='150'>
                               <rect width='100%' height='100%' fill='#111'/>
                               <text x='50%' y='50%' fill='#ffe259' text-anchor='middle' font-family='Arial' font-size='16'>image</text>
                             </svg>`
                          );
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {sections.activity && (
              <div style={sectionBox}>
                <h2>Recent Activity</h2>
                <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                  <li>Friended User123</li>
                  <li>Liked a post</li>
                  <li>Joined Group "Anime Fans"</li>
                </ul>
              </div>
            )}

            {sections.interests && (
              <div style={sectionBox}>
                <h2>Interests</h2>
                <div>
                  <span style={tag}>#Anime</span>
                  <span style={tag}>#Music</span>
                  <span style={tag}>#Tech</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ flex: 1 }}>
            {sections.friends && (
              <div style={sectionBox}>
                <h2>Friends</h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "1rem",
                  }}
                >
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <img
                        src="https://via.placeholder.com/80"
                        style={{
                          borderRadius: "50%",
                          border: "1px solid #333",
                        }}
                        alt="friend"
                        onError={(e) => {
                          e.currentTarget.src =
                            "data:image/svg+xml;utf8," +
                            encodeURIComponent(
                              `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
                                 <rect width='100%' height='100%' fill='#111'/>
                               </svg>`
                            );
                        }}
                      />
                      <p style={{ fontSize: "0.8rem" }}>Friend{i + 1}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const sectionBox = {
  marginBottom: "2rem",
  padding: "1rem",
  borderRadius: 8,
  border: "1px solid #333",
  background: "rgba(17,17,17,0.5)",
};

const btn = {
  border: "none",
  padding: "0.4rem 0.8rem",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold",
};

const actionBtn = {
  border: "1px solid #333",
  background: "rgba(255,226,89,0.2)",
  color: "#ffe259",
  padding: "0.4rem 0.8rem",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold",
};

const tag = {
  display: "inline-block",
  marginRight: "0.5rem",
  padding: "0.2rem 0.6rem",
  fontSize: "0.8rem",
  border: "1px solid #444",
  borderRadius: 6,
  background: "rgba(17,17,17,0.6)",
};
