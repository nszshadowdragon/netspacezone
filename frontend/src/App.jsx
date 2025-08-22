import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useAuth } from "./context/AuthContext";   // ✅ global auth

export default function App() {
  const location = useLocation();
  const { loading, loggingOut } = useAuth();   // ✅ include logout state

  // Pages where we don't want the Navbar
  const hideNavbarOn = ["/", "/signup"];
  const shouldHide = hideNavbarOn.includes(location.pathname.toLowerCase());

  // ✅ Prevent flash on refresh and logout
  if (loading || loggingOut) {
    return (
      <div
        style={{
          background: "#000",
          color: "#facc15",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.3rem",
          fontWeight: "bold",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <>
      {!shouldHide && <Navbar />}
      <Outlet />
    </>
  );
}
