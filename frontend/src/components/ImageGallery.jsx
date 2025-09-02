// frontend/src/components/ImageGallery.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import GalleryPopup from "./GalleryPopup.jsx";
import ImagePopupViewer from "./ImagePopupViewer.jsx";
import { useDropzone } from "react-dropzone";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { FaFolder, FaEye, FaUpload } from "react-icons/fa";
import socket, { connectSocket, joinGallery, leaveGallery } from "../socket";

/* -------------------- API base + file host (with prod fallback) -------------------- */
const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
const isLocal = (() => {
  try { const h = window.location.hostname; return h === "localhost" || h === "127.0.0.1"; }
  catch { return true; }
})();
const API_FALLBACK = isLocal ? "" : "https://api.netspacezone.com";
const API_BASE = (env.VITE_API_BASE || API_FALLBACK).replace(/\/$/, "");
const FILE_HOST = API_BASE || (isLocal ? "http://localhost:5000" : "https://api.netspacezone.com");
const HOST_TAG  = API_BASE || (isLocal ? "dev" : "prod");

const api = (path, opts = {}) =>
  fetch(`${API_BASE}${path}`, { credentials: "include", ...opts });

/* -------------------- helpers -------------------- */
function imgSrc(pathOrObj) {
  let p = pathOrObj;
  if (!p) return "";
  if (typeof p === "object" && p.path) p = p.path;
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith("/uploads/")) return `${FILE_HOST}${p}`;
  if (p.startsWith("/")) return p;
  return `/${p}`;
}
function useBroadcast(channelName, onMessage) {
  const ref = useRef(null);
  useEffect(() => {
    let ch = null;
    try {
      if ("BroadcastChannel" in window) {
        ch = new BroadcastChannel(channelName);
        ch.onmessage = (ev) => onMessage?.(ev.data);
      }
    } catch {}
    ref.current = ch;
    return () => { try { ch?.close(); } catch {} };
  }, [channelName, onMessage]);
  return ref;
}
const idOf = (im) => String(im?._id || im?.id || im?.filename || "");

/* -------------------- canonical endpoints only -------------------- */
const ENDPOINTS = {
  list:     (ownerId) => `/api/gallery?accountId=${ownerId}`,
  folders:  (ownerId) => `/api/gallery/folders?accountId=${ownerId}`,
  upload:   [{ path: `/api/gallery`, field: "image" }], // multipart POST
  del:      (id, ownerId) => `/api/gallery/${encodeURIComponent(id)}?accountId=${ownerId}`,
  reorder:  `/api/gallery/reorder`,
};

async function toJsonSafe(res) { try { return await res.json(); } catch { return null; } }
function cacheKey(ownerId) { return `nsz.gallery.ep.${HOST_TAG}.${ownerId}`; }

/** Keep a tiny “discovery” cache (URLs are fixed now, but this preserves your shape) */
async function discoverEndpoints(ownerId) {
  const cachedRaw = localStorage.getItem(cacheKey(ownerId));
  if (cachedRaw) { try { const cached = JSON.parse(cachedRaw); if (cached?.list) return cached; } catch {} }
  const ep = {
    list: ENDPOINTS.list(ownerId),
    folders: ENDPOINTS.folders(ownerId),
    upload: ENDPOINTS.upload,
    del: ENDPOINTS.del,
    reorder: ENDPOINTS.reorder,
  };
  localStorage.setItem(cacheKey(ownerId), JSON.stringify(ep));
  return ep;
}

async function tryUpload(epUpload, file, ownerId, folder) {
  let lastError = "";
  for (const { path, field } of epUpload) {
    try {
      const fd = new FormData();
      fd.append(field, file, file.name);
      fd.append("accountId", ownerId);
      if (folder && folder !== "All") fd.append("folder", folder);

      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (res.ok) return await toJsonSafe(res);

      const text = await res.text().catch(() => "");
      lastError = `${res.status} ${res.statusText} @ ${API_BASE || ""}${path} — ${text.slice(0, 200)}`;
    } catch (e) {
      lastError = String(e?.message || e);
    }
  }
  throw new Error(lastError || "Upload failed.");
}

