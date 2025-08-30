// frontend/src/App.jsx
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useAuth } from "./context/AuthContext";

export default function App() {
  const location = useLocation();
  const { unreadCount } = useAuth() || {};

  // Public routes where we don't want the navbar
  const hideNavbarOn = ["/landing", "/signup"];
  const shouldHide = hideNavbarOn.includes(location.pathname.toLowerCase());

  return (
    <>
      {!shouldHide && <Navbar unreadCount={unreadCount || 0} />}
      {/* No loading overlay — page content always renders */}
      <main style={{ minHeight: shouldHide ? "100vh" : "calc(100vh - 92px)" }}>
        <Outlet />
      </main>
    </>
  );
}
