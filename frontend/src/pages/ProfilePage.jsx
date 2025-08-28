// frontend/src/pages/ProfilePage.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_ORIGIN = "https://api.netspacezone.com";

// Accept data URLs, absolute URLs, or relative paths
function resolveImage(src) {
  if (!src) return "";
  if (/^(https?:\/\/|data:)/i.test(src)) return src;
  const path = src.startsWith("/") ? src : `/${src}`;
  return `${API_ORIGIN}${path}`;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth(); // { username, email, firstName, lastName, birthday, interests, profilePic/profileImage }

  // Redirect to landing if not logged in
  useEffect(() => {
    if (!user) navigate("/", { replace: true });
  }, [user, navigate]);

  if (!user) return null;

  const rawPic = user.profilePic || user.profileImage || "";
  const avatar = resolveImage(rawPic) || "https://via.placeholder.com/120";

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const birthday =
    user.birthday ? new Date(user.birthday).toLocaleDateString() : null;
  const interests = Array.isArray(user.interests) ? user.interests : [];

  return (
    <>
      {/* Scoped responsive styles */}
      <style>{`
        :root { --gold: #facc15; --ink: #000; }
        .profile-wrap {
          min-height: 100vh;
          width: 100%;
          background: var(--ink);
          color: var(--gold);
          position: relative;
          overflow-x: hidden;
          padding: clamp(16px, 4vw, 40px);
        }
        .profile-bg {
          position: absolute;
          inset: 0;
          background: url('/assets/nsz-logo.png') center/cover no-repeat;
          opacity: .07;
          z-index: 0;
        }
        .profile-shell {
          position: relative;
          z-index: 1;
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          gap: clamp(12px, 2.5vw, 18px);
        }

        /* Header card */
        .card {
          background: rgba(17,17,17,0.65);
          border: 1px solid #333;
          border-radius: 14px;
          padding: clamp(16px, 3vw, 24px);
          box-shadow: 0 0 22px rgba(250, 204, 21, 0.18);
        }
        .header-card {
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
        .header-name {
          margin: 0;
          font-weight: 800;
          font-size: clamp(22px, 4vw, 32px);
          color: var(--gold);
        }
        .header-username {
          margin: 4px 0 0 0;
          font-size: clamp(14px, 2.6vw, 16px);
          color: #cbd5e1;
          word-break: break-word;
        }

        /* Details grid */
        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: clamp(10px, 2vw, 16px);
        }
        .grid-2 { grid-template-columns: repeat(2, minmax(0,1fr)); }
        .grid-1 { grid-template-columns: 1fr; }

        .label {
          font-weight: 700;
          font-size: .95rem;
          color: #e2e8f0;
          margin-bottom: 6px;
        }
        .value {
          font-weight: 800;
          color: var(--gold);
          word-break: break-word;
        }

        /* Interests */
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .chip {
          background: #232326;
          border: 1px solid #2d2d32;
          color: var(--gold);
          font-weight: 800;
          font-size: .95rem;
          padding: 6px 10px;
          border-radius: 999px;
        }

        /* Responsive layout changes */
        @media (max-width: 980px) {
          .header-card { grid-template-columns: 1fr; text-align: center; }
        }
        @media (max-width: 640px) {
          .grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="profile-wrap">
        <div className="profile-bg" />

        <div className="profile-shell">
          {/* Header */}
          <section className="card header-card">
            <img
              src={avatar}
              alt={`${user.username} avatar`}
              crossOrigin="anonymous"
              className="avatar"
            />
            <div>
              <h1 className="header-name">{fullName || user.username}</h1>
              <p className="header-username">@{user.username}</p>
            </div>
          </section>

          {/* Core details */}
          <section className="card">
            <div className="grid">
              <div>
                <div className="label">First Name</div>
                <div className="value">{user.firstName || "—"}</div>
              </div>
              <div>
                <div className="label">Last Name</div>
                <div className="value">{user.lastName || "—"}</div>
              </div>
              <div>
                <div className="label">Email</div>
                <div className="value">{user.email || "—"}</div>
              </div>
            </div>

            <div className="grid" style={{ marginTop: 16 }}>
              <div>
                <div className="label">Birthday</div>
                <div className="value">{birthday || "—"}</div>
              </div>
              <div>
                <div className="label">Username</div>
                <div className="value">{user.username}</div>
              </div>
              <div>
                <div className="label">Referral</div>
                <div className="value">{user.referral || "—"}</div>
              </div>
            </div>
          </section>

          {/* Interests */}
          <section className="card">
            <div className="label" style={{ marginBottom: 8 }}>Interests</div>
            {interests.length ? (
              <div className="chips">
                {interests.map((i) => (
                  <span key={i} className="chip">{i}</span>
                ))}
              </div>
            ) : (
              <div className="value">—</div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
