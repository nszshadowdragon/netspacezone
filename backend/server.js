// backend/server.js
require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const app = express();

/* ------------ ENV ------------ */
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "";

/* ------------ CORS allowlist ------------ */
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://netspacezone.com",
  "https://www.netspacezone.com",
];

// Accept either CORS_ORIGINS or CORS_ORIGIN from env (comma separated)
const EXTRA = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWLIST = Array.from(new Set([...DEFAULT_ORIGINS, ...EXTRA]));

/** Is this origin allowed? */
function isAllowedOrigin(origin) {
  // No Origin header (server-to-server, curl) -> allow
  if (!origin) return true;
  if (ALLOWLIST.includes(origin)) return true;

  try {
    const { hostname } = new URL(origin);
    // Allow any Render subdomain (static hosting) and your prod host
    if (hostname.endsWith(".onrender.com")) return true;
    if (hostname === "netspacezone.com" || hostname === "www.netspacezone.com")
      return true;
  } catch {
    // ignore parse error -> disallow
  }
  return false;
}

const corsOptions = {
  origin: (origin, cb) =>
    isAllowedOrigin(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS")),
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  optionsSuccessStatus: 204,
};

/* ------------ Upload dir ------------ */
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ------------ Express basics ------------ */
app.set("trust proxy", 1);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ------------ Static uploads (long-cache) ------------ */
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    maxAge: "365d",
    etag: true,
    index: false,
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  })
);

/* ------------ Routes ------------ */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/gallery", require("./routes/galleryRoutes"));

/* Health check */
app.get("/healthz", (_req, res) => res.json({ ok: true }));

/* ------------ DB ------------ */
if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error("Mongo connection error:", err));
} else {
  console.warn("MONGO_URI missing; skipping DB connect.");
}

/* ------------ HTTP server + Socket.IO ------------ */
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, cb) =>
      isAllowedOrigin(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS")),
    credentials: true,
    methods: ["GET", "POST"],
  },
  path: "/socket.io",
});

/* ===== Real-time wiring =====
   - presence:*  -> user-specific room: user:<userId>
   - gallery:*   -> gallery owner room: gallery:<ownerId>
==================================================== */
const socketsByUser = new Map(); // userId -> Set<socketId>

function emitPresence(userId) {
  const uid = String(userId);
  const count = socketsByUser.get(uid)?.size || 0;
  const payload = {
    userId: uid,
    online: count > 0,
    connections: count,
    ts: Date.now(),
  };
  io.to(`user:${uid}`).emit("presence:update", payload);
  io.to(`gallery:${uid}`).emit("presence:update", payload); // NEW: gallery viewers get presence too
}

function addPresence(userId, socket, info = {}) {
  const uid = String(userId);
  let set = socketsByUser.get(uid);
  if (!set) {
    set = new Set();
    socketsByUser.set(uid, set);
  }
  set.add(socket.id);
  socket.data.userId = uid;
  socket.data.userInfo = info || {};
  emitPresence(uid);
}

function removePresence(socket) {
  const uid = socket.data?.userId;
  if (!uid) return;
  const set = socketsByUser.get(uid);
  if (set) {
    set.delete(socket.id);
    if (set.size === 0) socketsByUser.delete(uid);
  }
  emitPresence(uid);
}

// Optional auth pass-through (token available to handlers)
io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  socket.data = socket.data || {};
  socket.data.token = token || "";
  next();
});

io.on("connection", (socket) => {
  // Join presence for a user
  socket.on("presence:join", ({ userId, username, ...rest } = {}) => {
    if (!userId) return;
    socket.join(`user:${userId}`);
    addPresence(userId, socket, { username, ...rest });
  });

  // Leave explicit presence
  socket.on("presence:leave", () => removePresence(socket));

  // Join a gallery room (viewing owner’s gallery)
  socket.on("gallery:join", ({ ownerId } = {}) => {
    if (!ownerId) return;
    socket.join(`gallery:${String(ownerId)}`);
  });

  // Leave a gallery room (so viewers stop receiving updates)
  socket.on("gallery:leave", ({ ownerId } = {}) => {
    if (!ownerId) return;
    socket.leave(`gallery:${String(ownerId)}`);
  });

  // (optional) per-image rooms
  socket.on("image:join", ({ imageId } = {}) => {
    if (imageId) socket.join(`image:${String(imageId)}`);
  });
  socket.on("image:leave", ({ imageId } = {}) => {
    if (imageId) socket.leave(`image:${String(imageId)}`);
  });

  socket.on("disconnect", () => removePresence(socket));
});

/* Make helpers available to routes/controllers */
app.set("io", io);

/** Broadcast a gallery event to viewers of a given owner’s gallery.
 *  Usage from a route/controller:
 *    const io = req.app.get('io');
 *    io.emitGallery(ownerId, 'image:created', payload);
 */
io.emitGallery = function emitGallery(ownerId, evt, payload) {
  io.to(`gallery:${String(ownerId)}`).emit(`gallery:${evt}`, {
    ownerId: String(ownerId),
    payload,
    ts: Date.now(),
  });
};

/* ------------ Start ------------ */
server.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`CORS allowlist: ${ALLOWLIST.join(", ")}`);
  console.log(`Serving uploads from: ${UPLOAD_DIR}`);
});
