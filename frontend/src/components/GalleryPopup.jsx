// frontend/src/components/GalleryPopup.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDropzone } from "react-dropzone";
import { FaFolder, FaUpload, FaSyncAlt, FaTimes } from "react-icons/fa";
import ImagePopupViewer from "./ImagePopupViewer.jsx";
import socket, { connectSocket, joinGallery, leaveGallery } from "../socket";

/* -------------------- API base + file host -------------------- */
const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
const API_BASE = (env.VITE_API_BASE || "").replace(/\/$/, "");
const isLocal = (() => {
  try {
    const h = window.location.hostname;
    return h === "localhost" || h === "127.0.0.1";
  } catch { return true; }
})();
const FILE_HOST = API_BASE || (isLocal ? "http://localhost:5000" : "");
const api = (path, opts = {}) => fetch(`${API_BASE}${path}`, { credentials: "include", ...opts });

/* -------------------- endpoints discovery -------------------- */
const CANDIDATES = {
  list: (ownerId) => [
    `/api/gallery?accountId=${ownerId}`,
    `/api/gallery/images?accountId=${ownerId}`,
    `/api/images?accountId=${ownerId}`,
    `/api/photos?accountId=${ownerId}`,
    `/api/users/${ownerId}/gallery`,
    `/api/user/${ownerId}/gallery`,
  ],
  folders: (ownerId) => [
    `/api/gallery/folders?accountId=${ownerId}`,
    `/api/folders?scope=gallery&accountId=${ownerId}`,
    `/api/users/${ownerId}/gallery/folders`,
  ],
  upload: [
    { path: `/api/gallery`, field: "image" },
    { path: `/api/gallery/upload`, field: "image" },
    { path: `/api/images`, field: "image" },
    { path: `/api/media/upload`, field: "image" },
    { path: `/api/upload`, field: "image" },
  ],
};

async function toJsonSafe(r) { try { return await r.json(); } catch { return null; } }

async function discover(ownerId) {
  const find = async (arr, expectArrayKey) => {
    for (const url of arr) {
      try {
        const r = await api(url);
        if (!r.ok) continue;
        const j = await toJsonSafe(r);
        if (Array.isArray(j) || (expectArrayKey && Array.isArray(j?.[expectArrayKey]))) {
          return { url, json: j };
        }
      } catch {}
    }
    return null;
  };
  const list = await find(CANDIDATES.list(ownerId), "images");
  const folders = await find(CANDIDATES.folders(ownerId), "folders");
  return { list: list?.url || null, folders: folders?.url || null };
}

/* -------------------- helpers -------------------- */
const idOf = (im) => String(im?._id || im?.id || im?.filename || "");
function imgSrc(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  const p = x.path || x.url || x.src || x.filename || "";
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith?.("/uploads/")) return `${FILE_HOST}${p}`;
  if (p.startsWith?.("/")) return p;
  return `/${p}`;
}

