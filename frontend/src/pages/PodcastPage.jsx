import React from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getSpaceThemeStyles } from '../themeStyles';

export default function PodcastPage() {
  const { user, token } = useAuth();
  const { theme } = useTheme();
  const { sectionBackground, sectionTextColor } = getSpaceThemeStyles(theme);

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
        padding: '2rem',
        background: sectionBackground,
        color: sectionTextColor
      }}>
        <p>Podcast – Development in Progress</p>
      </div>
    </Layout>
  );
}
