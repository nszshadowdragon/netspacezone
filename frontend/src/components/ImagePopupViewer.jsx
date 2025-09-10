import React, { useEffect, useRef, useState, useMemo } from "react";
import socket, { connectSocket, joinGallery, leaveGallery } from "../socket";
import { useAuth } from "../context/AuthContext";

const ACCENT = "#ffe066";
const HEADER_H = 56;
const GAP = 12;
const RADIUS = 14;

/* ---------------- env + api ---------------- */
function apiBase() {
  const env = (import.meta.env?.VITE_API_BASE || import.meta.env?.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (env) return env;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" ? "http://localhost:5000" : "";
}
const REMOTE_UPLOADS = (import.meta.env?.VITE_REMOTE_UPLOADS_ORIGIN || "").replace(/\/$/, "");

/* Auth header helper (JWT) */
function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    ""
  );
}
function authHeaders(extra = {}) {
  const t = getToken();
  return t ? { ...extra, Authorization: `Bearer ${t}` } : extra;
}

/** fetch with timeout so UI never “hangs” */
async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function patchImage({ ownerId, filename, body }) {
  const res = await fetchWithTimeout(
    `${apiBase()}/api/gallery/${encodeURIComponent(filename)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ accountId: ownerId, ...body }),
    }
  );
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to save"));
  try { return await res.json(); } catch { return null; }
}

/** Robust delete: try id, then basename(filename), then full filename. Retry once. */
async function deleteByKey(ownerId, key) {
  const url = `${apiBase()}/api/gallery/${encodeURIComponent(key)}?accountId=${encodeURIComponent(ownerId)}`;
  const res = await fetchWithTimeout(url, { method: "DELETE", credentials: "include", headers: authHeaders() }, 8000);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${t.slice(0,120)}`);
  }
  return true;
}
function pickDeleteKeys(im) {
  const keys = [];
  const id = im?._id || im?.id;
  const filename = im?.filename || im?.path || im?.url || im?.src || "";
  if (id) keys.push(String(id));
  if (filename) {
    const base = String(filename).split("/").pop();
    if (base && !keys.includes(base)) keys.push(base);
    if (filename && !keys.includes(filename)) keys.push(String(filename));
  }
  return keys.filter(Boolean);
}
async function deleteImageSmart({ ownerId, image }) {
  let lastErr = "";
  const keys = pickDeleteKeys(image);
  for (const k of keys) {
    try { return await deleteByKey(ownerId, k); }
    catch (e) { lastErr = String(e?.message || e) || lastErr; }
  }
  await new Promise(r => setTimeout(r, 250));
  try { if (keys[0]) return await deleteByKey(ownerId, keys[0]); }
  catch (e) { lastErr = String(e?.message || e) || lastErr; }
  throw new Error(lastErr || "Delete failed");
}

