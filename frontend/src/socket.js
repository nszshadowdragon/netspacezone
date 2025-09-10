// frontend/src/socket.js
import { io } from "socket.io-client";

/**
 * Socket host always follows the API host:
 *  - If VITE_API_BASE_URL is set (e.g. https://api.netspacezone.com) → use it.
 *  - Otherwise fall back to the current page origin (Vite proxy / same-origin dev).
 */
const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
const API_BASE =
  (env.VITE_API_BASE_URL || env.VITE_API_BASE || "").replace(/\/$/, "");

function resolveSocketUrl() {
  if (API_BASE && /^https?:\/\//i.test(API_BASE)) return API_BASE; // socket.io accepts http(s) base
  const { protocol, host } = window.location;
  return `${protocol}//${host}`;
}

const SOCKET_URL = resolveSocketUrl();

/** Reuse across HMR and route changes */
const sock = (() => {
  if (globalThis.__NSZ_SOCKET__) return globalThis.__NSZ_SOCKET__;

  const s = io(SOCKET_URL, {
    path: "/socket.io",
    withCredentials: true,            // send cookies for the API domain
    transports: ["websocket"],        // prefer WS (no long-poll)
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 800,
    timeout: 10000,
    autoConnect: true,
  });

  // Light debug (comment out if noisy)
  try {
    // eslint-disable-next-line no-console
    console.debug("[socket] connecting to:", SOCKET_URL);
    s.on("connect", () => console.debug("[socket] connected", s.id));
    s.on("disconnect", (r) => console.debug("[socket] disconnected:", r));
    s.on("reconnect_attempt", (n) => console.debug("[socket] reconnect_attempt:", n));
    s.on("connect_error", (err) => console.debug("[socket] connect_error:", err?.message));
  } catch {}

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
   - presence: presence:join / presence:leave (room: user:<userId>)
   - gallery:  gallery:join  / gallery:leave  (room: gallery:<ownerId>)
   - image:    image:join    / image:leave    (room: image:<imageId>) [optional]
------------------------------------------------------------------*/
export function joinRooms({ userId, ownerId, imageId } = {}) {
  if (userId)  sock.emit("presence:join", { userId: String(userId) });
  if (ownerId) sock.emit("gallery:join",  { ownerId: String(ownerId) });
  if (imageId) sock.emit("image:join",    { imageId: String(imageId) });
}
export function leaveRooms({ userId, ownerId, imageId } = {}) {
  if (userId)  sock.emit("presence:leave"); // server infers user from socket
  if (ownerId) sock.emit("gallery:leave",  { ownerId: String(ownerId) });
  if (imageId) sock.emit("image:leave",    { imageId: String(imageId) });
}

/* typed convenience wrappers */
export const joinPresence = (userId) => joinRooms({ userId });
export const leavePresence = (userId) => leaveRooms({ userId });
export const joinGallery  = (ownerId) => joinRooms({ ownerId });
export const leaveGallery = (ownerId) => leaveRooms({ ownerId });
export const joinImage    = (imageId) => joinRooms({ imageId });
export const leaveImage   = (imageId) => leaveRooms({ imageId });
