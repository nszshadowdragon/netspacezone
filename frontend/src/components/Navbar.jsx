import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import SearchBar from "./SearchBar";
import { useAuth } from "../context/AuthContext";

function isLocalhost() {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}
function apiHost() {
  return isLocalhost() ? "http://localhost:5000" : "https://api.netspacezone.com";
}

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72">
      <rect width="100%" height="100%" fill="#111"/>
      <circle cx="36" cy="36" r="32" fill="#222" stroke="#333" stroke-width="4"/>
      <text x="50%" y="54%" text-anchor="middle" fill="#ffe259" font-size="12" font-family="Arial">avatar</text>
    </svg>`
  );

function resolveAvatar(raw, ver) {
  let src = (raw || "").trim();
  if (!src) return FALLBACK_AVATAR;
  if (/^(data:|blob:)/i.test(src)) return src;

  const host = apiHost();

  if (/^https?:\/\//i.test(src)) {
    try {
      const u = new URL(src);
      if (/api\.netspacezone\.com$/i.test(u.hostname) && u.pathname.startsWith("/uploads/")) {
        u.protocol = isLocalhost() ? "http:" : "https:";
        u.host = isLocalhost() ? "localhost:5000" : "api.netspacezone.com";
      }
      if (ver) u.searchParams.set("v", ver);
      return u.toString();
    } catch {
      /* fall through */
    }
  }

  src = src.replace(/^\.?\/*/, "");
  if (!src.startsWith("uploads/") && !src.startsWith("uploads\\")) src = `uploads/${src}`;
  const u = new URL(`${host}/${src}`);
  if (ver) u.searchParams.set("v", ver);
  return u.toString();
}

export default function Navbar({ unreadCount }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [currentUser, setCurrentUser] = useState(user);
  const [avatarVersion, setAvatarVersion] = useState(() => localStorage.getItem("nsz:avatar:v") || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllPopup, setShowAllPopup] = useState(false);

  const menuRef = useRef(null);
  const bellRef = useRef(null);

  const GOLD = "#facc15";

  useEffect(() => setCurrentUser(user), [user]);

  useEffect(() => {
    const onUserUpdated = (e) => {
      if (e?.detail) {
        setCurrentUser(e.detail);
        const v = localStorage.getItem("nsz:avatar:v") || String(Date.now());
        setAvatarVersion(v);
      }
    };
    window.addEventListener("nsz:user-updated", onUserUpdated);

    let bc = null;
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel("nsz_auth");
      bc.addEventListener("message", (evt) => {
        if (evt?.data?.type === "user-updated" && evt.data.user) {
          setCurrentUser(evt.data.user);
          const v = localStorage.getItem("nsz:avatar:v") || String(Date.now());
          setAvatarVersion(v);
        }
      });
    }

    const onStorage = (e) => {
      if (e.key === "nsz:avatar:v") setAvatarVersion(e.newValue || "");
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("nsz:user-updated", onUserUpdated);
      window.removeEventListener("storage", onStorage);
      bc?.close?.();
    };
  }, []);

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

  const rawPic = (currentUser?.profilePic || currentUser?.profileImage || "").trim();
  const avatarSrc = resolveAvatar(rawPic, avatarVersion);

  const pathname = location.pathname || "/";
  const isOn = (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`);

  const menuPages = [
    { key: "spacehub", label: "SpaceHub", to: "/spacehub", isCurrent: () => isOn("/spacehub") || pathname === "/" },
    {
      key: "profile",
      label: "Profile",
      to: currentUser?.username ? `/profile/${currentUser.username}` : "/profile",
      isCurrent: () => isOn("/profile"),
      hide: !currentUser?.username,
    },
    { key: "settings", label: "Settings", to: "/settings", isCurrent: () => isOn("/settings") },
    { key: "store", label: "Store", to: "/store", isCurrent: () => isOn("/store") },
    { key: "events", label: "Events", to: "/events", isCurrent: () => isOn("/events") },
    { key: "blog", label: "Blog", to: "/blog", isCurrent: () => isOn("/blog") },
    { key: "podcast", label: "Podcast", to: "/podcast", isCurrent: () => isOn("/podcast") },
    { key: "creatorshub", label: "CreatorsHub", to: "/creatorshub", isCurrent: () => isOn("/creatorshub") || isOn("/creators") },
  ];

  const visibleMenuPages = menuPages.filter((p) => !p.hide && !p.isCurrent());

  // Compute a width that’s just a bit wider than the longest label currently shown
  const labelsForWidth = [...visibleMenuPages.map((p) => p.label), "Logout"];
  const maxChars = Math.max(...labelsForWidth.map((s) => (s || "").length), 8); // floor
  const dropdownWidth = `calc(${maxChars}ch + 48px)`; // add padding/spacing

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
      <img src="/assets/nsz-logo2.png" alt="NSZ Logo" style={{ height: 182 }} />

      <div style={{ minWidth: 280, maxWidth: 480, width: "100%" }}>
        <SearchBar />
      </div>

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
              <h4 style={{ marginBottom: 8, textAlign: "center" }}>Notifications</h4>
              {unreadCount > 0 ? <p>You have {unreadCount} new notification(s).</p> : <p>No new notifications</p>}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <img
          src={avatarSrc}
          alt="Profile"
          crossOrigin="anonymous"
          onClick={() => currentUser?.username && navigate(`/profile/${currentUser.username}`)}
          onError={(e) => {
            if (!e.currentTarget.dataset.fallback) {
              e.currentTarget.dataset.fallback = "1";
              e.currentTarget.src = FALLBACK_AVATAR;
            }
          }}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            objectFit: "cover",
            border: `2px solid ${GOLD}`,
            cursor: currentUser?.username ? "pointer" : "default",
          }}
        />
        <div style={{ color: GOLD, fontWeight: 700, fontSize: "1rem", marginTop: 3 }}>
          {currentUser?.username || "Guest"}
        </div>
      </div>

      {/* Hamburger + Dropdown */}
      <div ref={menuRef}>
        <button
          id="menuBtn"
          onClick={() => setMenuOpen((p) => !p)}
          style={{ background: "none", border: "none", color: GOLD, fontSize: "2rem", cursor: "pointer" }}
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
              padding: "10px 8px",
              zIndex: 1001,
              width: dropdownWidth, // auto-sized to longest label
            }}
          >
            {/* Items */}
            {visibleMenuPages.map((item) => (
              <div
                key={item.key}
                onClick={() => {
                  navigate(item.to);
                  setMenuOpen(false);
                }}
                style={{
                  margin: "6px 6px",
                  padding: "12px 16px",
                  border: `1px solid ${GOLD}`,
                  borderRadius: 10,
                  color: GOLD,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  userSelect: "none",
                }}
              >
                {item.label}
              </div>
            ))}

            {/* Logout — same border & centering for uniformity */}
            <div
              onClick={() => {
                logout();
                setMenuOpen(false);
                navigate("/spacehub", { replace: true });
              }}
              style={{
                margin: "6px 6px",
                padding: "12px 16px",
                border: `1px solid ${GOLD}`,
                borderRadius: 10,
                color: "#ff4444",
                fontWeight: 800,
                cursor: "pointer",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                userSelect: "none",
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
