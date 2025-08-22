import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SearchBar from "./SearchBar";
import { useAuth } from "../context/AuthContext";   // ✅ global auth

export default function Navbar({ unreadCount }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();   // ✅ bring in logout function

  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllPopup, setShowAllPopup] = useState(false);

  const menuRef = useRef(null);
  const bellRef = useRef(null);

  const GOLD = "#facc15";

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && !event.target.closest("#menuBtn")) {
        setMenuOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(event.target) && !event.target.closest("#bellBtn")) {
        setShowAllPopup(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navPages = [
    { name: "Home", path: "/home" },
    { name: "Profile", path: `/profile/${user?.username}` },
    { name: "Settings", path: "/settings" },
    { name: "Store", path: "/store" },
    { name: "SpaceHub", path: "/spacehub" },
    { name: "Events", path: "/events" },
    { name: "Blog", path: "/blog" },
    { name: "Podcast", path: "/podcast" },
    { name: "CreatorsHub", path: "/creatorshub" },
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-evenly",
        background: "#000",
        borderBottom: `1.5px solid ${GOLD}`,
        position: "sticky",
        top: 0,
        zIndex: 1000,
        height: 92,
        padding: "0 24px",
      }}
    >
      {/* Logo */}
      <img src="/assets/nsz-logo2.png" alt="NSZ Logo" style={{ height: 182 }} />

      {/* Search */}
      <div style={{ minWidth: 280, maxWidth: 480, width: "100%" }}>
        <SearchBar />
      </div>

      {/* Notification Bell */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative" }} ref={bellRef}>
          <button
            id="bellBtn"
            onClick={() => setShowAllPopup((p) => !p)}
            style={{
              background: "none",
              border: "2px solid " + GOLD,
              borderRadius: "50%",
              width: 36,
              height: 36,
              color: GOLD,
              fontSize: "1.1rem",
              cursor: "pointer",
            }}
          >
            🔔
          </button>
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                background: "#ef4444",
                color: "#fff",
                fontSize: 10,
                padding: "0 5px",
                borderRadius: 999,
                lineHeight: "16px",
                height: 18,
              }}
            >
              {unreadCount}
            </span>
          )}

          {showAllPopup && (
            <div
              style={{
                position: "absolute",
                top: 46,
                right: 0,
                background: "#111",
                border: `1.5px solid ${GOLD}`,
                borderRadius: 12,
                padding: 16,
                zIndex: 1002,
                width: 260,
                color: "#fff",
              }}
            >
              <h4 style={{ marginBottom: 8 }}>Notifications</h4>
              {unreadCount > 0 ? (
                <p>You have {unreadCount} new notification(s).</p>
              ) : (
                <p>No new notifications</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* User Info */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <img
          src={user?.profilePic && user.profilePic.trim() !== "" ? user.profilePic : "/assets/default-avatar.png"}
          alt="Profile"
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            objectFit: "cover",
            border: `2px solid ${GOLD}`,
          }}
        />
        <div
          style={{
            color: GOLD,
            fontWeight: 700,
            fontSize: "1rem",
            marginTop: 3,
          }}
        >
          {user?.username || "Guest"}
        </div>
      </div>

      {/* Menu */}
      <div ref={menuRef}>
        <button
          id="menuBtn"
          onClick={() => setMenuOpen((p) => !p)}
          style={{
            background: "none",
            border: "none",
            color: GOLD,
            fontSize: "2rem",
            cursor: "pointer",
          }}
        >
          ☰
        </button>

        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: 92,
              right: 20,
              background: "#000",
              border: `1.5px solid ${GOLD}`,
              borderRadius: 12,
              padding: "10px 0",
              zIndex: 1001,
              width: 220,
            }}
          >
            {/* 🚫 TEMPORARILY HIDE ALL NAVIGATION LINKS */}
            {false && navPages.map((page) => (
              <div
                key={page.path}
                onClick={() => {
                  navigate(page.path);
                  setMenuOpen(false);
                }}
                style={{
                  padding: "12px 18px",
                  cursor: "pointer",
                  borderBottom: `1px solid ${GOLD}`,
                  color: GOLD,
                }}
              >
                {page.name}
              </div>
            ))}

            {/* ✅ Keep Logout available */}
            <div
              onClick={() => {
                logout();
                setMenuOpen(false);
                navigate("/", { replace: true });
              }}
              style={{
                padding: "12px 18px",
                color: "#ff4444",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Logout
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const actionBtn = {
  border: "1px solid #333",
  background: "rgba(255,226,89,0.2)",
  color: "#ffe259",
  padding: "0.4rem 0.8rem",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold",
};
