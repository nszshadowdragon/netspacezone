// frontend/src/pages/ProfilePage.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_ORIGIN = "https://api.netspacezone.com";

// Accept data URLs, absolute URLs, or relative /uploads paths
function resolveAvatar(raw, username = "U") {
  const cleaned = (raw || "").trim();
  if (!cleaned) return "/assets/default-avatar.png";
  if (/^(data:|https?:\/\/)/i.test(cleaned)) return cleaned;
  if (cleaned.startsWith("/uploads")) return `${API_ORIGIN}${cleaned}`;
  if (cleaned.startsWith("/")) return cleaned;
  // fallback: ui-avatars or your local default
  return `/assets/default-avatar.png`;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth(); // { username, profilePic/profileImage, ... }

  // Kick to landing if not logged in
  useEffect(() => {
    if (!user) navigate("/", { replace: true });
  }, [user, navigate]);

  if (!user) return null;

  const rawPic = user.profilePic || user.profileImage || "";
  const avatar = resolveAvatar(rawPic, user.username);

  return (
    <>
      <style>{`
        :root { --gold: #facc15; --ink: #000; }
        .wrap {
          min-height: 100vh;
          background: var(--ink);
          color: var(--gold);
          padding: clamp(16px, 4vw, 40px);
          overflow-x: hidden;
        }
        .shell {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          gap: clamp(12px, 2.5vw, 18px);
        }
        /* Header */
        .card {
          background: rgba(17,17,17,0.65);
          border: 1px solid #333;
          border-radius: 14px;
          padding: clamp(16px, 3vw, 24px);
          box-shadow: 0 0 22px rgba(250, 204, 21, 0.18);
        }
        .header {
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: clamp(12px, 2.5vw, 18px);
        }
        .avatar {
          width: clamp(88px, 14vw, 140px);
          height: clamp(88px, 14vw, 140px);
          border-radius: 50%;
          border: 3px solid #000;
          object-fit: cover;
          display: block;
        }
        .name { margin: 0; font-weight: 800; font-size: clamp(22px, 4vw, 32px); }
        .handle { margin: 4px 0 0 0; font-size: clamp(14px, 2.6vw, 16px); color: #cbd5e1; }

        /* Grid */
        .grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: clamp(12px, 2.2vw, 20px);
        }
        @media (max-width: 900px) {
          .header { grid-template-columns: 1fr; text-align: center; }
          .grid { grid-template-columns: 1fr; }
        }

        .section-title {
          font-size: 1.2rem;
          font-weight: 800;
          margin: 0 0 12px 0;
          letter-spacing: .5px;
        }
        .placeholder {
          color: #e2e8f0;
          background: #0b0b0b;
          border: 1px dashed #333;
          border-radius: 10px;
          padding: 14px;
          font-size: .98rem;
        }

        .chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .chip {
          background: #232326;
          border: 1px solid #2d2d32;
          color: var(--gold);
          font-weight: 800;
          font-size: .92rem;
          padding: 6px 10px;
          border-radius: 999px;
        }

        .btn-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
        .btn {
          background: var(--gold);
          color: #111;
          border: none;
          border-radius: 10px;
          padding: 10px 14px;
          font-weight: 800;
          cursor: pointer;
        }
        .btn-secondary {
          background: #232326;
          color: var(--gold);
          border: 2px solid var(--gold);
        }
      `}</style>

      <div className="wrap">
        <div className="shell">
          {/* Header */}
          <section className="card header">
            <img
              src={avatar}
              alt={`${user.username} avatar`}
              crossOrigin="anonymous"
              className="avatar"
              onError={(e) => { e.currentTarget.src = "/assets/default-avatar.png"; }}
            />
            <div>
              <h1 className="name">{user.username}</h1>
              <p className="handle">@{user.username}</p>

              <div className="btn-row">
                <button className="btn" onClick={() => alert("Edit Profile (coming soon)")}>
                  Edit Profile
                </button>
                <button className="btn btn-secondary" onClick={() => alert("Share Profile (coming soon)")}>
                  Share
                </button>
              </div>
            </div>
          </section>

          {/* Main Grid */}
          <div className="grid">
            {/* Left / Main Column */}
            <div className="left-col">
              {/* Posts */}
              <section className="card">
                <h3 className="section-title">Posts</h3>
                <div className="placeholder">
                  A personalized feed of this user’s posts will appear here (composer, media, comments, likes).
                </div>
              </section>

              {/* Activity */}
              <section className="card">
                <h3 className="section-title">Recent Activity</h3>
                <div className="placeholder">
                  Latest likes, follows, and comments will show up here.
                </div>
              </section>

              {/* Photos */}
              <section className="card">
                <h3 className="section-title">Photos</h3>
                <div className="placeholder">
                  A grid of recent photo uploads will render here.
                </div>
              </section>
            </div>

            {/* Right / Sidebar */}
            <aside className="right-col">
              {/* About */}
              <section className="card">
                <h3 className="section-title">About</h3>
                <div className="placeholder">
                  Bio, location, join date, and other quick facts will live here.
                </div>
              </section>

              {/* Stats */}
              <section className="card">
                <h3 className="section-title">Stats</h3>
                <div className="placeholder">
                  Followers, Following, Friends, and Post counts will display here.
                </div>
              </section>

              {/* Interests */}
              <section className="card">
                <h3 className="section-title">Interests</h3>
                {Array.isArray(user.interests) && user.interests.length ? (
                  <div className="chips">
                    {user.interests.slice(0, 12).map((i) => (
                      <span key={i} className="chip">{i}</span>
                    ))}
                  </div>
                ) : (
                  <div className="placeholder">User hasn’t added interests yet.</div>
                )}
              </section>

              {/* Friends */}
              <section className="card">
                <h3 className="section-title">Friends</h3>
                <div className="placeholder">
                  A preview of friends / mutual friends will be shown here.
                </div>
              </section>

              {/* Badges */}
              <section className="card">
                <h3 className="section-title">Badges</h3>
                <div className="placeholder">
                  Earned badges and achievements will appear here.
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
