import React from 'react';

export default function ChatWidget() {
  return (
    <div style={{
      backgroundColor: '#111',
      color: '#0ff',
      padding: '1rem',
      borderRadius: '10px',
      width: '300px'
    }}>
      <h2 style={{ fontSize: '1.2rem' }}>Chat (Test Mode)</h2>
      <div style={{ fontSize: '0.9rem', marginTop: '1rem' }}>
        Development in Progress
      </div>
    </div>
  );
}
