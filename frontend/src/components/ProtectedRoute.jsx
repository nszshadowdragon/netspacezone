import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;
    axios.get('http://localhost:5000/api/profile', { withCredentials: true })
      .then(res => {
        if (mounted) setIsAuthenticated(true);
      })
      .catch(() => {
        if (mounted) setIsAuthenticated(false);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  if (loading) return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 22,
      fontWeight: 600,
      color: '#14c0cc',
      background: '#161824'
    }}>
      Loading...
    </div>
  );

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}
