import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FaFolder, FaUpload, FaSyncAlt, FaTimes } from "react-icons/fa";
import ImagePopupViewer from "./ImagePopupViewer.jsx";

/* ---------- API base ---------- */
const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
const isLocal = (() => { try { const h = window.location.hostname; return h === "localhost" || h === "127.0.0.1"; } catch { return true; }})();
const API_FALLBACK = isLocal ? "http://localhost:5000" : "https://api.netspacezone.com";
const API_BASE = (env.VITE_API_BASE || env.VITE_API_BASE_URL || API_FALLBACK).replace(/\/$/, "");
const FILE_HOST = API_BASE;

/* ---------- helpers ---------- */
const idOf = (im) => String(im?._id || im?.id || im?.filename || "");
const imgSrc = (x) => {
  if (!x) return "";
  if (typeof x === "string") return x;
  const p = x.path || x.url || x.src || x.filename || "";
  if (/^(https?:|blob:|data:)/i.test(p)) return p;
  if (p.startsWith?.("/uploads/")) return `${FILE_HOST}${p}`;
  if (p.startsWith?.("/")) return p;
  return `/${p}`;
};
const filterAndSort = (images, folder) => {
  const base = folder && folder !== "All" ? images.filter((i) => (i.folder || "All") === folder) : images;
  return [...base].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("authToken") ||
  sessionStorage.getItem("token") ||
  "";

const api = (path, opts = {}) =>
  fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { ...(opts.headers || {}), ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    ...opts,
  });

