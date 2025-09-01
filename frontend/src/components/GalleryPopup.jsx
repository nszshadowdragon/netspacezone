// src/components/GalleryPopup.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import ImagePopupViewer from "./ImagePopupViewer";
import { useDropzone } from "react-dropzone";
import { toast } from "react-toastify";
import {
  FaSearch, FaTimes, FaTrash, FaFolderPlus, FaFolder, FaChevronLeft,
  FaChevronRight, FaCheckSquare, FaRegSquare, FaImages, FaSortAmountDown, FaUpload
} from "react-icons/fa";

const API_BASE = 'http://localhost:5000';
function apiFetch(url, options = {}) { return fetch(url, { credentials: "include", ...options }); }
function getGalleryImgSrc(pathOrObj) {
  let path = pathOrObj;
  if (!path) return "";
  if (typeof path === "object" && path.path) path = path.path;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/uploads")) return `${API_BASE}${path}`;
  if (path.startsWith("/")) return path;
  return "/" + path;
}

// space to clear the fixed header + some breathing room
const SAFE_TOP = 88;      // tweak if your header is taller/shorter
const SAFE_BOTTOM = 32;

const modalBackdrop = {
  position: "fixed",
  zIndex: 2500,
  inset: 0,
  background: "rgba(0,0,0,0.94)",
  display: "flex",
  alignItems: "flex-start", // anchor to top
  justifyContent: "center",
  paddingTop: `calc(${SAFE_TOP}px + env(safe-area-inset-top, 0px))`,
  paddingBottom: `calc(${SAFE_BOTTOM}px + env(safe-area-inset-bottom, 0px))`,
  paddingLeft: "16px",
  paddingRight: "16px",
  boxSizing: "border-box",
};

const modalShell = {
  width: "min(1200px, 96vw)",
  maxHeight: `calc(100vh - ${SAFE_TOP + SAFE_BOTTOM}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`,
  height: "min(820px, 96vh)",
  background: "#111",
  borderRadius: 18,
  border: "1.5px solid #353535",
  boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerBar = { padding: "14px 18px", borderBottom: "1px solid #262626", display: "grid", gap: 12, alignItems: "center", gridTemplateColumns: "1fr auto" };
const titleStyle = { color: "#ffe066", fontWeight: 900, letterSpacing: 1, fontSize: 20, display: "flex", alignItems: "center", gap: 10 };
const controlsRow = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 };
const pill = { background: "#232323", color: "#ffe066", border: "1px solid #2d2d2d", borderRadius: 10, padding: "8px 12px", fontWeight: 700 };
const searchWrap = { position: "relative", minWidth: 260, flex: "1 1 260px" };
const searchInput = { width: "100%", padding: "10px 36px 10px 36px", borderRadius: 10, border: "1px solid #2e2e2e", background: "#181818", color: "#eee", fontSize: 14, outline: "none" };
const bodyWrap = { display: "grid", gridTemplateColumns: "220px 1fr", minHeight: 0, flex: "1 1 auto" };
const sidebar = { borderRight: "1px solid #262626", padding: 14, overflow: "auto" };
const content = { padding: 14, overflow: "auto", position: "relative" };
const gridWrap = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 };
const tile = { position: "relative", borderRadius: 12, overflow: "hidden", background: "#191919", border: "1px solid #2a2a2a", cursor: "pointer" };

