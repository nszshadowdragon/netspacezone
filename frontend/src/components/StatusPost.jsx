import React from 'react';

export default function StatusPost() {
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      color: '#facc15',
      padding: '1rem',
      borderRadius: '8px',
      marginBottom: '1rem'
    }}>
      <textarea
        placeholder="What's on your mind?"
        style={{
          width: '100%',
          background: '#000',
          color: '#fff',
          padding: '0.5rem',
          borderRadius: '4px',
          border: '1px solid #333'
        }}
      />
      <button
        style={{
          marginTop: '0.5rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#facc15',
          color: '#000',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        Post
      </button>
    </div>
  );
}
