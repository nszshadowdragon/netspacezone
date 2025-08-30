import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import "./index.css";

import App from "./App";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Public
import Landing from "./pages/LandingPage.jsx";
import Signup from "./pages/SignUpPage.jsx";

// In-app
import SpaceHubPage from "./pages/SpaceHubPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import StorePage from "./pages/StorePage.jsx";
import EventsPage from "./pages/EventsPage.jsx";
import BlogPage from "./pages/BlogPage.jsx";
import PodcastPage from "./pages/PodcastPage.jsx";
import CreatorsHubPage from "./pages/CreatorsHubPage.jsx";

/** Root gate: decide "/" immediately without mounting <App/> */
function StartGate() {
  const { user, loading } = useAuth() || {};
  const navigate = useNavigate();

  React.useEffect(() => {
    // While loading, go to landing to avoid blank screen
    if (loading) {
      navigate("/landing", { replace: true });
      return;
    }
    navigate(user ? "/spacehub" : "/landing", { replace: true });
  }, [user, loading, navigate]);

  return null;
}

/** Shows a small full-screen gate while auth is resolving, otherwise protects children */
function RequireAuth({ children }) {
  const { user, loading } = useAuth() || {};
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#000",
          color: "#ffe259",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
        }}
      >
        Authorizing…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/landing" replace state={{ from: location.pathname }} />;
  }
  return children;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Root: guest -> /landing, authed -> /spacehub */}
          <Route path="/" element={<StartGate />} />

          {/* Public */}
          <Route path="/landing" element={<Landing />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected layout (Navbar + Outlet) */}
          <Route element={<RequireAuth><App /></RequireAuth>}>
            {/* Use RELATIVE paths so <App> always wraps them */}
            <Route path="spacehub" element={<SpaceHubPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/:username" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="store" element={<StorePage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="blog" element={<BlogPage />} />
            <Route path="podcast" element={<PodcastPage />} />
            <Route path="creatorshub" element={<CreatorsHubPage />} />
            <Route path="creators" element={<CreatorsHubPage />} />
            {/* in-app fallback */}
            <Route path="*" element={<Navigate to="spacehub" replace />} />
          </Route>

          {/* global fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