export default function GalleryPopup({
  open = false,
  onClose = () => {},
  ownerId,           // profile owner's id
  canEdit = false,   // whether the viewer can edit (owner)
  initialFolder = "All",
}) {
  const { user } = useAuth();
  const accountId = ownerId || user?._id || ""; // ALWAYS owner’s id
  const isOwner = !!canEdit;

  const [folders, setFolders] = useState(["All"]);
  const [selectedFolder, setSelectedFolder] = useState(initialFolder || "All");
  const [images, setImages] = useState([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest"); // newest | oldest | mostLiked
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const [selected, setSelected] = useState(new Set());
  const [allShownChecked, setAllShownChecked] = useState(false);

  const [viewerIndex, setViewerIndex] = useState(null); // opens ImagePopupViewer
  const listRef = useRef(null);
  const backdropRef = useRef(null);

  // Upload
  const onDrop = useCallback((acceptedFiles) => {
    if (!acceptedFiles?.length || !isOwner) return;
    (async () => {
      let ok = 0;
      for (const f of acceptedFiles) {
        const form = new FormData();
        form.append("image", f);
        form.append("folder", selectedFolder);
        form.append("accountId", accountId);
        try {
          const res = await apiFetch(`${API_BASE}/api/gallery`, { method: "POST", body: form });
          if (res.ok) ok++;
        } catch {}
      }
      if (ok) {
        toast.success(`${ok} image${ok > 1 ? "s" : ""} uploaded`);
        await refreshAll(accountId);
      } else {
        toast.error("Upload failed");
      }
    })();
  }, [accountId, selectedFolder, isOwner]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    multiple: true,
    accept: { "image/*": [] },
    disabled: !isOwner || !accountId,
  });

  // Fetch data (keyed to ownerId)
  async function refreshAll(targetId = accountId) {
    if (!targetId) return;
    try {
      const rf = await apiFetch(`${API_BASE}/api/gallery/folders?accountId=${targetId}`);
      const fjson = await rf.json();
      if (Array.isArray(fjson) && fjson.length) {
        setFolders(["All", ...fjson.filter((f) => f !== "All")]);
      }
    } catch {}

    try {
      const ri = await apiFetch(`${API_BASE}/api/gallery?accountId=${targetId}`);
      const imgs = await ri.json();
      setImages((imgs || []).map((im) => ({ ...im, folder: im.folder || "All" })));
      setPage(1);
      setSelected(new Set());
    } catch {
      toast.error("Failed to load gallery.");
    }
  }

  // Reset when opened or when navigating to a different profile
  useEffect(() => {
    if (!open) return;
    setImages([]);
    setFolders(['All']);
    setSelectedFolder('All');
    setSelected(new Set());
    setViewerIndex(null);
    refreshAll(accountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId]);

  // Derived list
  const filtered = useMemo(() => {
    let list = images;
    if (selectedFolder !== "All") list = list.filter((im) => im.folder === selectedFolder);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (im) =>
          im.filename?.toLowerCase().includes(q) ||
          im.caption?.toLowerCase().includes(q) ||
          im.folder?.toLowerCase().includes(q)
      );
    }
    switch (sort) {
      case "oldest": list = [...list].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)); break;
      case "mostLiked": list = [...list].sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0)); break;
      default: list = [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    return list;
  }, [images, selectedFolder, query, sort]);

  const paged = useMemo(() => filtered.slice(0, page * pageSize), [filtered, page]);

  // Infinite scroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    function onScroll() {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
        if (page * pageSize < filtered.length) setPage((p) => p + 1);
      }
    }
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [filtered.length, page]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (!open) return;
      if (viewerIndex !== null) return; // ImagePopupViewer handles its shortcuts
      if (e.key === "Escape") onClose();
      if ((e.key === "Backspace" || e.key === "Delete") && selected.size && isOwner) {
        e.preventDefault();
        handleBulkDelete();
      }
      if (e.key.toLowerCase() === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleSelectAllShown();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, viewerIndex, selected, isOwner, onClose]);

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      setAllShownChecked(next.size && paged.every((im) => next.has(im.filename)));
      return next;
    });
  }

  function toggleSelectAllShown() {
    if (allShownChecked) {
      const next = new Set(selected);
      for (const im of paged) next.delete(im.filename);
      setSelected(next);
      setAllShownChecked(false);
    } else {
      const next = new Set(selected);
      for (const im of paged) next.add(im.filename);
      setSelected(next);
      setAllShownChecked(true);
    }
  }

  async function createFolder() {
    if (!isOwner) return;
    const name = prompt("New folder name:");
    if (!name) return;
    try {
      const res = await apiFetch(`${API_BASE}/api/gallery/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, accountId }),
      });
      if (res.status === 409) return toast.error("Folder already exists.");
      if (!res.ok) throw new Error();
      toast.success(`Folder "${name}" created.`);
      await refreshAll(accountId);
      setSelectedFolder(name);
    } catch {
      toast.error("Failed to create folder.");
    }
  }

  async function handleBulkMove() {
    if (!isOwner) return;
    if (!selected.size) return toast.info("Select images first.");
    const name = prompt("Move selected to folder (existing or new):", selectedFolder);
    if (!name) return;
    if (!folders.includes(name) && name !== "All") {
      try {
        await apiFetch(`${API_BASE}/api/gallery/folders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, accountId }),
        });
      } catch {}
    }
    for (const id of selected) {
      try {
        await apiFetch(`${API_BASE}/api/gallery/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder: name, accountId }),
        });
      } catch {}
    }
    toast.success("Images moved.");
    await refreshAll(accountId);
  }

  async function handleBulkDelete() {
    if (!isOwner) return;
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} image(s)? This cannot be undone.`)) return;
    let ok = 0;
    for (const id of selected) {
      try {
        const res = await apiFetch(`${API_BASE}/api/gallery/${encodeURIComponent(id)}?accountId=${accountId}`, { method: "DELETE" });
        if (res.ok) ok++;
      } catch {}
    }
    toast[ok ? "success" : "error"](`${ok} deleted`);
    await refreshAll(accountId);
  }

  // Update hook for viewer (likes/comments/caption)
  async function updateGalleryImage(updated) {
    try {
      await apiFetch(`${API_BASE}/api/gallery/${updated.filename}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId, // OWNER id
          caption: updated.caption,
          likes: updated.likes,
          dislikes: updated.dislikes,
          comments: updated.comments,
          folder: updated.folder,
        }),
      });
      setImages((prev) =>
        prev.map((im) => (im.filename === updated.filename ? { ...im, ...updated } : im))
      );
    } catch {
      toast.error("Failed to update image.");
    }
  }

  if (!open) return null;

  return (
    <div
      style={modalBackdrop}
      aria-modal
      aria-label="Gallery viewer"
      role="dialog"
      ref={backdropRef}
      onMouseDown={(e) => {
        // close only when clicking the dark backdrop (not inside the shell)
        if (e.target === backdropRef.current) onClose();
      }}
      key={accountId}
    >
      <div style={modalShell} onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={titleStyle}><FaImages /> Gallery</div>
            {/* Search */}
            <div style={searchWrap}>
              <FaSearch style={{ position: "absolute", top: 10, left: 12, color: "#666" }} />
              <input
                style={searchInput}
                placeholder="Search filename, caption or folder…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div style={controlsRow}>
            {/* Folders */}
            <div style={{ ...pill, display: "flex", alignItems: "center", gap: 8 }}>
              <FaFolder />
              <select
                value={selectedFolder}
                onChange={(e) => {
                  setSelectedFolder(e.target.value);
                  setPage(1);
                }}
                style={{ background: "transparent", color: "#ffe066", border: "none", fontWeight: 800, outline: "none" }}
              >
                {folders.map((f) => (
                  <option key={f} value={f} style={{ color: "#000" }}>
                    {f}
                  </option>
                ))}
              </select>
              {isOwner && (
                <button
                  onClick={createFolder}
                  title="New folder"
                  style={{ background: "transparent", border: "none", color: "#ffe066", cursor: "pointer" }}
                >
                  <FaFolderPlus />
                </button>
              )}
            </div>

            {/* Sort */}
            <div style={{ ...pill, display: "flex", alignItems: "center", gap: 8 }}>
              <FaSortAmountDown />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                style={{ background: "transparent", color: "#ffe066", border: "none", fontWeight: 800, outline: "none" }}
              >
                <option value="newest" style={{ color: "#000" }}>Newest</option>
                <option value="oldest" style={{ color: "#000" }}>Oldest</option>
                <option value="mostLiked" style={{ color: "#000" }}>Most liked</option>
              </select>
            </div>

            {/* Upload */}
            {isOwner && (
              <button {...getRootProps()} style={{ ...pill, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <FaUpload /> Upload
                <input {...getInputProps()} style={{ display: "none" }} />
              </button>
            )}

            {/* Bulk select */}
            <button
              onClick={() => {
                if (allShownChecked) {
                  const next = new Set(selected);
                  for (const im of paged) next.delete(im.filename);
                  setSelected(next);
                  setAllShownChecked(false);
                } else {
                  const next = new Set(selected);
                  for (const im of paged) next.add(im.filename);
                  setSelected(next);
                  setAllShownChecked(true);
                }
              }}
              style={{ ...pill, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
              title="Toggle select visible"
            >
              {allShownChecked ? <FaCheckSquare /> : <FaRegSquare />} Select shown
            </button>

            {/* Move / Delete (owner only) */}
            {isOwner && <button onClick={handleBulkMove} style={{ ...pill, cursor: "pointer" }}>Move</button>}
            {isOwner && (
              <button
                onClick={handleBulkDelete}
                style={{ ...pill, cursor: "pointer", color: "#fff", background: "#b91c1c", borderColor: "#7f1d1d" }}
                title="Delete selected"
              >
                <FaTrash /> Delete
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "transparent",
                border: "1px solid #333",
                color: "#f87171",
                borderRadius: 10,
                padding: "8px 10px",
                cursor: "pointer",
              }}
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={bodyWrap}>
          {/* Sidebar (quick stats) */}
          <aside style={sidebar}>
            <div style={{ color: "#aaa", marginBottom: 10, fontWeight: 700 }}>Summary</div>
            <div style={{ color: "#ffe066", fontWeight: 900, fontSize: 20 }}>
              {filtered.length} <span style={{ color: "#888", fontWeight: 700, fontSize: 14 }}>images</span>
            </div>
            <div style={{ marginTop: 12, color: "#bbb", fontSize: 13 }}>
              Showing <b>{Math.min(paged.length, filtered.length)}</b> of <b>{filtered.length}</b>
            </div>
            <div style={{ marginTop: 16, color: "#bbb", fontSize: 13 }}>
              Selected: <b>{selected.size}</b>
            </div>
            <div style={{ marginTop: 18, borderTop: "1px solid #262626", paddingTop: 12, color: "#999", fontSize: 12, lineHeight: 1.4 }}>
              Tips:
              <ul style={{ margin: "8px 0 0 18px" }}>
                <li>Ctrl/⌘ + A selects all visible</li>
                <li>{isOwner ? 'Delete key removes selected' : 'Owner can delete images'}</li>
                <li>Click image to open viewer</li>
              </ul>
            </div>
          </aside>

          {/* Grid */}
          <section style={{ ...content }} ref={listRef}>
            {paged.length === 0 ? (
              <div style={{ color: "#aaa", fontStyle: "italic", padding: 20 }}>No images match your filters.</div>
            ) : (
              <div style={gridWrap}>
                {paged.map((im, idx) => {
                  const id = im.filename;
                  const checked = selected.has(id);
                  return (
                    <div
                      key={id || idx}
                      style={tile}
                      onClick={(e) => {
                        const withinCheckbox = e.target?.dataset?.cb === "1";
                        if (withinCheckbox) return;
                        const startAt = filtered.findIndex((x) => x.filename === id);
                        setViewerIndex(startAt >= 0 ? startAt : 0);
                      }}
                    >
                      <img
                        src={getGalleryImgSrc(im)}
                        alt={im.caption || im.filename || `img-${idx}`}
                        style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }}
                        loading="lazy"
                      />

                      {/* top overlay: checkbox */}
                      <div style={{ position: "absolute", top: 8, left: 8 }}>
                        <button
                          data-cb="1"
                          onClick={() => toggleSelect(id)}
                          title={checked ? "Unselect" : "Select"}
                          style={{
                            background: "rgba(0,0,0,0.6)",
                            color: "#ffe066",
                            border: "1px solid #333",
                            borderRadius: 8,
                            padding: "6px 8px",
                            cursor: "pointer",
                          }}
                        >
                          {checked ? <FaCheckSquare /> : <FaRegSquare />}
                        </button>
                      </div>

                      {/* bottom overlay: quick stats */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 10px",
                          background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                          color: "#eee",
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: "flex", gap: 8 }}>
                          <div title="Likes">❤️ {im.likes?.length || 0}</div>
                          <div title="Comments">💬 {im.comments?.length || 0}</div>
                        </div>
                        <div style={{ maxWidth: "65%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#ffe066", fontWeight: 700 }}>
                          {im.caption || im.filename}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pager display */}
            {page * pageSize < filtered.length && (
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{ ...pill, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                >
                  <FaChevronLeft /> Prev
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  style={{ ...pill, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                >
                  Next <FaChevronRight />
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Image viewer (single image) */}
      {viewerIndex !== null && filtered[viewerIndex] && (
        <ImagePopupViewer
          img={filtered[viewerIndex]}
          popupImages={filtered}
          popupIndex={viewerIndex}
          getGalleryImgSrc={getGalleryImgSrc}
          prevPopupImg={(arr) => setViewerIndex((i) => (i - 1 + arr.length) % arr.length)}
          nextPopupImg={(arr) => setViewerIndex((i) => (i + 1) % arr.length)}
          deleteImage={async () => {
            if (!isOwner) return toast.info('Only the profile owner can delete images.');
            const im = filtered[viewerIndex];
            await apiFetch(`${API_BASE}/api/gallery/${im.filename}?accountId=${accountId}`, { method: "DELETE" });
            toast.success("Image deleted.");
            setViewerIndex(null);
            await refreshAll(accountId);
          }}
          isEditingCaption={false}
          setIsEditingCaption={() => {}}
          captionInput={filtered[viewerIndex]?.caption || ""}
          setCaptionInput={() => {}}
          saveCaption={() => {}}
          closePopup={() => setViewerIndex(null)}
          updateGalleryImage={updateGalleryImage}
        />
      )}
    </div>
  );
}
