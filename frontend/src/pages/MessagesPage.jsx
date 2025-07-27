import React from 'react';
import Navbar from '../components/Navbar';

export default function MessagesPage() {
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
        <h1>Messages 📬 Development in Progress</h1>
      </div>
    </>
  );
}
