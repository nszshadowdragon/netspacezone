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
      if (/api\.netspacezone\.com$/i.test(u.hostname) && u.pathname.startsWith("/uploads/")) {
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
    <div className="profile-page" style={{ position: "relative" }}>
      {/* decorative background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "url('/assets/nsz-logo.png') center/cover no-repeat",
          opacity: 0.07,
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* Responsive styles */}
      <style>{`
        .profile-page{
          min-height:100vh; width:100vw; background:#000; color:#ffe259;
        }
        .pp-container{ position:relative; z-index:1; padding:2rem; max-width:1100px; margin:0 auto; }
        @media (max-width: 680px){ .pp-container{ padding:1rem; } }

        .pp-header{
          display:flex; gap:1rem; justify-content:space-between; align-items:flex-start;
          padding:1.25rem; margin-bottom:2rem; border:1px solid #333; border-radius:8px;
          background:rgba(17,17,17,.6);
        }
        .pp-left{ flex:1; }
        .pp-center{ flex:1; text-align:center; }
        .pp-right{ flex:1; text-align:right; }
        .pp-actions{ margin-top:.8rem; display:flex; gap:.5rem; flex-wrap:wrap; }
        .pp-username{ margin:0; font-size:clamp(20px,3.2vw,28px); }
        .pp-avatar{
          height:clamp(96px,14vw,120px); width:clamp(96px,14vw,120px);
          border-radius:50%; border:3px solid #000; object-fit:cover; display:block; margin:0 auto .5rem;
        }

        @media (max-width: 900px){
          .pp-header{ flex-direction:column; align-items:center; text-align:center; }
          .pp-right{ text-align:center; }
          .pp-actions{ justify-content:center; }
        }

        .pp-main{ display:flex; gap:2rem; }
        .pp-col-left{ flex:2; }
        .pp-col-right{ flex:1; }
        @media (max-width: 900px){ .pp-main{ flex-direction:column; } }

        .section{
          margin-bottom:2rem; padding:1rem; border-radius:8px; border:1px solid #333; background:rgba(17,17,17,.5);
        }

        .pp-friends{ display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; }
        @media (max-width: 480px){ .pp-friends{ grid-template-columns:repeat(2,1fr); } }

        .pp-btn{ border:none; padding:.45rem .85rem; border-radius:6px; cursor:pointer; font-weight:700; }
        .pp-btn.gold{ background:#ffe259; color:#000; }
        .pp-btn.action{ border:1px solid #333; background:rgba(255,226,89,.2); color:#ffe259; }
        textarea.pp-input{
          width:100%; padding:.5rem; border-radius:6px; background:transparent; border:1px solid #333; color:#ffe259;
        }
      `}</style>

      <div className="pp-container">
        {/* HEADER */}
        <div className="pp-header">
          {/* LEFT: Favorite Quote */}
          <div className="pp-left">
            <h3 style={{ marginBottom: ".5rem" }}>Favorite Quote</h3>
            <p>“Where connection meets cosmos.”</p>
            <small style={{ display: "block", marginTop: "1rem" }}>
              123 Friends • 56 Posts • 900 Likes
            </small>
            <div className="pp-actions">
              <button className="pp-btn action" onClick={() => setIsFriend(!isFriend)}>
                {isFriend ? "Unfriend" : "Add"}
              </button>
              <button className="pp-btn action">Message</button>
              <button className="pp-btn action">Share</button>
            </div>
          </div>

          {/* CENTER: Avatar + Username */}
          <div className="pp-center">
            <img
              src={avatar}
              alt="avatar"
              className="pp-avatar"
              onError={(e) => {
                if (!e.currentTarget.dataset.fallback) {
                  e.currentTarget.dataset.fallback = "1";
                  e.currentTarget.src = fallbackDataUri;
                }
              }}
            />
            <h1 className="pp-username">@{displayUsername}</h1>
          </div>

          {/* RIGHT: Highlights + Edit */}
          <div className="pp-right">
            <div style={{ marginBottom: "1rem" }}>
              <button
                onClick={() => setEditMode((e) => !e)}
                className="pp-btn gold"
              >
                {editMode ? "Close Editor" : "Edit Profile"}
              </button>
            </div>
            <h3 style={{ marginBottom: ".5rem" }}>Highlights</h3>
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
            className="section"
            style={{
              background: "rgba(30,20,5,0.9)",
              border: "1px solid #b8860b",
              boxShadow: "0 0 10px rgba(255,226,89,0.5)",
            }}
          >
            <h2 style={{ marginTop: 0, color: "#ffe259" }}>⚡ Profile Customization</h2>
            <p style={{ marginBottom: "1rem", color: "#aaa" }}>
              Toggle sections and adjust your layout:
            </p>
            {Object.keys(sections).map((key) => (
              <div key={key} style={{ marginBottom: ".5rem" }}>
                <label>
                  <input
                    type="checkbox"
                    checked={sections[key]}
                    onChange={() => toggleSection(key)}
                    style={{ marginRight: ".5rem" }}
                  />
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </label>
              </div>
            ))}
            <button className="pp-btn gold" style={{ marginTop: "1rem" }}>
              Save Changes
            </button>
          </div>
        )}

        {/* MAIN LAYOUT */}
        <div className="pp-main">
          {/* LEFT COLUMN */}
          <div className="pp-col-left">
            {sections.feed && (
              <div className="section">
                <textarea className="pp-input" placeholder="What's on your mind?" />
                <button className="pp-btn gold" style={{ marginTop: ".5rem" }}>
                  Post
                </button>
                <div style={{ marginTop: "1rem" }}>
                  {["First post!", "Excited to join NSZ!"].map((post, i) => (
                    <div
                      key={i}
                      className="section"
                      style={{
                        marginBottom: "1rem",
                        background: "rgba(17,17,17,0.6)",
                      }}
                    >
                      <strong>@{displayUsername}</strong>
                      <p style={{ margin: ".3rem 0" }}>{post}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sections.gallery && (
              <div className="section">
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
              <div className="section">
                <h2>Recent Activity</h2>
                <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                  <li>Friended User123</li>
                  <li>Liked a post</li>
                  <li>Joined Group "Anime Fans"</li>
                </ul>
              </div>
            )}

            {sections.interests && (
              <div className="section">
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
          <div className="pp-col-right">
            {sections.friends && (
              <div className="section">
                <h2>Friends</h2>
                <div className="pp-friends">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <img
                        src="https://via.placeholder.com/80"
                        style={{ borderRadius: "50%", border: "1px solid #333" }}
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
                      <p style={{ fontSize: ".8rem" }}>Friend{i + 1}</p>
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

const tag = {
  display: "inline-block",
  marginRight: "0.5rem",
  padding: "0.2rem 0.6rem",
  fontSize: "0.8rem",
  border: "1px solid #444",
  borderRadius: 6,
  background: "rgba(17,17,17,0.6)",
};
