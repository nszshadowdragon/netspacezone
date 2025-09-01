// src/components/ImagePopupViewer.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FaChevronLeft, FaChevronRight, FaTrash, FaShareAlt,
  FaThumbsDown, FaEdit, FaReply, FaEllipsisV, FaCommentDots
} from 'react-icons/fa';
import { MdRocketLaunch } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { toggleImageLike, saveComments, saveCaption } from '../services/galleryApi'; // uses ../api axios instance

/* ----------------------------- utilities ----------------------------- */

// Vite-friendly env (no process.env at runtime). Optionally set window.__API_URL__.
const API_BASE = (() => {
  const v =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
    (typeof window !== 'undefined' && window.__API_URL__) ||
    '';
  return (typeof v === 'string' ? v.replace(/\/$/, '') : '');
})();

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

function useIsMobile(threshold = 700) {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < threshold : false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < threshold);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [threshold]);
  return isMobile;
}

const SAFE_TOP = 88;
const SAFE_BOTTOM = 32;
const MODAL_MAXH =
  `calc(100vh - ${SAFE_TOP + SAFE_BOTTOM}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`;
const IMAGE_MAX_VH = '50vh';

// 🔕 Toggle to temporarily disable all comments UI
const COMMENTS_DISABLED = true;

function idOf(u) {
  if (!u) return u;
  if (typeof u === 'string') return u;
  if (typeof u === 'object') return u._id || u.id || u;
  return u;
}
const uniqIds = (arr = []) => Array.from(new Set((arr || []).map(idOf).filter(Boolean)));

function displayUsername(uLike) {
  if (!uLike) return 'User';
  if (typeof uLike === 'string') return uLike.slice(0, 7);
  const o = uLike;
  return o.username || 'User';
}
function initialOf(nameLike) {
  const s = (nameLike || '').trim();
  return s ? s[0].toUpperCase() : 'U';
}
function avatarFrom(uObj) {
  if (!uObj || typeof uObj !== 'object') return undefined;
  let src =
    uObj.profilePic ||
    uObj.profileImage ||
    uObj.avatar ||
    uObj.avatarUrl ||
    uObj.photoUrl ||
    uObj.photoURL ||
    uObj.image ||
    uObj.picture ||
    uObj.profileImg ||
    undefined;

  if (src && src.startsWith('/uploads')) {
    return `${API_BASE}${src}`;
  }
  return src;
}
function isUserObj(x) {
  if (!x || typeof x !== 'object') return false;
  if (typeof x.username === 'string' && x.username.trim()) return true;
  return !!avatarFrom(x);
}

// Normalize for rendering
function normalizeForRender(arr) {
  return (arr || []).map(c => ({
    ...c,
    userId: c.userId ?? c.user,
    likes: uniqIds(c.likes || []),
    dislikes: uniqIds(c.dislikes || []),
    replies: (c.replies || []).map(r => ({
      ...r,
      userId: r.userId ?? r.user,
      likes: uniqIds(r.likes || []),
      dislikes: uniqIds(r.dislikes || []),
    })),
  }));
}

// Reduce payload for save
function compactForSave(arr) {
  return (arr || []).map(c => ({
    _id: c._id,
    text: c.text,
    userId: idOf(c.userId ?? c.user),
    likes: uniqIds(c.likes || []),
    dislikes: uniqIds(c.dislikes || []),
    createdAt: c.createdAt || new Date().toISOString(),
    replies: (c.replies || []).map(r => ({
      _id: r._id,
      text: r.text,
      userId: idOf(r.userId ?? r.user),
      likes: uniqIds(r.likes || []),
      dislikes: uniqIds(r.dislikes || []),
      createdAt: r.createdAt || new Date().toISOString(),
    }))
  }));
}

/* --------------- user directory (optional hydrate for string IDs) ----------- */
const USER_FIELDS = 'username,profileImage,profilePic,avatar,avatarUrl,photoUrl,photoURL,picture,image';

async function fetchOneUser(id) {
  const tryUrls = [
    `/messages/user/${id}?fields=${encodeURIComponent(USER_FIELDS)}`,
    `/api/users/${id}?fields=${encodeURIComponent(USER_FIELDS)}`
  ];
  for (const url of tryUrls) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (_) {}
  }
  return { _id: id, username: String(id).slice(0, 7) };
}

