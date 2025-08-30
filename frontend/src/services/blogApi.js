// src/services/blogApi.js
import api from '../api';

// ----------------------------- listings -----------------------------
/**
 * Common listing helper
 * @param {'hot'|'new'|'top'} sort
 * @param {{limit?:number, cursor?:string, cursorScore?:number, tag?:string, q?:string}} opts
 */
function listBy(sort, opts = {}) {
  const params = {
    sort,
    limit: opts.limit,
    tag: opts.tag,
    q: opts.q,
  };
  if (opts.cursor) params.cursor = opts.cursor;
  if ((sort === 'hot' || sort === 'top') && opts.cursorScore != null) {
    params.cursorScore = opts.cursorScore;
  }
  return api.get('/blog', { params }).then(r => r.data);
}

export function listHot(opts = {}) {
  return listBy('hot', opts);
}
export function listNew(opts = {}) {
  return listBy('new', opts);
}
export function listTop(opts = {}) {
  return listBy('top', opts);
}

// ----------------------------- single -----------------------------
export function getBlog(id) {
  if (!id) throw new Error('id required');
  return api.get(`/blog/${encodeURIComponent(id)}`).then(r => r.data);
}

// ----------------------------- create/update/delete -----------------------------
export function createBlog({ title, content, coverImage, tags }) {
  return api.post('/blog', { title, content, coverImage, tags }).then(r => r.data);
}

export function updateBlog(id, data) {
  if (!id) throw new Error('id required');
  return api.patch(`/blog/${encodeURIComponent(id)}`, data).then(r => r.data);
}

export function deleteBlog(id) {
  if (!id) throw new Error('id required');
  return api.delete(`/blog/${encodeURIComponent(id)}`).then(r => r.data);
}

// ----------------------------- reactions & follows -----------------------------
export function toggleLike(id) {
  if (!id) throw new Error('id required');
  return api.post(`/blog/${encodeURIComponent(id)}/like`).then(r => r.data);
}

export function toggleFollow(id) {
  if (!id) throw new Error('id required');
  return api.post(`/blog/${encodeURIComponent(id)}/follow`).then(r => r.data);
}

// ----------------------------- comments -----------------------------
export function addComment(postId, text) {
  if (!postId) throw new Error('postId required');
  if (!text || typeof text !== 'string') throw new Error('text required');
  return api.post(`/blog/${encodeURIComponent(postId)}/comments`, { text }).then(r => r.data);
}

export function editComment(postId, commentId, text) {
  if (!postId) throw new Error('postId required');
  if (!commentId) throw new Error('commentId required');
  if (!text || typeof text !== 'string') throw new Error('text required');
  return api
    .patch(
      `/blog/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
      { text }
    )
    .then(r => r.data);
}

export function deleteComment(postId, commentId) {
  if (!postId) throw new Error('postId required');
  if (!commentId) throw new Error('commentId required');
  return api
    .delete(`/blog/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`)
    .then(r => r.data);
}
