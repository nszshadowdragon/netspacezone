import React from 'react';
import Layout from '../components/Layout';

export default function EventsPage() {
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
        <p>Events – Development in Progress</p>
      </div>
    </Layout>
  );
}
