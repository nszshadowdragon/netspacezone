import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ImageGallery from "../components/ImageGallery";
import AvatarImg from "../components/AvatarImg";

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

  const [profileUser, setProfileUser] = useState(null);
  const [friendship, setFriendship] = useState("none");
  const [confirmUnfriendOpen, setConfirmUnfriendOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const isSelf = useMemo(() => {
    if (!user) return false;
    if (profileUser?._id && user._id) return String(user._id) === String(profileUser._id);
    if (routeUsername) {
      return (
        String(routeUsername).toLowerCase() ===
        String(user.username || "").toLowerCase()
      );
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

  // cache-first load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const targetUsername = routeUsername || user?.username;
      if (!targetUsername) return;
      const key = String(targetUsername).toLowerCase();

      if (PROFILE_CACHE.has(key)) {
        setProfileUser(PROFILE_CACHE.get(key));
      } else if (routeUsername && user?.username && routeUsername === user.username) {
        PROFILE_CACHE.set(key, user);
        setProfileUser(user);
      }

      const fresh = await fetchProfileByUsername(targetUsername);
      if (cancelled) return;
      if (fresh) {
        PROFILE_CACHE.set(key, fresh);
        setProfileUser(fresh);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeUsername, user]);

  useEffect(() => {
    if (isSelf) {
      setFriendship("self");
      return;
    }
    let cancelled = false;
    async function loadStatus() {
      if (!user || !profileUser) return;
      try {
        const res = await fetch(
          `${API_BASE}/api/users/friends/status?userId=${encodeURIComponent(
            profileUser._id
          )}`,
          {
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Authorization: getToken() ? `Bearer ${getToken()}` : undefined,
            },
          }
        );
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            setFriendship(data?.status || "none");
          } else if (res.status === 404) {
            setFriendship("none");
          }
        }
      } catch {
        if (!cancelled) setFriendship("none");
      }
    }
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [isSelf, user?._id, profileUser?._id]);

  async function handleAddFriend() {
    if (!user || !profileUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/friends/request`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: getToken() ? `Bearer ${getToken()}` : undefined,
        },
        body: JSON.stringify({ toUserId: profileUser._id }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setFriendship(data?.status || "pending");
      } else {
        const msg = await res.text().catch(() => "");
        alert(`Could not send friend request. ${msg || ""}`.trim());
      }
    } catch {
      alert("Network error sending friend request.");
    }
  }

  async function handleConfirmUnfriend() {
    if (!user || !profileUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/friends/unfriend`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: getToken() ? `Bearer ${getToken()}` : undefined,
        },
        body: JSON.stringify({ userId: profileUser._id }),
      });
      if (res.ok) {
        setFriendship("none");
        setConfirmUnfriendOpen(false);
      } else {
        const msg = await res.text().catch(() => "");
        alert(`Could not unfriend. ${msg || ""}`.trim());
      }
    } catch {
      alert("Network error trying to unfriend.");
    }
  }

  const showAddBtn = !isSelf && (friendship === "none" || friendship === "incoming");
  const showRequested = !isSelf && friendship === "pending";
  const showUnfriend = !isSelf && friendship === "friends";

  return (
    <div className="profile-page" style={{ position: "relative" }} key={routeUsername || user?.username}>
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
        .profile-page{ min-height:100vh; width:100vw; background:#000; color:#ffe259; }
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
        .section{ margin-bottom:2rem; padding:1rem; border-radius:8px; border:1px solid #333; background:rgba(17,17,17,.5); }
        .pp-friends{ display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; }
        @media (max-width: 480px){ .pp-friends{ grid-template-columns:repeat(2,1fr); } }
        .pp-btn{ border:none; padding:.45rem .85rem; border-radius:6px; cursor:pointer; font-weight:700; }
        .pp-btn.gold{ background:#ffe259; color:#000; }
        .pp-btn.action{ border:1px solid #333; background:rgba(255,226,89,.2); color:#ffe259; }
        textarea.pp-input{ width:100%; padding:.5rem; border-radius:6px; background:transparent; border:1px solid #333; color:#ffe259; }
        .overlay{ position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; z-index:50; }
        .modal{ background:#111; border:1px solid #444; border-radius:10px; padding:1rem; width:min(420px,92vw); box-shadow:0 0 18px rgba(255,226,89,.15); }
        .modal-actions{ display:flex; gap:.5rem; justify-content:flex-end; }
      `}</style>

      <div className="pp-container">
        <div className="pp-header">
          <div className="pp-left">
            <h3 style={{ marginBottom: ".5rem" }}>Favorite Quote</h3>
            <p>“Where connection meets cosmos.”</p>
            <small style={{ display: "block", marginTop: "1rem" }}>
              123 Friends • 56 Posts • 900 Likes
            </small>

            <div className="pp-actions">
              {showAddBtn && (
                <button className="pp-btn action" onClick={handleAddFriend} aria-label="Add Friend">
                  Add
                </button>
              )}
              {showRequested && (
                <button className="pp-btn action" disabled title="Request sent">
                  Requested
                </button>
              )}
              {showUnfriend && (
                <button
                  className="pp-btn action"
                  onClick={() => setConfirmUnfriendOpen(true)}
                  aria-label="Unfriend"
                >
                  Unfriend
                </button>
              )}
              <button className="pp-btn action">Message</button>
              <button className="pp-btn action">Share</button>
            </div>
          </div>

          <div className="pp-center">
            {/* Avatar now uses a skeleton → swaps in only after decoded (no 'avatar' text flash) */}
            <AvatarImg
              user={profileUser || undefined}
              size={120}
              eager
              className=""
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
            <p><strong>Featured In:</strong> Top Creators</p>
            <p><strong>Achievements:</strong> 1000+ Likes • Creator of the Month</p>
          </div>
        </div>

        <div className="pp-main">
          <div className="pp-col-left">
            <div className="section">
              <textarea className="pp-input" placeholder="What's on your mind?" />
              <button className="pp-btn gold" style={{ marginTop: ".5rem" }}>
                Post
              </button>
            </div>

            <div className="section">
              <h2 style={{ marginTop: 0 }}>Photos</h2>
              {profileUser ? (
                <ImageGallery ownerId={profileUser._id} canEdit={isSelf} />
              ) : (
                <div style={{ color: "#bbb" }}>Loading profile…</div>
              )}
            </div>
          </div>

          <div className="pp-col-right">
            <div className="section">
              <h2>Friends</h2>
              {/* ... right column content ... */}
            </div>
          </div>
        </div>
      </div>

      {confirmUnfriendOpen && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Unfriend confirmation">
          <div className="modal">
            <h3>Unfriend @{displayUsername}?</h3>
            <p style={{ color: "#ddd", marginTop: 0 }}>
              You can add them again later. This action won’t delete messages.
            </p>
            <div className="modal-actions">
              <button className="pp-btn action" onClick={() => setConfirmUnfriendOpen(false)}>
                Cancel
              </button>
              <button className="pp-btn gold" onClick={handleConfirmUnfriend}>
                Confirm Unfriend
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
