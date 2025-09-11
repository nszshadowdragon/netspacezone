import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaBell, FaCheck, FaTimes, FaUndoAlt, FaSpinner } from "react-icons/fa";
import { useNotifications } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { useFriends } from "../context/FriendsContext";
import useFriendship from "../hooks/useFriendship";
import FriendsAPI from "../services/friends";
import AvatarImg from "./AvatarImg";
import socket from "../socket";

/* ---------- helpers ---------- */
function timeAgo(d) {
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    const s = Math.floor((Date.now() - date.getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleString();
  } catch { return ""; }
}
function getProfileImageSrc(src) {
  if (!src) return "/profilepic.jpg";
  if (src.startsWith("http")) return src;
  if (src.startsWith("/uploads")) {
    const isLocal = /localhost|127\.0\.0\.1/.test(window.location.hostname);
    const base = import.meta?.env?.VITE_API_BASE_URL || (isLocal ? "http://localhost:5000" : "");
    return `${(base || "").replace(/\/$/, "")}${src}`;
  }
  return src;
}
function useOutsideClose(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) onClose?.(); }
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

/* ---------- request lists (Requests tab) ---------- */
function useRequestLists(open, tab) {
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const reload = useCallback(async () => {
    if (!open) return;
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
  }, [open, tab]);

  useEffect(() => { reload(); }, [reload]);

  return { incoming, setIncoming, outgoing, setOutgoing, loading, err, reload };
}

