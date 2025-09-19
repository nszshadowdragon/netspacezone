// frontend/src/services/notificationFeed.js
// Notification feed derived from the Friends API so we don't need /api/notifications.

import FriendsAPI from "./friends";

/** Get notifications for the bell: mapped from incoming friend requests */
export async function fetchNotifications() {
  const [{ data: incomingRes }, countsRes] = await Promise.all([
    FriendsAPI.listIncoming(), // array of users / requests
    FriendsAPI.getCounts(),    // { incoming, outgoing, friends }
  ]);

  const incoming = Array.isArray(incomingRes) ? incomingRes : [];

  const notifications = incoming.map((req) => ({
    id: req._id || `${req.username || ""}-${req.createdAt || ""}`,
    type: "friend_request",
    username: req.username,
    displayName: req.displayName || req.username,
    profileImage: req.profileImage || "",
    createdAt: req.createdAt || req.requestedAt || Date.now(),
    fromUserId: req._id || req.userId || "",
  }));

  const counts = (countsRes?.data) || { incoming: incoming.length, outgoing: 0, friends: 0 };

  return { notifications, counts };
}

/** Optional helper if you want the bell to refresh just the count */
export async function fetchNotificationCount() {
  const { data } = await FriendsAPI.getCounts();
  return Number(data?.incoming || 0);
}
