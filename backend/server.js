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
const PORT =
  process.env.PORT ||
  process.env.API_PORT ||
  5000;

// Accept multiple common Mongo env names so DB connect never silently breaks
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGODB_URL ||
  process.env.DB_URI ||
  process.env.DATABASE_URL ||
  "";

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

/* ------------ Express basics ------------ */
app.set("trust proxy", 1);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ------------ Upload dirs (serve from BOTH in dev) ------------ */
// Primary uploads directory (backend)
const DEFAULT_UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(__dirname, "uploads");

// Optional: older/local assets under the frontend public folder (dev convenience)
const FRONT_PUBLIC_UPLOADS =
  process.env.FRONT_PUBLIC_UPLOADS ||
  path.join(__dirname, "..", "frontend", "public", "uploads");

// Build a list of directories to serve under the same /uploads route
const UPLOAD_DIRS = [DEFAULT_UPLOAD_DIR];
if (fs.existsSync(FRONT_PUBLIC_UPLOADS)) {
  UPLOAD_DIRS.push(FRONT_PUBLIC_UPLOADS);
}

// Ensure they exist
UPLOAD_DIRS.forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

// Mount ALL upload dirs at /uploads (order matters; first wins)
UPLOAD_DIRS.forEach((dir) => {
  app.use(
    "/uploads",
    express.static(dir, {
      maxAge: "365d",
      etag: true,
      index: false,
      setHeaders(res) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    })
  );
});
console.log("[uploads] serving from:", UPLOAD_DIRS.join(" | "));

/* ------------ Routes ------------ */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/gallery", require("./routes/galleryRoutes"));

// Users router (search + friend request folded in)
const usersRouter = require("./routes/users");
app.use("/api/users", usersRouter);

/* Health check + basic diagnostics */
app.get("/healthz", (_req, res) =>
  res.json({
    ok: true,
    mongoConfigured: Boolean(MONGO_URI),
  })
);

/* ------------ DB ------------ */
if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("[DB] MongoDB connected"))
    .catch((err) => {
      console.error("[DB] Mongo connection error:", err?.message || err);
    });
} else {
  console.warn(
    "[DB] No Mongo URI detected (set one of: MONGO_URI, MONGODB_URI, DATABASE_URL, DB_URI)."
  );
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
  io.to(`gallery:${uid}`).emit("presence:update", payload);
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

io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  socket.data = socket.data || {};
  socket.data.token = token || "";
  next();
});

io.on("connection", (socket) => {
  socket.on("presence:join", ({ userId, username, ...rest } = {}) => {
    if (!userId) return;
    socket.join(`user:${userId}`);
    addPresence(userId, socket, { username, ...rest });
  });

  socket.on("presence:leave", () => removePresence(socket));

  socket.on("gallery:join", ({ ownerId } = {}) => {
    if (!ownerId) return;
    socket.join(`gallery:${String(ownerId)}`);
  });

  socket.on("gallery:leave", ({ ownerId } = {}) => {
    if (!ownerId) return;
    socket.leave(`gallery:${String(ownerId)}`);
  });

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

/* ------------ Start ------------ */
server.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`CORS allowlist: ${ALLOWLIST.join(", ")}`);
  console.log(
    `[DB] Using ${
      MONGO_URI ? "configured" : "NO"
    } Mongo URI (accepted keys: MONGO_URI/MONGODB_URI/DATABASE_URL/DB_URI)`
  );
});
