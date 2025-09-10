// frontend/src/components/NotificationsPopup.jsx
import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useNotifications } from "../context/NotificationContext";
import { useFriends } from "../context/FriendsContext";
import FriendsAPI from "../services/friends";
import useFriendship from "../hooks/useFriendship";
import AvatarImg from "./AvatarImg";

const NOTIFICATION_TYPES = [
  { type: "like", label: "Likes" },
  { type: "comment", label: "Comments" },
  { type: "reply", label: "Replies" },
  { type: "friend_request", label: "Friend Requests" },
  { type: "follow", label: "Follows" },
  { type: "system", label: "System" },
];

function timeAgo(dateStr) {
  try {
    const date = new Date(dateStr);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleString();
  } catch {
    return "";
  }
}

// ----- Requests helpers -----
function useRequestLists(tab) {
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      if (tab === "incoming") {
        const { ok, data, error } = await FriendsAPI.listIncoming();
        if (ok) setIncoming(Array.isArray(data) ? data : []);
        else setErr(error || "Failed to load");
      } else {
        const { ok, data, error } = await FriendsAPI.listOutgoing();
        if (ok) setOutgoing(Array.isArray(data) ? data : []);
        else setErr(error || "Failed to load");
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { reload(); }, [reload]);
  return { incoming, setIncoming, outgoing, setOutgoing, loading, err, reload };
}