export default function GalleryPopup({
  open = false,
  onClose,
  ownerId,
  ownerUsername = "",
  canEdit = false,
  initialFolder = "All",
}) {
  const [folders, setFolders] = useState(["All"]);
  const [folder, setFolder] = useState(initialFolder || "All");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(null);
  const [viewerKey, setViewerKey] = useState(0);
  const [status, setStatus] = useState("");

  function listPath() {
    const qs = new URLSearchParams();
    if (ownerId) qs.set("accountId", ownerId);
    if (ownerId) qs.set("userId", ownerId);
    if (ownerUsername) qs.set("username", ownerUsername);
    return `/api/gallery?${qs.toString()}`;
  }
  function foldersPath() {
    const qs = new URLSearchParams();
    if (ownerId) qs.set("accountId", ownerId);
    if (ownerId) qs.set("userId", ownerId);
    if (ownerUsername) qs.set("username", ownerUsername);
    return `/api/gallery/folders?${qs.toString()}`;
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const refresh = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      try {
        const rf = await api(foldersPath());
        if (rf.ok) {
          const j = await rf.json().catch(() => null);
          const arr = Array.isArray(j) ? j : Array.isArray(j?.folders) ? j.folders : [];
          const extra = (arr || []).filter((f) => f && f !== "All" && String(f).toLowerCase() !== "root");
          setFolders(["All", ...Array.from(new Set(extra))]);
        }
      } catch {}
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
  }, [open, ownerId, ownerUsername, initialFolder]);

  useEffect(() => { if (open) refresh(); }, [open, ownerId, ownerUsername, refresh]);

  async function uploadOne(file) {
    const token = getToken();
    const fd = new FormData();
    fd.append("image", file, file.name);
    if (ownerId) fd.append("accountId", ownerId);
    if (ownerId) fd.append("userId", ownerId);
    if (ownerUsername) fd.append("username", ownerUsername);
    if (folder && folder !== "All") fd.append("folder", folder);

    const r = await fetch(`${API_BASE}/api/gallery`, {
      method: "POST",
      body: fd,
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (r.status === 200 || r.status === 201 || r.status === 204) {
      try { return await r.json(); } catch { return {}; }
    }
    const t = await r.text().catch(() => "");
    throw new Error(`${r.status} ${r.statusText} — ${t.slice(0, 160)}`);
  }

  const onPickFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) { setStatus("No files selected."); return; }
    if (!canEdit) { setStatus("Not allowed to upload here."); return; }

    setStatus(`Selected ${files.length} file(s)…`);

    const temps = files.map((f) => {
      const url = URL.createObjectURL(f);
      return { _id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`, url, path: url, folder: folder || "All", createdAt: Date.now(), __temp: true };
    });
    setImages((curr) => [...temps, ...curr]);

    for (const f of files) {
      try {
        if (f.size > 20 * 1024 * 1024) { setStatus(`Rejected ${f.name}: >20MB`); continue; }
        await uploadOne(f);
        setStatus(`Uploaded ${f.name}`);
        await refresh();
      } catch (e) {
        setImages((curr) => {
          const i = curr.findIndex((x) => x.__temp);
          if (i === -1) return curr;
          const next = curr.slice(); next.splice(i, 1); return next;
        });
        setStatus(`Failed ${f.name}: ${e?.message || e}`);
      }
    }
    setTimeout(() => setStatus(""), 2200);
  }, [ownerId, ownerUsername, folder, canEdit, refresh]);

  if (!open) return null;

  const GAP = 12;
  const overlay = { position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: GAP, isolation: "isolate" };
  const frame = { width: "min(1400px, 100%)", height: "min(86vh, 100%)", background: "#0b0b0b", border: "1px solid #2d2d2d", borderRadius: 14, boxShadow: "0 10px 40px rgba(0,0,0,.6)", display: "flex", flexDirection: "column", overflow: "hidden" };
  const header = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid #222", color: "#ffe066" };
  const left = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
  const right = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
  const btn = { background: "#1a1a1a", color: "#ffe066", border: "1px solid #2d2d2d", borderRadius: 10, padding: "8px 10px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" };
  const select = { ...btn };
  const body = { flex: 1, overflow: "auto", padding: 12 };
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 };
  const tile = { position: "relative", background: "#0e0e0e", border: "1px solid #262626", borderRadius: 10, overflow: "hidden", aspectRatio: "4 / 3", cursor: "pointer" };
  const footer = { padding: 10, borderTop: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "space-between", color: "#888", fontSize: 13 };

  return createPortal(
    <div
      style={overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Gallery Manager"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div style={frame} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <div style={left}>
            <strong>Gallery Manager</strong>

            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <FaFolder />
              <select value={folder} onChange={(e) => setFolder(e.target.value)} style={select} aria-label="Select folder">
                {folders.map((f) => (<option key={f} value={f}>{f}</option>))}
              </select>
            </label>

            {canEdit && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }} title="Upload images">
                <span style={btn}><FaUpload /> Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => { const files = e.target.files; onPickFiles(files); e.target.value = ""; }}
                />
              </label>
            )}
          </div>

          <div style={right}>
            <div style={{ fontSize: 12, color: "#aaa", minHeight: 18 }}>{status}</div>
            <button type="button" onClick={refresh} style={btn} title="Refresh"><FaSyncAlt /> Refresh</button>
            <button type="button" onClick={onClose} style={btn} title="Close gallery"><FaTimes /> Close</button>
          </div>
        </div>

        <div style={body}>
          <div style={grid}>
            {filterAndSort(images, folder).map((im, i) => (
              <div key={idOf(im) || im.path || i} style={{ ...tile, opacity: im.__temp ? 0.7 : 1 }} onClick={() => setViewerIdx(i)} role="button" tabIndex={0}>
                <img src={imgSrc(im)} alt={im.caption || ""} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                {im.__temp && (
                  <div style={{ position: "absolute", bottom: 6, right: 6, fontSize: 12, background: "rgba(0,0,0,.6)", padding: "2px 6px", borderRadius: 6, border: "1px solid #333" }}>
                    uploading…
                  </div>
                )}
              </div>
            ))}
            {!loading && images.length === 0 && (
              <div style={{ color: "#aaa", gridColumn: "1 / -1", padding: 20 }}>No images in this folder.</div>
            )}
          </div>
        </div>

        <div style={footer}>
          <div>Images in “{folder}”</div>
          <div>{loading ? "Loading…" : `Showing ${filterAndSort(images, folder).length} / ${images.length}`}</div>
        </div>
      </div>

      {viewerIdx !== null && filterAndSort(images, folder).length > 0 && (
        <ImagePopupViewer
          key={viewerKey}
          ownerId={ownerId}
          fileHost={FILE_HOST}
          images={filterAndSort(images, folder)}
          popupIndex={viewerIdx}
          closePopup={() => setViewerIdx(null)}
          updateGalleryImage={(updated) => {
            if (!updated) return;
            setImages((curr) => curr.map((im) => (idOf(im) === idOf(updated) ? { ...im, ...updated } : im)));
          }}
        />
      )}
    </div>,
    document.body
  );
}
