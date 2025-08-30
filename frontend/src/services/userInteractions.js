// src/services/userInteractions.js
import api from '../api';

/**
 * Send a friend request to another user.
 * @param {string} username
 * @returns {Promise}
 */
export function sendFriendRequest(username) {
  return api.post(`/users/${encodeURIComponent(username)}/friend-request`).then(r => r.data);
}

/**
 * Follow another user.
 * @param {string} username
 * @returns {Promise}
 */
export function followUser(username) {
  return api.post(`/users/${encodeURIComponent(username)}/follow`).then(r => r.data);
}

/**
 * Send a message to another user by username.
 * @param {string} username
 * @param {string} text
 * @returns {Promise}
 */
export function sendMessage(username, text) {
  return api.post('/messages', { to: username, text }).then(r => r.data);
}

/**
 * Share a profile URL (e.g., just returns it or triggers your share dialog).
 * @param {string} username
 * @returns {string}
 */
export function getProfileShareLink(username) {
  return `${window.location.origin}/profile/${encodeURIComponent(username)}`;
}
