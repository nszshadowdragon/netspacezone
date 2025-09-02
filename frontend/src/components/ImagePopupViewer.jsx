// frontend/src/components/ImagePopupViewer.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import socket, { connectSocket, joinGallery, leaveGallery } from "../socket";
import { useAuth } from "../context/AuthContext";

const ACCENT = "#ffe066";
const HEADER_H = 56;
const GAP = 12;
const RADIUS = 14;

/* ---------------- env + api ---------------- */
function apiBase() {
  const env = (import.meta.env?.VITE_API_BASE || "").replace(/\/$/, "");
  if (env) return env;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" ? "http://localhost:5000" : "";
}
async function patchImage({ ownerId, filename, body }) {
  const res = await fetch(`${apiBase()}/api/gallery/${encodeURIComponent(filename)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: ownerId, ...body }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to save"));
  try { return await res.json(); } catch { return null; }
}
async function deleteImageReq({ ownerId, filename }) {
  const url = `${apiBase()}/api/gallery/${encodeURIComponent(filename)}?accountId=${encodeURIComponent(ownerId)}`;
  const res = await fetch(url, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to delete"));
  return true;
}

/* ---------------- helpers ---------------- */
const idOf = (im) => String(im?._id || im?.id || im?.filename || "");
const valId = (v) => String(v?._id || v?.id || v || "");
const timeago = (d) => {
  if (!d) return "";
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d`;
  return new Date(t).toLocaleString();
};
function buildSrc(x, host = "") {
  if (!x) return "";
  if (typeof x === "string") return x;
  const p = x.path || x.url || x.src || x.filename || "";
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith?.("/uploads/")) return `${host}${p}`;
  if (p.startsWith?.("/")) return p;
  return `/${p}`;
}
function pickAvatar(u) {
  if (!u) return "";
  return (
    u.profilePic || u.profileImage || u.avatar || u.avatarUrl ||
    u.photoUrl || u.photoURL || u.picture || ""
  );
}
function initialOf(name) {
  return (name || "U").trim().charAt(0).toUpperCase();
}

