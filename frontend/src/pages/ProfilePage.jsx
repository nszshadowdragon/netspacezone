// frontend/src/pages/ProfilePage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ImageGallery from "../components/ImageGallery";
import AvatarImg from "../components/AvatarImg";

/* ------------------- API base (dev via proxy; prod via env) ------------------- */
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

/* ----------------------- in-memory profile cache ----------------------- */
const PROFILE_CACHE = new Map(); // key: lowercased username -> profile object

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

/* Resolve a profile by username using /api/users/search (auth required). */
async function fetchProfileByUsername(username) {
  const res = await fetch(
    `${API_BASE}/api/users/search?q=${encodeURIComponent(username)}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken() ? `Bearer ${getToken()}` : undefined,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  const arr = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
  const exact = arr.find(
    (u) => String(u.username).toLowerCase() === String(username).toLowerCase()
  );
  return exact || arr[0] || null;
}

/* ---- tiny perf helpers to warm the connection & image ---- */
function preconnectTo(origin) {
  if (!origin) return;
  try {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = origin;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  } catch {}
}
function prefetchImage(src) {
  if (!src) return;
  try {
    const img = new Image();
    img.decoding = "async";
    // @ts-ignore
    img.fetchPriority = "high";
    img.loading = "eager";
    img.src = src;
  } catch {}
}

/* ----------------------------- tiny inline avatar for friend placeholders ----------------------------- */
const friendDot =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
      <rect width='100%' height='100%' fill='#0f0f0f'/>
      <circle cx='40' cy='40' r='36' fill='#1c1c1c' stroke='#333' stroke-width='2'/>
    </svg>`
  );

export default function ProfilePage() {
  const navigate = useNavigate();
  const { username: routeUsername } = useParams();
  const { user } = useAuth();

  const [profileUser, setProfileUser] = useState(null);
  const [isFriend, setIsFriend] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [sections, setSections] = useState({
    friends: true,
    feed: true,
    gallery: true,
    activity: true,
    interests: true,
  });

  const viewerIsOwner =
    !!(user && profileUser && String(user._id) === String(profileUser._id));

  // If route is /profile and we know me, normalize to /profile/:me
  useEffect(() => {
    if (!routeUsername && user?.username) {
      navigate(`/profile/${user.username}`, { replace: true });
    }
  }, [routeUsername, user?.username, navigate]);

  // Load profile (instant from cache, then background revalidate)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const targetUsername = routeUsername || user?.username;
      if (!targetUsername) return;

      const key = String(targetUsername).toLowerCase();

      // 1) Instant render from cache (if present)
      if (PROFILE_CACHE.has(key)) {
        const cached = PROFILE_CACHE.get(key);
        setProfileUser(cached);
        // Warm connection & image so swap is instant even if we revalidate
        if (cached?.profileImageUrl && /^https?:\/\//i.test(cached.profileImageUrl)) {
          try { preconnectTo(new URL(cached.profileImageUrl).origin); } catch {}
          prefetchImage(cached.profileImageUrl);
        }
      } else if (routeUsername && user?.username && routeUsername === user.username) {
        // If viewing myself and not cached yet, seed cache with current user
        PROFILE_CACHE.set(key, user);
        setProfileUser(user);
      }

      // 2) Revalidate in background
      const fresh = await fetchProfileByUsername(targetUsername);
      if (cancelled) return;

      if (fresh) {
        PROFILE_CACHE.set(key, fresh);
        setProfileUser((prev) => {
          // If we already showed cached data, avoid state churn unless changed
          if (prev && prev._id === fresh._id && prev.profileImageUrl === fresh.profileImageUrl) {
            return prev;
          }
          return fresh;
        });

        // Warm connection + preload new avatar (prevents visible swap delay)
        if (fresh.profileImageUrl && /^https?:\/\//i.test(fresh.profileImageUrl)) {
          try { preconnectTo(new URL(fresh.profileImageUrl).origin); } catch {}
          prefetchImage(fresh.profileImageUrl);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [routeUsername, user]);

  const displayUsername = useMemo(
    () => routeUsername || user?.username || "user",
    [routeUsername, user?.username]
  );

  const toggleSection = (key) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Gate for unauthenticated /profile (without :username)
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
          Sign in to view your profile, or open a profile via a URL like{" "}
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
        .pp-main{ display:flex; gap:2rem; }
        .pp-col-left{ flex:2; }
        .pp-col-right{ flex:1; }
        @media (max-width: 900px){
          .pp-header{ flex-direction:column; align-items:center; text-align:center; }
          .pp-right{ text-align:center; }
          .pp-actions{ justify-content:center; }
          .pp-main{ flex-direction:column; }
        }

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
          {/* LEFT */}
          <div className="pp-left">
            <h3 style={{ marginBottom: ".5rem" }}>Favorite Quote</h3>
            <p>“Where connection meets cosmos.”</p>
            <small style={{ display: "block", marginTop: "1rem" }}>
              123 Friends • 56 Posts • 900 Likes
            </small>
            <div className="pp-actions">
              <button
                className="pp-btn action"
                onClick={() => setIsFriend((v) => !v)}
              >
                {isFriend ? "Unfriend" : "Add"}
              </button>
              <button className="pp-btn action">Message</button>
              <button className="pp-btn action">Share</button>
            </div>
          </div>

          {/* CENTER: avatar + username */}
          <div className="pp-center">
            <AvatarImg
              user={profileUser || (viewerIsOwner ? user : null)}
              style={{
                width: "clamp(96px,14vw,120px)",
                height: "clamp(96px,14vw,120px)",
                border: "3px solid #000",
                display: "block",
                margin: "0 auto .5rem",
              }}
              rounded
              title={profileUser ? `@${profileUser.username}` : undefined}
            />
            <h1 className="pp-username">@{displayUsername}</h1>
          </div>

          {/* RIGHT */}
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

        {/* EDIT PANEL */}
        {editMode && (
          <div
            className="section"
            style={{
              background: "rgba(30,20,5,0.9)",
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

        {/* MAIN */}
        <div className="pp-main">
          {/* LEFT COL */}
          <div className="pp-col-left">
            {sections.feed && (
              <div className="section">
                <textarea
                  className="pp-input"
                  placeholder="What's on your mind?"
                />
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
                <h2 style={{ marginTop: 0 }}>Photos</h2>
                {profileUser ? (
                  <ImageGallery ownerId={profileUser._id} canEdit={viewerIsOwner} />
                ) : (
                  <div style={{ color: "#bbb" }}>Loading profile…</div>
                )}
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

          {/* RIGHT COL */}
          <div className="pp-col-right">
            {sections.friends && (
              <div className="section">
                <h2>Friends</h2>
                <div className="pp-friends">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <img
                        src={friendDot}
                        alt="friend"
                        style={{
                          borderRadius: "50%",
                          border: "1px solid #333",
                          width: 80,
                          height: 80,
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
