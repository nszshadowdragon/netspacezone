// frontend/src/App.jsx
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useAuth } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext"; // <-- ThemeProvider & useTheme

function AppContent() {
  const location = useLocation();
  const { unreadCount } = useAuth() || {};
  const { theme } = useTheme(); // <-- get current theme

  // Public routes where we don't want the navbar
  const hideNavbarOn = ["/landing", "/signup"];
  const shouldHide = hideNavbarOn.includes(location.pathname.toLowerCase());

  // Apply theme variables globally for page content
  const themeStyles = theme
    ? {
        "--bg-color": theme.bgColor || "#000",
        "--text-color": theme.textColor || "#ffe259",
        "--primary-color": theme.primaryColor || "#facc15",
      }
    : {};

  return (
    <>
      {!shouldHide && <Navbar unreadCount={unreadCount || 0} />}
      <main
        style={{
          minHeight: shouldHide ? "100vh" : "calc(100vh - 92px)",
          background: "var(--bg-color)",
          color: "var(--text-color)",
          transition: "background 0.3s ease, color 0.3s ease",
          ...themeStyles,
        }}
      >
        <Outlet />
      </main>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
