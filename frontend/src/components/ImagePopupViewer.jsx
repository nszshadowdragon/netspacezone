// frontend/src/components/ImagePopupViewer.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { FaTimes, FaChevronLeft, FaChevronRight, FaHeart, FaRegHeart, FaThumbsDown, FaRegThumbsDown, FaShare } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";

/* ---------------- API host (local vs prod, Vite-aware) ---------------- */
const API_HOST = (() => {
  try {
    const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
    if (env.VITE_API_URL) return env.VITE_API_URL;
    const h = window.location.hostname;
    const isLocal = h === "localhost" || h === "127.0.0.1";
    return isLocal ? "http://localhost:5000" : "https://api.netspacezone.com";
  } catch {
    return "http://localhost:5000";
  }
})();

const api = (path, opts = {}) =>
  fetch(`${API_HOST}${path}`, { credentials: "include", ...opts });

/* ---------------- Helpers ---------------- */
function absImg(p) {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith("/uploads/")) return `${API_HOST}${p}`;
  if (p.startsWith("/")) return p;
  return `/${p}`;
}
const getId = (im, fallback) => String(im?._id || im?.id || im?.filename || fallback || "");
const getOwnerId = (im) =>
  im?.ownerId || im?.accountId || im?.userId || im?.user?._id || im?.author?._id || "";
const timeAgo = (dateLike) => {
  if (!dateLike) return "";
  const t = new Date(dateLike).getTime();
  if (!t) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  const y = Math.floor(mo / 12);
  return `${y}y`;
};

/* ---------------- Broadcast channel (soft real-time) ---------------- */
function useBroadcast(name, onMessage) {
  const ref = useRef(null);
  useEffect(() => {
    let ch = null;
    try {
      if ("BroadcastChannel" in window) {
        ch = new BroadcastChannel(name);
        ch.onmessage = (ev) => onMessage?.(ev.data);
      }
    } catch {}
    ref.current = ch;
    return () => {
      try { ch?.close(); } catch {}
    };
  }, [name, onMessage]);
  return ref;
}

