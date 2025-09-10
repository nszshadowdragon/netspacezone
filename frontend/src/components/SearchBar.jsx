// frontend/src/components/SearchBar.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

/* -------- API base (dev defaults to backend) -------- */
const isLocal = /localhost|127\.0\.0\.1/.test(window.location.hostname);
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || (isLocal ? "http://localhost:5000" : "");

/* -------- inline placeholder (never 404) -------- */
const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
      <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='#0f0f0f'/><stop offset='1' stop-color='#1c1c1c'/>
      </linearGradient></defs>
      <rect width='100%' height='100%' fill='url(#g)'/>
      <circle cx='100' cy='72' r='40' fill='#2a2a2a' stroke='#333' stroke-width='3'/>
      <rect x='36' y='122' width='128' height='56' rx='28' fill='#222' stroke='#333' stroke-width='3'/>
    </svg>`
  );

/* ---------- helpers ---------- */
function normalizeUploadsPath(raw) {
  const name = String(raw || "").replace(/^https?:\/\/.+$/i, "");
  const withLeading = name.startsWith("/") ? name : `/${name}`;
  const ensured = withLeading.startsWith("/uploads")
    ? withLeading
    : `/uploads${withLeading}`;
  const parts = ensured.split("/");
  const head = parts.slice(0, 2).join("/"); // "/uploads"
  const tail = parts.slice(2).map(encodeURIComponent).join("/");
  return tail ? `${head}/${tail}` : head;
}

/** Fix dev absolutes and force uploads to backend when running locally. */
function fixDevAbsolute(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const isApiLocal =
      host === "api.localhost" || (/\.localhost$/.test(host) && /^api\./i.test(host));
    if (isApiLocal) {
      return `http://localhost:5000${u.pathname}${u.search || ""}`;
    }
    if ((host === "localhost" || host === "127.0.0.1") && u.protocol === "https:") {
      return `http://localhost${u.port ? `:${u.port}` : ""}${u.pathname}${u.search || ""}`;
    }
    if (
      isLocal &&
      host !== "localhost" &&
      host !== "127.0.0.1" &&
      u.pathname.startsWith("/uploads/")
    ) {
      return `http://localhost:5000${u.pathname}${u.search || ""}`;
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Build candidates:
 * - data: URI → use directly
 * - absolute URL → dev-fix then use
 * - relative → prefix API_BASE
 */
function buildImgCandidates(raw) {
  if (!raw) return [];
  if (/^data:/i.test(raw)) return [raw];
  if (/^https?:\/\//i.test(raw)) return [fixDevAbsolute(raw)];
  const p = normalizeUploadsPath(raw);
  return API_BASE ? [`${API_BASE}${p}`] : [p];
}

/* ---------------- SmartAvatar (skeleton → decoded image) ---------------- */
function SmartAvatar({ src, size = 36, alt = "", style, eager = true }) {
  const candidates = buildImgCandidates(src);
  const [idx, setIdx] = useState(0);
  const [ready, setReady] = useState(false);
  const current = candidates[idx];

  // reset when src changes
  useEffect(() => {
    setIdx(0);
    setReady(false);
  }, [src]);

  // preload and decode before showing <img>
  useEffect(() => {
    if (!current) return;
    try {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = current;
      document.head.appendChild(link);
      setTimeout(() => {
        try { document.head.removeChild(link); } catch {}
      }, 4000);
    } catch {}

    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    // @ts-ignore
    img.fetchPriority = eager ? "high" : "auto";
    img.loading = eager ? "eager" : "lazy";
    img.onload = () => !cancelled && setReady(true);
    img.onerror = () => {
      if (cancelled) return;
      if (idx < candidates.length - 1) {
        setIdx((n) => n + 1);
        setReady(false);
      } else {
        setReady(true);
      }
    };
    img.src = current;

    if (candidates[idx + 1]) {
      const img2 = new Image();
      img2.decoding = "async";
      img2.src = candidates[idx + 1];
    }

    return () => { cancelled = true; };
  }, [current, idx, candidates, eager]);

  const boxStyle = {
    width: size,
    height: size,
    borderRadius: "50%",
    overflow: "hidden",
    display: "inline-block",
    lineHeight: 0,
    background: "#222",
    border: "2px solid #555",
    flexShrink: 0,
    ...style,
  };

  return (
    <span style={boxStyle} aria-hidden={alt ? undefined : true}>
      {!ready && (
        <span
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            background:
              "radial-gradient(100% 100% at 50% 0%, #232323 0%, #171717 60%, #0f0f0f 100%)",
            animation: "nszPulse .45s ease-in-out 2",
          }}
        />
      )}
      <style>{`@keyframes nszPulse { 0%{opacity:.6} 50%{opacity:.9} 100%{opacity:.6} }`}</style>

      {ready && (
        <img
          src={current || DEFAULT_AVATAR}
          alt={alt}
          width={size}
          height={size}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          // @ts-ignore
          fetchPriority={eager ? "high" : "auto"}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={(e) => {
            if (e.currentTarget.src !== DEFAULT_AVATAR) {
              e.currentTarget.src = DEFAULT_AVATAR;
            }
          }}
          draggable={false}
        />
      )}
    </span>
  );
}

