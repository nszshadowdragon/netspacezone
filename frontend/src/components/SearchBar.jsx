import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const navigate = useNavigate();

  const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    "";

  // ---- perf helpers ----
  // 1) Preconnect to the uploads origin to warm DNS+TLS.
  const preconnected = useRef(new Set());
  const ensurePreconnect = (origin) => {
    if (!origin) return;
    try {
      if (preconnected.current.has(origin)) return;
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = origin;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
      preconnected.current.add(origin);
    } catch {}
  };

  // 2) Prefetch images in-memory so <img> hits hot cache.
  const prefetchImage = (src) => {
    if (!src) return;
    try {
      const img = new Image();
      // hint browser: do it off the main thread and right away
      img.decoding = "async";
      // @ts-ignore
      img.fetchPriority = "high";
      img.loading = "eager";
      img.src = src;
    } catch {}
  };

  const performSearch = useCallback(
    async (val) => {
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
            headers: {
              "Content-Type": "application/json",
              Authorization: getToken() ? `Bearer ${getToken()}` : undefined,
            },
            signal: controller.signal,
          }
        );

        if (!res.ok) throw new Error(`Search failed (${res.status})`);

        const data = await res.json();
        const arr = Array.isArray(data?.users)
          ? data.users
          : Array.isArray(data)
          ? data
          : [];

        // Preconnect once per distinct uploads origin, then prefetch images
        const origins = new Set();
        for (const u of arr) {
          const src = u?.profileImageUrl;
          if (src && /^https?:\/\//i.test(src)) {
            try { origins.add(new URL(src).origin); } catch {}
          }
        }
        origins.forEach((o) => ensurePreconnect(o));
        arr.forEach((u) => prefetchImage(u?.profileImageUrl));

        setResults(arr);
        setDropdownOpen(true);
        setHighlightIndex(arr.length ? 0 : -1);
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
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Debounce a bit tighter so prefetch starts sooner
  useEffect(() => {
    const t = setTimeout(() => performSearch(query), 150);
    return () => clearTimeout(t);
  }, [query, performSearch]);

  // Close dropdown on outside click
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
        headers: {
          "Content-Type": "application/json",
          Authorization: getToken() ? `Bearer ${getToken()}` : undefined,
        },
        body: JSON.stringify({
          toUserId: user._id || user.id || user.userId,
        }),
      });

      if (!res.ok) throw new Error(`Add friend failed (${res.status})`);

      const payload = await res.json();
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
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
    }
  }

  return (
    <div className="nsz-searchbar" style={{ position: "relative", width: "100%" }}>
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Search NSZ users..."
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query && results.length && setDropdownOpen(true)}
        onKeyDown={onKeyDown}
        style={{
          padding: "0.5rem",
          borderRadius: "6px",
          border: "1px solid #555",
          width: "100%",
          backgroundColor: "#000",
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
            <div style={{ padding: "0.8rem 1.2rem", color: "#fffde6" }}>No results.</div>
          )}

          {!loading &&
            results.map((u, i) => {
              const isActive = i === highlightIndex;
              const src = u.profileImageUrl || "/profilepic.jpg";

              return (
                <div
                  key={(u._id || u.id || u.username) + i}
                  onClick={() => handleSelectUser(u.username)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                    padding: "0.6rem 1.2rem",
                    borderBottom: "1px solid #232323",
                    background: isActive ? "#151515" : "transparent",
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightIndex(i)}
                >
                  <img
                    src={src}
                    alt={u.username}
                    width={36}
                    height={36}
                    loading="eager"
                    decoding="async"
                    // @ts-ignore
                    fetchPriority="high"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectUser(u.username);
                    }}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/profilepic.jpg";
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      objectFit: "cover",
                      background: "#222",
                      border: "2px solid #555",
                      flexShrink: 0,
                    }}
                  />

                  {/* Username only */}
                  <div
                    onClick={() => handleSelectUser(u.username)}
                    style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
                  >
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
                    <span
                      style={{
                        fontSize: 12,
                        color: "#ffd966",
                        padding: "0.25rem 0.5rem",
                        border: "1px solid #a68d2a",
                        borderRadius: 6,
                      }}
                    >
                      Requested
                    </span>
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
