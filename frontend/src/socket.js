// frontend/src/socket.js
import { io } from "socket.io-client";

function apiBase() {
  const h = window.location.hostname;
  const isLocal = h === "localhost" || h === "127.0.0.1";
  const env = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
  return env || (isLocal ? "http://localhost:5000" : "https://api.netspacezone.com");
}

// Reuse the same socket across HMR and route changes
const sock = (() => {
  if (globalThis.__NSZ_SOCKET__) return globalThis.__NSZ_SOCKET__;
  const s = io(apiBase(), {
    withCredentials: true,
    transports: ["websocket"],     // prefer WS
    autoConnect: false,            // we control when to connect
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
  });

  // (Optional) quiet useful diagnostics
  s.on("connect_error", (err) => console.debug("[socket] connect_error:", err.message));
  s.on("reconnect_attempt", (n) => console.debug("[socket] reconnect_attempt:", n));

  globalThis.__NSZ_SOCKET__ = s;
  return s;
})();

export default sock;

export function connectSocket(auth) {
  // If your server uses auth, pass it here (e.g., token)
  if (auth?.token) sock.auth = { token: auth.token };
  if (!sock.connected) sock.connect();
  return sock;
}

export function disconnectSocket() {
  if (sock.connected) sock.disconnect();
}
