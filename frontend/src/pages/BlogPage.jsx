// src/pages/BlogPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import socket from '../socket';
import { useAuth } from '../context/AuthContext';
import {
  listHot,
  listNew,
  listTop,
  toggleLike,
  toggleFollow,
  createBlog,
  getBlog,
  updateBlog,
  deleteBlog,
  addComment,
  editComment,
  deleteComment,
} from '../services/blogApi';
import CommentsSection from '../components/CommentsSection';

/* ---------------------- THEME WIRING (page-wide) ---------------------- */
function getDomTheme() {
  const fromDom = document?.documentElement?.dataset?.theme;
  const fromStorage = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
  return (fromDom || fromStorage || 'light').toLowerCase();
}

// Keep text black per your request; adjust only surfaces/borders/accents
function getThemeStyles(theme) {
  // Default (light-ish)
  let styles = {
    pageBg: '#ffffff',
    cardBg: '#ffffff',
    border: '#e5e7eb',
    text: '#111111', // black in all themes
    subtext: '#374151',
    faintText: '#6b7280',
    tagBg: '#f4f4f5',
    primary: '#10b981',
    primaryBorder: '#10b981',
    danger: '#ef4444',
  };

  if (theme.includes('dark')) {
    styles = {
      ...styles,
      pageBg: '#f8fafc',
      cardBg: '#ffffff',
      border: '#e5e7eb',
      primary: '#059669',
      primaryBorder: '#059669',
    };
  } else if (theme.includes('cosmic') || theme.includes('space')) {
    styles = {
      ...styles,
      pageBg: '#f7f7fb',
      cardBg: '#ffffff',
      border: '#e5e7eb',
      primary: '#6366f1',
      primaryBorder: '#6366f1',
    };
  } else if (theme.includes('solar')) {
    styles = {
      ...styles,
      pageBg: '#fffaf0',
      cardBg: '#ffffff',
      border: '#f3e8cc',
      primary: '#d97706',
      primaryBorder: '#d97706',
    };
  }

  return styles;
}