/* -------------------- component -------------------- */
export default function ImageGallery({
  profileUser,
  ownerId: ownerIdProp,
  canEdit: canEditProp,
  initialFolder = "All",
}) {
  const { user } = useAuth();
  const ownerId =
    ownerIdProp ||
    profileUser?._id || profileUser?.id ||
    user?._id || "";

  const isOwner = !!(canEditProp ?? (user && String(user._id) === String(ownerId)));

  const [folders, setFolders] = useState(["All"]);
  const [selectedFolder, setSelectedFolder] = useState(initialFolder || "All");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  /** EXCLUSIVE modal mode: 'viewer' | 'manager' | null */
  const [mode, setMode] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(null);

  const [banner, setBanner] = useState({ type: "", msg: "" });
  const showBanner = (type, msg) => setBanner({ type, msg });
  const clearBanner = () => setBanner({ type: "", msg: "" });

  const [ep, setEp] = useState(null);
  const bc = useBroadcast("nsz:gallery", (msg) => {
    if (msg?.type?.startsWith("gallery:") && msg.ownerId === ownerId) refreshAll();
  });

  // discover (writes fixed endpoints to cache); then load
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!ownerId) return;
      setLoading(true);
      const found = await discoverEndpoints(ownerId);
      if (!alive) return;
      setEp(found);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [ownerId]);

  // realtime via socket singleton
  useEffect(() => {
    if (!ownerId) return;
    connectSocket();
    joinGallery(String(ownerId));

    const onCreated = (evt) => {
      const img = evt?.payload || evt;
      if (!img) return refreshAll();
      setImages((curr) => [img, ...curr]);
    };
    const onDeleted = (evt) => {
      const img = evt?.payload || evt;
      const id = idOf(img);
      if (!id) return refreshAll();
      setImages((curr) => curr.filter((i) => idOf(i) !== id));
    };
    const onUpdated = (evt) => {
      const updated = evt?.payload || evt;
      if (!updated) return refreshAll();
      const id = idOf(updated);
      setImages((curr) => {
        let found = false;
        const next = curr.map((im) => {
          if (idOf(im) === id) { found = true; return { ...im, ...updated }; }
          return im;
        });
        return found ? next : [updated, ...next];
      });
    };
    const onReordered = () => refreshAll();

    socket.on("gallery:image:created", onCreated);
    socket.on("gallery:image:deleted", onDeleted);
    socket.on("gallery:image:updated", onUpdated);
    socket.on("gallery:reordered", onReordered);

    return () => {
      socket.off("gallery:image:created", onCreated);
      socket.off("gallery:image:deleted", onDeleted);
      socket.off("gallery:image:updated", onUpdated);
      socket.off("gallery:reordered", onReordered);
      leaveGallery(String(ownerId));
    };
  }, [ownerId, ep]);

  async function refreshAll(targetId = ownerId) {
    if (!targetId || !ep) return;
    setLoading(true);
    clearBanner();
    try {
      // folders
      try {
        const rf = await api(ep.folders);
        if (rf.ok) {
          const j = await toJsonSafe(rf);
          const arr = Array.isArray(j) ? j : (Array.isArray(j?.folders) ? j.folders : []);
          const extras = (arr || [])
            .filter((f) => f && f !== "All" && String(f).toLowerCase() !== "root");
          setFolders(["All", ...Array.from(new Set(extras))]);
        } else {
          setFolders((f) => f.length ? f : ["All"]);
        }
      } catch {
        setFolders((f) => f.length ? f : ["All"]);
      }

      // images
      let imgs = [];
      try {
        const ri = await api(ep.list);
        if (ri.ok) {
          const j = await toJsonSafe(ri);
          imgs = Array.isArray(j) ? j : (Array.isArray(j?.images) ? j.images : []);
        }
      } catch {}
      setImages((Array.isArray(imgs) ? imgs : []).map((im) => ({ ...im, folder: im.folder || "All" })));
    } catch (e) {
      console.error("gallery refresh error", e);
      showBanner("error", "Could not load gallery.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (ep) refreshAll(); }, [ownerId, ep]);

  /** Upload via dropzone */
  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles?.length || !isOwner || !ep) return;
    showBanner("info", `Uploading ${acceptedFiles.length} file(s)…`);
    try {
      for (const file of acceptedFiles) {
        if (file.size > 20 * 1024 * 1024) {
          showBanner("error", `Rejected ${file.name}: over 20MB`);
          return;
        }
        await tryUpload(ep.upload, file, ownerId, selectedFolder);
      }
      showBanner("success", "Upload complete ✔");
      refreshAll();
      try { bc.current?.postMessage?.({ type: "gallery:upload", ownerId }); } catch {}
    } catch (e) {
      console.error(e);
      showBanner("error", "Upload failed.");
    } finally {
      setTimeout(() => clearBanner(), 3500);
    }
  }, [isOwner, ownerId, selectedFolder, ep]);

  const { getRootProps, getInputProps, open: openFileDialog } = useDropzone({
    onDrop,
    multiple: true,
    accept: { "image/*": [] },
    maxSize: 20 * 1024 * 1024,
    noClick: true,
    disabled: !isOwner || !ownerId,
  });

  /** order persistence (visible subset only) */
  async function persistReorder(newOrder) {
    if (!ep) return;
    try {
      const res = await api(ep.reorder, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: ownerId, order: newOrder }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        showBanner("error", `Could not save order (${res.status}) ${t.slice(0, 120)}`);
      } else {
        setTimeout(() => clearBanner(), 2000);
      }
    } catch (e) {
      showBanner("error", `Could not save order (${String(e?.message || e)})`);
    }
  }

  /** responsive grid + filtered list */
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const mq2 = window.matchMedia("(max-width: 640px)");
    const mq3 = window.matchMedia("(max-width: 900px)");
    const update = () => setCols(mq2.matches ? 2 : (mq3.matches ? 3 : 4));
    update(); mq2.addEventListener("change", update); mq3.addEventListener("change", update);
    return () => { mq2.removeEventListener("change", update); mq3.removeEventListener("change", update); };
  }, []);

  const filtered = useMemo(() => {
    let list = images;
    if (selectedFolder && selectedFolder !== "All") {
      list = list.filter((i) => (i.folder || "All") === selectedFolder);
    }
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

  /** -------- modal control helpers (EXCLUSIVE) -------- */
  const openViewer  = (idx) => { setMode("viewer");  setViewerIndex(idx); };
  const closeViewer = () => { setViewerIndex(null);   setMode(null);      };
  const openManager = () => { setViewerIndex(null);   setMode("manager"); };
  const closeManager= () => { setMode(null);                              };

  /* -------- styles -------- */
  const card = { background: "#111", border: "1.5px solid #353535", borderRadius: 14, boxShadow: "0 4px 24px rgba(0,0,0,.3)", padding: "1rem", color: "#ffe066" };
  const header = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 };
  const controls = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" };
  const select = { background: "#1a1a1a", color: "#ffe066", border: "1px solid #2d2d2d", borderRadius: 10, padding: "8px 10px", fontWeight: 700 };
  const grid = { display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 };
  const item = { position: "relative", borderRadius: 10, overflow: "hidden", background: "#0c0c0c", border: "1px solid #262626", aspectRatio: "4 / 3" };
  const dragHandle = {
    position: "absolute",
    top: 6, left: 6,
    width: 22, height: 22,
    borderRadius: 6,
    background: "rgba(0,0,0,.55)",
    border: "1px solid #2d2d2d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    color: "#ffe066",
    cursor: "grab",
    zIndex: 2,
  };

  return (
    <div style={card} key={ownerId}>
      {/* Controls */}
      <div style={header}>
        <div style={controls}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FaFolder />
            <select value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)} style={select}>
              {folders.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>

          {isOwner && (
            <div {...getRootProps()} style={{ display: "inline-flex", alignItems: "center" }}>
              <button
                type="button"
                onClick={openFileDialog}
                style={{ ...select, display: "inline-flex", alignItems: "center", gap: 8 }}
                title="Upload images"
              >
                <FaUpload /> Upload
              </button>
              <input {...getInputProps()} />
            </div>
          )}

          {/* Single launcher for full manager */}
          <button
            type="button"
            onClick={openManager}
            style={{ ...select, display: "inline-flex", alignItems: "center", gap: 8 }}
            title="View all images"
          >
            <FaEye /> View All
          </button>
        </div>
      </div>

      <DragDropContext onDragEnd={isOwner ? onDragEnd : () => {}}>
        <Droppable droppableId="grid" direction="horizontal">
          {(dropProvided) => (
            <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} style={grid}>
              {filtered.slice(0, cols * 2).map((im, idx) => (
                <Draggable
                  key={String(im._id || im.id || idx)}
                  draggableId={String(im._id || im.id || idx)}
                  index={idx}
                  isDragDisabled={!isOwner}
                >
                  {(dragProvided) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      style={{ ...item, ...(dragProvided.draggableProps.style || {}) }}
                    >
                      {/* Drag via small grip only */}
                      {isOwner && (
                        <div
                          {...dragProvided.dragHandleProps}
                          style={dragHandle}
                          title="Drag to reorder"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ⋮⋮
                        </div>
                      )}

                      {/* Tile opens the individual image viewer */}
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="Open image"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openViewer(idx); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewer(idx); } }}
                        style={{ position: "absolute", inset: 0 }}
                      >
                        <img
                          src={imgSrc(im)}
                          alt={im.caption || ""}
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.opacity = 0.4; }}
                        />
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {dropProvided.placeholder}
              {filtered.length === 0 && (
                <div style={{ color: "#aaa", padding: 20, gridColumn: `span ${cols}` }}>
                  {loading ? "Loading…" : (isOwner ? "No images yet. Upload to get started." : "No images to show.")}
                </div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Manager modal (exclusive) */}
      {mode === "manager" && (
        <GalleryPopup
          open
          onClose={closeManager}
          ownerId={ownerId}
          canEdit={isOwner}
          initialFolder={selectedFolder}
        />
      )}

      {/* Individual viewer (exclusive) */}
      {mode === "viewer" && viewerIndex !== null &&
        createPortal(
          <ImagePopupViewer
            ownerId={ownerId}
            fileHost={FILE_HOST}
            images={filtered}
            popupIndex={viewerIndex}
            closePopup={closeViewer}
            updateGalleryImage={(updated) => {
              if (!updated) return;
              setImages((curr) =>
                curr.map((im) =>
                  (idOf(im) === idOf(updated) ? { ...im, ...updated } : im)
                )
              );
            }}
          />,
          document.body
        )
      }
    </div>
  );
}