/* ---------------- component ---------------- */
export default function ImagePopupViewer({
  images = [],
  popupIndex = 0,
  closePopup,
  updateGalleryImage,
  ownerId,
  fileHost = "",
}) {
  const { user } = useAuth();
  const meId = useMemo(() => valId(user), [user]);

  const [idx, setIdx] = useState(Math.max(0, Math.min(popupIndex, images.length - 1)));
  const current = images[idx] || null;
  const prevExists = idx > 0;
  const nextExists = idx < images.length - 1;

  // lock background scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // deep-link ?image=<id>, restore on unmount
  const initialUrlRef = useRef(typeof window !== "undefined" ? window.location.href : "");
  useEffect(() => {
    if (!current) return;
    const url = new URL(window.location.href);
    url.searchParams.set("image", idOf(current));
    window.history.replaceState({}, "", url.toString());
    return () => {
      try { const clean = new URL(initialUrlRef.current); window.history.replaceState({}, "", clean.toString()); } catch {}
    };
  }, [current]);

  // keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); closePopup?.(); }
      if (e.key === "ArrowLeft" && prevExists) { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
      if (e.key === "ArrowRight" && nextExists) { e.preventDefault(); setIdx((i) => Math.min(images.length - 1, i + 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevExists, nextExists, closePopup, images.length]);

  // preload neighbors
  useEffect(() => {
    const preload = (i) => {
      const im = images[i]; if (!im) return;
      const s = buildSrc(im, fileHost); if (!s) return;
      const pic = new Image(); pic.src = s;
    };
    if (nextExists) preload(idx + 1);
    if (prevExists) preload(idx - 1);
  }, [idx, images, prevExists, nextExists, fileHost]);

  // caption + reactions
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(current?.caption || "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setCaption(current?.caption || ""); setEditing(false); setSaving(false); }, [idx, current]);

  const likesArr = Array.isArray(current?.likes) ? current.likes : [];
  const dislikesArr = Array.isArray(current?.dislikes) ? current.dislikes : [];
  const iLike = meId && likesArr.map(valId).includes(meId);
  const iDislike = meId && dislikesArr.map(valId).includes(meId);

  const [working, setWorking] = useState(false);
  const optimisticUpdate = (next) => updateGalleryImage?.(next);

  async function toggleReaction(kind) {
    if (!current || working) return;
    setWorking(true);
    try {
      const idMe = meId;
      const curLikes = Array.isArray(current.likes) ? current.likes.map(valId) : [];
      const curDislikes = Array.isArray(current.dislikes) ? current.dislikes.map(valId) : [];

      let nextLikes = [...curLikes];
      let nextDislikes = [...curDislikes];

      if (kind === "like") {
        if (nextLikes.includes(idMe)) {
          nextLikes = nextLikes.filter((x) => x !== idMe);
        } else {
          nextLikes.push(idMe);
          nextDislikes = nextDislikes.filter((x) => x !== idMe);
        }
      } else {
        if (nextDislikes.includes(idMe)) {
          nextDislikes = nextDislikes.filter((x) => x !== idMe);
        } else {
          nextDislikes.push(idMe);
          nextLikes = nextLikes.filter((x) => x !== idMe);
        }
      }

      // optimistic
      optimisticUpdate({ ...current, likes: nextLikes, dislikes: nextDislikes, reactions: undefined });

      const saved = await patchImage({
        ownerId,
        filename: current.filename || idOf(current),
        body: { likes: nextLikes, dislikes: nextDislikes },
      });

      if (saved) optimisticUpdate(saved);
    } catch {
      // optional: toast
    } finally {
      setWorking(false);
    }
  }

  async function saveCaption() {
    if (!current || saving) return;
    setSaving(true);
    try {
      const saved = await patchImage({
        ownerId,
        filename: current.filename || idOf(current),
        body: { caption: caption || "" },
      });
      if (saved) optimisticUpdate(saved);
      setEditing(false);
    } catch {
      // optional: toast
    } finally {
      setSaving(false);
    }
  }

  // realtime: gallery updates + presence
  const [online, setOnline] = useState(false);
  useEffect(() => {
    connectSocket();
    if (ownerId) joinGallery(String(ownerId));

    const onGalleryUpdated = (evt) => {
      const updated = evt?.payload || evt || null;
      if (!updated) return;
      if (idOf(updated) === idOf(current)) optimisticUpdate(updated);
    };
    const onPresence = (p) => {
      if (p?.userId && ownerId && String(p.userId) === String(ownerId)) setOnline(!!p.online);
    };

    socket.on("gallery:image:updated", onGalleryUpdated);
    socket.on("presence:update", onPresence);

    return () => {
      socket.off("gallery:image:updated", onGalleryUpdated);
      socket.off("presence:update", onPresence);
      if (ownerId) leaveGallery(String(ownerId));
    };
  }, [ownerId, current]);

  if (!current) return null;
  const src = buildSrc(current, fileHost);

  const ownerUser = current?.user || current?.owner || {};
  const ownerName = ownerUser?.username || ownerUser?.name || "User";
  const ownerAvatar = pickAvatar(ownerUser);
  const when = timeago(current?.createdAt);

  /* ---------------- styles ---------------- */
  const overlay = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0,0,0,0.92)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: `max(${GAP}px, env(safe-area-inset-top))`,
    paddingRight: `max(${GAP}px, env(safe-area-inset-right))`,
    paddingBottom: `max(${GAP}px, env(safe-area-inset-bottom))`,
    paddingLeft: `max(${GAP}px, env(safe-area-inset-left))`,
  };
  const frame = {
    position: "relative",
    width: "min(1600px, 100%)",
    height: "100%",
    border: "1px solid #2d2d2d",
    borderRadius: RADIUS,
    overflow: "hidden",
    boxShadow: "0 10px 40px rgba(0,0,0,.55)",
    background: "#050505",
    display: "grid",
    gridTemplateColumns: "380px 1fr",
    columnGap: 12,
  };
  const responsive = `
    @media (max-width: 980px) {
      .iv-frame      { grid-template-columns: 1fr; }
      .iv-meta       { width: 100%; max-height: 48vh; border-right: none; border-top: 1px solid #262626; }
      .iv-stageWrap  { order: -1; }
      .iv-navZone    { width: 72px; }
      .iv-countBadge { left: 10px !important; top: 10px !important; }
    }
  `;
  const header = {
    position: "absolute", top: 8, right: 8, height: HEADER_H,
    display: "flex", alignItems: "center", justifyContent: "flex-end",
    pointerEvents: "none",
  };
  const closeBtn = {
    pointerEvents: "auto",
    border: "1px solid #2d2d2d",
    background: "rgba(0,0,0,.55)",
    color: "#eee",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 800,
  };

  // RIGHT: image stage
  const stageWrap = { position: "relative", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" };
  const stage = { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" };
  const media = { maxWidth: "100%", maxHeight: `calc(100% - ${HEADER_H}px)`, objectFit: "contain", display: "block" };
  const navZone = (side) => ({
    position: "absolute", top: 0, bottom: 0, [side]: 0, width: 96,
    display: "flex", alignItems: "center", justifyContent: side === "left" ? "flex-start" : "flex-end",
    padding: "0 10px", cursor: "pointer",
    background: `linear-gradient(${side === "left" ? "to right" : "to left"}, rgba(0,0,0,.35), transparent)`,
    userSelect: "none",
  });
  const navBtn = {
    width: 44, height: 44, borderRadius: "9999px",
    border: "1px solid #2d2d2d", background: "rgba(0,0,0,.55)",
    color: "#eee", fontSize: 28, lineHeight: "42px", textAlign: "center", fontWeight: 900,
  };

  // count badge — now inside the RIGHT pane (stageWrap) top-left
  const countBadge = {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 2,
    border: "1px solid #2d2d2d",
    background: "rgba(0,0,0,.55)",
    color: "#ddd",
    borderRadius: 10,
    padding: "6px 10px",
    fontWeight: 800,
    pointerEvents: "none",
  };

  // LEFT: details/meta (VERTICAL ONLY; no horizontal scroll)
  const side = {
    position: "relative",
    width: 380,
    padding: "14px",
    color: "#ddd",
    overflowY: "auto",
    overflowX: "hidden",
    borderRight: "1px solid #262626",
    overscrollBehavior: "contain",
  };
  const topRow = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 8, marginBottom: 8,
  };
  const userWrap = { display: "flex", alignItems: "center", gap: 10, minWidth: 0 };
  const avatarStyle = {
    width: 36, height: 36, borderRadius: "9999px", background: "#111",
    border: "1px solid #2d2d2d", overflow: "hidden", display: "grid", placeItems: "center",
    color: "#ccc", fontWeight: 900,
  };
  const dot = (on) => ({ width: 8, height: 8, borderRadius: 9999, background: on ? "#16a34a" : "#555", boxShadow: on ? "0 0 8px rgba(22,163,74,.7)" : "none" });
  const userName = { fontWeight: 900, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const sub = { opacity: 0.75, fontSize: 12 };
  const divider = { borderTop: "1px solid #262626", margin: "10px 0" };

  const iconBtn = (active) => ({
    display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
    border: "1px solid #2d2d2d", background: "#121212",
    color: active ? ACCENT : "#bbb", borderRadius: 10, padding: "6px 10px", fontWeight: 800,
  });
  const countsRow = { display: "flex", gap: 10, alignItems: "center", marginTop: 10 };

  const captionBox = { whiteSpace: "pre-wrap", lineHeight: 1.45, overflowWrap: "anywhere", wordBreak: "break-word", marginTop: 10 };
  const editArea = { width: "100%", minHeight: 80, resize: "vertical", background: "#0e0e0e", color: "#eee", border: "1px solid #2d2d2d", borderRadius: 10, padding: 10 };
  const editRow = { display: "flex", gap: 8, marginTop: 8 };
  const editBtn = { border: "1px solid #2d2d2d", background: "#1a1a1a", color: ACCENT, borderRadius: 10, padding: "8px 12px", fontWeight: 800 };

  // 3-dot menu
  const [menuOpen, setMenuOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const actionsIconBtn = {
    width: 36, height: 32, display: "grid", placeItems: "center",
    border: "1px solid #2d2d2d", background: "#121212", color: ACCENT,
    borderRadius: 8, fontSize: 18, lineHeight: 1,
  };
  const menu = {
    position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 20,
    background: "#0b0b0b", border: "1px solid #262626", borderRadius: 10, minWidth: 220,
    boxShadow: "0 8px 24px rgba(0,0,0,.5)", overflow: "hidden",
  };
  const item = {
    display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
    color: "#ddd", background: "transparent", border: "none", cursor: "pointer",
  };
  const itemDanger = { ...item, color: "#f87171" };

  /* ---------------- UI ---------------- */
  const [copied, setCopied] = useState(false);
  async function copyShare() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("image", idOf(current));
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  async function onDelete() {
    if (!current || deleting) return;
    const filename = current.filename || idOf(current);
    const ok = window.confirm("Delete this image? This cannot be undone.");
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteImageReq({ ownerId, filename });
      // Close viewer; parent gallery will refresh via socket "gallery:image:deleted"
      closePopup?.();
    } catch (e) {
      alert(`Delete failed: ${e?.message || e}`);
    } finally {
      setDeleting(false);
      setMenuOpen(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" style={overlay} onClick={(e) => { if (e.target === e.currentTarget) closePopup?.(); }}>
      <style>{responsive}</style>

      <div className="iv-frame" style={frame} onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <div style={header}>
          <button onClick={closePopup} style={closeBtn} aria-label="Close image">✕</button>
        </div>

        {/* LEFT: meta */}
        <aside className="iv-meta" style={side}>
          <div style={topRow}>
            <div style={userWrap}>
              <div style={avatarStyle}>
                {ownerAvatar ? (
                  <img src={ownerAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span>{initialOf(ownerName)}</span>
                )}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={userName}>{ownerName}</span>
                  <span style={dot(online)} />
                </div>
                <div style={sub}>{when}</div>
              </div>
            </div>

            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                style={actionsIconBtn}
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="More actions"
              >
                ⋯
              </button>
              {menuOpen && (
                <div style={menu}>
                  {!editing && (
                    <button style={item} onClick={() => { setMenuOpen(false); setEditing(true); }}>
                      ✎ Edit caption
                    </button>
                  )}
                  <button style={item} onClick={() => { setMenuOpen(false); setShowInfo((v) => !v); }}>
                    {showInfo ? "Hide info" : "Show info"}
                  </button>
                  <button style={item} onClick={() => { setMenuOpen(false); copyShare(); }}>
                    {copied ? "✓ Link copied" : "🔗 Share link"}
                  </button>
                  <button style={itemDanger} onClick={onDelete} disabled={deleting}>
                    {deleting ? "Deleting…" : "🗑 Delete image"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={divider} />

          {/* Info panel (appears ABOVE caption when toggled) */}
          {showInfo && (
            <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8, overflowWrap: "anywhere", wordBreak: "break-word" }}>
              {current?.filename && <div><strong>File:</strong> {current.filename}</div>}
              {current?.createdAt && <div><strong>Uploaded:</strong> {new Date(current.createdAt).toLocaleString()}</div>}
            </div>
          )}

          {/* Caption */}
          {!editing ? (
            <div style={captionBox}>{current?.caption || <span style={{ opacity: 0.6 }}>No caption</span>}</div>
          ) : (
            <>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption…"
                style={editArea}
              />
              <div style={editRow}>
                <button style={editBtn} onClick={saveCaption} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button style={editBtn} onClick={() => { setCaption(current?.caption || ""); setEditing(false); }} disabled={saving}>
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Reactions: icon buttons */}
          <div style={countsRow}>
            <button
              style={iconBtn(iLike)}
              onClick={() => toggleReaction("like")}
              aria-pressed={iLike}
              title={iLike ? "Unlike" : "Like"}
            >
              👍 <span>{likesArr.length}</span>
            </button>
            <button
              style={iconBtn(iDislike)}
              onClick={() => toggleReaction("dislike")}
              aria-pressed={iDislike}
              title={iDislike ? "Undo dislike" : "Dislike"}
            >
              👎 <span>{dislikesArr.length}</span>
            </button>
          </div>

          <div style={divider} />

          {/* Comments placeholder */}
          <div style={{ padding: "10px 0", color: "#aaa", fontStyle: "italic" }}>
            💬 Comments coming soon
          </div>
        </aside>

        {/* RIGHT: image stage */}
        <div className="iv-stageWrap" style={stageWrap}>
          {/* Image count badge is now inside the right pane */}
          <div className="iv-countBadge" style={countBadge}>
            {images.length ? `${idx + 1} / ${images.length}` : ""}
          </div>

          <div className="iv-stage" style={stage}>
            {prevExists && (
              <div
                className="iv-navZone"
                style={navZone("left")}
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                aria-label="Previous image"
              >
                <div style={navBtn}>‹</div>
              </div>
            )}

            <img src={src} alt={current?.caption || ""} style={media} />

            {nextExists && (
              <div
                className="iv-navZone"
                style={navZone("right")}
                onClick={() => setIdx((i) => Math.min(images.length - 1, i + 1))}
                aria-label="Next image"
              >
                <div style={navBtn}>›</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
