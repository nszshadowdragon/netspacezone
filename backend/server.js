// backend/server.js
require("dotenv").config();

const express = require("express");
const http = require("http");
const https = require("https");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const app = express();

/* ------------ ENV ------------ */
const PORT = process.env.PORT || process.env.API_PORT || 5000;
const REMOTE_BASE = (process.env.UPLOADS_REMOTE_BASE || "").replace(/\/+$/, "");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGODB_URL ||
  process.env.DB_URI ||
  process.env.DATABASE_URL ||
  "";

/* ------------ CORS ------------ */
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://netspacezone.com",
  "https://www.netspacezone.com",
];
const EXTRA = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOWLIST = Array.from(new Set([...DEFAULT_ORIGINS, ...EXTRA]));
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWLIST.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith(".onrender.com")) return true;
    if (hostname === "netspacezone.com" || hostname === "www.netspacezone.com")
      return true;
  } catch {}
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

/* ------------ Uploads: static mounts + smart lookup + REMOTE proxy ------------ */
function resolveUploadDirs() {
  const guesses = [
    process.env.UPLOAD_DIR && path.resolve(process.env.UPLOAD_DIR),

    path.resolve(__dirname, "uploads"),
    path.resolve(__dirname, "public", "uploads"),

    path.resolve(__dirname, "..", "uploads"),
    path.resolve(__dirname, "..", "public", "uploads"),

    path.resolve(process.cwd(), "uploads"),
    path.resolve(process.cwd(), "public", "uploads"),
    path.resolve(process.cwd(), "backend", "uploads"),
    path.resolve(process.cwd(), "backend", "public", "uploads"),

    path.resolve(__dirname, "..", "frontend", "public", "uploads"),
  ]
    .filter(Boolean)
    .map((p) => path.normalize(p));

  const primary = path.resolve(__dirname, "uploads");
  try { fs.mkdirSync(primary, { recursive: true }); } catch {}

  const seen = new Set();
  const out = [];
  for (const g of [primary, ...guesses]) {
    if (seen.has(g)) continue;
    seen.add(g);
    try { if (fs.existsSync(g)) out.push(g); } catch {}
  }
  return out;
}
const UPLOAD_DIRS = resolveUploadDirs();
console.log("[uploads] serving from:", UPLOAD_DIRS.join(" | "));

// static mounts first (fast path)
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

const ALT_SUBS = ["", "users", "user", "profile", "profiles", "avatars", "images", "gallery", "pics", "photos"];
const ALT_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

function fileExists(p) { try { return fs.existsSync(p) && fs.statSync(p).isFile(); } catch { return false; } }
function dirExists(p)  { try { return fs.existsSync(p) && fs.statSync(p).isDirectory(); } catch { return false; } }
function listDir(p)    { try { return fs.readdirSync(p); } catch { return []; } }

function tryLocalSend(res, p) {
  if (fileExists(p)) {
    console.log(`[uploads] found -> ${p}`);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.sendFile(p);
  }
  return false;
}

// Proxy to remote /uploads if configured
function proxyRemoteUpload(rel, res) {
  if (!REMOTE_BASE) return false;
  const cleaned = String(rel || "").replace(/^\/+/, ""); // e.g. "1756...png" or "users/a/b.png"
  const target = new URL(`${REMOTE_BASE}/uploads/${cleaned}`);
  console.log(`[uploads] proxy -> ${target.href}`);

  const lib = target.protocol === "https:" ? https : http;
  const req = lib.get(target, (up) => {
    if ((up.statusCode || 500) >= 200 && (up.statusCode || 500) < 300) {
      // pass through content-type/length if present
      if (up.headers["content-type"]) res.setHeader("Content-Type", up.headers["content-type"]);
      if (up.headers["content-length"]) res.setHeader("Content-Length", up.headers["content-length"]);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      up.pipe(res);
    } else {
      res.status(up.statusCode || 502);
      up.pipe(res);
    }
  });
  req.on("error", (err) => {
    console.warn("[uploads] proxy error:", err?.message || err);
    if (!res.headersSent) res.status(404).send("Not Found");
  });
  return true;
}