function useUserDirectory(comments, authUser) {
  const [userMap, setUserMap] = useState({});

  // seed with current user
  useEffect(() => {
    if (authUser && authUser._id) {
      setUserMap(prev => ({ ...prev, [authUser._id]: authUser }));
    }
  }, [authUser?._id]); // eslint-disable-line

  // preload chat users list if available
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const res = await fetch('/messages/chat-users');
        if (!res.ok) return;
        const arr = await res.json();
        if (abort) return;
        const next = {};
        for (const u of arr || []) {
          const k = String(u._id || u.id || u.userId || u.userID || '');
          if (k) next[k] = u;
        }
        setUserMap(prev => ({ ...next, ...prev }));
      } catch (_) {}
    })();
    return () => { abort = true; };
  }, []);

  // find any unresolved string userIds from comments/replies
  const missingIds = useMemo(() => {
    const s = new Set();
    for (const c of comments || []) {
      const cu = c?.userId;
      if (cu && typeof cu === 'string' && !userMap[cu]) s.add(cu);
      for (const r of c?.replies || []) {
        const ru = r?.userId;
        if (ru && typeof ru === 'string' && !userMap[ru]) s.add(ru);
      }
    }
    return Array.from(s);
  }, [comments, userMap]);

  // fetch missing users
  useEffect(() => {
    if (!missingIds.length) return;
    let abort = false;
    (async () => {
      const results = await Promise.allSettled(missingIds.map(fetchOneUser));
      if (abort) return;
      const add = {};
      results.forEach((r, i) => {
        const id = missingIds[i];
        if (r.status === 'fulfilled' && r.value) add[id] = r.value;
        else add[id] = { _id: id, username: String(id).slice(0, 7) };
      });
      setUserMap(prev => ({ ...prev, ...add }));
    })();
    return () => { abort = true; };
  }, [missingIds]);

  const resolve = (uLike) => {
    if (!uLike) return null;
    if (typeof uLike === 'object') return uLike;
    return userMap[uLike] || uLike;
  };

  return resolve;
}

/* ------------------------------- component ------------------------------- */

