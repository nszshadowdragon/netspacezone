// backend/server.js (entry point)
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
const CORS_ORIGIN = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Add sensible defaults (deduped) for local + prod
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://netspacezone.com",
  "https://www.netspacezone.com",
];
const ORIGINS = Array.from(new Set([...DEFAULT_ORIGINS, ...CORS_ORIGIN]));

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

/* ------------ Ensure upload directory exists ------------ */
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ------------ CORS (REST) ------------ */
app.use(
  cors({
    origin: (origin, cb) => {
      // allow server-to-server / curl (no origin)
      if (!origin) return cb(null, true);
      if (ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  })
);

/* ------------ Body / cookies ------------ */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ------------ Serve uploads from the configured folder ------------ */
/* In dev: /uploads => <repo>/backend/uploads
   In prod: /uploads => persistent disk */
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
    origin: ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/socket.io",
});

// Optional auth pass-through (reads token from client if you use it)
io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  socket.data = socket.data || {};
  socket.data.token = token || "";
  return next();
});

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);
  });
});

// Make io available to routes if needed
app.set("io", io);

/* ------------ Start ------------ */
server.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`CORS origins: ${ORIGINS.join(", ")}`);
  console.log(`Serving uploads from: ${UPLOAD_DIR}`);
});
