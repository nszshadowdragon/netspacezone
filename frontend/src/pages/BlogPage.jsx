// src/pages/BlogPage.jsx
import React, { useEffect } from 'react';

export default function BlogPage() {
  // Optional: set a helpful title
  useEffect(() => {
    document.title = 'NSZ Blog — Development in Progress';
  }, []);

  return (
    <main
      style={{
        minHeight: 'calc(100vh - 64px)', // room under your navbar
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f0f0f',
        color: '#ffffff',
        textAlign: 'center',
        padding: '40px 16px',
        borderTop: '1px solid #eab308', // subtle gold line like your theme
      }}
    >
      <h1
        style={{
          margin: 0,
          fontWeight: 900,
          fontSize: 'clamp(22px, 4vw, 32px)',
        }}
      >
        Blog — Development in Progress
      </h1>
    </main>
  );
}
