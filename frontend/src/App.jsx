// src/App.jsx
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import { HelmetProvider }  from 'react-helmet-async';   // ← NEW
import { AuthProvider }    from './context/AuthContext';
import { ThemeProvider }   from './context/ThemeContext';
import { SearchProvider }  from './context/SearchContext';

import { ToastContainer }  from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Navbar      from './components/Navbar';
import ChatWidget  from './components/ChatWidget';
import LandingPage from './pages/LandingPage';
import SignUpPage  from './pages/SignUpPage';
import HomePage    from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import Settings    from './pages/SettingsPage';

/* ────────────── Error Boundary ────────────── */
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err, info) { console.error('[App ErrorBoundary]', err, info); }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center text-white">
          <h1 className="text-2xl font-bold mb-4">Oops! An unexpected error occurred.</h1>
          <p className="mb-6">Try refreshing the page or coming back later.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-teal-600 text-white rounded"
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
/* ─────────────────────────────────────────── */

export default function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>                       {/* ← NEW wrapper */}
        <ThemeProvider>
          <AuthProvider>
            <Router>
              <SearchProvider>
                <Navbar />

                <Routes>
                  <Route path="/"                  element={<LandingPage />} />
                  <Route path="/signup"            element={<SignUpPage  />} />
                  <Route path="/home"              element={<HomePage    />} />
                  <Route path="/profile/:username" element={<ProfilePage />} />
                  <Route path="/settings"          element={<Settings    />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>

                <ChatWidget />

                {/* single, global toast container */}
                <ToastContainer position="top-center" autoClose={3000} />
              </SearchProvider>
            </Router>
          </AuthProvider>
        </ThemeProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}