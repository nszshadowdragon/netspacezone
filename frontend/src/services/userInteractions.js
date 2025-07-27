// src/services/userInteractions.js
import axios from 'axios';

/**
 * Send a friend request to another user.
 * @param {string} username
 * @returns {Promise}
 */
export function sendFriendRequest(username) {
  return axios.post(`/api/users/${username}/friend-request`);
}

/**
 * Follow another user.
 * @param {string} username
 * @returns {Promise}
 */
export function followUser(username) {
  return axios.post(`/api/users/${username}/follow`);
}

/**
 * Send a message to another user.
 * @param {string} username
 * @param {string} text
 * @returns {Promise}
 */
export function sendMessage(username, text) {
  return axios.post(`/api/messages`, { to: username, text });
}

/**
 * Share a profile URL (e.g., just returns it or triggers your share dialog).
 * @param {string} username
 * @returns {string}
 */
export function getProfileShareLink(username) {
  return `${window.location.origin}/profile/${username}`;
}