/* ---------- shared RequestRow ---------- */
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

  // Local broadcast (ProfilePage/useFriendship listens)
  const broadcast = (type, id) => {
    try { window.dispatchEvent(new CustomEvent("nsz:friend", { detail: { type, otherId: id } })); } catch {}
    try {
      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel("nsz:friend");
        bc.postMessage({ type, otherId: id });
        bc.close();
      }
    } catch {}
  };

  return (
    <div className="nb-row">
      <div className="nb-rowL">
        <AvatarImg user={{ _id: otherId, username: otherUsername, profileImage: u.profileImage }} size={36} />
        <div className="nb-rowUser">
          <div className="nb-name">@{otherUsername || "user"}</div>
          <div className="nb-sub">{mode === "incoming" ? "sent you a request" : "you sent a request"}</div>
        </div>
      </div>
      <div className="nb-rowR">
        {mode === "incoming" ? (
          <>
            <button
              className="nb-btn gold"
              disabled={busy}
              onClick={async () => { broadcast("accepted", otherId); onDone?.(otherId, "accept"); await accept(); }}
              title="Accept"
            >
              {busy ? <FaSpinner className="spin" /> : <FaCheck />}
            </button>
            <button
              className="nb-btn"
              disabled={busy}
              onClick={async () => { broadcast("declined", otherId); onDone?.(otherId, "decline"); await decline(); }}
              title="Decline"
            >
              {busy ? <FaSpinner className="spin" /> : <FaTimes />}
            </button>
          </>
        ) : (
          <button
            className="nb-btn"
            disabled={busy}
            onClick={async () => { broadcast("canceled", otherId); onDone?.(otherId, "cancel"); await cancel(); }}
            title="Cancel"
          >
            {busy ? <FaSpinner className="spin" /> : <FaUndoAlt />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- main bell ---------- */
export default function NotificationBell({ className, onViewAll }) {
  const { user, loading: authLoading } = useAuth();

  // All tab
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markOneRead,
    markAllRead,
    removeNotification: _removeNotification,
    clearOne: _clearOne,
  } = useNotifications();
  const removeNotification = _removeNotification || _clearOne;

  // Counts / Requests tab
  const { counts, refreshCounts, setCounts } = useFriends();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("all");
  const [reqTab, setReqTab] = useState("incoming");

  const wrapRef = useOutsideClose(open, () => setOpen(false));

  const { incoming, setIncoming, outgoing, setOutgoing, loading: reqLoading, err: reqErr, reload } =
    useRequestLists(open && tab === "requests", reqTab);

  // ---------- NEW: All-tab fallback to Friends incoming ----------
  const [allIncoming, setAllIncoming] = useState([]);
  const [allIncomingLoading, setAllIncomingLoading] = useState(false);
  const loadAllIncoming = useCallback(async () => {
    setAllIncomingLoading(true);
    try {
      const r = await FriendsAPI.listIncoming();
      if (r.ok) setAllIncoming(Array.isArray(r.data) ? r.data : r.data?.results || []);
    } finally { setAllIncomingLoading(false); }
  }, []);

  // Fetch notifications when panel opens
  const lastFetchRef = useRef(0);
  const maybeFetchAll = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 1200) return;
    lastFetchRef.current = now;
    await fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!authLoading && user && open && tab === "all") {
      // Always try both: notifications + fallback incoming
      maybeFetchAll(true);
      loadAllIncoming();
    }
  }, [authLoading, user, open, tab, maybeFetchAll, loadAllIncoming]);

  // Socket counts refresh
  useEffect(() => {
    const bump = () => { refreshCounts(); if (open && tab === "all") maybeFetchAll(false); };
    socket.on("friend:request:created", bump);
    socket.on("friend:request:canceled", bump);
    socket.on("friend:accepted", bump);
    socket.on("friend:declined", bump);
    socket.on("friend:removed", bump);
    return () => {
      socket.off("friend:request:created", bump);
      socket.off("friend:request:canceled", bump);
      socket.off("friend:accepted", bump);
      socket.off("friend:declined", bump);
      socket.off("friend:removed", bump);
    };
  }, [open, tab, refreshCounts, maybeFetchAll]);

  // Badge = unread notifications + incoming requests
  const totalBadge = Math.max(0, Number(unreadCount || 0) + Number(counts?.incoming || 0));

  // Helpers
  const currentList = reqTab === "incoming" ? incoming : outgoing;
  const setCurrentList = reqTab === "incoming" ? setIncoming : setOutgoing;

  const adjCounts = useCallback((delta) => {
    setCounts?.((prev) => ({
      incoming: Math.max(0, (prev?.incoming || 0) + (delta.incoming || 0)),
      outgoing: Math.max(0, (prev?.outgoing || 0) + (delta.outgoing || 0)),
      friends: Math.max(0, (prev?.friends || 0) + (delta.friends || 0)),
    }));
  }, [setCounts]);

  // Clear friend_request in All by actor id
  const clearFriendRequestByActor = useCallback((actorId) => {
    notifications.forEach((n) => {
      if (n?.type === "friend_request" && String(n?.actor?._id || "") === String(actorId || "")) {
        try { markOneRead?.(n._id); removeNotification?.(n._id); } catch {}
      }
    });
    // also remove from fallback list
    setAllIncoming((curr) => curr.filter((r) =>
      String(
        (r.fromUser && (r.fromUser._id || r.fromUser.id)) ||
        r.fromUserId || r.userId || r.from || ""
      ) !== String(actorId || "")
    ));
  }, [notifications, markOneRead, removeNotification]);

  return (
    <div ref={wrapRef} className={className} style={{ position: "relative" }}>
      <button aria-label="Notifications" onClick={() => setOpen((v) => !v)} className="nb-bell">
        <FaBell />
        {totalBadge > 0 && <span className="nb-badge">{totalBadge > 99 ? "99+" : totalBadge}</span>}
      </button>

      {open && (
        <div className="nb-panel">
          {/* Tabs */}
          <div className="nb-tabs">
            <button className={`nb-tab ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>All</button>
            <button className={`nb-tab ${tab === "requests" ? "active" : ""}`} onClick={() => { setTab("requests"); reload(); }}>
              Requests{counts?.incoming ? ` (${counts.incoming})` : ""}
            </button>
            <div className="nb-spacer" />
            {tab === "all" ? (
              <>
                <button onClick={() => { maybeFetchAll(true); loadAllIncoming(); }} className="nb-ctrl" title="Refresh">Refresh</button>
                <button onClick={markAllRead} className={`nb-ctrl ${unreadCount === 0 ? "disabled" : ""}`} disabled={unreadCount === 0} title="Mark all read">Mark all read</button>
              </>
            ) : (
              <button onClick={() => reload()} className="nb-ctrl" title="Refresh requests">↻</button>
            )}
          </div>

          {/* Body */}
          {tab === "all" ? (
            <div className="nb-body">
              {/* First try NotificationContext items */}
              {notifications.length > 0 ? (
                notifications.map((n) => {
                  if (n.type === "friend_request") {
                    const actorId = n?.actor?._id || "";
                    const item = {
                      fromUserId: actorId,
                      fromUser: n?.actor ? { _id: n.actor._id, username: n.actor.username, profileImage: n.actor.profileImage } : null,
                      createdAt: n.createdAt,
                    };
                    return (
                      <div key={n._id} style={{ padding: "8px 8px 0" }}>
                        <RequestRow
                          item={item}
                          mode="incoming"
                          onDone={(actor, action) => {
                            // Clear entry from All & Requests & counts
                            try { markOneRead?.(n._id); removeNotification?.(n._id); } catch {}
                            setIncoming((curr) =>
                              Array.isArray(curr)
                                ? curr.filter((r) => String(r.fromUserId || r.userId || r.from) !== String(actor || actorId))
                                : curr
                            );
                            if (action === "accept") adjCounts({ incoming: -1, friends: +1 });
                            else if (action === "decline") adjCounts({ incoming: -1 });
                            refreshCounts();
                          }}
                        />
                      </div>
                    );
                  }
                  // Other notif types (if used)
                  return (
                    <div key={n._id} className={`nb-item ${n.read ? "read" : "unread"}`}>
                      <img src={getProfileImageSrc(n?.actor?.profileImage || n?.fromProfileImage)} alt={n?.actor?.username || "user"} className="nb-avatar" />
                      <div className="nb-content">
                        <div className="nb-line">
                          <strong>@{n?.actor?.username || "Someone"}</strong>{" "}
                          <span>{String(n.message || "").replace(n?.actor?.username || "", "").trim()}</span>
                        </div>
                        <div className="nb-time">{timeAgo(n.createdAt)}</div>
                      </div>
                      {!n.read && <button onClick={() => markOneRead?.(n._id)} className="nb-mark">Mark read</button>}
                    </div>
                  );
                })
              ) : (
                // ---------- NEW: Fallback to Friends incoming ----------
                <>
                  {allIncomingLoading && <div className="nb-empty"><FaSpinner className="spin" /> Loading…</div>}
                  {!allIncomingLoading && allIncoming.length === 0 && (
                    <div className="nb-empty">No notifications yet.</div>
                  )}
                  {!allIncomingLoading && allIncoming.length > 0 && (
                    <div className="nb-list" style={{ padding: "8px" }}>
                      {allIncoming.map((row, i) => (
                        <RequestRow
                          key={i}
                          item={row}
                          mode="incoming"
                          onDone={(actorId, action) => {
                            // remove from fallback and keep counts in sync
                            setAllIncoming((curr) =>
                              curr.filter((r) =>
                                String(
                                  (r.fromUser && (r.fromUser._id || r.fromUser.id)) ||
                                  r.fromUserId || r.userId || r.from || ""
                                ) !== String(actorId || "")
                              )
                            );
                            clearFriendRequestByActor(actorId);
                            if (action === "accept") adjCounts({ incoming: -1, friends: +1 });
                            else if (action === "decline") adjCounts({ incoming: -1 });
                            refreshCounts();
                          }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            // ---------- Requests tab ----------
            <div className="nb-body">
              <div className="nb-reqTabs">
                <button className={`nb-reqTab ${reqTab === "incoming" ? "active" : ""}`} onClick={() => setReqTab("incoming")}>
                  Incoming{counts?.incoming ? ` (${counts.incoming})` : ""}
                </button>
                <button className={`nb-reqTab ${reqTab === "outgoing" ? "active" : ""}`} onClick={() => setReqTab("outgoing")}>
                  Sent{counts?.outgoing ? ` (${counts.outgoing})` : ""}
                </button>
              </div>

              {reqLoading && <div className="nb-empty"><FaSpinner className="spin" /> Loading…</div>}
              {!reqLoading && reqErr && <div className="nb-empty">Error: {reqErr}</div>}
              {!reqLoading && !reqErr && currentList.length === 0 && (
                <div className="nb-empty">No {reqTab === "incoming" ? "incoming" : "sent"} requests.</div>
              )}

              {!reqLoading && !reqErr && currentList.length > 0 && (
                <div className="nb-list">
                  {currentList.map((item, i) => (
                    <RequestRow
                      key={i}
                      item={item}
                      mode={reqTab}
                      onDone={(actorId, action) => {
                        setCurrentList((curr) => { const next = curr.slice(); next.splice(i, 1); return next; });
                        clearFriendRequestByActor(actorId);
                        if (reqTab === "incoming") {
                          if (action === "accept") adjCounts({ incoming: -1, friends: +1 });
                          else if (action === "decline") adjCounts({ incoming: -1 });
                        } else if (reqTab === "outgoing" && action === "cancel") {
                          adjCounts({ outgoing: -1 });
                        }
                        refreshCounts();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* styles */}
      <style>{`
        .nb-bell{ position:relative; display:inline-flex; align-items:center; justify-content:center; width:38px; height:38px; border-radius:10px; border:1px solid #2b2b2b; background:#141414; color:#ffe066; cursor:pointer; }
        .nb-badge{ position:absolute; top:-6px; right:-6px; min-width:18px; height:18px; padding:0 5px; border-radius:999px; background:#ff4d4f; color:#fff; font-size:11px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #400; }
        .nb-panel{ position:absolute; right:0; top:calc(100% + 8px); width:min(420px, 92vw); max-height:70vh; overflow:hidden; z-index:1000; background:#0f0f0f; border:1px solid #2a2a2a; border-radius:12px; box-shadow:0 12px 40px rgba(0,0,0,.5); }
        .nb-tabs{ display:flex; align-items:center; gap:6px; padding:8px; border-bottom:1px solid #222; background:linear-gradient(180deg, rgba(255,224,102,.06), transparent); }
        .nb-tab{ padding:6px 10px; border-radius:8px; border:1px solid #2b2b2b; background:#141414; color:#ffe066; cursor:pointer; font-weight:700; font-size:13px; }
        .nb-tab.active{ background:#1b1b1b; box-shadow:inset 0 0 0 1px #333; }
        .nb-spacer{ flex:1; }
        .nb-ctrl{ padding:6px 10px; border-radius:8px; border:1px solid #2b2b2b; background:#141414; color:#ffe066; cursor:pointer; font-weight:700; }
        .nb-body{ max-height:60vh; overflow:auto; }
        .nb-empty{ padding:18px; color:#bbb; font-size:13px; display:flex; align-items:center; gap:8px; justify-content:center; }
        .spin{ animation:spin .8s linear infinite; } @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        .nb-list{ padding:6px 8px 10px; display:flex; flex-direction:column; gap:8px; }
        .nb-row{ display:grid; grid-template-columns:1fr auto; align-items:center; gap:10px; padding:8px; border:1px solid #262626; border-radius:10px; background:#121212; }
        .nb-rowL{ display:flex; align-items:center; gap:10px; min-width:0; }
        .nb-rowUser{ min-width:0; }
        .nb-name{ font-weight:700; color:#ffe066; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
        .nb-sub{ font-size:12px; color:#9a9a9a; }
        .nb-rowR{ display:flex; align-items:center; gap:6px; }
        .nb-btn{ width:34px; height:34px; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; border:1px solid #2a2a2a; background:#1a1a1a; color:#ffe066; cursor:pointer; }
        .nb-btn.gold{ background:#ffe066; color:#111; border-color:#deb64c; }
      `}</style>
    </div>
  );
}
