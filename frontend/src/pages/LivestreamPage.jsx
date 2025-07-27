import React from 'react';

export default function [LivestreamPage]() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000',
      color: '#facc15', // gold, can be toggled later with themes
      fontSize: '1.5rem',
      fontWeight: 'bold',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <p>[PageName] – Development in Progress</p>
    </div>
  );
}
