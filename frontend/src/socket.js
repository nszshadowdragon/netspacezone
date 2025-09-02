// frontend/src/socket.js
import { io } from "socket.io-client";

/** Resolve API base */
function apiBase() {
  const h = window.location.hostname;
  const isLocal = h === "localhost" || h === "127.0.0.1";
  const env = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
  return env || (isLocal ? "http://localhost:5000" : "https://api.netspacezone.com");
}

/** Reuse across HMR and route changes */
const sock = (() => {
  if (globalThis.__NSZ_SOCKET__) return globalThis.__NSZ_SOCKET__;

  const s = io(apiBase(), {
    path: "/socket.io",
    withCredentials: true,
    transports: ["websocket"], // prefer WS
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 750,
    timeout: 10000,
  });

  // Light debug (comment out if noisy)
  s.on("connect", () => console.debug("[socket] connected", s.id));
  s.on("disconnect", (r) => console.debug("[socket] disconnected:", r));
  s.on("reconnect_attempt", (n) => console.debug("[socket] reconnect_attempt:", n));
  s.on("connect_error", (err) => console.debug("[socket] connect_error:", err?.message));

  globalThis.__NSZ_SOCKET__ = s;
  return s;
})();

export default sock;

/** Connect (optionally with auth) */
export function connectSocket(auth) {
  if (auth?.token) sock.auth = { token: auth.token };
  if (!sock.connected) sock.connect();
  return sock;
}

/** Disconnect */
export function disconnectSocket() {
  if (sock.connected) sock.disconnect();
}

/* ---------------- Room helpers (match server.js) ----------------
   - presence:   presence:join   / presence:leave   (room: user:<userId>)
   - gallery:    gallery:join    / gallery:leave    (room: gallery:<ownerId>)
   - image:      image:join      / image:leave      (room: image:<imageId>)  [optional]
------------------------------------------------------------------*/

/** Join rooms as needed */
export function joinRooms({ userId, ownerId, imageId } = {}) {
  if (userId)  sock.emit("presence:join", { userId: String(userId) });
  if (ownerId) sock.emit("gallery:join",  { ownerId: String(ownerId) });
  if (imageId) sock.emit("image:join",    { imageId: String(imageId) });
}

/** Leave rooms when unmounting/navigating */
export function leaveRooms({ userId, ownerId, imageId } = {}) {
  if (userId)  sock.emit("presence:leave"); // server infers user from socket
  if (ownerId) sock.emit("gallery:leave",  { ownerId: String(ownerId) });
  if (imageId) sock.emit("image:leave",    { imageId: String(imageId) });
}

/* ---------------- Typed convenience wrappers ---------------- */

export const joinPresence = (userId) => joinRooms({ userId });
export const leavePresence = (userId) => leaveRooms({ userId });

export const joinGallery = (ownerId) => joinRooms({ ownerId });
export const leaveGallery = (ownerId) => leaveRooms({ ownerId });

export const joinImage = (imageId) => joinRooms({ imageId });
export const leaveImage = (imageId) => leaveRooms({ imageId });

/* ---------------- Event names (for reference) ----------------
Server emits (from server.js):
- io.to(`user:${userId}`).emit("presence:update", { userId, online, connections, ts })
- io.to(`gallery:${ownerId}`).emit(`gallery:image:created|updated|deleted`, { ownerId, payload, ts })
- (optional) io.to(`image:${imageId}`).emit("image:updated", payload)

Client handlers should expect the gallery payload wrapper and unwrap `.payload`.
----------------------------------------------------------------*/