/**
 * Prefer order:
 * 1) profileImageUrl (absolute URL from API)
 * 2) profileImage / profilePic (uploads path/relative)
 * 3) avatarUrl / avatar / imageUrl (fallbacks)
 */
function pickAnyAvatar(u) {
  if (!u) return "";
  const candidates = [
    u.profileImageUrl,
    u.profileImage,     // ✅ added
    u.profilePic,       // ✅ added
    u.avatarUrl,
    u.avatar,
    u.imageUrl,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return "";
}

/* --------------------------------- SearchBar --------------------------------- */
export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const abortRef = useRef(null);
  const navigate = useNavigate();

  const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    "";

  const performSearch = useCallback(async (val) => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }
    if (!val.trim()) {
      setResults([]);
      setDropdownOpen(false);
      setErr("");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setErr("");

    try {
      const res = await fetch(
        `${API_BASE}/api/users/search?q=${encodeURIComponent(val)}`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: getToken() ? `Bearer ${getToken()}` : undefined,
          },
          signal: controller.signal,
        }
      );

      if (res.status === 401) {
        setErr("Sign in to search.");
        setResults([]);
        setDropdownOpen(true);
        setHighlightIndex(-1);
        return;
      }
      if (!res.ok) throw new Error(`Search failed (${res.status})`);

      const data = await res.json();
      const arr = Array.isArray(data?.users)
        ? data.users
        : Array.isArray(data)
        ? data
        : [];

      const patched = arr.map((u) => ({
        ...u,
        _avatarSrc: pickAnyAvatar(u), // ✅ now includes profileImage/profilePic
      }));

      setResults(patched);
      setDropdownOpen(true);
      setHighlightIndex(patched.length ? 0 : -1);
    } catch (e) {
      if (e?.name !== "AbortError") {
        setErr("Search error. Try again.");
        setResults([]);
        setDropdownOpen(true);
        setHighlightIndex(-1);
      }
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Light debounce
  useEffect(() => {
    const t = setTimeout(() => performSearch(query), 120);
    return () => clearTimeout(t);
  }, [query, performSearch]);

  useEffect(() => {
    function handleClick(e) {
      if (
        !e.target.closest(".nsz-searchbar") &&
        !e.target.closest(".nsz-search-dropdown")
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  function handleSelectUser(username) {
    if (!username) return;
    setDropdownOpen(false);
    setQuery("");
    navigate(`/profile/${username}`);
  }

  async function handleAddFriend(e, user, index) {
    e.stopPropagation();
    setResults((prev) =>
      prev.map((u, i) => (i === index ? { ...u, requestPending: true } : u))
    );
    try {
      const res = await fetch(`${API_BASE}/api/users/friends/request`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: getToken() ? `Bearer ${getToken()}` : undefined,
        },
        body: JSON.stringify({ toUserId: user._id || user.id || user.userId }),
      });
      if (!res.ok) throw new Error();
      const payload = await res.json().catch(() => ({}));
      setResults((prev) =>
        prev.map((u, i) =>
          i === index
            ? {
                ...u,
                isFriend: payload?.isFriend ?? u.isFriend ?? false,
                requestPending: payload?.requestPending ?? true,
              }
            : u
        )
      );
    } catch {
      setResults((prev) =>
        prev.map((u, i) => (i === index ? { ...u, requestPending: false } : u))
      );
      setErr("Couldn’t send request.");
      setDropdownOpen(true);
    }
  }

  // ✅ NEW: Cancel outgoing friend request
  async function handleCancelRequest(e, user, index) {
    e.stopPropagation();
    setResults((prev) =>
      prev.map((u, i) => (i === index ? { ...u, _canceling: true } : u))
    );
    try {
      const res = await fetch(`${API_BASE}/api/users/friends/cancel`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: getToken() ? `Bearer ${getToken()}` : undefined,
        },
        body: JSON.stringify({ toUserId: user._id || user.id || user.userId }),
      });
      if (!res.ok) throw new Error();
      setResults((prev) =>
        prev.map((u, i) =>
          i === index ? { ...u, requestPending: false, _canceling: false } : u
        )
      );
    } catch {
      setResults((prev) =>
        prev.map((u, i) =>
          i === index ? { ...u, _canceling: false } : u
        )
      );
      setErr("Couldn’t cancel request.");
      setDropdownOpen(true);
    }
  }

  function onKeyDown(e) {
    if (!dropdownOpen || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = results[highlightIndex] || results[0];
      if (chosen) handleSelectUser(chosen.username);
    } else if (e.key === "Escape") setDropdownOpen(false);
  }

  return (
    <div className="nsz-searchbar" style={{ position: "relative", width: "100%" }}>
      <input
        type="search"
        value={query}
        placeholder="Search NSZ users..."
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query && results.length && setDropdownOpen(true)}
        onKeyDown={onKeyDown}
        style={{
          padding: "0.5rem",
          borderRadius: 6,
          border: "1px solid #555",
          width: "100%",
          background: "#000",
          color: "#fff",
        }}
      />

      {dropdownOpen && (
        <div
          className="nsz-search-dropdown"
          style={{
            position: "absolute",
            top: "2.3rem",
            left: 0,
            right: 0,
            background: "#111",
            color: "#ffe066",
            borderRadius: 7,
            boxShadow: "0 6px 24px #000e",
            zIndex: 1300,
            padding: "0.6rem 0",
            maxHeight: "60vh",
            overflowY: "auto",
          }}
        >
          {loading && (
            <div style={{ padding: "0.8rem 1.2rem", color: "#fffde6" }}>
              Searching…
            </div>
          )}
          {!loading && err && (
            <div style={{ padding: "0.8rem 1.2rem", color: "#ffb3b3" }}>{err}</div>
          )}
          {!loading && !err && results.length === 0 && query.trim() && (
            <div style={{ padding: "0.8rem 1.2rem", color: "#fffde6" }}>
              No results.
            </div>
          )}

          {!loading &&
            results.map((u, i) => {
              const isActive = i === highlightIndex;
              const eager = i < 6;
              return (
                <div
                  key={(u._id || u.id || u.username) + i}
                  onClick={() => handleSelectUser(u.username)}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightIndex(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                    padding: "0.6rem 1.2rem",
                    borderBottom: "1px solid #232323",
                    background: isActive ? "#151515" : "transparent",
                  }}
                >
                  <SmartAvatar src={u._avatarSrc} alt={u.username} size={36} eager={eager} />

                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span
                      style={{
                        fontWeight: 800,
                        color: "#ffe066",
                        lineHeight: 1.1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "calc(100vw - 220px)",
                      }}
                      title={`@${u.username}`}
                    >
                      @{u.username}
                    </span>
                  </div>

                  <div style={{ flex: 1 }} />

                  {u.isFriend ? (
                    <span
                      style={{
                        fontSize: 12,
                        color: "#8ee98e",
                        padding: "0.25rem 0.5rem",
                        border: "1px solid #2a2",
                        borderRadius: 6,
                      }}
                    >
                      Friends
                    </span>
                  ) : u.requestPending ? (
                    <button
                      onClick={(e) => handleCancelRequest(e, u, i)}
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        padding: "0.35rem 0.6rem",
                        borderRadius: 6,
                        border: "1px solid #664",
                        background: "#1a1a1a",
                        color: "#ffd966",
                        opacity: u._canceling ? 0.6 : 1,
                      }}
                      title="Cancel request"
                    >
                      {u._canceling ? "Canceling…" : "Cancel"}
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleAddFriend(e, u, i)}
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        padding: "0.35rem 0.6rem",
                        borderRadius: 6,
                        border: "1px solid #444",
                        background: "#000",
                        color: "#ffe066",
                      }}
                    >
                      Add Friend
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
