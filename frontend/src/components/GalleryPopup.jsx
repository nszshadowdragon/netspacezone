// frontend/src/components/GalleryPopup.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDropzone } from "react-dropzone";
import { FaFolder, FaUpload, FaSyncAlt, FaTimes } from "react-icons/fa";
import ImagePopupViewer from "./ImagePopupViewer.jsx";
import socket, { connectSocket, joinGallery, leaveGallery } from "../socket";

/* -------------------- API base + file host (with prod fallback) -------------------- */
const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
const isLocal = (() => {
  try {
    const h = window.location.hostname;
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return true;
  }
})();
const API_FALLBACK = isLocal ? "" : "https://api.netspacezone.com";
const API_BASE = (env.VITE_API_BASE || API_FALLBACK).replace(/\/$/, "");
const FILE_HOST = API_BASE || (isLocal ? "http://localhost:5000" : "https://api.netspacezone.com");

const api = (path, opts = {}) =>
  fetch(`${API_BASE}${path}`, { credentials: "include", ...opts });

/* -------------------- canonical endpoints -------------------- */
const ENDPOINTS = {
  list:     (ownerId) => `/api/gallery?accountId=${ownerId}`,
  folders:  (ownerId) => `/api/gallery/folders?accountId=${ownerId}`,
  upload:   { path: `/api/gallery`, field: "image" }, // POST multipart
};

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
function filterAndSort(images, folder) {
  const base = folder && folder !== "All" ? images.filter((i) => (i.folder || "All") === folder) : images;
  return [...base].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

/* -------------------- component -------------------- */
export default function GalleryPopup({
  open = false,
  onClose,
  ownerId,
  canEdit = false,
  initialFolder = "All",
}) {
  const [folders, setFolders] = useState(["All"]);
  const [folder, setFolder] = useState(initialFolder || "All");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  // viewer index within the *filtered* list
  const [viewerIdx, setViewerIdx] = useState(null);
  // bump this to remount viewer when the filtered list changes (e.g., on delete)
  const [viewerKey, setViewerKey] = useState(0);

  // lock background scroll while this modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const refresh = useCallback(async () => {
    if (!open || !ownerId) return;
    setLoading(true);
    try {
      // folders
      try {
        const rf = await api(ENDPOINTS.folders(ownerId));
        if (rf.ok) {
          const j = await rf.json().catch(() => null);
          const arr = Array.isArray(j) ? j : Array.isArray(j?.folders) ? j.folders : [];
          const extra = (arr || [])
            .filter((f) => f && f !== "All" && String(f).toLowerCase() !== "root");
          setFolders(["All", ...Array.from(new Set(extra))]);
        } else {
          setFolders((f) => f.length ? f : ["All"]);
        }
      } catch {
        setFolders((f) => f.length ? f : ["All"]);
      }

      // images
      try {
        const ri = await api(ENDPOINTS.list(ownerId));
        if (ri.ok) {
          const j = await ri.json().catch(() => null);
          const arr = Array.isArray(j) ? j : Array.isArray(j?.images) ? j.images : [];
          setImages((arr || []).map((im) => ({ ...im, folder: im.folder || "All" })));
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [open, ownerId]);

  useEffect(() => {
    if (open) refresh();
  }, [open, ownerId, refresh]);

  // realtime sync + deletion-aware viewer continuity
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
      const delId = idOf(im);
      if (!delId) return refresh();

      setImages((curr) => {
        // compute filtered lists before & after to keep viewer on next/prev item
        const prevFiltered = filterAndSort(curr, folder);
        const prevIdxInFiltered = prevFiltered.findIndex((x) => idOf(x) === delId);

        const nextCurr = curr.filter((x) => idOf(x) !== delId);
        const nextFiltered = filterAndSort(nextCurr, folder);

        // If viewer was open and the deleted image was visible in this folder
        if (viewerIdx !== null && prevIdxInFiltered !== -1) {
          if (nextFiltered.length > 0) {
            const nextIdx = Math.min(viewerIdx, nextFiltered.length - 1);
            // remount viewer on new index so it doesn't “white screen”
            setViewerIdx(nextIdx);
            setViewerKey((k) => k + 1);
          } else {
            // nothing left—close the viewer
            setViewerIdx(null);
          }
        }

        return nextCurr;
      });
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
  }, [open, ownerId, folder, viewerIdx]);

  // upload
  const onDrop = useCallback(
    async (accepted) => {
      if (!canEdit || !accepted?.length) return;

      for (const f of accepted) {
        if (f.size > 20 * 1024 * 1024) continue;

        try {
          const fd = new FormData();
          fd.append(ENDPOINTS.upload.field, f, f.name);
          fd.append("accountId", ownerId);
          if (folder && folder !== "All") fd.append("folder", folder);

          const r = await fetch(`${API_BASE}${ENDPOINTS.upload.path}`, {
            method: "POST",
            body: fd,
            credentials: "include",
          });

          if (!r.ok) {
            const t = await r.text().catch(() => "");
            console.warn("Upload failed:", r.status, r.statusText, t.slice(0, 200));
          }
        } catch (e) {
          console.warn("Upload error:", e?.message || e);
        }
      }

      refresh();
    },
    [canEdit, ownerId, folder, refresh]
  );

  const { getRootProps, getInputProps, open: openFileDialog } = useDropzone({
    onDrop,
    multiple: true,
    accept: { "image/*": [] },
    maxSize: 20 * 1024 * 1024,
    noClick: true,
    disabled: !canEdit || !ownerId,
  });

  const filtered = useMemo(() => filterAndSort(images, folder), [images, folder]);

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
    isolation: "isolate",
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

  // Component-scoped CSS that enforces the mobile layout for ImagePopupViewer.
  // ≥1024px: meta left, image right; <1024px: image on top, meta below.
  const viewerMobileCss = `
    @media (max-width: 1024px) {
      .iv-frame {
        display: grid !important;
        grid-template-columns: 1fr !important;
        grid-template-areas: "stage" "meta" !important;
        height: auto !important;
        max-height: 100vh !important;
      }
      .iv-stageWrap { grid-area: stage !important; }
      .iv-meta { grid-area: meta !important; border-right: none !important; border-top: 1px solid #262626 !important; }
      .iv-stage img { width: 100% !important; height: auto !important; object-fit: contain !important; max-height: 70vh !important; }
      .iv-navZone { width: 72px !important; }
      .iv-countBadge { left: 10px !important; top: 10px !important; }
    }
    @media (max-width: 640px) {
      .iv-navZone { display: none !important; } /* prevent paddles covering the image on tiny screens */
      .iv-stageWrap { max-height: 65vh !important; }
      .iv-countBadge { left: 8px !important; top: 8px !important; }
    }
  `;

  return createPortal(
    <>
      <div
        style={overlay}
        role="dialog"
        aria-modal="true"
        aria-label="Gallery Manager"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        <div style={frame} onClick={(e) => e.stopPropagation()}>
          {/* header */}
          <div style={header}>
            <div style={left}>
              <strong>Gallery Manager</strong>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <FaFolder />
                <select value={folder} onChange={(e) => setFolder(e.target.value)} style={select} aria-label="Select folder">
                  {folders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
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
              <button type="button" onClick={onClose} style={btn} title="Close gallery">
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setViewerIdx(i);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Open image"
                >
                  <img
                    src={imgSrc(im)}
                    alt={im.caption || ""}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.opacity = 0.4;
                    }}
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

      {/* Force mobile behavior for the viewer regardless of any parent styles */}
      <style>{viewerMobileCss}</style>

      {/* Individual viewer from inside manager */}
      {viewerIdx !== null && filtered.length > 0 && (
        <ImagePopupViewer
          key={viewerKey}              // remount on deletes so we land on next/prev
          ownerId={ownerId}
          fileHost={FILE_HOST}
          images={filtered}
          popupIndex={viewerIdx}
          closePopup={() => setViewerIdx(null)}
          updateGalleryImage={(updated) => {
            if (!updated) return;
            setImages((curr) =>
              curr.map((im) =>
                (idOf(im) === idOf(updated) ? { ...im, ...updated } : im
              ))
            );
          }}
        />
      )}
    </>,
    document.body
  );
}
