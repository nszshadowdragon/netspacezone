// src/components/ImageGallery.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import GalleryPopup from "./GalleryPopup";
import ImagePopupViewer from "./ImagePopupViewer";
import { useDropzone } from "react-dropzone";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { toast } from "react-toastify";
import { FaFolder, FaFolderPlus, FaImages, FaEye, FaUpload } from "react-icons/fa";

/** Resolve API host for local vs prod and Vite env */
const API_HOST = (() => {
  const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
  if (env.VITE_API_URL) return env.VITE_API_URL;
  try {
    const h = window.location.hostname;
    const isLocal = h === "localhost" || h === "127.0.0.1";
    return isLocal ? "http://localhost:5000" : "https://api.netspacezone.com";
  } catch {
    return "http://localhost:5000";
  }
})();

const api = (path, opts={}) =>
  fetch(`${API_HOST}${path}`, { credentials: "include", ...opts });

/** Normalizes a gallery image src to an absolute URL */
function imgSrc(pathOrObj) {
  let p = pathOrObj;
  if (!p) return "";
  if (typeof p === "object" && p.path) p = p.path;
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith("/uploads/")) return `${API_HOST}${p}`;
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

export default function ImageGallery({
  ownerId: ownerIdProp,
  canEdit: canEditProp,
  initialFolder = "All",
}) {
  const { user } = useAuth();
  const ownerId = ownerIdProp || user?._id || ""; // profile owner's id
  const isOwner = !!(canEditProp ?? (user && user._id === ownerIdProp));
  const [folders, setFolders] = useState(["All"]);
  const [selectedFolder, setSelectedFolder] = useState(initialFolder || "All");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
  const bc = useBroadcast("nsz:gallery", (msg) => {
    if (msg?.type?.startsWith("gallery:") && msg.ownerId === ownerId) {
      refreshAll();
    }
  });

  // Optional Socket.IO live updates (graceful if client not installed)
  useEffect(() => {
    let socket;
    let active = true;
    (async () => {
      try {
        const mod = await import("socket.io-client");
        const io = mod.io || mod.default;
        const s = io(API_HOST, { withCredentials: true, transports: ["websocket"] });
        socket = s;
        s.emit("gallery:join", { ownerId });
        const refresh = () => { if (active) refreshAll(); };
        s.on("gallery:changed", refresh);
        s.on("gallery:image:created", refresh);
        s.on("gallery:image:deleted", refresh);
        s.on("gallery:image:updated", refresh);
        s.on("gallery:reordered", refresh);
      } catch {
        // ignore if socket lib not available
      }
    })();
    return () => {
      active = false;
      try { socket?.disconnect(); } catch {}
    };
  }, [ownerId]);

  async function refreshAll(targetId = ownerId) {
    if (!targetId) return;
    setLoading(true);
    try {
      // Folders
      try {
        const rf = await api(`/api/gallery/folders?accountId=${targetId}`);
        const fjson = await rf.json();
        if (Array.isArray(fjson) && fjson.length) {
          setFolders(["All", ...fjson.filter((f) => f !== "All")]);
        } else {
          setFolders(["All"]);
        }
      } catch { /* non-fatal */ }

      // Images (try canonical endpoint, then fallbacks)
      let imgs = [];
      let ri = await api(`/api/gallery?accountId=${targetId}`);
      if (ri.ok) {
        imgs = await ri.json();
      } else {
        // legacy fallback
        ri = await api(`/api/gallery/images?accountId=${targetId}`);
        if (ri.ok) imgs = await ri.json();
      }
      setImages((Array.isArray(imgs) ? imgs : []).map((im) => ({ ...im, folder: im.folder || "All" })));
    } catch (e) {
      console.error("gallery refresh error", e);
      toast.error("Failed to load gallery.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshAll(); /* on mount + when owner changes */ }, [ownerId]);

  // Upload
  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles?.length || !isOwner) return;
    try {
      const uploads = acceptedFiles.map(async (file) => {
        const fd = new FormData();
        fd.append("file", file, file.name);
        fd.append("accountId", ownerId);
        fd.append("folder", selectedFolder === "All" ? "" : selectedFolder);
        const res = await api(`/api/gallery/upload`, { method: "POST", body: fd });
        if (!res.ok) throw new Error("upload failed");
        return res.json();
      });
      await Promise.all(uploads);
      toast.success("Uploaded ✔");
      refreshAll();
      try { bc.current?.postMessage?.({ type: "gallery:upload", ownerId }); } catch {}
    } catch (e) {
      console.error(e);
      toast.error("Upload failed.");
    }
  }, [isOwner, ownerId, selectedFolder]);

  const { getRootProps, getInputProps, open: openFileDialog } = useDropzone({
    onDrop,
    multiple: true,
    accept: { "image/*": [] },
    noClick: true,
    disabled: !isOwner || !ownerId,
  });

  // Reorder (owner only)
  async function persistReorder(newOrder) {
    try {
      const res = await api(`/api/gallery/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: ownerId, order: newOrder }),
      });
      if (!res.ok) throw new Error("reorder failed");
      try { bc.current?.postMessage?.({ type: "gallery:reordered", ownerId }); } catch {}
    } catch (e) {
      console.error(e);
      toast.error("Could not save order.");
    }
  }

  function onDragEnd(result) {
    if (!result.destination) return;
    const src = result.source.index;
    const dst = result.destination.index;
    const list = filtered.slice(); // list of visible images
    const [moved] = list.splice(src, 1);
    list.splice(dst, 0, moved);

    // Update global images while preserving non-visible items order
    const visibleIds = new Set(filtered.map((i) => i._id || i.id));
    const newVisibleOrder = list.map((i) => i._id || i.id);
    const others = images.filter((i) => !visibleIds.has(i._id || i.id));
    const newGlobal = [...list, ...others];
    setImages(newGlobal);
    persistReorder(newVisibleOrder);
  }

  // Filter + sort
  const filtered = useMemo(() => {
    let list = images;
    if (selectedFolder && selectedFolder !== "All") {
      list = list.filter((i) => (i.folder || "All") === selectedFolder);
    }
    // newest first by default
    list = [...list].sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return list;
  }, [images, selectedFolder]);

  // Open Viewer
  function openViewerAt(idx) { setViewerIndex(idx); }
  function closeViewer() { setViewerIndex(null); }
  function updateGalleryImage(updated) {
    if (!updated) return;
    setImages((curr) => curr.map((im) => ((im._id || im.id) === (updated._id || updated.id) ? { ...im, ...updated } : im)));
  }

  // UI styles
  const card = { background: "#111", border: "1.5px solid #353535", borderRadius: 14, boxShadow: "0 4px 24px rgba(0,0,0,.3)", padding: "1rem", color: "#ffe066" };
  const header = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 };
  const h2 = { margin: 0, fontWeight: 900, letterSpacing: .5, fontSize: 18, color: "#ffe066" };
  const controls = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" };
  const select = { background: "#1a1a1a", color: "#ffe066", border: "1px solid #2d2d2d", borderRadius: 10, padding: "8px 10px", fontWeight: 700 };
  const grid = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 };
  const item = { position: "relative", borderRadius: 10, overflow: "hidden", background: "#0c0c0c", border: "1px solid #262626" };
  const footerRow = { display: "flex", justifyContent: "space-between", marginTop: 10 };

  // Responsive columns
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const mq2 = window.matchMedia("(max-width: 640px)");
    const mq3 = window.matchMedia("(max-width: 900px)");
    const update = () => setCols(mq2.matches ? 2 : (mq3.matches ? 3 : 4));
    update();
    mq2.addEventListener("change", update);
    mq3.addEventListener("change", update);
    return () => { mq2.removeEventListener("change", update); mq3.removeEventListener("change", update); };
  }, []);

  const visible = filtered.slice(0, cols * 2); // show 1–2 rows initially

  return (
    <div style={card} key={ownerId}>
      <div style={header}>
        <h2 style={h2}>Image Gallery</h2>

        <div style={controls}>
          {/* Folder select */}
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FaFolder />
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              style={select}
            >
              {folders.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>

          {/* Create folder (owner) */}
          {isOwner && (
            <button
              type="button"
              onClick={async () => {
                const name = prompt("Folder name");
                if (!name) return;
                try {
                  const res = await api(`/api/gallery/folders`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, accountId: ownerId }),
                  });
                  if (res.status === 409) { toast.error("Folder exists."); return; }
                  if (!res.ok) throw new Error("create folder failed");
                  toast.success("Folder created");
                  refreshAll();
                  try { bc.current?.postMessage?.({ type: "gallery:folder:created", ownerId }); } catch {}
                } catch (e) { toast.error("Could not create folder."); }
              }}
              style={{ ...select, display: "inline-flex", alignItems: "center", gap: 8 }}
              title="Create folder"
            >
              <FaFolderPlus /> New
            </button>
          )}

          {/* Upload (owner) */}
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

          {/* View All */}
          <button
            type="button"
            onClick={() => setShowPopup(true)}
            style={{ ...select, display: "inline-flex", alignItems: "center", gap: 8 }}
            title="Open full gallery"
          >
            <FaEye /> View All
          </button>
        </div>
      </div>

      {/* Grid with drag reorder (owner only) */}
      <DragDropContext onDragEnd={isOwner ? onDragEnd : () => {}}>
        <Droppable droppableId="grid" direction="horizontal" renderClone={null}>
          {(dropProvided) => (
            <div
              ref={dropProvided.innerRef}
              {...dropProvided.droppableProps}
              style={{ ...grid, gridTemplateColumns: `repeat(${cols}, 1fr)` }}
            >
              {visible.map((im, idx) => (
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
                      {...(isOwner ? dragProvided.dragHandleProps : {})}
                      style={{ ...item, ...(dragProvided.draggableProps.style || {}) }}
                      onClick={() => openViewerAt(idx)}
                    >
                      <img
                        src={imgSrc(im)}
                        alt={im.caption || ""}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                        loading="lazy"
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {dropProvided.placeholder}
              {/* filler */}
              {visible.length === 0 && (
                <div style={{ color: "#aaa", padding: 20, gridColumn: `span ${cols}` }}>
                  {loading ? "Loading…" : (isOwner ? "No images yet. Upload to get started." : "No images to show.")}
                </div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div style={footerRow}>
        <button
          type="button"
          onClick={() => setShowPopup(true)}
          style={{ ...select, display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <FaImages /> Open Gallery
        </button>
        <div style={{ fontSize: 12, color: "#aaa", alignSelf: "center" }}>
          Showing {visible.length} / {filtered.length}
        </div>
      </div>

      {/* Full-screen Gallery */}
      {showPopup && (
        <GalleryPopup
          open={showPopup}
          onClose={() => setShowPopup(false)}
          ownerId={ownerId}
          canEdit={isOwner}
          initialFolder={selectedFolder}
        />
      )}

      {/* Single Image Viewer */}
      {viewerIndex !== null && (
        <ImagePopupViewer
          images={filtered}
          popupIndex={viewerIndex}
          closePopup={closeViewer}
          updateGalleryImage={updateGalleryImage}
        />
      )}
    </div>
  );
}
