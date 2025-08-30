// src/services/chatApi.js
import api from '../api';

// helper: try endpoints and fallback only on 404
async function tryEndpoints(calls) {
  let lastErr;
  for (const call of calls) {
    try { const res = await call(); return res.data; }
    catch (e) { if (e?.response?.status !== 404) throw e; lastErr = e; }
  }
  throw lastErr;
}

// ---- social ----
export async function getFriends(userId) {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return tryEndpoints([
    () => api.get(`/social/friends${qs}`),
    () => api.get(`/api/social/friends${qs}`),
    () => api.get(`/api/api/social/friends${qs}`),
  ]);
}

export async function getFriendRequests() {
  return tryEndpoints([
    () => api.get('/social/friendRequests'),
    () => api.get('/api/social/friendRequests'),
    () => api.get('/api/api/social/friendRequests'),
  ]);
}

// ---- messaging (unchanged) ----
export async function getChatUsers() {
  return tryEndpoints([
    () => api.get('/messages/chat-users'),
    () => api.get('/api/messages/chat-users'),
    () => api.get('/api/api/messages/chat-users'),
  ]);
}
export async function getMessages(userId) {
  return tryEndpoints([
    () => api.get(`/api/messages/${userId}`),
    () => api.get(`/messages/thread/${userId}`),
    () => api.get(`/api/messages/thread/${userId}`),
    () => api.get(`/api/api/messages/${userId}`),
  ]);
}
export async function sendMessage(userId, text) {
  return tryEndpoints([
    () => api.post('/api/messages', { to: userId, text }),
    () => api.post('/messages/send', { to: userId, text }),
    () => api.post('/api/messages/send', { to: userId, text }),
    () => api.post('/api/api/messages', { to: userId, text }),
  ]);
}
export async function editMessage(messageId, text) {
  return tryEndpoints([
    () => api.put(`/api/messages/${messageId}`, { text }),
    () => api.put(`/messages/${messageId}`, { text }),
    () => api.put(`/api/api/messages/${messageId}`, { text }),
  ]);
}
export async function deleteMessage(messageId) {
  return tryEndpoints([
    () => api.delete(`/api/messages/${messageId}`),
    () => api.delete(`/messages/${messageId}`),
    () => api.delete(`/api/api/messages/${messageId}`),
  ]);
}
export async function getUnreadCounts() {
  return tryEndpoints([
    () => api.get('/messages/unread-counts'),
    () => api.get('/api/messages/unread-counts'),
    () => api.get('/api/messages/unread/counts'),
    () => api.get('/api/api/messages/unread-counts'),
  ]);
}
