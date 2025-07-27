import React from 'react';

export default function FollowersPopup({ title, users = [], onClose }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, width: '100%', height: '100vh',
      background: 'rgba(10,10,18,0.93)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(3px)'
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(120deg, #191c25 70%, #181a1f 100%)',
          borderRadius: 22,
          minWidth: 320,
          maxWidth: 480,
          width: 'min(97vw, 440px)',
          boxShadow: '0 8px 46px #000c',
          padding: 32,
          position: 'relative',
          border: '2px solid #292b36'
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 18, fontSize: 28, color: '#ffe066',
            background: 'rgba(40,35,45,0.8)', border: 'none', cursor: 'pointer',
            zIndex: 8, fontWeight: 'bold', borderRadius: '50%', boxShadow: '0 2px 10px #0008',
            width: 44, height: 44, lineHeight: '40px', textAlign: 'center', transition: 'background 0.17s'
          }}
        >✕</button>
        <h2 style={{
          fontSize: 25, fontWeight: 800, color: "#ffe066", textAlign: "center", margin: "0 0 16px 0"
        }}>
          {title}
        </h2>
        {users.length === 0 ? (
          <div style={{ color: "#ffe066", fontWeight: 600, fontSize: 16, textAlign: "center", margin: "45px 0" }}>
            No users to show.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 21, justifyContent: 'center' }}>
            {users.map(friend => (
              <a
                key={friend._id}
                href={`/profile/${friend.username}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: '#ffe066',
                  minWidth: 78
                }}
              >
                <img
                  src={
                    friend.profileImage
                      ? (friend.profileImage.startsWith('http')
                        ? friend.profileImage
                        : `http://localhost:5000${friend.profileImage}`)
                      : `https://ui-avatars.com/api/?name=${friend.username || "U"}`
                  }
                  alt={friend.username}
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid #facc15",
                    marginBottom: 5,
                    background: "#181818"
                  }}
                />
                <span style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#ffe066",
                  wordBreak: "break-all",
                  textAlign: 'center'
                }}>
                  {friend.fullName || friend.username}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
