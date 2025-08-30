// src/services/galleryApi.js
// Safe client for Gallery that prevents username/avatar flicker after comment mutations.
// Uses your existing axios instance (import api from '../api'), same as blogApi/chatApi.

import api from '../api'; // ✅ fixed path

/* ------------------------- merge helpers (no flicker) ------------------------- */

function mergeCommentUsers(prevImg, nextImg) {
  if (!prevImg || !nextImg) return nextImg;
  const byComment = new Map((prevImg.comments || []).map(c => [c._id, c]));
  nextImg.comments = (nextImg.comments || []).map(c => {
    const prev = byComment.get(c._id);
    // Prefer preserved user object if current one is just an ID
    if (prev && typeof c.userId === 'string' && typeof prev.userId === 'object') {
      c.userId = prev.userId;
    }

    const prevReplies = new Map((prev?.replies || []).map(r => [r._id, r]));
    c.replies = (c.replies || []).map(r => {
      const pr = prevReplies.get(r._id);
      if (pr && typeof r.userId === 'string' && typeof pr.userId === 'object') {
        r.userId = pr.userId;
      }
      return r;
    });

    return c;
  });
  return nextImg;
}

/* -------------------------------- API calls --------------------------------- */

// List images for an account (server already populates comment user fields)
export async function listGallery({ accountId }) {
  if (!accountId) throw new Error('accountId required');
  const { data } = await api.get('/api/gallery', { params: { accountId } });
  return data;
}

// Core safe updater: never write the outgoing payload into UI; only apply populated response.
export async function updateGalleryImageSafe({ filename, accountId, patch, setImages }) {
  if (!filename) throw new Error('filename required');
  if (!accountId) throw new Error('accountId required');

  const { data: updated } = await api.patch(`/api/gallery/${encodeURIComponent(filename)}`, {
    accountId,
    ...patch,
  });

  if (typeof setImages === 'function') {
    setImages(prev =>
      prev.map(img =>
        img.filename === updated.filename ? mergeCommentUsers(img, updated) : img
      )
    );
  }

  return updated;
}

/* ---------------------------- convenience wrappers --------------------------- */

// Image-level like/dislike (do NOT touch comments)
export function toggleImageLike({ filename, accountId, likes, dislikes, setImages }) {
  return updateGalleryImageSafe({
    filename,
    accountId,
    patch: { likes, dislikes },
    setImages,
  });
}

// Replace comments (add/edit/delete/like/dislike on comments or replies)
export function saveComments({ filename, accountId, comments, likes, dislikes, setImages }) {
  return updateGalleryImageSafe({
    filename,
    accountId,
    patch: { comments, ...(likes ? { likes } : {}), ...(dislikes ? { dislikes } : {}) },
    setImages,
  });
}

// Caption
export function saveCaption({ filename, accountId, caption, setImages }) {
  return updateGalleryImageSafe({
    filename,
    accountId,
    patch: { caption },
    setImages,
  });
}
