import React from 'react';
import Layout from '../components/Layout';

export default function TermsPage() {
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
        <h1>Terms & Policies</h1>
        <p style={{ marginTop: '1rem' }}>📄 Development in Progress</p>
      </div>
    </Layout>
  );
}
