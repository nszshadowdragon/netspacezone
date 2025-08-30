import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import SearchBar from "./SearchBar";
import { useAuth } from "../context/AuthContext";

/* --------------------- helpers --------------------- */
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
    } catch {}
  }

  src = src.replace(/^\.?\/*/, "");
  if (!src.startsWith("uploads/") && !src.startsWith("uploads\\")) src = `uploads/${src}`;
  const u = new URL(`${host}/${src}`);
  if (ver) u.searchParams.set("v", ver);
  return u.toString();
}
/* --------------------------------------------------- */

export default function Navbar({ unreadCount = 0 }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth() || {};

  const [currentUser, setCurrentUser] = useState(user);
  const [avatarVersion, setAvatarVersion] = useState(() => localStorage.getItem("nsz:avatar:v") || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllPopup, setShowAllPopup] = useState(false);

  const dropdownRef = useRef(null);
  const bellRef = useRef(null);
  const navRef = useRef(null);

  const [navH, setNavH] = useState(92);
  const [rightInset, setRightInset] = useState("0px");

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

  // close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && !e.target.closest("#menuBtn")) {
        setMenuOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target) && !e.target.closest("#bellBtn")) {
        setShowAllPopup(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // measure navbar height + compute right inset (scrollbar width + safe area + extra gap)
  useEffect(() => {
    const RIGHT_GAP_PX = 24;
    const update = () => {
      const h = navRef.current?.getBoundingClientRect()?.height;
      setNavH(Math.max(60, Math.round(h || 92)));

      const sb = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      setRightInset(`calc(${sb}px + env(safe-area-inset-right) + ${RIGHT_GAP_PX}px)`);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const rawPic = (currentUser?.profilePic || currentUser?.profileImage || "").trim();
  const avatarSrc = resolveAvatar(rawPic, avatarVersion);

  const isOn = (prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`);

  const menuPages = [
    { key: "spacehub", label: "SpaceHub", to: "/spacehub", isCurrent: () => isOn("/spacehub") || location.pathname === "/" },
    { key: "profile", label: "Profile", to: currentUser?.username ? `/profile/${currentUser.username}` : "/profile", isCurrent: () => isOn("/profile") },
    { key: "settings", label: "Settings", to: "/settings", isCurrent: () => isOn("/settings") },
    { key: "store", label: "Store", to: "/store", isCurrent: () => isOn("/store") },
    { key: "events", label: "Events", to: "/events", isCurrent: () => isOn("/events") },
    { key: "blog", label: "Blog", to: "/blog", isCurrent: () => isOn("/blog") },
    { key: "podcast", label: "Podcast", to: "/podcast", isCurrent: () => isOn("/podcast") },
    { key: "creatorshub", label: "CreatorsHub", to: "/creatorshub", isCurrent: () => isOn("/creatorshub") || isOn("/creators") },
  ];
  const visibleMenuPages = menuPages.filter((p) => !p.isCurrent());

  const labelsForWidth = [...visibleMenuPages.map((p) => p.label), "Logout"];
  const maxChars = Math.max(...labelsForWidth.map((s) => (s || "").length), 8);
  const dropdownWidth = `calc(${maxChars}ch + 48px)`;

  const profilePath = currentUser?.username ? `/profile/${currentUser.username}` : "/profile";

  const handleLogout = useCallback(async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    try {
      if (typeof logout === "function") await Promise.resolve(logout());
      try {
        await fetch(`${apiHost()}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
      } catch {}
      try { localStorage.removeItem("token"); } catch {}
      try {
        if ("BroadcastChannel" in window) {
          const bc = new BroadcastChannel("nsz_auth");
          bc.postMessage({ type: "logout" });
          bc.close();
        }
        window.dispatchEvent(new CustomEvent("nsz:user-logged-out"));
      } catch {}
    } finally {
      setMenuOpen(false);
      navigate("/landing", { replace: true });
    }
  }, [logout, navigate]);

  return (
    <>
      {/* Responsive tweaks; desktop/laptop stays exactly as laid out below */}
      <style>{`
        /* Hide username on smaller screens */
        @media (max-width: 900px){
          .nsz-username { display: none !important; }
        }

        /* Phone layout: center rows, stretch search, space-evenly icons */
        @media (max-width: 768px){
          .nsz-bar { 
            flex-wrap: wrap !important; 
            justify-content: center !important;
            row-gap: 10px !important;
            padding: 10px 12px !important;
            height: auto !important;
          }
          /* Logo: centered, 50% wider, 15% taller */
          .nsz-logo { 
            order: 1; 
            height: 64px !important;             /* ~15% up from 56px */
            transform: scale(1.5, 1.15);          /* 50% wider, 15% taller */
            transform-origin: center; 
            margin: 0 auto !important; 
            display: block !important;
          }
          .nsz-search { 
            order: 2; 
            width: min(92vw, 640px) !important; 
            margin: 0 auto !important; 
          }
          .nsz-actions { 
            order: 3; 
            width: 100% !important; 
            display: flex !important; 
            justify-content: space-evenly !important; 
            align-items: center !important;
            gap: 18px !important;
          }
          #bellBtn { width: 34px !important; height: 34px !important; font-size: .95rem !important; }
          .nsz-avatar { width: 40px !important; height: 40px !important; border-width: 1.5px !important; }
          #menuBtn { font-size: 1.8rem !important; }
        }

        /* Extra-small phones */
        @media (max-width: 420px){
          .nsz-logo { 
            height: 60px !important;             /* ~15% up from 52px */
            transform: scale(1.5, 1.15);
          }
          #bellBtn { width: 30px !important; height: 30px !important; }
          .nsz-avatar { width: 36px !important; height: 36px !important; }
          #menuBtn { font-size: 1.6rem !important; }
        }

        /* Desktop: keep your laptop sizing; constrain search width there */
        @media (min-width: 901px){
          .nsz-search { min-width: 280px; max-width: 480px; }
        }
      `}</style>

      {/* DESKTOP/LAPTOP BASELINE (unchanged) */}
      <div
        ref={navRef}
        className="nsz-bar"
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
        {/* Logo (kept as-is for laptop/desktop) */}
        <img src="/assets/nsz-logo2.png" alt="NSZ Logo" className="nsz-logo" style={{ height: 182 }} />

        {/* Search */}
        <div className="nsz-search" style={{ width: "100%" }}>
          <SearchBar />
        </div>

        {/* Actions */}
        <div className="nsz-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Bell */}
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
              aria-label="Notifications"
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

          {/* Avatar + username -> Profile */}
          <Link
            to={profilePath}
            onClick={() => setMenuOpen(false)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none" }}
            aria-label="Go to profile"
          >
            <img
              src={avatarSrc}
              alt="Profile"
              crossOrigin="anonymous"
              draggable="false"
              className="nsz-avatar"
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
              }}
            />
            <div className="nsz-username" style={{ color: GOLD, fontWeight: 700, fontSize: "1rem", marginTop: 3 }}>
              {currentUser?.username || "Guest"}
            </div>
          </Link>

          {/* Burger */}
          <button
            id="menuBtn"
            onClick={() => setMenuOpen((p) => !p)}
            style={{ background: "none", border: "none", color: GOLD, fontSize: "2rem", cursor: "pointer" }}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
      </div>

      {/* RIGHT-EDGE DROPDOWN — stays inside content area, below bar */}
      {menuOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: navH,
            right: rightInset,
            background: "#000",
            border: `1.5px solid ${GOLD}`,
            borderRadius: "12px 0 0 12px",
            padding: "10px 8px",
            zIndex: 2000,
            width: dropdownWidth,
            minWidth: 220,
            boxShadow: "0 8px 24px rgba(0,0,0,.5)",
          }}
        >
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

          <button
            onClick={handleLogout}
            style={{
              margin: "6px 6px",
              padding: "12px 16px",
              border: `1px solid ${GOLD}`,
              borderRadius: 10,
              background: "transparent",
              color: "#ff4444",
              fontWeight: 800,
              cursor: "pointer",
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "calc(100% - 12px)",
            }}
            aria-label="Log out"
          >
            Logout
          </button>
        </div>
      )}
    </>
  );
}