function RequestRow({ item, mode, onDone }) {
  const u =
    item.user ||
    (mode === "incoming" ? item.fromUser || item.from || item.sender : item.toUser || item.to || item.receiver) ||
    {};
  const otherId =
    (mode === "incoming"
      ? item.fromUserId || item.from || item.userId
      : item.toUserId || item.to || item.userId) ||
    u._id ||
    u.id ||
    "";
  const otherUsername =
    item.username || u.username || item.fromUsername || item.toUsername || "";

  const { busy, accept, decline, cancel } = useFriendship({ userId: otherId, username: otherUsername });

  return (
    <div className="np-row">
      <div className="np-rowL">
        <AvatarImg user={{ _id: otherId, username: otherUsername, profileImage: u.profileImage }} size={40} />
        <div className="np-user">
          <div className="np-name">@{otherUsername || "user"}</div>
          <div className="np-sub">{mode === "incoming" ? "sent you a request" : "you sent a request"}</div>
        </div>
      </div>
      <div className="np-rowR">
        {mode === "incoming" ? (
          <>
            <button className="np-accept" disabled={busy} onClick={async () => { const r = await accept(); if (r.ok) onDone?.(); }}>
              Accept
            </button>
            <button className="np-decline" disabled={busy} onClick={async () => { const r = await decline(); if (r.ok) onDone?.(); }}>
              Decline
            </button>
          </>
        ) : (
          <button className="np-cancel" disabled={busy} onClick={async () => { const r = await cancel(); if (r.ok) onDone?.(); }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function NotificationsPopup({ onClose }) {
  // Existing notifications context
  const {
    notifications,
    filterState,
    setFilterState,
    markAllRead,
    clearOne,
    clearAll,
  } = useNotifications();

  // For requests tab badge
  const { counts, refreshCounts } = useFriends();

  // Local tabs
  const [tab, setTab] = useState("all"); // 'all' | 'requests'
  const [reqTab, setReqTab] = useState("incoming"); // 'incoming' | 'outgoing'

  // Requests lists
  const { incoming, setIncoming, outgoing, setOutgoing, loading, err, reload } = useRequestLists(reqTab);
  const currentList = reqTab === "incoming" ? incoming : outgoing;
  const setCurrentList = reqTab === "incoming" ? setIncoming : setOutgoing;

  const filteredAll = useMemo(
    () => notifications.filter((n) => filterState?.[n.type] !== false),
    [notifications, filterState]
  );

  const toggleFilter = (type) => {
    setFilterState((f) => ({ ...f, [type]: f[type] === false ? true : false }));
  };

  // Friend request actions inside "All" tab cards
  const onAcceptFromAll = useCallback(
    async (n) => {
      const otherUsername = n?.actor?.username || n?.fromUsername || "";
      const otherId = n?.actor?._id || n?.fromUserId || "";
      await FriendsAPI.acceptRequest({ fromUserId: otherId, username: otherUsername });
      refreshCounts();
      clearOne(n._id);
    },
    [clearOne, refreshCounts]
  );
  const onDeclineFromAll = useCallback(
    async (n) => {
      const otherUsername = n?.actor?.username || n?.fromUsername || "";
      const otherId = n?.actor?._id || n?.fromUserId || "";
      await FriendsAPI.declineRequest({ fromUserId: otherId, username: otherUsername });
      refreshCounts();
      clearOne(n._id);
    },
    [clearOne, refreshCounts]
  );

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, width: "100%", height: "100vh",
        background: "rgba(15,15,20,0.97)", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)"
      }}
      onClick={onClose}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 20, right: 25,
          fontSize: 28, color: "#ffe066",
          background: "transparent", border: "none",
          cursor: "pointer", zIndex: 10000
        }}
      >
        ✕
      </button>

      <div
        style={{
          background: "#1a1c23", borderRadius: 20, minWidth: 400, maxWidth: 700,
          width: "min(98vw, 640px)", boxShadow: "0 8px 44px #000d",
          padding: 0, position: "relative", border: "2px solid #292b36",
          maxHeight: "90vh", display: "flex", flexDirection: "column"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with tabs */}
        <div style={{
          padding: "14px 16px", borderBottom: "1px solid #252525",
          display: "flex", alignItems: "center", gap: 8
        }}>
          <button
            className={`np-tab ${tab === "all" ? "active" : ""}`}
            onClick={() => setTab("all")}
          >
            All
          </button>
          <button
            className={`np-tab ${tab === "requests" ? "active" : ""}`}
            onClick={() => { setTab("requests"); reload(); }}
          >
            Requests{counts?.incoming ? ` (${counts.incoming})` : ""}
          </button>
          <div style={{ flex: 1 }} />
          {tab === "all" ? (
            <>
              <button onClick={markAllRead} className="np-btn gold">Mark All Read</button>
              <button onClick={clearAll} className="np-btn danger">Clear All</button>
              <button onClick={reload} className="np-btn">↻</button>
            </>
          ) : (
            <button onClick={reload} className="np-btn">↻</button>
          )}
        </div>

        {/* Filters (All tab only) */}
        {tab === "all" && (
          <div style={{ padding: 12, background: "#222229", color: "#ffe066", borderBottom: "1px solid #292b36" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Filter Types</div>
            {NOTIFICATION_TYPES.map(({ type, label }) => (
              <div key={type} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                <label style={{ flex: 1, cursor: "pointer" }}>{label}</label>
                <div
                  style={{
                    cursor: "pointer", width: 36, height: 20, borderRadius: 12,
                    background: filterState?.[type] !== false ? "#ffe066" : "#2d2d31",
                    position: "relative"
                  }}
                  onClick={() => toggleFilter(type)}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    background: filterState?.[type] !== false ? "#232323" : "#888",
                    position: "absolute", left: filterState?.[type] !== false ? 16 : 2, top: 2
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          {tab === "all" ? (
            filteredAll.length === 0 ? (
              <div style={{ color: "#ffe066", textAlign: "center", padding: 20 }}>
                No notifications yet.
              </div>
            ) : (
              filteredAll.map((n) => (
                <div
                  key={n._id}
                  style={{
                    background: n.read ? "#191919" : "#2e260f",
                    color: n.read ? "#ffe066a0" : "#ffe066",
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    padding: "10px 16px",
                    borderRadius: 8,
                    margin: "0 12px"
                  }}
                >
                  <a
                    href={`/profile/${n.actor?.username || n.fromUsername || ""}`}
                    onClick={onClose}
                    style={{ display: "flex", alignItems: "center" }}
                  >
                    <img
                      src={n?.actor?.profileImage ? (n.actor.profileImage.startsWith("/uploads")
                        ? `${(import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/,"")}${n.actor.profileImage}`
                        : n.actor.profileImage) : "/profilepic.jpg"}
                      alt={n.actor?.username || "User"}
                      style={{
                        width: 40, height: 40, borderRadius: "50%",
                        objectFit: "cover", border: "1.5px solid #444"
                      }}
                    />
                  </a>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      <span>@{n.actor?.username || "User"}</span>{" "}
                      <span>{String(n.message || "").replace(n.actor?.username || "", "").trim()}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#b7b378", marginTop: 2 }}>
                      {timeAgo(n.createdAt)}
                    </div>

                    {n.type === "friend_request" && (
                      <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                        <button onClick={() => onAcceptFromAll(n)} className="np-accept">Accept</button>
                        <button onClick={() => onDeclineFromAll(n)} className="np-decline">Decline</button>
                      </div>
                    )}
                  </div>
                  <button onClick={() => clearOne(n._id)} className="np-clear">✕</button>
                </div>
              ))
            )
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, padding: "0 12px" }}>
                <button className={`np-subtab ${reqTab === "incoming" ? "active" : ""}`} onClick={() => setReqTab("incoming")}>
                  Incoming{counts?.incoming ? ` (${counts.incoming})` : ""}
                </button>
                <button className={`np-subtab ${reqTab === "outgoing" ? "active" : ""}`} onClick={() => setReqTab("outgoing")}>
                  Sent{counts?.outgoing ? ` (${counts.outgoing})` : ""}
                </button>
              </div>

              {loading && <div className="np-empty">Loading…</div>}
              {!loading && err && <div className="np-empty">Error: {err}</div>}
              {!loading && !err && currentList.length === 0 && (
                <div className="np-empty">No {reqTab === "incoming" ? "incoming" : "sent"} requests.</div>
              )}

              {!loading && !err && currentList.length > 0 && (
                <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {currentList.map((item, i) => (
                    <RequestRow
                      key={i}
                      item={item}
                      mode={reqTab}
                      onDone={() => {
                        setCurrentList((curr) => {
                          const next = curr.slice();
                          next.splice(i, 1);
                          return next;
                        });
                        refreshCounts();
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* local styles */}
      <style>{`
        .np-tab{
          padding: 6px 10px; border-radius: 8px; border: 1px solid #2b2b2b; background:#141414; color:#ffe066;
          cursor:pointer; font-weight:700; font-size:13px;
        }
        .np-tab.active{ background:#1b1b1b; box-shadow: inset 0 0 0 1px #333; }

        .np-btn{ background:#333; color:#ffe066; padding:5px 10px; border:none; border-radius:6px; cursor:pointer; font-weight:600; }
        .np-btn.gold{ background:#ffe066; color:#000; }
        .np-btn.danger{ background:#f87171; color:#fff; }

        .np-subtab{
          padding:6px 10px; border-radius:8px; border:1px solid #2b2b2b; background:#141414; color:#ffe066; cursor:pointer; font-weight:700; font-size:13px;
        }
        .np-subtab.active{ background:#1b1b1b; box-shadow: inset 0 0 0 1px #333; }

        .np-empty{ color:#ffe066; text-align:center; padding:20px; }
        .np-row{
          display:grid; grid-template-columns: 1fr auto; align-items:center; gap:12px;
          padding:10px; border:1px solid #2a2a2a; border-radius:10px; background:#121212;
        }
        .np-rowL{ display:flex; align-items:center; gap:10px; }
        .np-user{}
        .np-name{ font-weight:700; color:#ffe066; }
        .np-sub{ font-size:12px; color:#9a9a9a; }
        .np-rowR{ display:flex; align-items:center; gap:8px; }
        .np-accept{ background:#10b981; color:#fff; border:none; border-radius:6px; padding:4px 10px; cursor:pointer; font-weight:600; }
        .np-decline{ background:#ef4444; color:#fff; border:none; border-radius:6px; padding:4px 10px; cursor:pointer; font-weight:600; }
        .np-cancel{ background:#444; color:#ffe066; border:none; border-radius:6px; padding:4px 10px; cursor:pointer; font-weight:600; }

        .np-clear{
          background:transparent; color:#f87171; border:none; font-size:18px; font-weight:700; cursor:pointer;
        }
      `}</style>
    </div>
  );
}