export default function ImagePopupViewer({
  img,
  popupImages,
  getGalleryImgSrc,
  prevPopupImg,
  nextPopupImg,
  deleteImage,
  isEditingCaption,
  setIsEditingCaption,
  captionInput,
  setCaptionInput,
  closePopup,
  popupIndex,
  setImages,            // optional (preferred): services/galleryApi will update parent state
  updateGalleryImage,   // optional (fallback): your original updater from parent
}) {
  const { user } = useAuth();
  const userId = user?._id;
  const isMobile = useIsMobile();

  const [commentInput, setCommentInput] = useState('');
  const [replyBoxFor, setReplyBoxFor] = useState(null);
  const [replyInput, setReplyInput] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // local override during in-flight mutations (prevents flicker; keeps avatars)
  const [overrideComments, setOverrideComments] = useState(null);

  const lastResolvedRef = useRef({});

  const [optimisticLiked, setOptimisticLiked] = useState(null);
  const [optimisticDisliked, setOptimisticDisliked] = useState(null);

  // choose comments source: override while saving, else from img
  const baseComments = overrideComments ?? img?.comments ?? [];
  const renderComments = useMemo(() => normalizeForRender(baseComments), [baseComments]);

  const resolveUser = useUserDirectory(renderComments, user);

  useEffect(() => {
    setCommentInput('');
    setReplyBoxFor(null);
    setReplyInput('');
    setEditingCommentId(null);
    setEditingValue('');
    setShareStatus('');
    setMenuOpen(false);
    setOptimisticLiked(null);
    setOptimisticDisliked(null);
    setOverrideComments(null);
  }, [img?._id, userId]);

  // --- image-level reactions ---
  const baseLikes = uniqIds(img?.likes || []);
  const baseDislikes = uniqIds(img?.dislikes || []);

  const likesArr = optimisticLiked !== null
    ? (optimisticLiked ? uniqIds([...baseLikes, userId]) : baseLikes.filter(id => id !== userId))
    : baseLikes;

  const dislikesArr = optimisticDisliked !== null
    ? (optimisticDisliked ? uniqIds([...baseDislikes, userId]) : baseDislikes.filter(id => id !== userId))
    : baseDislikes;

  const liked = likesArr.includes(userId);
  const disliked = dislikesArr.includes(userId);

  // Helpers to call either services (preferred) or legacy parent updater (fallback)
  const useServices = typeof setImages === 'function';

  async function patchImageReactions(nextLikes, nextDislikes) {
    if (useServices) {
      await toggleImageLike({
        filename: img.filename,              // server expects :filename
        accountId: img.accountId,
        likes: nextLikes,
        dislikes: nextDislikes,
        setImages,
      });
    } else if (typeof updateGalleryImage === 'function') {
      // Fallback: DO NOT send comments to avoid username regressions
      await updateGalleryImage({
        _id: img._id,                         // keep legacy identity for your parent
        likes: nextLikes,
        dislikes: nextDislikes,
      });
    }
  }

  async function patchComments(nextComments) {
    // Show a stable, fully populated local copy while request is in-flight
    setOverrideComments(nextComments);

    if (useServices) {
      await saveComments({
        filename: img.filename,
        accountId: img.accountId,
        comments: compactForSave(nextComments),
        setImages,
      });
    } else if (typeof updateGalleryImage === 'function') {
      // Fallback to legacy parent updater (includes likes/dislikes to preserve counts)
      await updateGalleryImage({
        ...img,
        comments: compactForSave(nextComments),
        likes: uniqIds(img?.likes || []),
        dislikes: uniqIds(img?.dislikes || []),
      });
    }
    // Clear override so the populated server response (or parent state) is used
    setOverrideComments(null);
  }

  async function handleLike() {
    if (submitting) return;
    setSubmitting(true);
    const likeSet = new Set(uniqIds(img?.likes || []));
    const dislikeSet = new Set(uniqIds(img?.dislikes || []));
    if (liked) likeSet.delete(userId);
    else { likeSet.add(userId); dislikeSet.delete(userId); }
    setOptimisticLiked(!liked);
    setOptimisticDisliked(false);

    await patchImageReactions(Array.from(likeSet), Array.from(dislikeSet));
    setSubmitting(false);
  }
  async function handleDislike() {
    if (submitting) return;
    setSubmitting(true);
    const likeSet = new Set(uniqIds(img?.likes || []));
    const dislikeSet = new Set(uniqIds(img?.dislikes || []));
    if (disliked) dislikeSet.delete(userId);
    else { dislikeSet.add(userId); likeSet.delete(userId); }
    setOptimisticDisliked(!disliked);
    setOptimisticLiked(false);

    await patchImageReactions(Array.from(likeSet), Array.from(dislikeSet));
    setSubmitting(false);
  }

  // ---- comments handlers (kept for later re-enable) ----

  async function handleComment(e) {
    e.preventDefault();
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);

    const newComment = {
      _id: Math.random().toString(36).slice(2),
      userId: user, // full object for instant username/avatar
      text: commentInput,
      createdAt: new Date().toISOString(),
      likes: [],
      dislikes: [],
      replies: []
    };
    const next = [...(img.comments || []), newComment];
    setCommentInput('');

    await patchComments(next);
    setSubmitting(false);
  }

  async function handleReply(e, commentId) {
    e.preventDefault();
    if (!replyInput.trim() || submitting) return;
    setSubmitting(true);
    const newReply = {
      _id: Math.random().toString(36).slice(2),
      userId: user,
      text: replyInput,
      createdAt: new Date().toISOString(),
      likes: [],
      dislikes: []
    };
    const next = (img.comments || []).map(c =>
      c._id === commentId ? { ...c, replies: [...(c.replies || []), newReply] } : c
    );
    setReplyInput('');
    setReplyBoxFor(null);

    await patchComments(next);
    setSubmitting(false);
  }

  async function handleLikeDislikeComment(commentId, isReply, replyId, isLike) {
    const current = (img.comments || []).map(c => ({ ...c, replies: [...(c.replies || [])] }));
    if (isReply) {
      for (const c of current) {
        if (c._id === commentId) {
          c.replies = c.replies.map(r => {
            if (r._id !== replyId) return r;
            const likeSet = new Set(uniqIds(r.likes));
            const disSet = new Set(uniqIds(r.dislikes));
            if (isLike) { likeSet.has(userId) ? likeSet.delete(userId) : (likeSet.add(userId), disSet.delete(userId)); }
            else { disSet.has(userId) ? disSet.delete(userId) : (disSet.add(userId), likeSet.delete(userId)); }
            return { ...r, likes: Array.from(likeSet), dislikes: Array.from(disSet) };
          });
          break;
        }
      }
    } else {
      for (let i = 0; i < current.length; i++) {
        const c = current[i];
        if (c._id === commentId) {
          const likeSet = new Set(uniqIds(c.likes));
          const disSet = new Set(uniqIds(c.dislikes));
          if (isLike) { likeSet.has(userId) ? likeSet.delete(userId) : (likeSet.add(userId), disSet.delete(userId)); }
          else { disSet.has(userId) ? disSet.delete(userId) : (disSet.add(userId), likeSet.delete(userId)); }
          current[i] = { ...c, likes: Array.from(likeSet), dislikes: Array.from(disSet) };
          break;
        }
      }
    }
    await patchComments(current);
  }

  async function handleEditComment(commentId, isReply, replyId, value) {
    const current = (img.comments || []).map(c => ({ ...c, replies: [...(c.replies || [])] }));
    if (isReply) {
      for (const c of current) {
        if (c._id === commentId) {
          c.replies = c.replies.map(r => (r._id === replyId ? { ...r, text: value } : r));
          break;
        }
      }
    } else {
      for (let i = 0; i < current.length; i++) {
        if (current[i]._id === commentId) {
          current[i] = { ...current[i], text: value };
          break;
        }
      }
    }
    setEditingCommentId(null);
    setEditingValue('');
    await patchComments(current);
  }

  async function handleDeleteComment(commentId, isReply, replyId) {
    let current;
    if (isReply) {
      current = (img.comments || []).map(c =>
        c._id === commentId ? { ...c, replies: (c.replies || []).filter(r => r._id !== replyId) } : c
      );
    } else {
      current = (img.comments || []).filter(c => c._id !== commentId);
    }
    await patchComments(current);
  }

  async function handleSaveCaption() {
    if (submitting) return;
    setSubmitting(true);
    if (useServices) {
      await saveCaption({
        filename: img.filename,
        accountId: img.accountId,
        caption: captionInput || '',
        setImages,
      });
    } else if (typeof updateGalleryImage === 'function') {
      await updateGalleryImage({ _id: img._id, caption: captionInput || '' });
    }
    setIsEditingCaption(false);
    setSubmitting(false);
  }

  function handleShare() {
    const url = window.location.origin + (typeof getGalleryImgSrc === 'function' ? getGalleryImgSrc(img) : (img?.path || img?.url || ''));
    navigator.clipboard.writeText(url).then(() => {
      setShareStatus('Image link copied!');
      setTimeout(() => setShareStatus(''), 1500);
    });
  }

  const commentIconBtnStyle = {
    background: 'none',
    border: 'none',
    color: '#b4b7be',
    fontSize: '90%',
    cursor: 'pointer',
    padding: '0 4px',
    minWidth: 22,
    height: 20,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 5,
    opacity: 0.80,
    marginLeft: 1,
    marginRight: 1,
    transition: 'color 0.12s, background 0.14s',
  };

  function CommentHeader({ author, createdAt, canEdit, onEdit, onDelete, extra }) {
    const key = typeof author === 'string' ? author : (author && (author._id || author.id));
    let resolved = resolveUser(author);

    // Prefer last resolved object to avoid any avatar/name fallback
    if (!isUserObj(resolved) && key && lastResolvedRef.current[key]) {
      resolved = lastResolvedRef.current[key];
    }
    if (isUserObj(resolved) && key) {
      lastResolvedRef.current[key] = resolved;
    }

    const authorObj = isUserObj(resolved) ? resolved : null;
    const name = displayUsername(authorObj);
    const avatar = authorObj && avatarFrom(authorObj);

    return (
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 2 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', border: '1px solid #2d3140',
          display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1f2230'
        }}>
          {avatar ? (
            <img src={typeof avatar === 'string' ? avatar : ''} alt={`${name} avatar`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 800, color: '#ffe066' }}>{initialOf(name)}</span>
          )}
        </div>
        <span style={{ color: '#7ce9fd', fontWeight: 600, fontSize: 14.5 }}>{name}</span>
        <span style={{ color: '#999', fontSize: 11, fontWeight: 400, letterSpacing: 0.1 }}>{formatTime(createdAt)}</span>
        {canEdit && (
          <>
            <button style={commentIconBtnStyle} onClick={onEdit} title="Edit">
              <FaEdit />
            </button>
            <button style={commentIconBtnStyle} onClick={onDelete} title="Delete">
              <FaTrash />
            </button>
          </>
        )}
        {extra}
      </div>
    );
  }

  function renderReplies(comment) {
    return (comment.replies || []).map(reply => {
      const replyAuthor = reply.userId ?? reply.user;
      const canEdit = idOf(replyAuthor) === userId;
      return (
        <div key={reply._id} style={{
          marginLeft: 24, marginTop: 8,
          background: 'rgba(38,42,54,0.80)', borderRadius: 8,
          padding: '7px 12px', color: '#e8e8e8', fontSize: 14,
          display: 'flex', flexDirection: 'column', boxShadow: '0 1px 4px #0002'
        }}>
          <CommentHeader
            author={replyAuthor}
            createdAt={reply.createdAt}
            canEdit={canEdit}
            onEdit={() => { setEditingCommentId('reply-' + reply._id); setEditingValue(reply.text); }}
            onDelete={() => handleDeleteComment(comment._id, true, reply._id)}
            extra={
              <>
                <button style={commentIconBtnStyle} onClick={() => setReplyBoxFor(comment._id)} title="Reply">
                  <FaReply />
                </button>
                <button
                  style={{ ...commentIconBtnStyle, color: (reply.likes || []).includes(userId) ? '#18e1ff' : '#b4b7be' }}
                  onClick={() => handleLikeDislikeComment(comment._id, true, reply._id, true)}
                  title="Like Reply"
                >
                  <MdRocketLaunch style={{ fontSize: 13 }} /> <span style={{ marginLeft: 2 }}>{(reply.likes || []).length || 0}</span>
                </button>
                <button
                  style={{ ...commentIconBtnStyle, color: (reply.dislikes || []).includes(userId) ? '#ff4545' : '#b4b7be' }}
                  onClick={() => handleLikeDislikeComment(comment._id, true, reply._id, false)}
                  title="Dislike Reply"
                >
                  <FaThumbsDown style={{ fontSize: 12 }} /> <span style={{ marginLeft: 2 }}>{(reply.dislikes || []).length || 0}</span>
                </button>
              </>
            }
          />
          {editingCommentId === 'reply-' + reply._id ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                value={editingValue}
                onChange={e => setEditingValue(e.target.value)}
                style={{ flex: 1, padding: 5, fontSize: 13, borderRadius: 4 }}
                maxLength={140}
              />
              <button style={commentIconBtnStyle} onClick={() => handleEditComment(comment._id, true, reply._id, editingValue)}>Save</button>
              <button style={commentIconBtnStyle} onClick={() => setEditingCommentId(null)}>Cancel</button>
            </div>
          ) : (
            <div style={{ marginBottom: 0, marginTop: 2 }}>{reply.text}</div>
          )}
        </div>
      );
    });
  }

  /* ------------------------------- render ------------------------------- */

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 9999,
        top: 0, left: 0, width: '100%', height: '100vh',
        background: 'radial-gradient(ellipse at 60% 25%, #23273a99 0%, #16171e 100%)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: `calc(${SAFE_TOP}px + env(safe-area-inset-top, 0px))`,
        paddingBottom: `calc(${SAFE_BOTTOM}px + env(safe-area-inset-bottom, 0px))`,
        paddingLeft: 16,
        paddingRight: 16,
        boxSizing: 'border-box',
        backdropFilter: 'blur(6px)'
      }}
      onClick={closePopup}
    >
      <div
        style={{
          position: 'relative',
          background: 'linear-gradient(120deg, #191c25 65%, #181a1f 100%)',
          borderRadius: 24,
          minWidth: 420,
          width: 'min(970px, 98vw)',
          maxWidth: 1040,
          maxHeight: MODAL_MAXH,
          boxShadow: '0 6px 56px #000b',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 0,
          overflow: 'hidden',
          border: '2px solid #292b36',
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* LEFT: Comments (now disabled with a placeholder) */}
        <div style={{
          flex: 1.05,
          background: 'rgba(21,22,31,0.97)',
          borderTopLeftRadius: 20,
          borderBottomLeftRadius: 20,
          padding: 0,
          minWidth: 310,
          maxWidth: 410,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '4px 0 18px #0004'
        }}>
          <div style={{
            color: '#ffe066',
            fontWeight: 800,
            fontSize: 20,
            letterSpacing: 0.5,
            background: 'rgba(18,18,24,0.99)',
            borderTopLeftRadius: 20,
            padding: '18px 0 13px 28px',
            position: 'sticky',
            top: 0,
            zIndex: 1,
            boxShadow: '0 2px 10px #0001'
          }}>
            Comments
          </div>

          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 16px 80px 12px',
            minHeight: 200,
            maxHeight: '62vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {COMMENTS_DISABLED ? (
              <div
                style={{
                  textAlign: 'center',
                  background: 'rgba(38,42,54,0.55)',
                  border: '1px dashed #3a3d4a',
                  color: '#bbb',
                  borderRadius: 10,
                  padding: '18px 14px',
                  width: '100%'
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, color: '#ffe066', marginBottom: 6 }}>
                  Comments temporarily unavailable
                </div>
                <div style={{ fontSize: 15 }}>
                  comments will be available soon
                </div>
              </div>
            ) : (
              <>
                {renderComments.length === 0 && (
                  <div style={{ color: '#bbb', fontSize: 15, margin: '22px 0' }}>No comments yet. Be first!</div>
                )}
                {renderComments.map(comment => {
                  const commentAuthor = comment.userId ?? comment.user;
                  const canEdit = idOf(commentAuthor) === userId;
                  return (
                    <div key={comment._id} style={{
                      background: 'rgba(38,42,54,0.81)',
                      borderRadius: 9,
                      padding: '10px 11px 6px 13px',
                      color: '#fff',
                      fontSize: 15,
                      marginBottom: 13,
                      boxShadow: '0 1px 4px #0001'
                    }}>
                      <CommentHeader
                        author={commentAuthor}
                        createdAt={comment.createdAt}
                        canEdit={canEdit}
                        onEdit={() => { setEditingCommentId('main-' + comment._id); setEditingValue(comment.text); }}
                        onDelete={() => handleDeleteComment(comment._id, false)}
                        extra={
                          <>
                            <button style={commentIconBtnStyle} onClick={() => setReplyBoxFor(comment._id)} title="Reply">
                              <FaReply />
                            </button>
                            <button
                              style={{ ...commentIconBtnStyle, color: (comment.likes || []).includes(userId) ? '#18e1ff' : '#b4b7be' }}
                              onClick={() => handleLikeDislikeComment(comment._id, false, null, true)}
                              title="Like"
                            >
                              <MdRocketLaunch style={{ fontSize: 13 }} /> <span style={{ marginLeft: 2 }}>{(comment.likes || []).length || 0}</span>
                            </button>
                            <button
                              style={{ ...commentIconBtnStyle, color: (comment.dislikes || []).includes(userId) ? '#ff4545' : '#b4b7be' }}
                              onClick={() => handleLikeDislikeComment(comment._id, false, null, false)}
                              title="Dislike"
                            >
                              <FaThumbsDown style={{ fontSize: 12 }} /> <span style={{ marginLeft: 2 }}>{(comment.dislikes || []).length || 0}</span>
                            </button>
                          </>
                        }
                      />

                      {editingCommentId === 'main-' + comment._id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            style={{ flex: 1, padding: 6, fontSize: 14, borderRadius: 4 }}
                            maxLength={140}
                          />
                          <button style={commentIconBtnStyle} onClick={() => handleEditComment(comment._id, false, null, editingValue)}>Save</button>
                          <button style={commentIconBtnStyle} onClick={() => setEditingCommentId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ marginBottom: 2, marginTop: 1 }}>{comment.text}</div>
                      )}

                      {renderReplies(comment)}

                      {replyBoxFor === comment._id && (
                        <form onSubmit={e => handleReply(e, comment._id)} style={{ marginTop: 7, display: 'flex', gap: 5 }}>
                          <input
                            type="text"
                            value={replyInput}
                            onChange={e => setReplyInput(e.target.value)}
                            placeholder="Write a reply..."
                            maxLength={140}
                            style={{ flex: 1, borderRadius: 6, border: '1.5px solid #ffe066', padding: '6px 10px', fontSize: 13, color: '#1d2024' }}
                          />
                          <button type="submit" style={{
                            background: '#ffe066', color: '#232323', fontWeight: 700, border: 'none',
                            borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer'
                          }}>
                            Reply
                          </button>
                          <button type="button" onClick={() => setReplyBoxFor(null)} style={commentIconBtnStyle}>Cancel</button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* composer with current user's avatar (hidden while comments are disabled) */}
          {!COMMENTS_DISABLED && (
            <form
              style={{
                display: 'flex', gap: 8, padding: '14px 16px 14px 13px', background: '#191a21',
                borderBottomLeftRadius: 20, borderTop: '1.5px solid #22232d', position: 'sticky', bottom: 0,
                zIndex: 1,
              }}
              onSubmit={handleComment}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%', overflow: 'hidden',
                border: '1px solid #2d3140', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1f2230'
              }}>
                {avatarFrom(user) ? (
                  <img src={avatarFrom(user)} alt="Me" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#ffe066' }}>{initialOf(user?.username || 'Me')}</span>
                )}
              </div>
              <input
                type="text"
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                placeholder="Add a comment…"
                maxLength={140}
                style={{
                  flex: 1, borderRadius: 7, border: '1.5px solid #ffe066',
                  padding: '8px 12px', fontSize: 14, color: '#191b20'
                }}
                disabled={submitting}
              />
              <button
                type="submit"
                style={{
                  background: '#ffe066', color: '#191919', fontWeight: 700, border: 'none',
                  borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: submitting ? 'wait' : 'pointer'
                }}
                disabled={submitting}
              >
                Post
              </button>
            </form>
          )}
        </div>

        {/* RIGHT: Image & controls */}
        <div style={{
          flex: 1.9,
          minWidth: 350,
          maxWidth: 600,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '36px 20px 24px 20px',
          position: 'relative',
          background: 'transparent',
        }}>
          <button
            onClick={closePopup}
            style={{
              position: 'absolute',
              top: 16, right: 22, fontSize: 25, color: '#ffe3ef',
              background: 'rgba(40,35,45,0.7)', border: 'none', cursor: 'pointer',
              zIndex: 8, fontWeight: 'bold', borderRadius: '50%', boxShadow: '0 2px 10px #0008',
              width: 40, height: 40, lineHeight: '36px', textAlign: 'center'
            }}
            aria-label="Close"
          >✕</button>

          <div style={{
            position: 'absolute',
            top: 'calc(38px + 0.5vw)',
            left: 'calc(18px + 0.5vw)',
            zIndex: 8,
          }}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              style={{
                background: 'rgba(36,39,45,0.93)',
                color: '#ffe066',
                fontSize: 23,
                padding: '5px 9px',
                borderRadius: '50%',
                boxShadow: '0 2px 14px #0007',
                border: '1.5px solid #292b36'
              }}
              aria-label="Open menu"
            >
              <FaEllipsisV />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute',
                top: 38,
                left: 0,
                minWidth: 118,
                background: 'rgba(29, 31, 39, 0.97)',
                border: '1.5px solid #232431',
                borderRadius: 11,
                boxShadow: '0 8px 32px #000b',
                padding: '7px 0',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 22,
              }}>
                <button
                  style={{
                    background: 'none',
                    color: '#ffe066',
                    padding: '11px 22px',
                    borderRadius: 0,
                    justifyContent: 'flex-start',
                    fontSize: 17,
                    fontWeight: 600,
                    borderBottom: '1px solid #232431',
                  }}
                  onClick={() => {
                    setIsEditingCaption(true);
                    setMenuOpen(false);
                  }}
                >
                  <FaEdit style={{ marginRight: 9 }} /> Edit Caption
                </button>
                <button
                  style={{
                    background: 'none',
                    color: '#ff637a',
                    padding: '11px 22px',
                    borderRadius: 0,
                    justifyContent: 'flex-start',
                    fontSize: 17,
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    setMenuOpen(false);
                    setTimeout(() => {
                      if (window.confirm("Delete this image? This cannot be undone.")) deleteImage();
                    }, 120);
                  }}
                >
                  <FaTrash style={{ marginRight: 9 }} /> Delete Image
                </button>
              </div>
            )}
          </div>

          {/* Center row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            width: '100%',
            justifyContent: 'center',
            marginTop: 34,
            marginBottom: 10,
            minHeight: 260,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 48 }}>
              <button
                onClick={() => prevPopupImg(popupImages)}
                style={{
                  background: 'rgba(30,30,30,0.38)', color: '#ffe066', border: 'none',
                  fontSize: 28, cursor: 'pointer', borderRadius: 9, padding: '6px 6px'
                }}
                aria-label="Previous image"
              >
                <FaChevronLeft />
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <button
                  onClick={handleLike}
                  style={{
                    background: 'rgba(27,29,35,0.6)',
                    border: 'none',
                    color: liked ? '#18e1ff' : '#ffe066',
                    fontSize: 22,
                    cursor: 'pointer',
                    padding: '8px 10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: 9,
                    boxShadow: liked ? '0 0 13px #12e1ff77' : '0 1px 8px #0003',
                    minWidth: 48, justifyContent: 'center'
                  }}
                  disabled={submitting}
                  title="Like"
                >
                  <MdRocketLaunch style={{ transform: 'rotate(-10deg)', fontSize: 18 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, marginLeft: 6 }}>{likesArr.length}</span>
                </button>

                <button
                  onClick={handleDislike}
                  style={{
                    background: 'rgba(27,29,35,0.6)',
                    border: 'none',
                    color: disliked ? '#ff4545' : '#ffe066',
                    fontSize: 20,
                    cursor: 'pointer',
                    padding: '8px 10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: 9,
                    boxShadow: disliked ? '0 0 13px #ff454577' : '0 1px 8px #0003',
                    minWidth: 48, justifyContent: 'center'
                  }}
                  disabled={submitting}
                  title="Dislike"
                >
                  <FaThumbsDown style={{ fontSize: 16 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, marginLeft: 6 }}>{dislikesArr.length}</span>
                </button>

                <button
                  onClick={handleShare}
                  style={{
                    background: 'rgba(27,29,35,0.6)',
                    border: 'none',
                    color: '#ffe066',
                    fontSize: 18,
                    padding: '8px 12px',
                    borderRadius: 9,
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    minWidth: 48, justifyContent: 'center'
                  }}
                  title="Share"
                >
                  <FaShareAlt />
                </button>

                {isMobile && (
                  <button
                    onClick={() => {}}
                    style={{
                      background: 'rgba(27,29,35,0.6)',
                      border: 'none',
                      color: '#bbbbbb',
                      fontSize: 18,
                      padding: '8px 10px',
                      borderRadius: 9,
                      display: 'inline-flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      minWidth: 48, justifyContent: 'center'
                    }}
                    title="Comments"
                  >
                    <FaCommentDots />
                  </button>
                )}
              </div>
            </div>

            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(110deg,#181921 60%,#191c21 100%)',
              borderRadius: 20,
              boxShadow: '0 2px 26px #000b',
              padding: 0,
              minHeight: 300,
              minWidth: 240,
              maxHeight: IMAGE_MAX_VH,
              maxWidth: '36vw',
              overflow: 'hidden',
              width: 'min(99%, 420px)',
              aspectRatio: '5/7',
            }}>
              <img
                src={typeof getGalleryImgSrc === 'function' ? getGalleryImgSrc(img) : (img?.path || img?.url || '')}
                alt="Gallery Full View"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 20,
                  boxShadow: '0 2px 26px #000a',
                  background: '#181922',
                  display: 'block',
                  maxHeight: IMAGE_MAX_VH,
                  maxWidth: '36vw',
                  minWidth: 230,
                  minHeight: 300
                }}
              />
            </div>

            <button
              onClick={() => nextPopupImg(popupImages)}
              style={{
                background: 'rgba(30,30,30,0.38)', color: '#ffe066', border: 'none',
                fontSize: 28, cursor: 'pointer', borderRadius: 9, padding: '6px 6px',
                alignSelf: 'center'
              }}
              aria-label="Next image"
            >
              <FaChevronRight />
            </button>
          </div>

          {/* Caption */}
          <div
            style={{
              marginTop: 12,
              textAlign: 'center',
              minHeight: 64,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
            }}
          >
            {isEditingCaption ? (
              <>
                <input
                  type="text"
                  value={captionInput}
                  onChange={e => setCaptionInput(e.target.value)}
                  maxLength={120}
                  style={{
                    width: '70%',
                    maxWidth: 360,
                    padding: 9,
                    fontSize: 15.5,
                    borderRadius: 8,
                    border: '1.5px solid #ffe066',
                    marginBottom: 10,
                    color: '#141922',
                    textAlign: 'center',
                    background: '#fff'
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button
                    onClick={handleSaveCaption}
                    style={{
                      background: '#ffe066', color: '#232323', fontWeight: 700,
                      border: 'none', borderRadius: 8, padding: '6px 18px', fontSize: 14.5, cursor: 'pointer'
                    }}
                  >Save</button>
                  <button
                    onClick={() => setIsEditingCaption(false)}
                    style={{
                      background: '#232323', color: '#ffe066', fontWeight: 700,
                      border: 'none', borderRadius: 8, padding: '6px 18px', fontSize: 14.5, cursor: 'pointer'
                    }}
                  >Cancel</button>
                </div>
              </>
            ) : (
              img?.caption && (
                <div
                  style={{
                    fontSize: 19,
                    lineHeight: '1.4',
                    padding: '2px 10px',
                    wordBreak: 'break-word',
                    color: '#ffe066',
                    fontWeight: 500
                  }}
                >
                  {img.caption}
                </div>
              )
            )}
          </div>

          {shareStatus && (
            <div style={{
              color: '#62f3c2',
              fontWeight: 700,
              marginTop: 6,
              fontSize: 15.5,
              background: 'rgba(30, 34, 40, 0.85)',
              borderRadius: 7,
              padding: '5px 14px'
            }}>{shareStatus}</div>
          )}
        </div>
      </div>
    </div>
  );
}
