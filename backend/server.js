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
    // Allow any Render web service subdomain (frontend hosting)
    if (hostname.endsWith(".onrender.com")) return true;
    if (hostname === "netspacezone.com" || hostname === "www.netspacezone.com")
      return true;
  } catch {
    // ignore parse error -> disallow
  }
  return false;
}

const corsOptions = {
  origin: (origin, cb) => (isAllowedOrigin(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS"))),
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

/* ------------ Ensure upload directory exists ------------ */
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ------------ Trust proxy (Render) ------------ */
app.set("trust proxy", 1);

/* ------------ CORS (REST) ------------ */
app.use(cors(corsOptions));

/* ------------ Body / cookies ------------ */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ------------ Serve uploads ------------ */
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
    origin: (origin, cb) => (isAllowedOrigin(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS"))),
    credentials: true,
    methods: ["GET", "POST"],
  },
  path: "/socket.io",
});

// Optional auth pass-through
io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  socket.data = socket.data || {};
  socket.data.token = token || "";
  next();
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
  console.log(`CORS allowlist: ${ALLOWLIST.join(", ")}`);
  console.log(`Serving uploads from: ${UPLOAD_DIR}`);
});
