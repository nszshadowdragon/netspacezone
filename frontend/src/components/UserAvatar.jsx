import React from 'react';

export default function UserAvatar({ src, alt = '', size = 40 }) {
  return (
    <img
      src={src || '/profilepic.jpg'}
      alt={alt || 'User avatar'}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        border: '2px solid #e5e7eb',
        background: '#222'
      }}
    />
  );
}
