// Local apiFetch utility: always sends credentials for cookie-auth
async function apiFetch(url, options = {}) {
  const mergedOptions = {
    ...options,
    credentials: 'include'
  };
  // If the URL is relative, prefix with backend base (in dev)
  const fullUrl = url.startsWith('http') ? url : 'http://localhost:5000' + url;
  return fetch(fullUrl, mergedOptions);
}

// Get current friends
export async function getFriends() {
  const res = await apiFetch('/api/social/friends');
  if (!res.ok) throw new Error('Failed to fetch friends');
  return res.json();
}

// Get friend requests
export async function getFriendRequests() {
  const res = await apiFetch('/api/social/friendRequests');
  if (!res.ok) throw new Error('Failed to fetch friend requests');
  return res.json();
}

// Search users site-wide
export async function searchUsers(query) {
  const res = await apiFetch('/api/search/users?q=' + encodeURIComponent(query));
  if (!res.ok) throw new Error('Failed to search users');
  return res.json();
}

// Send friend request
export async function sendFriendRequest(userId) {
  const res = await apiFetch(`/api/social/friend/request/${userId}`, { method: 'POST' });
  return res.json();
}

// Accept friend request
export async function acceptFriendRequest(userId) {
  const res = await apiFetch(`/api/social/friend/accept/${userId}`, { method: 'POST' });
  return res.json();
}

// Decline friend request
export async function declineFriendRequest(userId) {
  const res = await apiFetch(`/api/social/friend/decline/${userId}`, { method: 'POST' });
  return res.json();
}

// Get conversation messages with a user
export async function getMessages(userId) {
  const res = await apiFetch(`/api/messages/${userId}`);
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json();
}

// Send a message to a user
export async function sendMessage(userId, text) {
  const res = await apiFetch(`/api/messages/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

// Edit a message
export async function editMessage(msgId, text) {
  const res = await apiFetch(`/api/messages/${msgId}/edit`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error('Failed to edit message');
  return res.json();
}

// React to a message
export async function reactToMessage(msgId, emoji) {
  const res = await apiFetch(`/api/messages/${msgId}/react`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emoji })
  });
  if (!res.ok) throw new Error('Failed to react to message');
  return res.json();
}

// Get unread message counts per user
export async function getUnreadCounts() {
  const res = await apiFetch('/api/messages/unread/counts');
  if (!res.ok) throw new Error('Failed to get unread counts');
  return res.json(); // [{ userId, count }]
}
