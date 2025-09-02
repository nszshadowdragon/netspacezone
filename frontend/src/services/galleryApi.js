// frontend/src/api/galleryApi.js  (or src/services/galleryApi.js)
// Unified Gallery API client
// - Keeps your "safe update" helpers to avoid username/avatar flicker
// - Forces uploads to POST /api/gallery (not /api/upload)
// - Works locally and in production (uses VITE_API_BASE if provided)

import baseApi from '../api';              // your shared axios instance
import axios from 'axios';

/* ----------------------------- axios instance ----------------------------- */
const API_BASE =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_API_BASE || '')).replace(/\/$/, '');

const api =
  baseApi && typeof baseApi.get === 'function'
    ? baseApi
    : axios.create({
        baseURL: API_BASE || undefined,    // same-origin if empty
        withCredentials: true,
      });

// Ensure credentials + optional bearer are always sent
api.defaults.withCredentials = true;
if (API_BASE && !api.defaults.baseURL) api.defaults.baseURL = API_BASE;

api.interceptors.request.use((cfg) => {
  const t =
    (typeof localStorage !== 'undefined' && localStorage.getItem('nsz_token')) ||
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('nsz_token'));
  if (t) {
    cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${t}` };
  }
  // be explicit on multipart; axios sets boundary automatically
  if (cfg.data instanceof FormData) {
    cfg.headers = { ...(cfg.headers || {}), 'Content-Type': 'multipart/form-data' };
  }
  cfg.withCredentials = true;
  return cfg;
});

/* ------------------------- merge helpers (no flicker) ------------------------- */
// (Preserves populated user objects on comments/replies after PATCH)
function mergeCommentUsers(prevImg, nextImg) {
  if (!prevImg || !nextImg) return nextImg;

  const byComment = new Map((prevImg.comments || []).map((c) => [c._id, c]));
  nextImg.comments = (nextImg.comments || []).map((c) => {
    const prev = byComment.get(c._id);

    // Prefer preserved user object if current one is just an ID
    if (prev && typeof c.userId === 'string' && typeof prev.userId === 'object') {
      c.userId = prev.userId;
    }

    const prevReplies = new Map((prev?.replies || []).map((r) => [r._id, r]));
    c.replies = (c.replies || []).map((r) => {
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

// ---- Lists ----

// List images for an account (server already populates comment user fields)
export async function listGallery({ accountId }) {
  if (!accountId) throw new Error('accountId required');
  const { data } = await api.get('/api/gallery', { params: { accountId } });
  // Some backends return {images:[...]}; others return the array directly
  return Array.isArray(data?.images) ? data.images : data;
}

// Alias used in some components
export const listImages = async (accountId) => listGallery({ accountId });

// Folders (returns ["All", ...userFolders])
export async function listFolders(accountId) {
  if (!accountId) throw new Error('accountId required');
  const { data } = await api.get('/api/gallery/folders', { params: { accountId } });
  return Array.isArray(data) ? data : data?.folders || ['All'];
}

// ---- Create / Upload ----

// Upload image (FORCES canonical endpoint /api/gallery)
export async function uploadImage({ file, accountId, folder = 'All' }) {
  if (!file) throw new Error('file required');
  if (!accountId) throw new Error('accountId required');

  const fd = new FormData();
  fd.append('image', file, file.name);   // server expects field "image"
  fd.append('accountId', accountId);
  if (folder && folder !== 'All') fd.append('folder', folder);

  const { data } = await api.post('/api/gallery', fd);
  return data; // server returns populated image doc
}

// ---- Update ----

// Core safe updater: never write outgoing payload into UI; only apply populated response.
export async function updateGalleryImageSafe({ filename, accountId, patch, setImages }) {
  if (!filename) throw new Error('filename required');
  if (!accountId) throw new Error('accountId required');

  const { data: updated } = await api.patch(`/api/gallery/${encodeURIComponent(filename)}`, {
    accountId,
    ...patch,
  });

  if (typeof setImages === 'function') {
    setImages((prev) =>
      prev.map((img) =>
        (img.filename || img._id) === (updated.filename || updated._id)
          ? mergeCommentUsers(img, updated)
          : img
      )
    );
  }

  return updated;
}

// Convenience wrappers
export function toggleImageLike({ filename, accountId, likes, dislikes, setImages }) {
  return updateGalleryImageSafe({
    filename,
    accountId,
    patch: { likes, dislikes },
    setImages,
  });
}
export function saveComments({ filename, accountId, comments, likes, dislikes, setImages }) {
  return updateGalleryImageSafe({
    filename,
    accountId,
    patch: { comments, ...(likes ? { likes } : {}), ...(dislikes ? { dislikes } : {}) },
    setImages,
  });
}
export function saveCaption({ filename, accountId, caption, setImages }) {
  return updateGalleryImageSafe({
    filename,
    accountId,
    patch: { caption },
    setImages,
  });
}

// Simple alias used by some callers
export const updateImage = async (filename, accountId, body) =>
  updateGalleryImageSafe({ filename, accountId, patch: body });

// ---- Delete ----
export async function deleteImage(filename, accountId) {
  if (!filename) throw new Error('filename required');
  if (!accountId) throw new Error('accountId required');

  const { data } = await api.delete(`/api/gallery/${encodeURIComponent(filename)}`, {
    params: { accountId },
  });
  return data;
}

export default {
  listGallery,
  listImages,
  listFolders,
  uploadImage,
  updateGalleryImageSafe,
  updateImage,
  toggleImageLike,
  saveComments,
  saveCaption,
  deleteImage,
};
