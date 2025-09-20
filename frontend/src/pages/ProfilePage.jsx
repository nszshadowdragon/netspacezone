// frontend/src/pages/ProfilePage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme, getThemeVars } from "../context/ThemeContext";
import ImageGallery from "../components/ImageGallery";
import AvatarImg from "../components/AvatarImg";
import useFriendship from "../hooks/useFriendship";

const isLocal = /localhost|127\.0\.0\.1/.test(window.location.hostname);
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || (isLocal ? "http://localhost:5000" : "");

const PROFILE_CACHE = new Map();

function getToken() {
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
  const { theme: viewerTheme } = useTheme();

  const [profileUser, setProfileUser] = useState(null);
  const [profileThemeVars, setProfileThemeVars] = useState(null);
  const [toast, setToast] = useState("");
  const [confirmUnfriendOpen, setConfirmUnfriendOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [quote, setQuote] = useState("“Where connection meets cosmos.”");

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const targetUsername = routeUsername || user?.username;
      if (!targetUsername) return;
      const key = String(targetUsername).toLowerCase();

      if (PROFILE_CACHE.has(key)) {
        setProfileUser(PROFILE_CACHE.get(key));
        const cached = PROFILE_CACHE.get(key);
        if (cached?.theme) {
          setProfileThemeVars(getThemeVars(cached.theme));
        } else {
          setProfileThemeVars(getThemeVars(viewerTheme));
        }
      } else if (routeUsername && user?.username && routeUsername === user.username) {
        PROFILE_CACHE.set(key, user);
        setProfileUser(user);
        setProfileThemeVars(getThemeVars(user?.theme || viewerTheme));
      } else {
        setProfileUser(null);
        setProfileThemeVars(getThemeVars(viewerTheme));
      }

      const fresh = await fetchProfileByUsername(targetUsername);
      if (cancelled) return;
      if (fresh) {
        PROFILE_CACHE.set(key, fresh);
        setProfileUser(fresh);
        setProfileThemeVars(getThemeVars(fresh?.theme || viewerTheme));
      }
    })();
    return () => {
      cancelled = true;
    };
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

  // Determine active theme name: prefer profile's theme, fallback to viewer
  const activeThemeName = (profileUser && profileUser.theme) ? profileUser.theme : (viewerTheme || "");
  const lowerTheme = String(activeThemeName || "").toLowerCase();
  const isNormalTheme = lowerTheme === "normal";
  // treat these as light-ish modes for outline purposes
  const isLightTheme = ["light", "default", "day", "light-theme", ""].includes(lowerTheme);

  // Theme style overrides limited to what's needed
  const themeStyle = {
    ...(profileThemeVars || {}),
    "--section-border-color": isNormalTheme ? (profileThemeVars?.["--primary-color"] || "#ffd759") : "#000000",
    // favorite quote override color: white in normal, black in light/other
    "--fav-quote-color": isNormalTheme ? "#ffffff" : "#000000",
    // counters color for dark/other themes: pick a lighter color for readability
    "--counters-color-dark": profileThemeVars?.["--text-color-light"] || "#cfcfcf",
    // outline for yellow/white in light mode
    "--light-outline": isLightTheme ? "0 0 3px rgba(0,0,0,0.95)" : "none",
  };

  return (
    <div
      className={`profile-page ${isLightTheme ? "light-mode" : ""} ${isNormalTheme ? "normal-theme" : ""}`}
      style={{
        position: "relative",
        background: "var(--bg-color)",
        // do not change global text color here — rely on theme variables; only adjust where needed below
        minHeight: "100vh",
        width: "100vw",
        ...themeStyle,
      }}
      key={routeUsername || user?.username}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--watermark, url('/assets/nsz-logo.png') center/cover no-repeat)",
          opacity: "var(--watermark-opacity, 0.07)",
          zIndex: 0,
          pointerEvents: "none",
          filter: "brightness(var(--watermark-brightness, .6))",
        }}
      />

      <style>{`
        /* Use theme-provided variables where possible. I purposely don't override global font colors. */
        :root{
          --bg-color: ${profileThemeVars?.["--bg-color"] ?? (isLightTheme ? "#ffffff" : "#0b0b0b")};
          --text-color: ${profileThemeVars?.["--text-color"] ?? (isLightTheme ? "#000000" : "#ffffff")};
          --text-color-light: ${profileThemeVars?.["--text-color-light"] ?? (isLightTheme ? "#222222" : "#cccccc")};
          --primary-color: ${profileThemeVars?.["--primary-color"] ?? "#ffd759"};
          --panel-bg: ${profileThemeVars?.["--panel-bg"] ?? (isLightTheme ? "rgba(255,255,255,0.98)" : "rgba(17,17,17,0.7)")};
          --panel-bg-soft: ${profileThemeVars?.["--panel-bg-soft"] ?? (isLightTheme ? "rgba(255,255,255,0.95)" : "rgba(17,17,17,0.5)")};
          --action-bg: ${profileThemeVars?.["--action-bg"] ?? (isLightTheme ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.03)")};
          --overlay-bg: ${profileThemeVars?.["--overlay-bg"] ?? "rgba(0,0,0,0.6)"};
          --watermark-opacity: ${profileThemeVars?.["--watermark-opacity"] ?? 0.07};
          --section-border-color: ${themeStyle["--section-border-color"]};
          --fav-quote-color: ${themeStyle["--fav-quote-color"]};
          --counters-color-dark: ${themeStyle["--counters-color-dark"]};
          --light-outline: ${themeStyle["--light-outline"]};
        }

        .profile-page { min-height:100vh; width:100vw; background: var(--bg-color); color: var(--text-color); }
        .pp-container { position:relative; z-index:1; padding:2rem; max-width:1100px; margin:0 auto; }
        @media (max-width: 680px){ .pp-container{ padding:1rem; } }

        /* Header + sections: always clearly bordered */
        .pp-header {
          display:flex;
          gap:1rem;
          justify-content:space-between;
          align-items:flex-start;
          padding:1.25rem;
          margin-bottom:2rem;
          border:2px solid var(--section-border-color);
          border-radius:10px;
          background: var(--panel-bg);
          box-shadow: 0 6px 18px rgba(0,0,0,0.06);
        }

        .pp-left{ flex:1; }
        .pp-center{ flex:1; text-align:center; }
        .pp-right{ flex:1; text-align:right; }

        .pp-actions{ margin-top:.8rem; display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; }
        .pp-username{ margin:0; font-size:clamp(20px,3.2vw,28px); color: var(--primary-color); text-shadow: none; }
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
          margin-bottom:2rem;
          padding:1rem;
          border-radius:8px;
          border:2px solid var(--section-border-color);
          background: var(--panel-bg-soft);
        }

        .pp-btn{ border:none; padding:.45rem .85rem; border-radius:6px; cursor:pointer; font-weight:700; background: transparent; color: var(--text-color); border:2px solid var(--section-border-color); }
        .pp-btn.gold{ background: var(--primary-color); color: var(--bg-color); border: 2px solid var(--section-border-color); }
        .pp-btn.action{ background: var(--action-bg); color: var(--text-color); }
        .pp-btn[disabled]{ opacity:.55; cursor:not-allowed; }

        textarea.pp-input{
          width:100%;
          padding:.6rem;
          border-radius:8px;
          background: transparent;
          border:2px solid var(--section-border-color);
          color:var(--text-color);
          min-height: 80px;
        }

        .overlay{ position:fixed; inset:0; background:var(--overlay-bg); display:flex; align-items:center; justify-content:center; z-index:50; }
        .modal{
          background: var(--bg-color);
          border:2px solid var(--section-border-color);
          border-radius:10px;
          padding:1rem;
          width:min(420px,92vw);
        }
        .modal-actions{ display:flex; gap:.5rem; justify-content:flex-end; }
        .pp-toast{ font-size:12px; color:var(--text-color-light); min-height:18px; margin-left:.25rem; }

        .pp-center img {
          border: 3px solid var(--primary-color);
          box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        }

        /* Favorite quote specifics — precise control; don't touch general .muted, .body-text etc. */
        .fav-quote {
          color: var(--fav-quote-color); /* black in light/default, white in normal */
          margin: 0 0 .5rem 0;
        }

        /* Counters styling: make sure readable in dark/other themes */
        .counters {
          margin-top: .75rem;
          /* default to theme's light color in dark themes; in light themes nothing changes */
          color: var(--text-color-light);
        }

        /* Yellow/gold and white text outline handling:
           - Apply a black outline (text-shadow) to .primary-text and .white-text only when in light-mode
           - In normal theme do not apply outline to primary (yellow) — keep as provided
        */
        .primary-text { color: var(--primary-color); }
        .white-text { color: #ffffff; }

        .light-mode .primary-text,
        .light-mode .white-text {
          text-shadow: var(--light-outline);
        }

        .normal-theme .primary-text {
          text-shadow: none; /* keep yellow as-is in normal theme */
        }

        /* In normal theme, make Message/Share buttons more visible */
        .normal-theme .pp-actions .pp-btn.action {
          background: rgba(0,0,0,0.18);
          color: #ffffff;
          border-color: var(--primary-color);
        }
        .normal-theme .pp-actions .pp-btn.gold {
          color: var(--bg-color);
        }

        /* Dark/other themes: ensure counters use counter-color variable */
        .profile-page:not(.light-mode):not(.normal-theme) .counters {
          color: var(--counters-color-dark);
        }

        .muted { color: var(--text-color-light); }
      `}</style>

      <div className="pp-container">
        <div className="pp-header" role="banner">
          <div className="pp-left">
            <h3 style={{ marginBottom: ".5rem" }} className="primary-text">Favorite Quote</h3>

            {editMode ? (
              <textarea
                className="pp-input"
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                aria-label="Edit quote"
                style={{ color: `var(--fav-quote-color)` }}
              />
            ) : (
              <p className="fav-quote">{quote}</p>
            )}

            <small className="counters">
              0 Friends • 0 Posts • 0 Likes
            </small>

            <div className="pp-actions" aria-label="profile actions">
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

              <span className="pp-toast" aria-live="polite">{toast}</span>
            </div>
          </div>

          <div className="pp-center" aria-hidden={false}>
            <AvatarImg
              user={profileUser || undefined}
              size={120}
              eager
              style={{ margin: "0 auto .5rem" }}
              rounded
            />
            <h1 className="pp-username primary-text">{`@${displayUsername}`}</h1>
          </div>

          <div className="pp-right">
            <div style={{ marginBottom: "1rem" }}>
              <button onClick={() => setEditMode((e) => !e)} className="pp-btn gold">
                {editMode ? "Close Editor" : "Edit Profile"}
              </button>
            </div>
            <h3 style={{ marginBottom: ".5rem" }} className="primary-text">Highlights</h3>
            <p className="muted"><strong>Featured In:</strong> N/A</p>
            <p className="muted"><strong>Achievements:</strong> N/A</p>
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
              <h2 style={{ marginTop: 0 }} className="primary-text">Photos</h2>
              {profileUser ? (
                <ImageGallery ownerId={profileUser._id} canEdit={isSelf} />
              ) : (
                <div className="muted">Loading profile…</div>
              )}
            </div>
          </div>

          <div className="pp-col-right">
            <div className="section">
              <h2 className="primary-text">Friends</h2>
            </div>
          </div>
        </div>
      </div>

      {confirmUnfriendOpen && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Unfriend confirmation">
          <div className="modal">
            <h3 style={{ color: isNormalTheme ? "#fff" : undefined }}>Unfriend @{displayUsername}?</h3>
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
