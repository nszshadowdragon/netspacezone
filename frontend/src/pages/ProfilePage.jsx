// frontend/src/pages/ProfilePage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme, getThemeVars } from "../context/ThemeContext"; // fixed import
import ImageGallery from "../components/ImageGallery";
import AvatarImg from "../components/AvatarImg";
import useFriendship from "../hooks/useFriendship";

// Safe SSR check for window
const isLocal = typeof window !== "undefined" && /localhost|127\.0\.0\.1/.test(window.location.hostname);
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || (isLocal ? "http://localhost:5000" : "");

const PROFILE_CACHE = new Map();

function getToken() {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

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

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { username: routeUsername } = useParams();
  const { user } = useAuth();
  const { theme: viewerTheme } = useTheme(); // fixed usage

  const [profileUser, setProfileUser] = useState(null);
  const [profileThemeVars, setProfileThemeVars] = useState(null);
  const [toast, setToast] = useState("");
  const [confirmUnfriendOpen, setConfirmUnfriendOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const isSelf = useMemo(() => {
    if (!user) return false;
    if (profileUser?._id && user._id) return String(user._id) === String(profileUser._id);
    if (routeUsername) {
      return String(routeUsername).toLowerCase() === String(user.username || "").toLowerCase();
    }
    return true;
  }, [user, profileUser, routeUsername]);

  const displayUsername = useMemo(
    () => routeUsername || user?.username || "user",
    [routeUsername, user?.username]
  );

  useEffect(() => {
    if (!routeUsername && user?.username) {
      navigate(`/profile/${user.username}`, { replace: true });
    }
  }, [routeUsername, user?.username, navigate]);

  // --- Vercel-safe profile + theme fetch ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const targetUsername = routeUsername || user?.username;
      if (!targetUsername) return;
      const key = String(targetUsername).toLowerCase();

      // Try cache first
      let profile = PROFILE_CACHE.get(key) || null;

      // Fetch fresh profile regardless of cache
      const fresh = await fetchProfileByUsername(targetUsername);
      if (cancelled) return;

      if (fresh) {
        PROFILE_CACHE.set(key, fresh);
        profile = fresh;
      }

      if (profile) {
        setProfileUser(profile);
        // Apply profile's theme, fallback to viewerTheme
        setProfileThemeVars(getThemeVars(profile?.theme || viewerTheme));
      }
    })();
    return () => { cancelled = true; };
  }, [routeUsername, user, viewerTheme]);

  const targetId = profileUser?._id || profileUser?.id || "";
  const targetUsernameProfile = profileUser?.username || routeUsername || "";

  const {
    status,
    busy,
    request, cancel, accept, decline, unfriend,
    FRIEND_STATUS: FS,
  } = useFriendship({ userId: targetId, username: targetUsernameProfile });

  async function handleAddFriend() {
    const r = await request();
    setToast(!r.ok ? "Could not send request." : "Friend request sent");
    setTimeout(() => setToast(""), 1800);
  }
  async function handleCancelRequest() {
    const r = await cancel();
    setToast(!r.ok ? "Could not cancel." : "");
    setTimeout(() => setToast(""), 1800);
  }
  async function handleAcceptFriend() {
    const r = await accept();
    setToast(!r.ok ? "Could not accept." : "You are now friends");
    setTimeout(() => setToast(""), 1800);
  }
  async function handleDeclineFriend() {
    const r = await decline();
    setToast(!r.ok ? "Could not decline." : "");
    setTimeout(() => setToast(""), 1800);
  }
  async function handleConfirmUnfriend() {
    const r = await unfriend();
    setToast(!r.ok ? "Could not unfriend." : "Removed from friends");
    setConfirmUnfriendOpen(false);
    setTimeout(() => setToast(""), 1800);
  }

  const showAddBtn = !(status === FS.SELF) && status === FS.NONE;
  const showRequested = !(status === FS.SELF) && status === FS.PENDING;
  const showIncoming = !(status === FS.SELF) && status === FS.INCOMING;
  const showUnfriend = !(status === FS.SELF) && status === FS.FRIENDS;

  return (
    <div
      className="profile-page"
      style={{
        position: "relative",
        background: "var(--bg-color)",
        color: "var(--text-color)",
        minHeight: "100vh",
        width: "100vw",
        ...(profileThemeVars || {}),
      }}
      key={routeUsername || user?.username}
    >
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
        .profile-page { min-height:100vh; width:100vw; background: var(--bg-color); color: var(--text-color); }
        .pp-container { position:relative; z-index:1; padding:2rem; max-width:1100px; margin:0 auto; }
        @media (max-width: 680px){ .pp-container{ padding:1rem; } }
        .pp-header { display:flex; gap:1rem; justify-content:space-between; align-items:flex-start; padding:1.25rem; margin-bottom:2rem; border:1px solid var(--primary-color); border-radius:8px; background: var(--panel-bg, rgba(17,17,17,.6)); }
        .pp-left{ flex:1; }
        .pp-center{ flex:1; text-align:center; }
        .pp-right{ flex:1; text-align:right; }
        .pp-actions{ margin-top:.8rem; display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; }
        .pp-username{ margin:0; font-size:clamp(20px,3.2vw,28px); }
        .pp-main{ display:flex; gap:2rem; }
        .pp-col-left{ flex:2; }
        .pp-col-right{ flex:1; }
        @media (max-width: 900px){ .pp-header{ flex-direction:column; align-items:center; text-align:center; } .pp-right{ text-align:center; } .pp-actions{ justify-content:center; } .pp-main{ flex-direction:column; } }
        .section{ margin-bottom:2rem; padding:1rem; border-radius:8px; border:1px solid var(--primary-color); background: var(--panel-bg-soft, rgba(17,17,17,.5)); }
        .pp-btn{ border:none; padding:.45rem .85rem; border-radius:6px; cursor:pointer; font-weight:700; }
        .pp-btn.gold{ background: var(--primary-color); color: var(--bg-color); }
        .pp-btn.action{ border:1px solid var(--primary-color); background: var(--action-bg, rgba(255,226,89,.12)); color: var(--text-color); }
        .pp-btn[disabled]{ opacity:.55; cursor:not-allowed; }
        textarea.pp-input{ width:100%; padding:.5rem; border-radius:6px; background:transparent; border:1px solid var(--primary-color); color:var(--text-color); }
        .overlay{ position:fixed; inset:0; background:var(--overlay-bg, rgba(0,0,0,.6)); display:flex; align-items:center; justify-content:center; z-index:50; }
        .modal{ background: var(--bg-color-darker, #111); border:1px solid var(--primary-color); border-radius:10px; padding:1rem; width:min(420px,92vw); box-shadow:0 0 18px rgba(0,0,0,.25); }
        .modal-actions{ display:flex; gap:.5rem; justify-content:flex-end; }
        .pp-toast{ font-size:12px; color:var(--text-color-light, #bbb); min-height:18px; margin-left:.25rem; }
        .muted { color: var(--text-color-light, #bbb); }
      `}</style>

      <div className="pp-container">
        <div className="pp-header">
          <div className="pp-left">
            <h3 style={{ marginBottom: ".5rem" }}>Favorite Quote</h3>
            <p className="muted">“Where connection meets cosmos.”</p>
            <small style={{ display: "block", marginTop: "1rem" }} className="muted">
              123 Friends • 56 Posts • 900 Likes
            </small>

            <div className="pp-actions">
              {showAddBtn && (
                <button className="pp-btn action" onClick={handleAddFriend} aria-label="Add Friend" disabled={busy}>
                  Add
                </button>
              )}

              {showIncoming && (
                <>
                  <button className="pp-btn gold" onClick={handleAcceptFriend} disabled={busy} aria-label="Accept Friend">
                    Accept
                  </button>
                  <button className="pp-btn action" onClick={handleDeclineFriend} disabled={busy} aria-label="Decline Friend">
                    Decline
                  </button>
                </>
              )}

              {showRequested && (
                <button className="pp-btn action" onClick={handleCancelRequest} disabled={busy} title="Cancel request">
                  Cancel
                </button>
              )}

              {showUnfriend && (
                <button
                  className="pp-btn action"
                  onClick={() => setConfirmUnfriendOpen(true)}
                  aria-label="Unfriend"
                  disabled={busy}
                >
                  Unfriend
                </button>
              )}

              <button className="pp-btn action" disabled={busy}>Message</button>
              <button className="pp-btn action" disabled={busy}>Share</button>

              <span className="pp-toast">{toast}</span>
            </div>
          </div>

          <div className="pp-center">
            <AvatarImg
              user={profileUser || undefined}
              size={120}
              eager
              style={{ margin: "0 auto .5rem" }}
              rounded
            />
            <h1 className="pp-username">@{displayUsername}</h1>
          </div>

          <div className="pp-right">
            <div style={{ marginBottom: "1rem" }}>
              <button onClick={() => setEditMode((e) => !e)} className="pp-btn gold">
                {editMode ? "Close Editor" : "Edit Profile"}
              </button>
            </div>
            <h3 style={{ marginBottom: ".5rem" }}>Highlights</h3>
            <p className="muted"><strong>Featured In:</strong> Top Creators</p>
            <p className="muted"><strong>Achievements:</strong> 1000+ Likes • Creator of the Month</p>
          </div>
        </div>

        <div className="pp-main">
          <div className="pp-col-left">
            <div className="section">
              <textarea
                className="pp-input"
                placeholder="What's on your mind?"
                aria-label="Create post"
              />
              <button className="pp-btn gold" style={{ marginTop: ".5rem" }}>
                Post
              </button>
            </div>

            <div className="section">
              <h2 style={{ marginTop: 0 }}>Photos</h2>
              {profileUser ? (
                <ImageGallery ownerId={profileUser._id} canEdit={isSelf} />
              ) : (
                <div className="muted">Loading profile…</div>
              )}
            </div>
          </div>

          <div className="pp-col-right">
            <div className="section">
              <h2>Friends</h2>
            </div>
          </div>
        </div>
      </div>

      {confirmUnfriendOpen && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Unfriend confirmation">
          <div className="modal">
            <h3>Unfriend @{displayUsername}?</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              You can add them again later. This action won’t delete messages.
            </p>
            <div className="modal-actions">
              <button className="pp-btn action" onClick={() => setConfirmUnfriendOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button className="pp-btn gold" onClick={handleConfirmUnfriend} disabled={busy}>
                Confirm Unfriend
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
