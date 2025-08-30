import React from 'react';

export default function Layout({ children }) {
  return (
    <div
      className="page-container"
      style={{
        minHeight: '100vh',
        width: '100%',
        boxSizing: 'border-box',
        padding: 0,
        background: 'none',
        color: 'inherit',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {children}
    </div>
  );
}