// Fallback resolver: alt subfolders/exts + nested + remote proxy
app.get("/uploads/*", (req, res) => {
  const relRaw = (req.params[0] || "").replace(/^\/+/, "");
  if (!relRaw) return res.status(404).send("Not Found");

  const relNorm = relRaw.split(/[\\/]+/).join("/");
  const base = path.basename(relNorm);
  const parsed = path.parse(base);
  const stem = parsed.name;
  const wantExt = (parsed.ext || "").toLowerCase();

  // A. exact rel under each root
  for (const root of UPLOAD_DIRS) {
    if (tryLocalSend(res, path.join(root, relNorm))) return;
  }

  const tried = [];

  // B. alt subfolders + ext combos + nested scan
  for (const root of UPLOAD_DIRS) {
    for (const sub of ALT_SUBS) {
      const dir = sub ? path.join(root, sub) : root;

      if (wantExt) {
        const p1 = path.join(dir, stem + wantExt);
        if (tryLocalSend(res, p1)) return;
        tried.push(p1);
      }
      for (const ext of ALT_EXTS) {
        if (ext === wantExt) continue;
        const p2 = path.join(dir, stem + ext);
        if (tryLocalSend(res, p2)) return;
        tried.push(p2);
      }

      // nested one level
      if (dirExists(dir)) {
        for (const child of listDir(dir)) {
          const childDir = path.join(dir, child);
          if (!dirExists(childDir)) continue;

          if (wantExt) {
            const pSame2 = path.join(childDir, stem + wantExt);
            if (tryLocalSend(res, pSame2)) return;
            tried.push(pSame2);
          }
          for (const ext of ALT_EXTS) {
            if (ext === wantExt) continue;
            const p3 = path.join(childDir, stem + ext);
            if (tryLocalSend(res, p3)) return;
            tried.push(p3);
          }

          const names = listDir(childDir);
          const lowerStem = stem.toLowerCase();
          const hit = names.find((n) => n.toLowerCase().startsWith(lowerStem));
          if (hit && tryLocalSend(res, path.join(childDir, hit))) return;
        }

        // same dir prefix scan
        const names2 = listDir(dir);
        const lowerStem = stem.toLowerCase();
        const hit2 = names2.find((n) => n.toLowerCase().startsWith(lowerStem));
        if (hit2 && tryLocalSend(res, path.join(dir, hit2))) return;
      }
    }
  }

  // C. proxy to remote origin if configured
  if (proxyRemoteUpload(relNorm, res)) return;

  console.warn(`[uploads] 404 for "${relRaw}". Tried:\n - ${tried.join("\n - ")}`);
  return res.status(404).send("Not Found");
});

/* ------------ Routes ------------ */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/gallery", require("./routes/galleryRoutes"));
app.use("/api/users", require("./routes/users"));

app.get("/healthz", (_req, res) =>
  res.json({ ok: true, mongoConfigured: Boolean(MONGO_URI), uploadsMounted: UPLOAD_DIRS, remoteFallback: REMOTE_BASE || null })
);

/* ------------ DB ------------ */
if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("[DB] MongoDB connected"))
    .catch((err) => console.error("[DB] Mongo connection error:", err?.message || err));
} else {
  console.warn("[DB] No Mongo URI set (MONGO_URI / MONGODB_URI / DATABASE_URL / DB_URI).");
}

/* ------------ HTTP + Socket.IO ------------ */
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => (isAllowedOrigin(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS"))),
    credentials: true,
    methods: ["GET", "POST"],
  },
  path: "/socket.io",
});
app.set("io", io);

io.on("connection", (socket) => {
  socket.on("presence:join", ({ userId } = {}) => { if (userId) socket.join(`user:${userId}`); });
  socket.on("presence:leave", () => {});
  socket.on("disconnect", () => {});
});

/* ------------ Start ------------ */
server.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`CORS allowlist: ${ALLOWLIST.join(", ")}`);
});
