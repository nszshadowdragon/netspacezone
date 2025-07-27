import React, { useState } from 'react';
import Navbar from '../components/Navbar';

export default function ProfilePage() {
  const user = JSON.parse(localStorage.getItem('user')) || {};
  const [showImageModal, setShowImageModal] = useState(false);

  return (
    <>
      <Navbar />
      <div
        style={{
          minHeight: '100vh',
          width: '100vw',
          backgroundColor: '#000',
          color: '#facc15',
          padding: '2rem',
          boxSizing: 'border-box'
        }}
      >
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
          {user.username || 'Guest'}'s Profile
        </h1>

        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <div>
            <img
              src={user.profileImage || '/profilepic.jpg'}
              alt='Profile'
              onClick={() => setShowImageModal(true)}
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                border: '2px solid #facc15',
                objectFit: 'cover',
                cursor: 'pointer'
              }}
            />
          </div>
          <div style={{ lineHeight: '2' }}>
            <div><strong>Email:</strong> {user.email || 'N/A'}</div>
            <div><strong>Role:</strong> {user.role || 'user'}</div>
            <div><strong>Theme:</strong> {user.theme || 'Gold'}</div>
            <div><strong>Quote:</strong> {user.quote || '—'}</div>
          </div>
        </div>

        <hr style={{ margin: '2rem 0', borderColor: '#333' }} />

        <h2 style={{ fontSize: '1.2rem' }}>About Me</h2>
        <p>{user.bio || 'No bio set.'}</p>

        <h2 style={{ fontSize: '1.2rem', marginTop: '2rem' }}>Posts</h2>
        <p>-- No posts yet. --</p>
      </div>

      {showImageModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.85)',
            color: '#facc15',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <img
            src={user.profileImage || '/profilepic.jpg'}
            alt="Full Size"
            style={{
              width: '200px',
              height: '200px',
              objectFit: 'cover',
              borderRadius: '10px',
              border: '3px solid #facc15',
              marginBottom: '1rem'
            }}
          />
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <button style={iconBtn}>👍 Like</button>
            <button style={iconBtn}>💬 Comment</button>
            <button style={iconBtn}>🔗 Share</button>
          </div>
          <button
            onClick={() => setShowImageModal(false)}
            style={{
              backgroundColor: '#f87171',
              color: '#000',
              padding: '0.5rem 1.5rem',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}

const iconBtn = {
  backgroundColor: 'transparent',
  color: '#facc15',
  padding: '0.5rem 1rem',
  border: '1px solid #facc15',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold'
};
