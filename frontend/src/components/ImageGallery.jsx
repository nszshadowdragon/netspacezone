import React, { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import GalleryPopup from "./GalleryPopup.jsx";
import ImagePopupViewer from "./ImagePopupViewer.jsx";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { FaFolder, FaEye, FaUpload } from "react-icons/fa";

/* ---------- API base ---------- */
const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
const isLocal = (() => { try { const h = window.location.hostname; return h === "localhost" || h === "127.0.0.1"; } catch { return true; }})();
const API_FALLBACK = isLocal ? "http://localhost:5000" : "https://api.netspacezone.com";
const API_BASE = (env.VITE_API_BASE_URL || env.VITE_API_BASE || API_FALLBACK).replace(/\/$/, "");
const FILE_HOST = API_BASE;

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("authToken") ||
  sessionStorage.getItem("token") ||
  "";

const api = (path, opts = {}) => {
  const token = getToken();
  const headers = { ...(opts.headers || {}) };
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { credentials: "include", ...opts, headers });
};

/* ---------- helpers ---------- */
const DEFAULT_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='#0f0f0f'/><rect x='14' y='14' width='372' height='272' rx='12' fill='#181818' stroke='#2b2b2b' stroke-width='3'/><circle cx='200' cy='140' r='60' fill='#222' stroke='#333' stroke-width='3'/></svg>`);

function normalizeUploadsPath(raw) {
  const name = String(raw || "");
  const withLeading = name.startsWith("/") ? name : `/${name}`;
  return withLeading.startsWith("/uploads") ? withLeading : `/uploads${withLeading}`;
}
function buildImgCandidates(raw) {
  if (!raw) return [];
  if (/^(https?:|blob:|data:)/i.test(raw)) return [raw]; // blob/data absolute
  const p = normalizeUploadsPath(raw);
  return [`${FILE_HOST}${p}`, p];
}
function SmartImage({ src, alt = "", style, onClick }) {
  const [idx, setIdx] = useState(0);
  const candidates = useMemo(() => buildImgCandidates(src), [src]);
  const current = candidates[idx] || DEFAULT_IMG;
  useEffect(() => setIdx(0), [src]);
  return (
    <img
      src={current}
      alt={alt}
      loading="lazy"
      decoding="async"
      onClick={onClick}
      onError={(e) => {
        if (idx < candidates.length - 1) setIdx((n) => n + 1);
        else if (e.currentTarget.src !== DEFAULT_IMG) e.currentTarget.src = DEFAULT_IMG;
      }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style }}
    />
  );
}

const idOf = (im) => String(im?._id || im?.id || im?.filename || "");

// Username from /profile/:username (fallback for accountId)
function pathUsername() {
  try {
    const seg = window.location.pathname.split("/").filter(Boolean);
    const i = seg.findIndex((s) => s === "profile");
    if (i !== -1 && seg[i + 1]) return decodeURIComponent(seg[i + 1]);
  } catch {}
  return "";
}

/* ---------- upload (multer.single('image')) ---------- */
async function uploadOne({ file, ownerId, username, folder }) {
  const token = getToken();
  const fd = new FormData();
  fd.append("image", file, file.name);
  if (ownerId) fd.append("accountId", ownerId);
  if (ownerId) fd.append("userId", ownerId);
  if (username) fd.append("username", username);
  if (folder && folder !== "All") fd.append("folder", folder);

  const res = await fetch(`${API_BASE}/api/gallery`, {
    method: "POST",
    body: fd,
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (res.status === 200 || res.status === 201 || res.status === 204) {
    try { return await res.json(); } catch { return {}; }
  }
  const t = await res.text().catch(() => "");
  throw new Error(`${res.status} ${res.statusText} — ${t.slice(0, 160)}`);
}

export default function ImageGallery({
  profileUser,
  ownerId: ownerIdProp,
  canEdit: canEditProp,
  initialFolder = "All",
}) {
  const { user } = useAuth();

  // Resolve owner id and username robustly
  const resolvedUsername = (profileUser?.username || user?.username || pathUsername() || "").trim();
  const resolvedOwnerId =
    ownerIdProp ||
    profileUser?._id ||
    profileUser?.id ||
    user?._id ||
    user?.id ||
    ""; // may be empty; server will use username fallback

  const isOwner = !!(canEditProp ?? (user && String(user._id) === String(resolvedOwnerId)));

  const [folders, setFolders] = useState(["All"]);
  const [selectedFolder, setSelectedFolder] = useState(initialFolder || "All");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(null);

  const [status, setStatus] = useState("");

  // basic list/folders endpoints (with both id + username so either works)
  function listPath() {
    const qs = new URLSearchParams();
    if (resolvedOwnerId) qs.set("accountId", resolvedOwnerId);
    if (resolvedOwnerId) qs.set("userId", resolvedOwnerId);
    if (resolvedUsername) qs.set("username", resolvedUsername);
    return `/api/gallery?${qs.toString()}`;
  }
  function foldersPath() {
    const qs = new URLSearchParams();
    if (resolvedOwnerId) qs.set("accountId", resolvedOwnerId);
    if (resolvedOwnerId) qs.set("userId", resolvedOwnerId);
    if (resolvedUsername) qs.set("username", resolvedUsername);
    return `/api/gallery/folders?${qs.toString()}`;
  }

  async function refreshAll() {
    setLoading(true);
    try {
      // folders
      try {
        const rf = await api(foldersPath());
        if (rf.ok) {
          const j = await rf.json().catch(() => null);
          const arr = Array.isArray(j) ? j : Array.isArray(j?.folders) ? j.folders : [];
          const extras = (arr || []).filter((f) => f && f !== "All" && String(f).toLowerCase() !== "root");
          setFolders(["All", ...Array.from(new Set(extras))]);
        }
      } catch {}
      // images
      try {
        const ri = await api(listPath());
        if (ri.ok) {
          const j = await ri.json().catch(() => null);
          const arr = Array.isArray(j) ? j : Array.isArray(j?.images) ? j.images : [];
          setImages((arr || []).map((im) => ({ ...im, folder: im.folder || "All" })));
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refreshAll(); /* eslint-disable-next-line */ }, [resolvedOwnerId, resolvedUsername]);

  const onPickFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) { setStatus("No files selected."); return; }
    if (!isOwner) { setStatus("Not allowed to upload here."); return; }

    setStatus(`Selected ${files.length} file(s)…`);

    // optimistic temps
    const temps = files.map((f) => {
      const url = URL.createObjectURL(f);
      return { _id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`, url, path: url, folder: selectedFolder || "All", createdAt: Date.now(), __temp: true };
    });
    setImages((curr) => [...temps, ...curr]);

    for (const f of files) {
      try {
        if (f.size > 20 * 1024 * 1024) { setStatus(`Rejected ${f.name}: >20MB`); continue; }
        await uploadOne({ file: f, ownerId: String(resolvedOwnerId || ""), username: resolvedUsername, folder: selectedFolder });
        setStatus(`Uploaded ${f.name}`);
        await refreshAll(); // show persisted list
      } catch (e) {
        // roll back one temp
        setImages((curr) => {
          const i = curr.findIndex((x) => x.__temp);
          if (i === -1) return curr;
          const next = curr.slice(); next.splice(i, 1); return next;
        });
        setStatus(`Failed ${f.name}: ${e?.message || e}`);
      }
    }
    setTimeout(() => setStatus(""), 2200);
  }, [isOwner, resolvedOwnerId, resolvedUsername, selectedFolder]);

  async function persistReorder(newOrder) {
    try {
      const res = await api("/api/gallery/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: resolvedOwnerId, userId: resolvedOwnerId, order: newOrder }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.warn("Could not save order:", res.status, t.slice(0, 120));
      }
    } catch (e) {
      console.warn("Could not save order:", e?.message || e);
    }
  }

  const [cols, setCols] = useState(4);
  useEffect(() => {
    const mq2 = window.matchMedia("(max-width: 640px)");
    const mq3 = window.matchMedia("(max-width: 900px)");
    const update = () => setCols(mq2.matches ? 2 : mq3.matches ? 3 : 4);
    update(); mq2.addEventListener("change", update); mq3.addEventListener("change", update);
    return () => { mq2.removeEventListener("change", update); mq3.removeEventListener("change", update); };
  }, []);

  const filtered = useMemo(() => {
    let list = images;
    if (selectedFolder && selectedFolder !== "All") list = list.filter((i) => (i.folder || "All") === selectedFolder);
    return [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [images, selectedFolder]);

  function onDragEnd(result) {
    if (!result.destination) return;
    const src = result.source.index;
    const dst = result.destination.index;
    const list = filtered.slice();
    const [moved] = list.splice(src, 1);
    list.splice(dst, 0, moved);

    const visibleIds = new Set(filtered.map((i) => i._id || i.id));
    const newVisibleOrder = list.map((i) => i._id || i.id);
    const others = images.filter((i) => !visibleIds.has(i._id || i.id));
    const newGlobal = [...list, ...others];

    setImages(newGlobal);
    persistReorder(newVisibleOrder);
  }

  const card = { background: "#111", border: "1.5px solid #353535", borderRadius: 14, boxShadow: "0 4px 24px rgba(0,0,0,.3)", padding: "1rem", color: "#ffe066" };
  const header = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 };
  const controls = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" };
  const select = { background: "#1a1a1a", color: "#ffe066", border: "1px solid #2d2d2d", borderRadius: 10, padding: "8px 10px", fontWeight: 700 };
  const grid = { display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 };
  const item = { position: "relative", borderRadius: 10, overflow: "hidden", background: "#0c0c0c", border: "1px solid #262626", aspectRatio: "4 / 3" };
  const dragHandle = { position: "absolute", top: 6, left: 6, width: 22, height: 22, borderRadius: 6, background: "rgba(0,0,0,.55)", border: "1px solid #2d2d2d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#ffe066", cursor: "grab", zIndex: 2 };

  return (
    <div style={card} key={`${resolvedOwnerId}-${resolvedUsername}`}>
      <div style={header}>
        <div style={controls}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FaFolder />
            <select value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)} style={select}>
              {folders.map((f) => (<option key={f} value={f}>{f}</option>))}
            </select>
          </label>

          {isOwner && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }} title="Upload images">
              <span style={{ ...select, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <FaUpload /> Upload
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => { const files = e.target.files; onPickFiles(files); e.target.value = ""; }}
              />
            </label>
          )}

          <button type="button" onClick={() => setMode("manager")} style={{ ...select, display: "inline-flex", alignItems: "center", gap: 8 }} title="View all images">
            <FaEye /> View All
          </button>
        </div>

        <div style={{ fontSize: 12, color: "#aaa", minHeight: 18 }}>{status}</div>
      </div>

      <DragDropContext onDragEnd={isOwner ? onDragEnd : () => {}}>
        <Droppable droppableId="grid" direction="horizontal">
          {(dropProvided) => (
            <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} style={grid}>
              {filtered.slice(0, cols * 2).map((im, idx) => (
                <Draggable key={String(im._id || im.id || idx)} draggableId={String(im._id || im.id || idx)} index={idx} isDragDisabled={!isOwner}>
                  {(dragProvided) => (
                    <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} style={{ ...item, ...(dragProvided.draggableProps.style || {}), opacity: im.__temp ? 0.7 : 1 }}>
                      {isOwner && (
                        <div {...dragProvided.dragHandleProps} style={dragHandle} title="Drag to reorder" onClick={(e) => e.stopPropagation()}>
                          ⋮⋮
                        </div>
                      )}
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="Open image"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMode("viewer"); setViewerIndex(idx); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMode("viewer"); setViewerIndex(idx); } }}
                        style={{ position: "absolute", inset: 0 }}
                      >
                        <SmartImage src={im.url || im.imageUrl || im.path || (im.filename ? `/uploads/${im.filename}` : "")} alt={im.caption || ""} />
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {dropProvided.placeholder}
              {filtered.length === 0 && (
                <div style={{ color: "#aaa", padding: 20, gridColumn: `span ${cols}` }}>
                  {loading ? "Loading…" : isOwner ? "No images yet. Upload to get started." : "No images to show."}
                </div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {mode === "manager" && (
        <GalleryPopup
          open
          onClose={() => setMode(null)}
          ownerId={resolvedOwnerId}
          ownerUsername={resolvedUsername}
          canEdit={isOwner}
          initialFolder={selectedFolder}
        />
      )}

      {mode === "viewer" && viewerIndex !== null &&
        createPortal(
          <ImagePopupViewer
            ownerId={resolvedOwnerId}
            fileHost={FILE_HOST}
            images={filtered}
            popupIndex={viewerIndex}
            closePopup={() => { setViewerIndex(null); setMode(null); }}
            updateGalleryImage={(updated) => {
              if (!updated) return;
              setImages((curr) => curr.map((im) => (idOf(im) === idOf(updated) ? { ...im, ...updated } : im)));
            }}
          />,
          document.body
        )}
    </div>
  );
}
