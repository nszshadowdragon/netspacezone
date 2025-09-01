// frontend/src/components/GalleryPopup.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "react-toastify";
import { FaTimes, FaUpload, FaTrash, FaFolder, FaFolderPlus, FaSearch, FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";
import ImagePopupViewer from "./ImagePopupViewer.jsx";

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

/* ----------------- Helpers ----------------- */
const toAbs = (p) => {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith("/uploads/")) return `${API_HOST}${p}`;
  if (p.startsWith("/")) return p;
  return `/${p}`;
};
const useBroadcast = (name, onMessage) => {
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
    return () => { try { ch?.close(); } catch {} };
  }, [name, onMessage]);
  return ref;
};

/* ========================== Component ========================== */
export default function GalleryPopup({
  open,
  onClose,
  ownerId,
  canEdit = false,
  initialFolder = "All",
}) {
  const containerRef = useRef(null);
  const [folders, setFolders] = useState(["All"]);
  const [folder, setFolder] = useState(initialFolder || "All");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "date", dir: "desc" }); // date|name, asc|desc
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [viewerIdx, setViewerIdx] = useState(null);

  const bc = useBroadcast("nsz:gallery", (msg) => {
    if (msg?.ownerId === ownerId && msg?.type?.startsWith("gallery:")) {
      refreshAll();
    }
  });

  /* ----------- body scroll lock + esc to close ----------- */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  /* ----------- Optional Socket.IO live refresh ----------- */
  useEffect(() => {
    if (!open || !ownerId) return;
    let socket;
    let active = true;
    (async () => {
      try {
        const mod = await import(/* @vite-ignore */ "socket.io-client");
        const io = mod.io || mod.default;
        const s = io(API_HOST, { withCredentials: true, transports: ["websocket"] });
        socket = s;
        s.emit("gallery:join", { ownerId });
        const refresh = () => active && refreshAll();
        s.on("gallery:changed", refresh);
        s.on("gallery:image:created", refresh);
        s.on("gallery:image:deleted", refresh);
        s.on("gallery:image:updated", refresh);
        s.on("gallery:reordered", refresh);
      } catch { /* sockets optional */ }
    })();
    return () => { try { socket?.disconnect(); } catch {} };
  }, [open, ownerId]);

  /* ---------------- Fetch folders & images ---------------- */
  const refreshAll = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      // Folders
      try {
        const rf = await api(`/api/gallery/folders?accountId=${ownerId}`);
        const fjson = await rf.json();
        setFolders(["All", ...(Array.isArray(fjson) ? fjson.filter((f) => f !== "All") : [])]);
      } catch { setFolders((f) => f.length ? f : ["All"]); }

      // Images (primary + legacy fallback)
      let imgs = [];
      let ri = await api(`/api/gallery?accountId=${ownerId}`);
      if (ri.ok) imgs = await ri.json();
      else {
        ri = await api(`/api/gallery/images?accountId=${ownerId}`);
        if (ri.ok) imgs = await ri.json();
      }
      setImages((Array.isArray(imgs) ? imgs : []).map((im) => ({ ...im, folder: im.folder || "All" })));
      setSelectedIds(new Set());
    } catch (e) {
      console.error(e);
      toast.error("Failed to load gallery.");
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => { if (open) refreshAll(); }, [open, ownerId, refreshAll]);

  /* -------------------- Uploads -------------------- */
  const onDrop = useCallback(async (files) => {
    if (!files?.length || !canEdit) return;
    try {
      const uploads = files.map(async (file) => {
        const fd = new FormData();
        fd.append("file", file, file.name);
        fd.append("accountId", ownerId);
        fd.append("folder", folder === "All" ? "" : folder);
        const res = await api(`/api/gallery/upload`, { method: "POST", body: fd });
        if (!res.ok) throw new Error("upload failed");
        return res.json();
      });
      await Promise.all(uploads);
      toast.success("Uploaded ✔");
      refreshAll();
      try { bc.current?.postMessage?.({ type: "gallery:upload", ownerId }); } catch {}
    } catch {
      toast.error("Upload failed.");
    }
  }, [canEdit, ownerId, folder, refreshAll]);

  const { getRootProps, getInputProps, open: openFileDialog } = useDropzone({
    onDrop, multiple: true, accept: { "image/*": [] }, noClick: true, disabled: !canEdit,
  });

  /* -------------------- Bulk delete -------------------- */
  const deleteSelected = async () => {
    if (!selectedIds.size) return;
    if (!confirm(`Delete ${selectedIds.size} image(s)?`)) return;
    try {
      const ids = Array.from(selectedIds);
      // Try a bulk endpoint first, fall back to per-id
      let bulkOk = false;
      try {
        const r = await api(`/api/gallery/bulk-delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: ownerId, ids }),
        });
        bulkOk = r.ok;
      } catch {}
      if (!bulkOk) {
        await Promise.all(ids.map((id) =>
          api(`/api/gallery/${encodeURIComponent(id)}?accountId=${ownerId}`, { method: "DELETE" })
        ));
      }
      toast.success("Deleted.");
      setSelectedIds(new Set());
      refreshAll();
      try { bc.current?.postMessage?.({ type: "gallery:deleted", ownerId }); } catch {}
    } catch {
      toast.error("Delete failed.");
    }
  };

  /* -------------------- Create folder -------------------- */
  const createFolder = async () => {
    const name = prompt("Folder name");
    if (!name) return;
    try {
      const r = await api(`/api/gallery/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: ownerId, name }),
      });
      if (r.status === 409) { toast.error("Folder already exists."); return; }
      if (!r.ok) throw new Error("create folder failed");
      toast.success("Folder created.");
      refreshAll();
      setFolder(name);
      try { bc.current?.postMessage?.({ type: "gallery:folder:created", ownerId }); } catch {}
    } catch {
      toast.error("Could not create folder.");
    }
  };

  /* -------------------- Filtering & sorting -------------------- */
  const filtered = useMemo(() => {
    let list = images;
    if (folder !== "All") list = list.filter((im) => (im.folder || "All") === folder);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      list = list.filter((im) =>
        (im.caption || "").toLowerCase().includes(t) ||
        (im.filename || im.path || "").toLowerCase().includes(t)
      );
    }
    if (sort.key === "name") {
      list = [...list].sort((a, b) =>
        (a.caption || a.filename || "").localeCompare(b.caption || b.filename || "")
      );
    } else {
      list = [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    if (sort.dir === "asc") list.reverse();
    return list;
  }, [images, folder, q, sort]);

  /* -------------------- Selection helpers -------------------- */
  const toggleSelect = (id, multi = false) => {
    setSelectedIds((curr) => {
      const next = new Set(multi ? curr : []);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  /* -------------------- Styles -------------------- */
  const backdrop = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 2000,
    display: open ? "block" : "none",
  };
  const card = {
    position: "fixed", inset: "5% 4%", background: "#0b0b0b", color: "#ffe066",
    border: "1.5px solid #2e2e2e", borderRadius: 14, zIndex: 2001, boxShadow: "0 12px 48px rgba(0,0,0,.55)",
    display: "flex", flexDirection: "column", overflow: "hidden",
  };
  const header = {
    padding: "10px 12px", borderBottom: "1px solid #262626", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
    background: "linear-gradient(180deg, rgba(255,226,89,.08), rgba(0,0,0,0))",
  };
  const title = { fontWeight: 900, letterSpacing: .4, marginRight: "auto" };
  const select = { background: "#161616", color: "#ffe066", border: "1px solid #2d2d2d", borderRadius: 10, padding: "7px 9px", fontWeight: 700 };
  const iconBtn = { ...select, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" };
  const searchBox = {
    display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px",
    border: "1px solid #2d2d2d", borderRadius: 10, background: "#161616",
  };
  const gridWrap = { padding: 12, overflow: "auto", flex: 1 };
  const grid = {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 8,
  };
  const tile = { position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #262626", background: "#0e0e0e", cursor: "pointer" };
  const selBadge = { position: "absolute", top: 6, left: 6, background: selectedColor(), color: "#000", padding: "2px 8px", borderRadius: 999, fontWeight: 900, fontSize: 12 };
  function selectedColor() { return "#16ff80"; }

  /* -------------------- Render -------------------- */
  if (!open) return null;

  return (
    <>
      {/* Backdrop click closes */}
      <div style={backdrop} onClick={() => onClose?.()} />
      <div
        ref={containerRef}
        style={card}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div style={header} {...getRootProps()}>
          <h2 style={title}>Gallery — View All</h2>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FaFolder />
            <select value={folder} onChange={(e) => setFolder(e.target.value)} style={select}>
              {folders.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>

          {canEdit && (
            <>
              <button type="button" onClick={createFolder} style={iconBtn} title="New folder">
                <FaFolderPlus /> New
              </button>

              <button type="button" onClick={() => openFileDialog()} style={iconBtn} title="Upload images">
                <FaUpload /> Upload
              </button>
              <input {...getInputProps()} />
            </>
          )}

          <span style={searchBox}>
            <FaSearch />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search caption or filename"
              style={{ background: "transparent", border: "none", outline: "none", color: "#ffe066", width: 180 }}
            />
          </span>

          <button
            type="button"
            onClick={() => setSort((s) => s.key === "date" ? { ...s, key: "name" } : { ...s, key: "date" })}
            style={iconBtn}
            title={sort.key === "date" ? "Sort by name" : "Sort by date"}
          >
            {sort.key === "date" ? "Date" : "Name"}
            {sort.dir === "desc" ? <FaSortAmountDown /> : <FaSortAmountUp />}
          </button>

          <button
            type="button"
            onClick={() => setSort((s) => ({ ...s, dir: s.dir === "desc" ? "asc" : "desc" }))}
            style={iconBtn}
            title="Toggle direction"
          >
            Dir
            {sort.dir === "desc" ? <FaSortAmountDown /> : <FaSortAmountUp />}
          </button>

          {canEdit && (
            <button
              type="button"
              disabled={!selectedIds.size}
              onClick={deleteSelected}
              style={{ ...iconBtn, opacity: selectedIds.size ? 1 : .5 }}
              title="Delete selected"
            >
              <FaTrash /> {selectedIds.size || 0}
            </button>
          )}

          <button
            type="button"
            onClick={() => onClose?.()}
            style={{ ...iconBtn, paddingInline: 10 }}
            title="Close"
          >
            <FaTimes />
          </button>
        </div>

        {/* GRID */}
        <div style={gridWrap}>
          <div style={{ ...grid, gridTemplateColumns: gridColsCSS() }}>
            {filtered.map((im, idx) => {
              const id = String(im._id || im.id || im.filename || idx);
              const isSel = selectedIds.has(id);
              return (
                <div
                  key={id}
                  style={{ ...tile, outline: isSel ? `2px solid ${selectedColor()}` : "none" }}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey) toggleSelect(id, true);
                    else if (e.shiftKey) toggleSelect(id, true);
                    else setViewerIdx(idx);
                  }}
                  onDoubleClick={() => setViewerIdx(idx)}
                >
                  <img
                    src={toAbs(im.path || im.url || im.src || im.filename)}
                    alt={im.caption || ""}
                    loading="lazy"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { e.currentTarget.style.opacity = .4; }}
                  />
                  {isSel && <span style={selBadge}>✓</span>}
                </div>
              );
            })}

            {!loading && filtered.length === 0 && (
              <div style={{ gridColumn: "1 / -1", color: "#aaa", padding: 20 }}>
                {q || folder !== "All"
                  ? "No results."
                  : (canEdit ? "No images yet. Upload to get started." : "No images to show.")}
              </div>
            )}
          </div>
        </div>

        {/* VIEWER (inside the popup so focus stays contained) */}
        {viewerIdx !== null && (
          <ImagePopupViewer
            images={filtered}
            popupIndex={viewerIdx}
            closePopup={() => setViewerIdx(null)}
            updateGalleryImage={(updated) => {
              if (!updated) return;
              setImages((curr) =>
                curr.map((im) => ((im._id || im.id) === (updated._id || updated.id) ? { ...im, ...updated } : im))
              );
            }}
          />
        )}

        {/* Footer actions */}
        <div style={{ padding: "8px 12px", borderTop: "1px solid #262626", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#aaa" }}>{loading ? "Loading…" : `${filtered.length} image(s)`}</span>
          {!!selectedIds.size && (
            <>
              <span style={{ color: "#aaa" }}>•</span>
              <button type="button" onClick={clearSelection} style={iconBtn}>Clear selection</button>
            </>
          )}
        </div>
      </div>
    </>
  );

  /* -------------------- utils -------------------- */
  function gridColsCSS() {
    // Responsive columns without extra CSS:
    const w = window.innerWidth || 1200;
    if (w < 520) return "repeat(2, 1fr)";
    if (w < 820) return "repeat(3, 1fr)";
    if (w < 1140) return "repeat(4, 1fr)";
    if (w < 1400) return "repeat(5, 1fr)";
    return "repeat(6, 1fr)";
  }
}