/* -------------------- component -------------------- */
export default function GalleryPopup({
  open = false,
  onClose,
  ownerId,
  canEdit = false,
  initialFolder = "All",
}) {
  const [endpoints, setEndpoints] = useState(null);
  const [folders, setFolders] = useState(["All"]);
  const [folder, setFolder] = useState(initialFolder || "All");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(null);

  // lock background scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // discover endpoints
  useEffect(() => {
    if (!open || !ownerId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const d = await discover(ownerId);
      if (!alive) return;
      setEndpoints(d);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [open, ownerId]);

  // load folders + images
  const refresh = useCallback(async () => {
    if (!open || !ownerId || !endpoints) return;
    setLoading(true);
    try {
      // folders
      if (endpoints.folders) {
        try {
          const rf = await api(endpoints.folders);
          if (rf.ok) {
            const j = await toJsonSafe(rf);
            const arr = Array.isArray(j) ? j : (Array.isArray(j?.folders) ? j.folders : []);
            // Keep only user-created folders; strip "root" and duplicates
            const extra = (arr || [])
              .filter((f) => f && f !== "All" && String(f).toLowerCase() !== "root");
            setFolders(["All", ...Array.from(new Set(extra))]);
          } else {
            setFolders(["All"]);
          }
        } catch {
          setFolders(["All"]);
        }
      } else {
        setFolders(["All"]);
      }
      // images
      if (endpoints.list) {
        const ri = await api(endpoints.list);
        if (ri.ok) {
          const j = await toJsonSafe(ri);
          const arr = Array.isArray(j) ? j : (Array.isArray(j?.images) ? j.images : []);
          setImages((arr || []).map((im) => ({ ...im, folder: im.folder || "All" })));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [open, ownerId, endpoints]);

  useEffect(() => { if (endpoints) refresh(); }, [endpoints, refresh]);

  // realtime sync
  useEffect(() => {
    if (!open || !ownerId) return;
    connectSocket();
    joinGallery(String(ownerId));

    const onCreated = (evt) => {
      const im = evt?.payload || evt;
      if (!im) return refresh();
      setImages((curr) => [im, ...curr]);
    };
    const onDeleted = (evt) => {
      const im = evt?.payload || evt;
      const id = idOf(im);
      if (!id) return refresh();
      setImages((curr) => curr.filter((x) => idOf(x) !== id));
    };
    const onUpdated = (evt) => {
      const im = evt?.payload || evt;
      if (!im) return refresh();
      const id = idOf(im);
      setImages((curr) => {
        let found = false;
        const next = curr.map((x) => {
          if (idOf(x) === id) { found = true; return { ...x, ...im }; }
          return x;
        });
        return found ? next : [im, ...next];
      });
    };

    socket.on("gallery:image:created", onCreated);
    socket.on("gallery:image:deleted", onDeleted);
    socket.on("gallery:image:updated", onUpdated);

    return () => {
      socket.off("gallery:image:created", onCreated);
      socket.off("gallery:image:deleted", onDeleted);
      socket.off("gallery:image:updated", onUpdated);
      leaveGallery(String(ownerId));
    };
  }, [open, ownerId, refresh]);

  // upload
  const onDrop = useCallback(async (accepted) => {
    if (!canEdit || !accepted?.length) return;
    for (const f of accepted) {
      if (f.size > 20 * 1024 * 1024) continue;
      for (const { path, field } of CANDIDATES.upload) {
        try {
          const fd = new FormData();
          fd.append(field, f, f.name);
          fd.append("accountId", ownerId);
          if (folder && folder !== "All") fd.append("folder", folder);
          const r = await fetch(`${API_BASE}${path}`, { method: "POST", body: fd, credentials: "include" });
          if (r.ok) break;
        } catch {}
      }
    }
    refresh();
  }, [canEdit, ownerId, folder, refresh]);

  const { getRootProps, getInputProps, open: openFileDialog } = useDropzone({
    onDrop,
    multiple: true,
    accept: { "image/*": [] },
    maxSize: 20 * 1024 * 1024,
    noClick: true,
    disabled: !canEdit || !ownerId,
  });

  const filtered = useMemo(() => {
    const list = folder === "All" ? images : images.filter((i) => (i.folder || "All") === folder);
    return [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [images, folder]);

  if (!open) return null;

  /* -------------------- styles -------------------- */
  const GAP = 12;
  const overlay = {
    position: "fixed",
    inset: 0,
    zIndex: 9998,
    background: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: `max(${GAP}px, env(safe-area-inset-top))`,
    paddingRight: `max(${GAP}px, env(safe-area-inset-right))`,
    paddingBottom: `max(${GAP}px, env(safe-area-inset-bottom))`,
    paddingLeft: `max(${GAP}px, env(safe-area-inset-left))`,
  };
  const frame = {
    width: "min(1400px, 100%)",
    height: "min(86vh, 100%)",
    background: "#0b0b0b",
    border: "1px solid #2d2d2d",
    borderRadius: 14,
    boxShadow: "0 10px 40px rgba(0,0,0,.6)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };
  const header = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderBottom: "1px solid #222",
    color: "#ffe066",
  };
  const left = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
  const right = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
  const btn = {
    background: "#1a1a1a",
    color: "#ffe066",
    border: "1px solid #2d2d2d",
    borderRadius: 10,
    padding: "8px 10px",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
  const select = { ...btn };
  const body = {
    flex: 1,
    overflow: "auto",
    padding: 12,
  };
  const grid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 10,
  };
  const tile = {
    position: "relative",
    background: "#0e0e0e",
    border: "1px solid #262626",
    borderRadius: 10,
    overflow: "hidden",
    aspectRatio: "4 / 3",
    cursor: "pointer",
  };
  const footer = {
    padding: 10,
    borderTop: "1px solid #222",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: "#888",
    fontSize: 13,
  };

  return createPortal(
    <>
      <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
        <div style={frame} onClick={(e) => e.stopPropagation()}>
          {/* header */}
          <div style={header}>
            <div style={left}>
              <strong>Gallery Manager</strong>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <FaFolder />
                <select value={folder} onChange={(e) => setFolder(e.target.value)} style={select}>
                  {folders.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>

              {canEdit && (
                <div {...getRootProps()} style={{ display: "inline-flex", alignItems: "center" }}>
                  <button type="button" onClick={openFileDialog} style={btn} title="Upload images">
                    <FaUpload /> Upload
                  </button>
                  <input {...getInputProps()} />
                </div>
              )}
            </div>

            <div style={right}>
              <button type="button" onClick={refresh} style={btn} title="Refresh">
                <FaSyncAlt /> Refresh
              </button>
              <button type="button" onClick={onClose} style={btn} title="Close">
                <FaTimes /> Close
              </button>
            </div>
          </div>

          {/* body */}
          <div style={body}>
            <div style={grid}>
              {filtered.map((im, i) => (
                <div
                  key={idOf(im) || i}
                  style={tile}
                  onClick={() => setViewerIdx(i)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setViewerIdx(i); }}
                  role="button"
                  tabIndex={0}
                >
                  <img
                    src={imgSrc(im)}
                    alt={im.caption || ""}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.opacity = 0.4; }}
                  />
                </div>
              ))}

              {!loading && filtered.length === 0 && (
                <div style={{ color: "#aaa", gridColumn: "1 / -1", padding: 20 }}>
                  No images in this folder.
                </div>
              )}
            </div>
          </div>

          {/* footer */}
          <div style={footer}>
            <div>Images in “{folder}”</div>
            <div>{loading ? "Loading…" : `Showing ${filtered.length} / ${images.length}`}</div>
          </div>
        </div>
      </div>

      {/* Individual viewer from inside manager */}
      {viewerIdx !== null && (
        <ImagePopupViewer
          ownerId={ownerId}
          fileHost={FILE_HOST}
          images={filtered}
          popupIndex={viewerIdx}
          closePopup={() => setViewerIdx(null)}
          updateGalleryImage={(updated) => {
            if (!updated) return;
            setImages((curr) => curr.map((im) =>
              ((im._id || im.id) === (updated._id || updated.id) ? { ...im, ...updated } : im)
            ));
          }}
        />
      )}
    </>,
    document.body
  );
}
