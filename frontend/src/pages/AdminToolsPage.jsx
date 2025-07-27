import React from 'react';
import Layout from '../components/Layout';
import { getCurrentUser } from '../utils/auth';
import { Navigate } from 'react-router-dom';

export default function AdminToolsPage() {
  const user = getCurrentUser();

  if (!user || user.role !== 'admin') {
    return <Navigate to='/' />;
  }

  return (
    <Layout>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        fontSize: '1.5rem',
        fontWeight: 'bold',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <h1>Admin Tools</h1>
        <p style={{ marginTop: '1rem' }}>⚙️ Development in Progress</p>
      </div>
    </Layout>
  );
}
