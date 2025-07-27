import React from 'react';
import Layout from '../components/Layout';

export default function SpaceHubPage() {
  return (
    <Layout>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.5rem',
        fontWeight: 'bold',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <p>Space Hub – Development in Progress</p>
      </div>
    </Layout>
  );
}