/* =================================================================== */
export default function ImagePopupViewer({
  images = [],
  popupIndex = 0,
  closePopup,
  updateGalleryImage, // (updated) => void  (from parent)
}) {
  const { user } = useAuth();
  const [index, setIndex] = useState(Math.min(Math.max(0, popupIndex || 0), Math.max(0, images.length - 1)));
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");
  const [savingCaption, setSavingCaption] = useState(false);
  const containerRef = useRef(null);

  const bc = useBroadcast("nsz:gallery", () => {
    // parent list should refresh via other components;
    // viewer itself stays focused on current image instance
  });

  useEffect(() => {
    setIndex(Math.min(Math.max(0, popupIndex || 0), Math.max(0, images.length - 1)));
  }, [popupIndex, images.length]);

  const im = images[index] || null;
  const imageId = getId(im, index);
  const ownerId = getOwnerId(im);
  const canEdit = !!(user && ownerId && String(user._id) === String(ownerId));

  // determine liked/disliked by the current user
  const userId = user?._id;
  const { likedByMe, dislikedByMe, likeCount, dislikeCount } = useMemo(() => {
    let liked = false, disliked = false, likesN = 0, dislikesN = 0;

    // common shapes:
    // im.likes: number | string[] | {_id:string}[]
    // im.dislikes: same
    // im.reactions?: { likes:number, dislikes:number, by?:{likes:string[],dislikes:string[]} }
    const L = im?.likes;
    const D = im?.dislikes;
    const R = im?.reactions;

    if (typeof L === "number") likesN = L;
    if (typeof D === "number") dislikesN = D;

    if (Array.isArray(L)) {
      likesN = L.length;
      liked =
        !!userId &&
        (L.includes(userId) || L.some((x) => x?._id === userId || x === userId));
    }
    if (Array.isArray(D)) {
      dislikesN = D.length;
      disliked =
        !!userId &&
        (D.includes(userId) || D.some((x) => x?._id === userId || x === userId));
    }
    if (R && typeof R.likes === "number") likesN = R.likes;
    if (R && typeof R.dislikes === "number") dislikesN = R.dislikes;
    if (R?.by?.likes && userId) {
      liked = R.by.likes.includes(userId);
    }
    if (R?.by?.dislikes && userId) {
      disliked = R.by.dislikes.includes(userId);
    }

    return { likedByMe: liked, dislikedByMe: disliked, likeCount: likesN, dislikeCount: dislikesN };
  }, [im, userId]);

  // caption draft control
  useEffect(() => {
    setEditingCaption(false);
    setCaptionDraft(im?.caption || "");
  }, [imageId]);

  // keyboard controls
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); closePopup?.(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index]);

  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => setIndex((i) => Math.min(images.length - 1, i + 1));

  /* ---------------- Like / Dislike ---------------- */
  const patchLocalReactions = useCallback((liked, disliked) => {
    // Create an updated image copy with adjusted counts/flags
    const updated = { ...(im || {}) };

    // Normalize counts
    let likesN = likeCount;
    let dislikesN = dislikeCount;

    // Apply toggles:
    if (liked) {
      if (!likedByMe) likesN += 1;
      if (dislikedByMe) dislikesN = Math.max(0, dislikesN - 1);
    } else {
      if (likedByMe) likesN = Math.max(0, likesN - 1);
    }
    if (disliked) {
      if (!dislikedByMe) dislikesN += 1;
      if (likedByMe) likesN = Math.max(0, likesN - 1);
    } else {
      if (dislikedByMe) dislikesN = Math.max(0, dislikesN - 1);
    }

    updated.reactions = {
      ...(updated.reactions || {}),
      likes: likesN,
      dislikes: dislikesN,
    };

    // best-effort: reflect user sets
    if (Array.isArray(updated.likes) || Array.isArray(updated.dislikes)) {
      try {
        if (Array.isArray(updated.likes)) {
          const setL = new Set(updated.likes.map((x) => (x?._id || x)));
          if (userId) {
            liked ? setL.add(userId) : setL.delete(userId);
          }
          updated.likes = Array.from(setL);
        }
        if (Array.isArray(updated.dislikes)) {
          const setD = new Set(updated.dislikes.map((x) => (x?._id || x)));
          if (userId) {
            disliked ? setD.add(userId) : setD.delete(userId);
          }
          updated.dislikes = Array.from(setD);
        }
      } catch {}
    }

    // push change upward
    updateGalleryImage?.(updated);
  }, [im, likeCount, dislikeCount, likedByMe, dislikedByMe, updateGalleryImage, userId]);

  const toggleLike = async () => {
    if (!imageId) return;
    try {
      // Try canonical route first; then fallbacks
      let ok = false;
      const routes = [
        `/api/gallery/${encodeURIComponent(imageId)}/like`,
        `/api/gallery/like?id=${encodeURIComponent(imageId)}`,
        `/api/gallery/like/${encodeURIComponent(imageId)}`,
      ];
      for (const r of routes) {
        const res = await api(r, { method: "POST" });
        if (res.ok) { ok = true; break; }
      }
      if (ok) {
        patchLocalReactions(!likedByMe, false);
        try { bc.current?.postMessage?.({ type: "gallery:image:updated", ownerId: getOwnerId(im) }); } catch {}
      }
    } catch (e) {
      /* swallow */
    }
  };

  const toggleDislike = async () => {
    if (!imageId) return;
    try {
      let ok = false;
      const routes = [
        `/api/gallery/${encodeURIComponent(imageId)}/dislike`,
        `/api/gallery/dislike?id=${encodeURIComponent(imageId)}`,
        `/api/gallery/dislike/${encodeURIComponent(imageId)}`,
      ];
      for (const r of routes) {
        const res = await api(r, { method: "POST" });
        if (res.ok) { ok = true; break; }
      }
      if (ok) {
        patchLocalReactions(false, !dislikedByMe);
        try { bc.current?.postMessage?.({ type: "gallery:image:updated", ownerId: getOwnerId(im) }); } catch {}
      }
    } catch (e) {
      /* swallow */
    }
  };

  /* ---------------- Caption edit (owner only) ---------------- */
  const saveCaption = async () => {
    if (!canEdit || !imageId) return;
    if (savingCaption) return;
    setSavingCaption(true);
    try {
      let ok = false, updated = null;
      const payload = { caption: captionDraft || "" };

      // canonical PATCH
      try {
        const r = await api(`/api/gallery/${encodeURIComponent(imageId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.ok) { ok = true; updated = await r.json().catch(() => null); }
      } catch {}

      // fallback route
      if (!ok) {
        const r = await api(`/api/gallery/update-caption`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: imageId, ...payload }),
        });
        if (r.ok) { ok = true; updated = await r.json().catch(() => null); }
      }

      // update parent state
      const merged = updated && (updated.image || updated);
      updateGalleryImage?.(merged || { ...(im || {}), caption: captionDraft || "" });
      setEditingCaption(false);
      try { bc.current?.postMessage?.({ type: "gallery:image:updated", ownerId: getOwnerId(im) }); } catch {}
    } catch {
      // noop
    } finally {
      setSavingCaption(false);
    }
  };

  /* ---------------- Share link ---------------- */
  const copyLink = async () => {
    try {
      const origin = window.location.origin || "";
      const id = imageId;
      const url = id ? `${origin}/image/${encodeURIComponent(id)}` : origin;
      await navigator.clipboard.writeText(url);
      flash("Link copied!");
    } catch {
      flash("Could not copy.");
    }
  };

  /* ---------------- UI helpers ---------------- */
  const [flashMsg, setFlashMsg] = useState("");
  function flash(msg) {
    setFlashMsg(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setFlashMsg(""), 1600);
  }

  if (!im) return null;

  /* ---------------- Styles ---------------- */
  const backdrop = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 3000,
  };
  const wrap = {
    position: "fixed", inset: "3% 2%", background: "#0a0a0a", border: "1px solid #2a2a2a",
    borderRadius: 14, color: "#ffe066", zIndex: 3001, display: "grid",
    gridTemplateColumns: "1fr 380px", gap: 0, overflow: "hidden",
  };
  const media = {
    position: "relative", background: "#000", minHeight: 280,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const imgStyle = {
    maxWidth: "100%", maxHeight: "86vh", objectFit: "contain",
    display: "block",
  };
  const side = { borderLeft: "1px solid #262626", display: "flex", flexDirection: "column", minHeight: 0 };
  const header = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid #262626" };
  const meta = { fontSize: 12, color: "#bbb" };
  const controls = { display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #262626" };
  const btn = { border: "1px solid #2d2d2d", background: "#141414", color: "#ffe066", borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 800 };
  const captionBox = { padding: "10px 12px", borderBottom: "1px solid #262626" };
  const input = { width: "100%", background: "#0f0f0f", border: "1px solid #2d2d2d", color: "#ffe066", borderRadius: 8, padding: "8px 10px", outline: "none" };
  const navBtn = {
    position: "absolute", top: "50%", transform: "translateY(-50%)",
    background: "rgba(0,0,0,.4)", border: "1px solid #3a3a3a", color: "#ffe066",
    borderRadius: 999, height: 44, width: 44, display: "grid", placeItems: "center", cursor: "pointer",
  };

  // responsive: collapse side panel on small screens
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 920);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <>
      {/* Backdrop click closes */}
      <div style={backdrop} onClick={() => closePopup?.()} />
      {/* Main card */}
      <div
        ref={containerRef}
        style={{ ...wrap, gridTemplateColumns: narrow ? "1fr" : "1fr 380px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* LEFT: Image + nav arrows */}
        <div style={media}>
          {index > 0 && (
            <button
              aria-label="Previous"
              style={{ ...navBtn, left: 10 }}
              onClick={prev}
            >
              <FaChevronLeft />
            </button>
          )}
          <img
            src={absImg(im.path || im.url || im.src || im.filename)}
            alt={im.caption || ""}
            style={imgStyle}
            onError={(e) => { e.currentTarget.style.opacity = .5; }}
          />
          {index < images.length - 1 && (
            <button
              aria-label="Next"
              style={{ ...navBtn, right: 10 }}
              onClick={next}
            >
              <FaChevronRight />
            </button>
          )}
        </div>

        {/* RIGHT: Details, actions */}
        {!narrow && (
          <div style={side}>
            {/* Header */}
            <div style={header}>
              <div>
                <div style={{ fontWeight: 900 }}>
                  {im?.author?.username || im?.user?.username || im?.username || "User"}
                </div>
                <div style={meta}>
                  {timeAgo(im?.createdAt)} • {String(im?.width || "")}{im?.width ? "×" : ""}{String(im?.height || "")}
                </div>
              </div>
              <button aria-label="Close" onClick={() => closePopup?.()} style={btn}>
                <FaTimes />
              </button>
            </div>

            {/* Controls */}
            <div style={controls}>
              <button
                type="button"
                onClick={toggleLike}
                style={{ ...btn, borderColor: likedByMe ? "#16ff80" : "#2d2d2d" }}
                title={likedByMe ? "Unlike" : "Like"}
              >
                {likedByMe ? <FaHeart /> : <FaRegHeart />} {likeCount}
              </button>

              <button
                type="button"
                onClick={toggleDislike}
                style={{ ...btn, borderColor: dislikedByMe ? "#ff7676" : "#2d2d2d" }}
                title={dislikedByMe ? "Remove dislike" : "Dislike"}
              >
                {dislikedByMe ? <FaThumbsDown /> : <FaRegThumbsDown />} {dislikeCount}
              </button>

              <button type="button" onClick={copyLink} style={btn} title="Copy link">
                <FaShare /> Share
              </button>
            </div>

            {/* Caption */}
            <div style={captionBox}>
              {!editingCaption && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ color: "#ddd", lineHeight: 1.4 }}>
                    {im?.caption ? im.caption : <span style={{ color: "#888" }}>No caption</span>}
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => { setCaptionDraft(im?.caption || ""); setEditingCaption(true); }}
                      style={btn}
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
              {editingCaption && canEdit && (
                <div>
                  <textarea
                    rows={3}
                    value={captionDraft}
                    onChange={(e) => setCaptionDraft(e.target.value)}
                    style={{ ...input, resize: "vertical" }}
                    placeholder="Write a caption…"
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={saveCaption}
                      style={{ ...btn, background: savingCaption ? "#164e3b" : "#0f2", color: "#111", borderColor: "#0f2" }}
                      disabled={savingCaption}
                    >
                      {savingCaption ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingCaption(false); setCaptionDraft(im?.caption || ""); }}
                      style={btn}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Comments placeholder */}
            <div style={{ padding: "10px 12px" }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Comments</div>
              <div style={{ color: "#aaa" }}>Comments will be available soon.</div>
            </div>

            {/* Footer meta */}
            <div style={{ marginTop: "auto", padding: "10px 12px", borderTop: "1px solid #262626", color: "#999", fontSize: 12 }}>
              ID: {imageId}
            </div>
          </div>
        )}
      </div>

      {/* Tiny toast */}
      {flashMsg && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "8px 12px",
            borderRadius: 10,
            background: "#064e3b",
            border: "1px solid #16ff80",
            color: "#fff",
            fontWeight: 800,
            zIndex: 4000,
          }}
        >
          {flashMsg}
        </div>
      )}
    </>
  );
}