/* ---------------- fallback image helpers ---------------- */
const DEFAULT_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'>
      <rect width='100%' height='100%' fill='#050505'/>
      <rect x='20' y='20' width='760' height='560' rx='16' fill='#111' stroke='#2d2d2d' stroke-width='3'/>
      <circle cx='400' cy='300' r='110' fill='#1a1a1a' stroke='#2d2d2d' stroke-width='3'/>
    </svg>`
  );

function fixLocalAbsolute(url) {
  try {
    const u = new URL(url);
    if (/localhost|127\.0\.0\.1/.test(u.hostname)) {
      u.protocol = "http:";
      u.hostname = "localhost";
      if (!u.port) u.port = "5000";
      return u.toString();
    }
  } catch {}
  return url;
}
function normalizeUploadsPath(raw) {
  const name = String(raw || "").replace(/^https?:\/\/.+$/i, "");
  const withLeading = name.startsWith("/") ? name : `/${name}`;
  const ensured = withLeading.startsWith("/uploads")
    ? withLeading
    : `/uploads${withLeading}`;
  const parts = ensured.split("/");
  const head = parts.slice(0, 2).join("/");
  const tail = parts.slice(2).map(encodeURIComponent).join("/");
  return tail ? `${head}/${tail}` : head;
}
function buildCandidatesFromImage(x, host = "") {
  // resolve something like {path|url|src|filename}
  const p0 = typeof x === "string" ? x : (x?.path || x?.url || x?.src || x?.filename || "");
  if (!p0) return [];
  if (/^https?:\/\//i.test(p0)) return [fixLocalAbsolute(p0)];
  const p = normalizeUploadsPath(p0);
  const out = [p, `${apiBase()}${p}`];
  if (host) out.push(`${host}${p}`);
  if (REMOTE_UPLOADS) out.push(`${REMOTE_UPLOADS}${p}`);
  return out.map(fixLocalAbsolute);
}
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
  if (!u) return u;
  return (
    u.profilePic || u.profileImage || u.avatar || u.avatarUrl ||
    u.photoUrl || u.photoURL || u.picture || ""
  );
}
function initialOf(name) { return (name || "U").trim().charAt(0).toUpperCase(); }

/* ---------------- component ---------------- */
export default function ImagePopupViewer({
  images = [],
  popupIndex = 0,
  closePopup,
  updateGalleryImage,
  ownerId,
  fileHost = "",
  onAfterDelete,
}) {
  const { user } = useAuth();
  const meId = useMemo(() => String(user?._id || user?.id || ""), [user]);

  // Broadcast for other components/tabs
  const bcRef = useRef(null);
  useEffect(() => {
    try { if ("BroadcastChannel" in window) bcRef.current = new BroadcastChannel("nsz:gallery"); } catch {}
    return () => { try { bcRef.current?.close(); } catch {} };
  }, []);

  // Optimistic hide when deleting
  const [hiddenIds, setHiddenIds] = useState([]);
  const visible = useMemo(
    () =>
      images.filter(
        (im) =>
          String(im?._id || im?.id || im?.filename || "") &&
          !hiddenIds.includes(String(im?._id || im?.id || im?.filename || ""))
      ),
    [images, hiddenIds]
  );

  const clamp = (n, max) => Math.max(0, Math.min(n, Math.max(0, max)));
  const [idx, setIdx] = useState(clamp(popupIndex, (visible.length || 1) - 1));
  const current = visible[idx] || null;
  const prevExists = idx > 0;
  const nextExists = idx < visible.length - 1;

  // Fallback chain for the big image
  const [srcIdx, setSrcIdx] = useState(0);
  const srcCandidates = useMemo(() => buildCandidatesFromImage(current, fileHost), [current, fileHost]);
  const src = srcCandidates[srcIdx] || DEFAULT_IMG;
  useEffect(() => setSrcIdx(0), [current]);

  // snapshot the item being deleted so async ops don’t shift targets
  const currentRef = useRef(null);
  useEffect(() => { currentRef.current = current; }, [current]);

  useEffect(() => { setIdx((i) => clamp(i, visible.length - 1)); }, [visible.length]);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // lock background scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // deep-link ?image=<id>
  const idOf = (im) => String(im?._id || im?.id || im?.filename || "");
  useEffect(() => {
    if (!current) return;
    const url = new URL(window.location.href);
    url.searchParams.set("image", idOf(current));
    window.history.replaceState({}, "", url.toString());
  }, [current]);

  function cleanUrlAndClose() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("image");
      window.history.replaceState({}, "", url.toString());
    } catch {}
    closePopup?.();
  }

  // keys
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); cleanUrlAndClose(); }
      if (e.key === "ArrowLeft" && prevExists) { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
      if (e.key === "ArrowRight" && nextExists) { e.preventDefault(); setIdx((i) => Math.min(visible.length - 1, i + 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevExists, nextExists, visible.length]);

  // preload neighbors (first candidate only)
  useEffect(() => {
    const preload = (i) => {
      const im = visible[i]; if (!im) return;
      const s = buildSrc(im, fileHost); if (!s) return;
      const pic = new Image(); pic.src = s;
    };
    if (nextExists) preload(idx + 1);
    if (prevExists) preload(idx - 1);
  }, [idx, visible, prevExists, nextExists, fileHost]);

  // caption + reactions
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(current?.caption || "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setCaption(current?.caption || ""); setEditing(false); setSaving(false); }, [idx, current]);

  const likesArr = Array.isArray(current?.likes) ? current.likes : [];
  const dislikesArr = Array.isArray(current?.dislikes) ? current.dislikes : [];
  const iLike = meId && likesArr.map(String).includes(meId);
  const iDislike = meId && dislikesArr.map(String).includes(meId);

  const [working, setWorking] = useState(false);
  const optimisticUpdate = (next) => updateGalleryImage?.(next);

  async function toggleReaction(kind) {
    if (!current || working) return;
    setWorking(true);
    try {
      const idMe = meId;
      const curLikes = Array.isArray(current.likes) ? current.likes.map(String) : [];
      const curDislikes = Array.isArray(current.dislikes) ? current.dislikes.map(String) : [];

      let nextLikes = [...curLikes];
      let nextDislikes = [...curDislikes];

      if (kind === "like") {
        if (nextLikes.includes(idMe)) nextLikes = nextLikes.filter((x) => x !== idMe);
        else nextLikes.push(idMe), (nextDislikes = nextDislikes.filter((x) => x !== idMe));
      } else {
        if (nextDislikes.includes(idMe)) nextDislikes = nextDislikes.filter((x) => x !== idMe);
        else nextDislikes.push(idMe), (nextLikes = nextLikes.filter((x) => x !== idMe));
      }

      optimisticUpdate({ ...current, likes: nextLikes, dislikes: nextDislikes, reactions: undefined });

      const saved = await patchImage({
        ownerId,
        filename: current.filename || idOf(current),
        body: { likes: nextLikes, dislikes: nextDislikes },
      });
      if (saved) optimisticUpdate(saved);
    } catch {
      // optional toast
    } finally {
      if (mountedRef.current) setWorking(false);
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
      // optional toast
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  // realtime
  const [online, setOnline] = useState(false);
  useEffect(() => {
    connectSocket();
    if (ownerId) joinGallery(String(ownerId));

    const onGalleryUpdated = (evt) => {
      const updated = evt?.payload || evt || null;
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

  if (!current) { cleanUrlAndClose(); return null; }

  // 🔧 Safety reset on image change
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  useEffect(() => { setDeleting(false); setConfirmDeleteOpen(false); }, [idOf(current)]);

  const ownerUser = current?.user || current?.owner || {};
  const ownerName = ownerUser?.username || ownerUser?.name || "User";
  const ownerAvatar = pickAvatar(ownerUser);
  const when = (() => {
    const t = new Date(current?.createdAt || 0);
    return Number.isNaN(+t) ? "" : t.toLocaleString();
  })();

  /* ---------------- layout & styles (unchanged) ---------------- */
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
    overflowY: "auto",
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
    gridTemplateAreas: `"meta stage"`,
    columnGap: 12,
  };
  const responsive = `
    @media (max-width: 1024px) {
      .iv-frame      { grid-template-columns: 1fr; grid-template-areas: "stage" "meta"; height: auto; max-height: 100vh; }
      .iv-stageWrap  { max-height: 70vh; }
      .iv-stage      { height: auto; }
      .iv-stage img  { width: 100%; height: auto; max-height: 70vh; object-fit: contain; }
      .iv-meta       { border-right: none; border-top: 1px solid #262626; max-height: none; }
      .iv-navZone    { width: 72px; }
      .iv-countBadge { left: 10px !important; top: 10px !important; }
    }
    @media (max-width: 640px) {
      .iv-stageWrap  { max-height: 65vh; }
      .iv-navZone    { display: none; }
      .iv-countBadge { left: 8px !important; top: 8px !important; }
    }
  `;
  const header = { position: "absolute", top: 8, right: 8, height: HEADER_H, display: "flex", alignItems: "center", justifyContent: "flex-end", zIndex: 50 };
  const closeBtn = { border: "1px solid #2d2d2d", background: "rgba(0,0,0,.55)", color: "#eee", borderRadius: 10, padding: "8px 12px", fontWeight: 800, cursor: "pointer" };
  const stageWrap = { gridArea: "stage", position: "relative", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" };
  const stage = { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" };
  const media = { maxWidth: "100%", maxHeight: `calc(100% - ${HEADER_H}px)`, objectFit: "contain", display: "block" };
  const navZone = (side) => ({ position: "absolute", top: 0, bottom: 0, [side]: 0, width: 96, display: "flex", alignItems: "center", justifyContent: side === "left" ? "flex-start" : "flex-end", padding: "0 10px", cursor: "pointer", background: `linear-gradient(${side === "left" ? "to right" : "to left"}, rgba(0,0,0,.35), transparent)`, userSelect: "none" });
  const navBtn = { width: 44, height: 44, borderRadius: "9999px", border: "1px solid #2d2d2d", background: "rgba(0,0,0,.55)", color: "#eee", fontSize: 28, lineHeight: "42px", textAlign: "center", fontWeight: 900 };
  const countBadge = { position: "absolute", top: 8, left: 8, zIndex: 2, border: "1px solid #2d2d2d", background: "rgba(0,0,0,.55)", color: "#ddd", borderRadius: 10, padding: "6px 10px", fontWeight: 800, pointerEvents: "none" };
  const side = { gridArea: "meta", width: "100%", padding: "14px", color: "#ddd", overflowY: "auto", overflowX: "hidden", borderRight: "1px solid #262626", overscrollBehavior: "contain" };
  const topRow = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 };
  const userWrap = { display: "flex", alignItems: "center", gap: 10, minWidth: 0 };
  const avatarStyle = { width: 36, height: 36, borderRadius: "9999px", background: "#111", border: "1px solid #2d2d2d", overflow: "hidden", display: "grid", placeItems: "center", color: "#ccc", fontWeight: 900 };
  const dot = (on) => ({ width: 8, height: 8, borderRadius: 9999, background: on ? "#16a34a" : "#555", boxShadow: on ? "0 0 8px rgba(22,163,74,.7)" : "none" });
  const userName = { fontWeight: 900, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const sub = { opacity: 0.75, fontSize: 12 };
  const divider = { borderTop: "1px solid #262626", margin: "10px 0" };
  const iconBtn = (active) => ({ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", border: "1px solid #2d2d2d", background: "#121212", color: active ? ACCENT : "#bbb", borderRadius: 10, padding: "6px 10px", fontWeight: 800 });
  const countsRow = { display: "flex", gap: 10, alignItems: "center", marginTop: 10 };
  const captionBox = { whiteSpace: "pre-wrap", lineHeight: 1.45, overflowWrap: "anywhere", wordBreak: "break-word", marginTop: 10 };
  const editArea = { width: "100%", minHeight: 80, resize: "vertical", background: "#0e0e0e", color: "#eee", border: "1px solid #2d2d2d", borderRadius: 10 };
  const editRow = { display: "flex", gap: 8, marginTop: 8 };
  const editBtn = { border: "1px solid #2d2d2d", background: "#1a1a1a", color: ACCENT, borderRadius: 10, padding: "8px 12px", fontWeight: 800 };

  const [menuOpen, setMenuOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const menuWrapRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, minWidth: 220 });

  useEffect(() => {
    function place() {
      if (!menuWrapRef.current) return;
      const r = menuWrapRef.current.getBoundingClientRect();
      const width = 240;
      const top = Math.min(window.innerHeight - 12, r.bottom + 8);
      const left = Math.min(window.innerWidth - width - 8, Math.max(8, r.right - width));
      setMenuPos({ top, left, minWidth: width });
    }
    if (menuOpen) {
      place();
      window.addEventListener("resize", place);
      window.addEventListener("scroll", place, true);
      return () => {
        window.removeEventListener("resize", place);
        window.removeEventListener("scroll", place, true);
      };
    }
  }, [menuOpen]);

  useEffect(() => {
    const onDoc = (e) => { if (menuWrapRef.current && !menuWrapRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const actionsIconBtn = { width: 36, height: 32, display: "grid", placeItems: "center", border: "1px solid #2d2d2d", background: "#121212", color: ACCENT, borderRadius: 8, fontSize: 18, lineHeight: 1, cursor: "pointer" };
  const menuPanel = {
    position: "fixed",
    top: menuPos.top, left: menuPos.left, minWidth: menuPos.minWidth,
    zIndex: 10050,
    background: "#0b0b0b",
    border: "1px solid #262626",
    borderRadius: 10,
    boxShadow: "0 12px 28px rgba(0,0,0,.6)",
    overflow: "hidden",
    maxHeight: "min(60vh, 420px)",
    display: "flex",
    flexDirection: "column",
  };
  const item = { display: "block", width: "100%", textAlign: "left", padding: "10px 12px", color: "#ddd", background: "transparent", border: "none", cursor: "pointer" };
  const itemDanger = { ...item, color: "#f87171", fontWeight: 800, position: "sticky", top: 0, background: "#0b0b0b" };

  const [copied, setCopied] = useState(false);
  function copyShare() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("image", idOf(current));
      navigator.clipboard?.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }
  function openDeleteConfirm() {
    setMenuOpen(false);
    setDeleting(false);
    setConfirmDeleteOpen(true);
  }
  function cancelDelete() { if (!deleting) setConfirmDeleteOpen(false); }

  // DELETE: optimistic, robust
  async function confirmDelete() {
    const snapshot = currentRef.current;
    if (!snapshot || deleting) return;
    const deleteId = idOf(snapshot);

    const nextIdx = idx < visible.length - 1 ? idx : (idx > 0 ? idx - 1 : null);
    setHiddenIds((h) => (h.includes(deleteId) ? h : [...h, deleteId]));
    if (nextIdx !== null) setIdx(nextIdx);

    setConfirmDeleteOpen(false);
    setDeleting(true);

    try {
      await deleteImageSmart({ ownerId, image: snapshot });
      onAfterDelete?.(String(deleteId));
      try { bcRef.current?.postMessage?.({ type: "gallery:deleted", ownerId: String(ownerId), imageId: String(deleteId) }); } catch {}
      try { window.dispatchEvent(new CustomEvent("nsz:gallery", { detail: { type: "gallery:deleted", ownerId: String(ownerId), imageId: String(deleteId) } })); } catch {}

      if (nextIdx === null) cleanUrlAndClose();
    } catch {
      setHiddenIds((h) => h.filter((id) => id !== deleteId));
    } finally {
      if (mountedRef.current) setDeleting(false);
    }
  }

  const modalOverlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", zIndex: 10000 };
  const modalCard = { background: "#0b0b0b", border: "1px solid #262626", borderRadius: 12, padding: 16, width: "min(420px, 92vw)", boxShadow: "0 10px 30px rgba(0,0,0,.6)" };
  const modalBtn = { border: "1px solid #2d2d2d", background: "#111", color: "#ddd", borderRadius: 10, padding: "8px 12px", fontWeight: 800 };
  const modalBtnDanger = { ...modalBtn, color: "#f87171", borderColor: "#3a1a1a", background: "#1a0f0f" };

  return (
    <div role="dialog" aria-modal="true" style={overlay} onClick={(e) => { if (e.target === e.currentTarget) cleanUrlAndClose(); }}>
      <style>{responsive}</style>

      <div className="iv-frame" style={frame} onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <div style={header}>
          <button onClick={cleanUrlAndClose} style={closeBtn} aria-label="Close image">✕</button>
        </div>

        {/* IMAGE */}
        <div className="iv-stageWrap" style={stageWrap}>
          <div className="iv-countBadge" style={countBadge}>{visible.length ? `${idx + 1} / ${visible.length}` : ""}</div>
          <div className="iv-stage" style={stage}>
            {prevExists && (
              <div className="iv-navZone" style={navZone("left")} onClick={() => setIdx((i) => Math.max(0, i - 1))} aria-label="Previous image">
                <div style={navBtn}>‹</div>
              </div>
            )}
            <img
              src={src}
              alt={current?.caption || ""}
              style={media}
              onError={(e) => {
                if (srcIdx < srcCandidates.length - 1) {
                  setSrcIdx((n) => n + 1);
                } else if (e.currentTarget.src !== DEFAULT_IMG) {
                  e.currentTarget.src = DEFAULT_IMG;
                }
              }}
            />
            {nextExists && (
              <div className="iv-navZone" style={navZone("right")} onClick={() => setIdx((i) => Math.min(visible.length - 1, i + 1))} aria-label="Next image">
                <div style={navBtn}>›</div>
              </div>
            )}
          </div>
        </div>

        {/* META */}
        <aside className="iv-meta" style={side}>
          <div style={topRow}>
            <div style={userWrap}>
              <div style={avatarStyle}>
                {ownerAvatar ? <img src={ownerAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span>{initialOf(ownerName)}</span>}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={userName}>{ownerName}</span>
                </div>
                <div style={sub}>{when}</div>
              </div>
            </div>

            {/* actions */}
            <div ref={menuWrapRef} style={{ position: "relative" }}>
              <button style={{ width: 36, height: 32, display: "grid", placeItems: "center", border: "1px solid #2d2d2d", background: "#121212", color: ACCENT, borderRadius: 8, fontSize: 18, lineHeight: 1, cursor: "pointer" }} onClick={() => setMenuOpen((v) => !v)} aria-label="More actions">⋯</button>
              {menuOpen && (
                <div style={menuPanel} role="menu" aria-label="Image actions">
                  <button style={itemDanger} onClick={openDeleteConfirm}>🗑 Delete image</button>
                  <div style={{ overflowY: "auto" }}>
                    {!editing && <button style={item} onClick={() => { setMenuOpen(false); setEditing(true); }}>✎ Edit caption</button>}
                    <button style={item} onClick={() => { setMenuOpen(false); setShowInfo((v) => !v); }}>{showInfo ? "Hide info" : "Show info"}</button>
                    <button style={item} onClick={() => { setMenuOpen(false); copyShare(); }}>{copied ? "✓ Link copied" : "🔗 Share link"}</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #262626", margin: "10px 0" }} />

          {!editing ? (
            <div style={captionBox}>
              {current?.caption || <span style={{ opacity: 0.6 }}>No caption</span>}
            </div>
          ) : (
            <>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption…"
                style={editArea}
              />
              <div style={editRow}>
                <button style={editBtn} onClick={saveCaption} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                <button style={editBtn} onClick={() => { setCaption(current?.caption || ""); setEditing(false); }} disabled={saving}>Cancel</button>
              </div>
            </>
          )}

          <div style={countsRow}>
            <button style={iconBtn(iLike)} onClick={() => toggleReaction("like")} aria-pressed={iLike} title={iLike ? "Unlike" : "Like"}>👍 <span>{likesArr.length}</span></button>
            <button style={iconBtn(iDislike)} onClick={() => toggleReaction("dislike")} aria-pressed={iDislike} title={iDislike ? "Undo dislike" : "Dislike"}>👎 <span>{dislikesArr.length}</span></button>
          </div>
        </aside>
      </div>

      {/* Confirm delete modal */}
      {confirmDeleteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", zIndex: 10000 }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !deleting) setConfirmDeleteOpen(false);
            if (e.key === "Enter") confirmDelete();
          }}
        >
          <div style={{ background: "#0b0b0b", border: "1px solid #262626", borderRadius: 12, padding: 16, width: "min(420px, 92vw)", boxShadow: "0 10px 30px rgba(0,0,0,.6)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, color: "#fff", marginBottom: 8 }}>Delete image?</div>
            <div style={{ color: "#bbb", marginBottom: 14 }}>This action cannot be undone.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={{ border: "1px solid #2d2d2d", background: "#111", color: "#ddd", borderRadius: 10, padding: "8px 12px", fontWeight: 800 }} onClick={() => setConfirmDeleteOpen(false)} disabled={deleting} autoFocus>Cancel</button>
              <button style={{ border: "1px solid #2d2d2d", background: "#1a1a1a", color: "#f87171", borderRadius: 10, padding: "8px 12px", fontWeight: 800, borderColor: "#3a1a1a" }} onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
