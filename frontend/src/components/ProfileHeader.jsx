import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ProfileHeader({
  user,
  cardStyle,
  getProfileImageSrc,
  renderFriendButtonRow,
  handleFollowClick,
  handleShare,
  isFollowing,
  followLoading,
  sectionTitle,
}) {
  const { theme } = useTheme();

  const isLight = theme === 'light';
  const isNorm1 = theme === 'normal1';
  const isNorm2 = theme === 'normal2';
  const isDark = theme === 'dark' || theme === 'custom';

  const taglineTopStyle = {
    color: isLight ? '#111' : '#facc15',
    fontWeight: 700,
    textShadow: isLight ? 'none' : '0 1px 2px #000, 0 -1px 2px #000'
  };

  const taglineBottomStyle = {
    color: isNorm1 || isDark ? '#fff' : isNorm2 ? '#111' : '#111',
    fontWeight: 400
  };

  return (
    <div style={{
      ...cardStyle,
      display: 'flex',
      alignItems: 'center',
      gap: '2.5rem',
      marginBottom: '2.5rem'
    }}>
      {!user ? (
        <div style={{ color: "#ffe066" }}>Loading profile...</div>
      ) : (
        <>
          <img
            src={getProfileImageSrc(user)}
            alt="Profile"
            style={{
              width: 110,
              height: 110,
              borderRadius: "50%",
              objectFit: "cover",
              border: "3.5px solid #facc15",
              marginBottom: 8,
              background: "#181818",
            }}
          />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div
              style={{
                fontSize: '2.25rem',
                fontWeight: 900,
                margin: 0,
                letterSpacing: '1.2px',
                color: '#111',
                textShadow: 'none'
              }}
            >
              {user.fullName || user.username}
            </div>
            {/* BUTTON ROW */}
            <div style={{ margin: '1.15rem 0 1.45rem 0', display: 'flex', gap: 18 }}>
              {renderFriendButtonRow()}
              <button
                onClick={handleFollowClick}
                disabled={followLoading}
                style={{
                  background: isFollowing ? '#191919' : '#facc15',
                  color: isFollowing ? '#ffe066' : '#000',
                  border: '1.5px solid #facc15',
                  borderRadius: 9,
                  fontWeight: 700,
                  fontSize: '1.07rem',
                  letterSpacing: 1,
                  padding: '8px 28px',
                  cursor: followLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 6px #0006',
                  transition: 'background .15s'
                }}
              >{isFollowing ? "Unfollow" : "Follow"}</button>
              <button
                onClick={handleShare}
                style={{
                  background: '#181818',
                  color: '#fff',
                  border: '1.5px solid #facc15',
                  borderRadius: 9,
                  fontWeight: 700,
                  fontSize: '1.07rem',
                  letterSpacing: 1,
                  padding: '8px 28px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 6px #0006',
                  transition: 'background .15s'
                }}
              >Share Profile</button>
            </div>
            {/* Professional Tagline Section */}
            <div style={{
              marginTop: 10,
              paddingTop: 12,
              borderTop: isLight ? '1.5px solid #222' : '1px solid #eee',
              fontSize: '1.09rem',
              maxWidth: 380,
              fontWeight: 500,
              lineHeight: 1.45,
              letterSpacing: 0.1
            }}>
              <span style={taglineTopStyle}>
                “Creating meaningful connections in the NetSpace Zone.”
              </span>
              <br />
              <span style={taglineBottomStyle}>
                Welcome to my profile. Let's build something amazing together!
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
