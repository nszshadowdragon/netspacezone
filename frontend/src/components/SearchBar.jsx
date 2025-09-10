// frontend/src/components/SearchBar.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";
import { useAuth } from "../context/AuthContext";
import AvatarImg from "./AvatarImg";
import FriendsAPI from "../services/friends";

/* -------- API base (dev defaults to backend) -------- */
const isLocal = /localhost|127\.0\.0\.1/.test(window.location.hostname);
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || (isLocal ? "http://localhost:5000" : "");

/* --------------------------------- SearchBar --------------------------------- */
export default function SearchBar() {
  const { user: me } = useAuth();
  const myId = String(me?._id || "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const abortRef = useRef(null);
  const annotateSeq = useRef(0); // prevent late updates
  const navigate = useNavigate();

  const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    "";

  const performSearch = useCallback(async (val) => {
    if (abortRef.current) { try { abortRef.current.abort(); } catch {} }
    if (!val.trim()) { setResults([]); setDropdownOpen(false); setErr(""); return; }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setErr("");

    try {
      const res = await fetch(
        `${API_BASE}/api/users/search?q=${encodeURIComponent(val)}&limit=12`,
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
        setResults([]); setDropdownOpen(true); setHighlightIndex(-1);
        return;
      }
      if (!res.ok) throw new Error(`Search failed (${res.status})`);

      const data = await res.json();
      const arr = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];

      // normalize fields we use
      const base = arr.map((u) => ({
        _id: String(u._id || u.id || ""),
        username: String(u.username || u.userName || u.name || "").trim(),
        fullName: String(u.fullName || u.displayName || "").trim(),
        profileImage: u.profileImage || u.profilePic || u.profileImageUrl || "",
        isFriend: false,
        requestPending: false,   // outgoing (you sent)
        incomingPending: false,  // incoming (they sent)
      }));

      setResults(base);
      setDropdownOpen(true);
      setHighlightIndex(base.length ? 0 : -1);

      // ---------- exact per-user status (prevents wrong "Incoming/Cancel") ----------
      annotateSeq.current += 1;
      const seq = annotateSeq.current;

      // status for each result (skip self)
      const statuses = await Promise.all(
        base.map((u) =>
          String(u._id) === myId
            ? Promise.resolve({ ok: true, statusText: "self" })
            : FriendsAPI.getStatus({ userId: u._id })
        )
      );

      if (annotateSeq.current !== seq) return; // newer search landed

      setResults((prev) =>
        prev.map((u, i) => {
          const st = statuses[i]?.statusText || statuses[i]?.data?.status || "none";
          if (st === "friends")  return { ...u, isFriend: true,  requestPending: false, incomingPending: false };
          if (st === "pending")  return { ...u, isFriend: false, requestPending: true,  incomingPending: false };
          if (st === "incoming") return { ...u, isFriend: false, requestPending: false, incomingPending: true  };
          return { ...u, isFriend: false, requestPending: false, incomingPending: false };
        })
      );
    } catch (e) {
      if (e?.name !== "AbortError") {
        setErr("Search error. Try again.");
        setResults([]); setDropdownOpen(true); setHighlightIndex(-1);
      }
    } finally {
      setLoading(false);
    }
  }, [myId]);

  // debounce
  useEffect(() => { const t = setTimeout(() => performSearch(query), 120); return () => clearTimeout(t); }, [query, performSearch]);

  // outside click
  useEffect(() => {
    function handleClick(e) {
      if (!e.target.closest(".nsz-searchbar") && !e.target.closest(".nsz-search-dropdown")) setDropdownOpen(false);
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  function handleSelectUser(username) {
    if (!username) return;
    setDropdownOpen(false); setQuery(""); navigate(`/profile/${username}`);
  }

  async function handleAddFriend(e, user, index) {
    e.stopPropagation();
    setResults((prev) => prev.map((u, i) => (i === index ? { ...u, requestPending: true } : u)));
    try {
      const res = await fetch(`${API_BASE}/api/users/friends/request`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: getToken() ? `Bearer ${getToken()}` : undefined,
        },
        body: JSON.stringify({ toUserId: user._id }),
      });
      if (!res.ok) throw new Error();
      const payload = await res.json().catch(() => ({}));
      setResults((prev) =>
        prev.map((u, i) =>
          i === index ? { ...u, isFriend: payload?.status === "friends", requestPending: payload?.status !== "friends", incomingPending: false } : u
        )
      );
    } catch {
      setResults((prev) => prev.map((u, i) => (i === index ? { ...u, requestPending: false } : u)));
      setErr("Couldn’t send request."); setDropdownOpen(true);
    }
  }

  async function handleCancelRequest(e, user, index) {
    e.stopPropagation();
    setResults((prev) => prev.map((u, i) => (i === index ? { ...u, _canceling: true } : u)));
    try {
      const res = await fetch(`${API_BASE}/api/users/friends/cancel`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: getToken() ? `Bearer ${getToken()}` : undefined,
        },
        body: JSON.stringify({ toUserId: user._id }),
      });
      if (!res.ok) throw new Error();
      setResults((prev) => prev.map((u, i) => (i === index ? { ...u, requestPending: false, _canceling: false } : u)));
    } catch {
      setResults((prev) => prev.map((u, i) => (i === index ? { ...u, _canceling: false } : u)));
      setErr("Couldn’t cancel request."); setDropdownOpen(true);
    }
  }

  // Accept/decline directly from dropdown when it's an incoming request
  async function handleAcceptIncoming(e, user, index) {
    e.stopPropagation();
    try {
      await FriendsAPI.acceptRequest({ fromUserId: user._id, username: user.username });
      setResults((prev) => prev.map((u, i) => (i === index ? { ...u, isFriend: true, incomingPending: false } : u)));
    } catch {}
  }
  async function handleDeclineIncoming(e, user, index) {
    e.stopPropagation();
    try {
      await FriendsAPI.declineRequest({ fromUserId: user._id, username: user.username });
      setResults((prev) => prev.map((u, i) => (i === index ? { ...u, incomingPending: false } : u)));
    } catch {}
  }

  // realtime flips (only when events involve me)
  useEffect(() => {
    if (!myId) return;

    const setForId = (targetId, patch) =>
      setResults((prev) => prev.map((u) => (String(u._id) === String(targetId) ? { ...u, ...patch } : u)));

    const onCreated = ({ fromUserId, toUserId }) => {
      if (String(fromUserId) === myId) setForId(toUserId,   { requestPending: true,  incomingPending: false });
      if (String(toUserId)   === myId) setForId(fromUserId, { incomingPending: true, requestPending: false });
    };
    const onCanceled = ({ fromUserId, toUserId }) => {
      if (String(fromUserId) === myId) setForId(toUserId,   { requestPending: false });
      if (String(toUserId)   === myId) setForId(fromUserId, { incomingPending: false });
    };
    const onAccepted = ({ a, b }) => {
      const other = String(a) === myId ? String(b) : String(b) === myId ? String(a) : "";
      if (other) setForId(other, { isFriend: true, requestPending: false, incomingPending: false });
    };
    const onRemoved = ({ a, b }) => {
      const other = String(a) === myId ? String(b) : String(b) === myId ? String(a) : "";
      if (other) setForId(other, { isFriend: false, requestPending: false, incomingPending: false });
    };

    socket.on("friend:request:created", onCreated);
    socket.on("friend:request:canceled", onCanceled);
    socket.on("friend:accepted", onAccepted);
    socket.on("friend:removed", onRemoved);
    socket.on("friend:declined", onCanceled);

    return () => {
      socket.off("friend:request:created", onCreated);
      socket.off("friend:request:canceled", onCanceled);
      socket.off("friend:accepted", onAccepted);
      socket.off("friend:removed", onRemoved);
      socket.off("friend:declined", onCanceled);
    };
  }, [myId]);

  function onKeyDown(e) {
    if (!dropdownOpen || !results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIndex((i) => (i + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIndex((i) => (i - 1 + results.length) % results.length); }
    else if (e.key === "Enter")   { e.preventDefault(); const chosen = results[highlightIndex] || results[0]; if (chosen) handleSelectUser(chosen.username); }
    else if (e.key === "Escape")  setDropdownOpen(false);
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
        style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #555", width: "100%", background: "#000", color: "#fff" }}
      />

      {dropdownOpen && (
        <div
          className="nsz-search-dropdown"
          style={{
            position: "absolute", top: "2.3rem", left: 0, right: 0,
            background: "#111", color: "#ffe066", borderRadius: 7, boxShadow: "0 6px 24px #000e",
            zIndex: 1300, padding: "0.6rem 0", maxHeight: "60vh", overflowY: "auto",
          }}
        >
          {loading && <div style={{ padding: "0.8rem 1.2rem", color: "#fffde6" }}>Searching…</div>}
          {!loading && err && <div style={{ padding: "0.8rem 1.2rem", color: "#ffb3b3" }}>{err}</div>}
          {!loading && !err && results.length === 0 && query.trim() && (
            <div style={{ padding: "0.8rem 1.2rem", color: "#fffde6" }}>No results.</div>
          )}

          {!loading && results.map((u, i) => {
            const isActive = i === highlightIndex;
            const isSelf = myId && String(u._id) === myId;

            return (
              <div
                key={(u._id || u.username) + i}
                onClick={() => handleSelectUser(u.username)}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlightIndex(i)}
                style={{
                  display: "grid", gridTemplateColumns: "auto 1fr auto",
                  alignItems: "center", gap: 12, cursor: "pointer",
                  padding: "0.6rem 1.2rem", borderBottom: "1px solid #232323",
                  background: isActive ? "#151515" : "transparent",
                }}
              >
                <AvatarImg user={{ _id: u._id, username: u.username, profileImage: u.profileImage }} size={36} />

                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#ffe066", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis" }}>
                    @{u.username}
                  </div>
                  {u.fullName && (
                    <div style={{ color: "#bdb37a", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {u.fullName}
                    </div>
                  )}
                </div>

                <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 8 }}>
                  {isSelf ? null : u.isFriend ? (
                    <span style={{ fontSize: 12, color: "#8ee98e", padding: "0.25rem 0.5rem", border: "1px solid #2a2", borderRadius: 6 }}>
                      Friends
                    </span>
                  ) : u.requestPending ? (
                    <button
                      onClick={(e) => handleCancelRequest(e, u, i)}
                      style={{ fontSize: 13, fontWeight: 800, padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #664", background: "#1a1a1a", color: "#ffd966", opacity: u._canceling ? 0.6 : 1 }}
                      title="Cancel request"
                    >
                      {u._canceling ? "Canceling…" : "Cancel"}
                    </button>
                  ) : u.incomingPending ? (
                    <>
                      <button
                        onClick={(e) => handleAcceptIncoming(e, u, i)}
                        style={{ fontSize: 13, fontWeight: 800, padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #2a2", background: "#0f1f0f", color: "#8ee98e" }}
                        title="Accept request"
                      >
                        Accept
                      </button>
                      <button
                        onClick={(e) => handleDeclineIncoming(e, u, i)}
                        style={{ fontSize: 13, fontWeight: 800, padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #641f1f", background: "#1a0f0f", color: "#ff9a9a" }}
                        title="Decline request"
                      >
                        Decline
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => handleAddFriend(e, u, i)}
                      style={{ fontSize: 13, fontWeight: 700, padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #444", background: "#000", color: "#ffe066" }}
                    >
                      Add Friend
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