/* ---------------- Inline Composer Modal (no external import) ---------------- */
function InlineComposer({ onCreated, onClose, themeStyles }) {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState(''); // <-- fixed (removed stray "the")
  const [content, setContent] = useState('');
  const [cover, setCover] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const addTag = () => {
    const t = tagInput.trim().replace(/\s+/g, '-').slice(0, 40);
    if (!t) return;
    if (!tags.includes(t) && tags.length < 12) setTags([...tags, t]);
    setTagInput('');
  };
  const removeTag = (t) => setTags(tags.filter((x) => x !== t));

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags(tags.slice(0, -1));
    }
  };

  const uploadCover = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      setCover(data?.path || data?.url || '');
    } catch (e) {
      alert(e.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      alert('Title and content are required.');
      return;
    }
    setSaving(true);
    try {
      const post = await createBlog({
        title: title.trim(),
        content: content.trim(),
        coverImage: cover,
        tags,
      });
      onCreated?.(post);
      onClose?.();
    } catch (e) {
      alert(e.message || 'Failed to create blog');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 50,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        style={{
          maxWidth: 720,
          width: '100%',
          background: themeStyles.cardBg,
          color: themeStyles.text,
          border: `1px solid ${themeStyles.border}`,
          borderRadius: 14,
          padding: 16,
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Create Blog</h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: themeStyles.text }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Catchy, descriptive title…"
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 10,
            border: `1px solid ${themeStyles.border}`,
            background: themeStyles.cardBg,
            color: themeStyles.text,
            outline: 'none',
            marginBottom: 14,
            fontSize: 16,
          }}
        />

        <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Tags</label>
        <div style={{ border: `1px solid ${themeStyles.border}`, borderRadius: 10, padding: 10, marginBottom: 14 }}>
          <div style={{ marginBottom: 6 }}>
            {tags.map((t) => (
              <span
                key={t}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 10px',
                  borderRadius: 999,
                  marginRight: 8,
                  marginBottom: 8,
                  background: themeStyles.tagBg,
                  color: themeStyles.text,
                  border: `1px solid ${themeStyles.border}`,
                  fontWeight: 600,
                }}
              >
                {t}
                <button
                  onClick={() => removeTag(t)}
                  style={{ marginLeft: 8, border: 'none', background: 'transparent', cursor: 'pointer', lineHeight: 1, color: themeStyles.text }}
                  aria-label="Remove tag"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a tag and press Enter"
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${themeStyles.border}`,
                background: themeStyles.cardBg,
                color: themeStyles.text,
                outline: 'none',
                fontSize: 14,
              }}
            />
            <button
              onClick={addTag}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: `1px solid ${themeStyles.text}`,
                background: themeStyles.text,
                color: '#fff',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>
        </div>

        <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Cover Image</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: `1px solid ${themeStyles.text}`,
              background: uploading ? '#d1d5db' : themeStyles.cardBg,
              color: themeStyles.text,
              fontWeight: 800,
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Uploading…' : 'Upload Image'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => uploadCover(e.target.files?.[0])}
            style={{ display: 'none' }}
          />
          {cover ? (
            <span style={{ fontSize: 13, color: themeStyles.text }}>{cover}</span>
          ) : (
            <span style={{ fontSize: 13, color: themeStyles.faintText }}>No image selected</span>
          )}
        </div>

        <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write something worth reading…"
          rows={10}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 10,
            border: `1px solid ${themeStyles.border}`,
            outline: 'none',
            resize: 'vertical',
            fontSize: 15,
            color: themeStyles.text,
            background: themeStyles.cardBg,
            marginBottom: 16,
          }}
        />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: `1px solid ${themeStyles.border}`,
              background: themeStyles.cardBg,
              color: themeStyles.text,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: `1px solid ${themeStyles.text}`,
              background: saving ? '#d1d5db' : themeStyles.text,
              color: '#fff',
              fontWeight: 800,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Blog list card ---------------- */
function BlogCard({ post, meId, onLike, onFollow, onOpen, themeStyles }) {
  const likeCount = (post.likes || []).length;
  const isLiked = (post.likes || []).some((u) => String(u) === String(meId));
  const isFollowing = (post.followers || []).some((u) => String(u) === String(meId));

  return (
    <div
      style={{
        border: `1px solid ${themeStyles.border}`,
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        background: themeStyles.cardBg,
        color: themeStyles.text,
      }}
    >
      {!!post.coverImage && (
        <div style={{ marginBottom: 12 }}>
          <img
            src={post.coverImage}
            alt=""
            style={{ width: '100%', borderRadius: 10, display: 'block', height: 'auto' }}
          />
        </div>
      )}

      <h3
        onClick={() => onOpen?.(post)}
        style={{ margin: 0, fontSize: 20, fontWeight: 800, cursor: 'pointer' }}
        title="Open post"
      >
        {post.title}
      </h3>

      <div style={{ marginTop: 6, color: themeStyles.subtext, fontSize: 14, lineHeight: 1.5 }}>
        {post.content?.slice(0, 220)}
        {post.content && post.content.length > 220 ? '…' : ''}
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => onLike?.(post)}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: `1px solid ${themeStyles.text}`,
            background: isLiked ? themeStyles.text : themeStyles.cardBg,
            color: isLiked ? '#fff' : themeStyles.text,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {isLiked ? 'Liked' : 'Like'} · {likeCount}
        </button>

        <button
          onClick={() => onFollow?.(post)}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: `1px solid ${themeStyles.text}`,
            background: isFollowing ? themeStyles.text : themeStyles.cardBg,
            color: isFollowing ? '#fff' : themeStyles.text,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>

        <div style={{ marginLeft: 'auto', fontSize: 13, color: themeStyles.faintText, display: 'flex', alignItems: 'center', gap: 8 }}>
          {post?.user?.profileImage ? (
            <img
              src={post.user.profileImage}
              alt={post?.user?.username || 'user'}
              style={{ width: 20, height: 20, borderRadius: '50%' }}
            />
          ) : null}
          <span>
            by {post?.user?.username || 'unknown'} • {new Date(post.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      {!!(post.tags || []).length && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {post.tags.map((t) => (
            <span
              key={t}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                background: themeStyles.tagBg,
                border: `1px solid ${themeStyles.border}`,
                fontWeight: 700,
                fontSize: 12,
                color: themeStyles.text,
              }}
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Detail Modal ---------------- */
function PostModal({
  post,
  meId,
  onClose,
  onLike,
  onFollow,
  onEdited,
  onDeleted,
  themeStyles,
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const isOwner = String(post?.user?._id || '') === String(meId);

  const handleEdit = async () => {
    if (!title.trim() || !content.trim()) {
      alert('Title and content are required');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateBlog(post._id, {
        title: title.trim(),
        content: content.trim(),
      });
      onEdited?.(updated);
      setEditing(false);
    } catch (e) {
      alert(e.message || 'Failed to update post');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this post?')) return;
    try {
      await deleteBlog(post._id);
      onDeleted?.(post._id);
      onClose?.();
    } catch (e) {
      alert(e.message || 'Failed to delete post');
    }
  };

  const handleAddComment = async (text) => addComment(post._id, text);
  const handleEditComment = async (commentId, text) => editComment(post._id, commentId, text);
  const handleDeleteComment = async (commentId) => deleteComment(post._id, commentId);

  const likeCount = (post.likes || []).length;
  const isLiked = (post.likes || []).some((u) => String(u) === String(meId));
  const isFollowing = (post.followers || []).some((u) => String(u) === String(meId));

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 60,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        style={{
          width: 'min(980px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: themeStyles.cardBg,
          color: themeStyles.text,
          border: `1px solid ${themeStyles.border}`,
          borderRadius: 14,
          padding: 16,
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          {post?.user?.profileImage ? (
            <img
              src={post.user.profileImage}
              alt={post?.user?.username || 'user'}
              style={{ width: 36, height: 36, borderRadius: '50%' }}
            />
          ) : null}
          <div style={{ fontWeight: 900, fontSize: 16 }}>
            {post?.user?.username || 'unknown'}
            <div style={{ fontWeight: 500, color: themeStyles.faintText, fontSize: 12 }}>
              {new Date(post.createdAt).toLocaleString()}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', fontSize: 24, cursor: 'pointer', color: themeStyles.text }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {!!post.coverImage && (
          <div style={{ marginBottom: 12 }}>
            <img
              src={post.coverImage}
              alt=""
              style={{ width: '100%', borderRadius: 10, display: 'block', height: 'auto' }}
            />
          </div>
        )}

        {!editing ? (
          <>
            <h2 style={{ margin: '6px 0 10px', fontWeight: 900 }}>{post.title}</h2>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: themeStyles.text }}>
              {post.content}
            </div>
          </>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${themeStyles.border}`, background: themeStyles.cardBg, color: themeStyles.text }}
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              style={{ padding: 12, borderRadius: 10, border: `1px solid ${themeStyles.border}`, background: themeStyles.cardBg, color: themeStyles.text }}
            />
          </div>
        )}

        {!!(post.tags || []).length && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {post.tags.map((t) => (
              <span
                key={t}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: themeStyles.tagBg,
                  border: `1px solid ${themeStyles.border}`,
                  fontWeight: 700,
                  fontSize: 12,
                  color: themeStyles.text,
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => onLike?.(post)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${themeStyles.text}`,
              background: isLiked ? themeStyles.text : themeStyles.cardBg,
              color: isLiked ? '#fff' : themeStyles.text,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {isLiked ? 'Liked' : 'Like'} · {likeCount}
          </button>
          <button
            onClick={() => onFollow?.(post)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${themeStyles.text}`,
              background: isFollowing ? themeStyles.text : themeStyles.cardBg,
              color: isFollowing ? '#fff' : themeStyles.text,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>

          {isOwner && !editing && (
            <>
              <button
                onClick={() => setEditing(true)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: `1px solid ${themeStyles.text}`,
                  background: themeStyles.cardBg,
                  color: themeStyles.text,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: `1px solid ${themeStyles.danger}`,
                  background: themeStyles.danger,
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </>
          )}
          {isOwner && editing && (
            <>
              <button
                onClick={() => setEditing(false)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: `1px solid ${themeStyles.border}`,
                  background: themeStyles.cardBg,
                  color: themeStyles.text,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={saving}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: `1px solid ${themeStyles.text}`,
                  background: saving ? '#d1d5db' : themeStyles.text,
                  color: '#fff',
                  fontWeight: 800,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: 18 }}>
          <CommentsSection
            postId={post._id}
            meId={meId}
            comments={post.comments || []}
            onAdd={handleAddComment}
            onEdit={handleEditComment}
            onDelete={handleDeleteComment}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function BlogPage() {
  const { user } = useAuth() || {};
  const meId = user?._id;

  // Watch the DOM/localStorage theme the navbar controls
  const [theme, setTheme] = useState(getDomTheme());
  useEffect(() => {
    const update = () => setTheme(getDomTheme());
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('storage', update);
    return () => {
      obs.disconnect();
      window.removeEventListener('storage', update);
    };
  }, []);
  const themeStyles = getThemeStyles(theme);

  // Mobile detection for responsive inline styles
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 900 : false));
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [tab, setTab] = useState('hot');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(null);
  const [cursorScore, setCursorScore] = useState(null);
  const [showComposer, setShowComposer] = useState(false);
  const [selected, setSelected] = useState(null);

  // trending tags
  const [trending, setTrending] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/blog/trending-tags');
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.items)) setTrending(data.items);
      } catch (e) {
        console.error('Failed to load trending tags', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const load = async (mode = 'init') => {
    try {
      setErr('');
      if (mode === 'init') {
        setLoading(true);
        setCursor(null);
        setCursorScore(null);
      }
      let resp;
      const opts = { limit: 10, tag: tag || undefined, q: q || undefined };
      if (mode === 'more' && cursor) {
        opts.cursor = cursor;
        if (tab !== 'new' && cursorScore != null) opts.cursorScore = cursorScore;
      }

      if (tab === 'new') resp = await listNew(opts);
      else if (tab === 'top') resp = await listTop(opts);
      else resp = await listHot(opts);

      const list = (resp.items || []).map((p) => ({ ...p }));
      if (mode === 'more') setItems((prev) => [...prev, ...list]);
      else setItems(list);

      setCursor(resp.nextCursor || null);
      setCursorScore(resp.nextCursorScore ?? null);
    } catch (e) {
      setErr(e.message || 'Failed to load blog posts.');
    } finally {
      if (mode === 'init') setLoading(false);
    }
  };

  useEffect(() => {
    load('init');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    function onNew(post) {
      setItems((prev) => [post, ...prev]);
    }
    function onUpdate(patch) {
      setItems((prev) =>
        prev.map((p) => (String(p._id) === String(patch._id) ? { ...p, ...patch } : p))
      );
      setSelected((s) => (s && String(s._id) === String(patch._id) ? { ...s, ...patch } : s));
    }
    function onDelete({ postId }) {
      setItems((prev) => prev.filter((p) => String(p._id) !== String(postId)));
      setSelected((s) => (s && String(s._id) === String(postId) ? null : s));
    }
    socket.on('blog:new', onNew);
    socket.on('blog:update', onUpdate);
    socket.on('blog:delete', onDelete);
    return () => {
      socket.off('blog:new', onNew);
      socket.off('blog:update', onUpdate);
      socket.off('blog:delete', onDelete);
    };
  }, []);

  const like = async (post) => {
    try {
      setItems((prev) =>
        prev.map((p) =>
          p._id === post._id
            ? {
                ...p,
                likes:
                  (p.likes || []).some((u) => String(u) === String(meId))
                    ? (p.likes || []).filter((u) => String(u) !== String(meId))
                    : [...(p.likes || []), meId],
              }
            : p
        )
      );
      setSelected((s) =>
        s && s._id === post._id
          ? {
              ...s,
              likes:
                (s.likes || []).some((u) => String(u) === String(meId))
                  ? (s.likes || []).filter((u) => String(u) !== String(meId))
                  : [...(s.likes || []), meId],
            }
          : s
      );
      await toggleLike(post._id);
    } catch {
      load('init');
    }
  };

  const follow = async (post) => {
    try {
      setItems((prev) =>
        prev.map((p) =>
          p._id === post._id
            ? {
                ...p,
                followers:
                  (p.followers || []).some((u) => String(u) === String(meId))
                    ? (p.followers || []).filter((u) => String(u) !== String(meId))
                    : [...(p.followers || []), meId],
              }
            : p
        )
      );
      setSelected((s) =>
        s && s._id === post._id
          ? {
              ...s,
              followers:
                (s.followers || []).some((u) => String(u) === String(meId))
                  ? (s.followers || []).filter((u) => String(u) !== String(meId))
                  : [...(s.followers || []), meId],
            }
          : s
      );
      await toggleFollow(post._id);
    } catch {
      load('init');
    }
  };

  const openPost = async (post) => {
    try {
      const full = await getBlog(post._id);
      setSelected(full);
    } catch {
      setSelected(post);
    }
  };

  // Header filters/tabs — sticky on mobile
  const HeaderTabs = (
    <div
      style={{
        display: 'flex',
        gap: isMobile ? 6 : 8,
        alignItems: 'stretch',
        flexWrap: isMobile ? 'nowrap' : 'wrap',
        overflowX: isMobile ? 'auto' : 'visible',
        position: isMobile ? 'sticky' : 'static',
        top: isMobile ? 0 : 'auto',
        zIndex: isMobile ? 30 : 'auto',
        background: isMobile ? themeStyles.pageBg : 'transparent',
        padding: isMobile ? '8px 0' : 0,
      }}
    >
      {['hot', 'new', 'top'].map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: `1px solid ${themeStyles.border}`,
            background: tab === t ? themeStyles.primary : themeStyles.cardBg,
            color: tab === t ? '#fff' : themeStyles.text,
            fontWeight: 800,
            cursor: 'pointer',
            flex: isMobile ? '0 0 auto' : 'none',
          }}
        >
          {t[0].toUpperCase() + t.slice(1)}
        </button>
      ))}

      <input
        placeholder="Search posts…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && load('init')}
        style={{
          marginLeft: isMobile ? 0 : 8,
          padding: '8px 12px',
          borderRadius: 10,
          border: `1px solid ${themeStyles.border}`,
          background: themeStyles.cardBg,
          color: themeStyles.text,
          outline: 'none',
          minWidth: isMobile ? 0 : 240,
          width: isMobile ? 220 : 'auto',
          flex: isMobile ? '0 0 auto' : 'none',
        }}
      />
      <input
        placeholder="Filter by tag (e.g. react)"
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && load('init')}
        style={{
          padding: '8px 12px',
          borderRadius: 10,
          border: `1px solid ${themeStyles.border}`,
          background: themeStyles.cardBg,
          color: themeStyles.text,
          outline: 'none',
          minWidth: isMobile ? 0 : 220,
          width: isMobile ? 200 : 'auto',
          flex: isMobile ? '0 0 auto' : 'none',
        }}
      />
      <button
        onClick={() => load('init')}
        style={{
          padding: '8px 12px',
          borderRadius: 10,
          border: `1px solid ${themeStyles.text}`,
          background: themeStyles.text,
          color: '#fff',
          fontWeight: 800,
          cursor: 'pointer',
          flex: isMobile ? '0 0 auto' : 'none',
        }}
        title="Apply filters"
      >
        Apply
      </button>
    </div>
  );

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '24px 16px',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 340px',
        gap: isMobile ? 16 : 24,
        background: themeStyles.pageBg,
        color: themeStyles.text,
      }}
    >
      {/* left column */}
      <div>
        <h1 style={{ margin: '0 0 10px 0', fontSize: isMobile ? 28 : 36, fontWeight: 900, color: themeStyles.text }}>
          NSZ Blog — {tab[0].toUpperCase() + tab.slice(1)}
        </h1>
        {HeaderTabs}

        {err && (
          <div style={{ color: '#ef4444', marginTop: 16, fontWeight: 700 }}>
            {err}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          {!loading && !items.length && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: themeStyles.faintText }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: themeStyles.text }}>
                No blog posts yet
              </div>
              <div style={{ marginTop: 8 }}>
                Be the first to share something amazing.
              </div>
            </div>
          )}

          {items.map((p) => (
            <BlogCard
              key={p._id}
              post={p}
              meId={meId}
              onLike={like}
              onFollow={follow}
              onOpen={openPost}
              themeStyles={themeStyles}
            />
          ))}

          {!!cursor && (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => load('more')}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: `1px solid ${themeStyles.text}`,
                  background: themeStyles.text,
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                Load more
              </button>
            </div>
          )}
        </div>
      </div>

      {/* right column */}
      <aside>
        <div
          style={{
            border: `1px solid ${themeStyles.border}`,
            borderRadius: 14,
            padding: 16,
            background: themeStyles.cardBg,
            color: themeStyles.text,
            marginBottom: 14,
            boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
          }}
        >
          <h3 style={{ margin: 0, fontWeight: 900 }}>Share something great</h3>
          <p style={{ margin: '8px 0 12px 0', color: themeStyles.subtext }}>
            Long-form posts, guides, hot takes—make it count.
          </p>
          <button
            onClick={() => setShowComposer(true)}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: `1px solid ${themeStyles.primaryBorder}`,
              background: themeStyles.primary,
              color: '#fff',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            + Create Post
          </button>
        </div>

        <div
          style={{
            border: `1px solid ${themeStyles.border}`,
            borderRadius: 14,
            padding: 16,
            background: themeStyles.cardBg,
            color: themeStyles.text,
            marginBottom: 14,
          }}
        >
          <h3 style={{ margin: 0, fontWeight: 900 }}>Trending tags</h3>
          {trending.length === 0 ? (
            <p style={{ margin: '8px 0 0 0', color: themeStyles.faintText }}>
              No tags yet. Be the first—add some when you post.
            </p>
          ) : (
            <ul style={{ margin: '8px 0 0 18px', color: themeStyles.subtext }}>
              {trending.map((t) => (
                <li
                  key={t.tag}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setTag(t.tag);
                    setTab('hot');
                    setTimeout(() => load('init'), 0);
                  }}
                  title={`Filter by #${t.tag}`}
                >
                  #{t.tag}{' '}
                  <span style={{ color: themeStyles.faintText }}>({t.count})</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          style={{
            border: `1px solid ${themeStyles.border}`,
            borderRadius: 14,
            padding: 16,
            background: themeStyles.cardBg,
            color: themeStyles.text,
          }}
        >
          <h3 style={{ margin: 0, fontWeight: 900 }}>About NSZ Blog</h3>
          <ul style={{ margin: '8px 0 0 18px', color: themeStyles.subtext }}>
            <li>Real-time updates</li>
            <li>Rich cover images</li>
            <li>Tags & search</li>
          </ul>
        </div>
      </aside>

      {showComposer && (
        <InlineComposer
          onCreated={(post) => setItems((prev) => [post, ...prev])}
          onClose={() => setShowComposer(false)}
          themeStyles={themeStyles}
        />
      )}

      {selected && (
        <PostModal
          post={selected}
          meId={meId}
          onClose={() => setSelected(null)}
          onLike={like}
          onFollow={follow}
          onEdited={(updated) => {
            setItems((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
            setSelected(updated);
          }}
          onDeleted={(id) => {
            setItems((prev) => prev.filter((p) => p._id !== id));
          }}
          themeStyles={themeStyles}
        />
      )}
    </div>
  );
}
