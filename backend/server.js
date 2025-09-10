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
const multer = require("multer");

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
    if (hostname === "netspacezone.com" || hostname === "www.netspacezone.com") return true;
  } catch {}
  return false;
}
const corsOptions = {
  origin: (origin, cb) => (isAllowedOrigin(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS"))),
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

/* ------------ Uploads: static-only + fallback resolver ------------ */
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
  ].filter(Boolean).map((p) => path.normalize(p));

  const primary = path.resolve(__dirname, "uploads");
  try { fs.mkdirSync(primary, { recursive: true }); } catch {}
  const seen = new Set(); const out = [];
  for (const g of [primary, ...guesses]) { if (seen.has(g)) continue; seen.add(g); try { if (fs.existsSync(g)) out.push(g); } catch {} }
  return out;
}
const UPLOAD_DIRS = resolveUploadDirs();
const PRIMARY_UPLOAD_DIR = UPLOAD_DIRS[0] || path.resolve(__dirname, "uploads");
console.log("[uploads] serving from:", UPLOAD_DIRS.join(" | "));

// static mounts only
UPLOAD_DIRS.forEach((dir) => {
  app.use("/uploads", express.static(dir, {
    maxAge: "365d", etag: true, index: false,
    setHeaders(res) { res.setHeader("Cache-Control", "public, max-age=31536000, immutable"); },
  }));
});
app.get(/^\/uploads\/(?:blob:|data:).*/i, (_req, res) => res.status(400).send("Blob/data URLs must not be requested from the server."));

const ALT_SUBS = ["", "users", "user", "profile", "profiles", "avatars", "images", "gallery", "pics", "photos"];
const ALT_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
function tryLocalSend(res, p) { try { if (fs.existsSync(p) && fs.statSync(p).isFile()) { res.setHeader("Cache-Control","public, max-age=31536000, immutable"); return res.sendFile(p);} } catch {} return false; }
app.get("/uploads/*", (req, res) => {
  const relRaw = (req.params[0] || "").replace(/^\/+/, "");
  if (!relRaw) return res.status(404).send("Not Found");
  if (/^(blob:|data:)/i.test(relRaw)) return res.status(400).send("Blob/data URLs must not be requested from the server.");
  const relNorm = relRaw.split(/[\\/]+/).join("/");
  const base = path.basename(relNorm);
  const parsed = path.parse(base);
  const stem = parsed.name;
  const wantExt = (parsed.ext || "").toLowerCase();
  for (const root of UPLOAD_DIRS) if (tryLocalSend(res, path.join(root, relNorm))) return;
  for (const root of UPLOAD_DIRS) {
    for (const sub of ALT_SUBS) {
      const dir = sub ? path.join(root, sub) : root;
      if (wantExt) if (tryLocalSend(res, path.join(dir, stem + wantExt))) return;
      for (const ext of ALT_EXTS) if (ext !== wantExt) if (tryLocalSend(res, path.join(dir, stem + ext))) return;
    }
  }
  return res.status(404).send("Not Found");
});

/* ------------ DB ------------ */
if (MONGO_URI) {
  mongoose.connect(MONGO_URI).then(() => console.log("[DB] MongoDB connected"))
    .catch((err) => console.error("[DB] Mongo connection error:", err?.message || err));
} else {
  console.warn("[DB] No Mongo URI set (MONGO_URI / MONGODB_URI / DATABASE_URL / DB_URI).");
}

// models
const GalleryImage = require("./models/GalleryImage");
let User = null;
try { User = require("./models/User"); } catch { /* if path differs, your existing routes still work */ }

/* ------------ Multer ------------ */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PRIMARY_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname || "") || ".png").toLowerCase();
    const base = `${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    cb(null, `${base}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => { if (!/^image\//i.test(file.mimetype)) return cb(new Error("Only image files allowed")); cb(null, true); },
});

/* ------------ helpers ------------ */
async function resolveAccountIdFromBody(body = {}) {
  let id = String(body.accountId || body.userId || "").trim();
  if (id) return id;
  const uname = (body.username || body.ownerUsername || "").trim();
  if (!uname || !User) return "";
  // case-insensitive username lookup
  const u = await User.findOne({ username: new RegExp(`^${uname}$`, "i") }).select("_id").lean();
  return u ? String(u._id) : "";
}

/* ------------ Upload & Read endpoints (minimal) ------------ */
// POST /api/gallery  (image upload)
app.post("/api/gallery", upload.single("image"), async (req, res) => {
  try {
    const filename = req.file?.filename;
    if (!filename) return res.status(400).send("No file");
    const accountId = await resolveAccountIdFromBody(req.body);
    if (!accountId) return res.status(400).send("Missing accountId");

    const doc = await GalleryImage.create({
      accountId,
      filename,
      path: `/uploads/${filename}`,
      url: `/uploads/${filename}`,
      folder: req.body?.folder || "All",
      caption: req.body?.caption || "",
      createdAt: new Date(),
    });

    try {
      const io = req.app.get("io");
      io?.emit("gallery:image:created", { payload: doc.toObject() });
    } catch {}

    return res.status(201).json(doc);
  } catch (e) {
    console.error("Upload error:", e);
    return res.status(500).send("Upload failed");
  }
});

// GET /api/gallery?accountId=... | userId=... | username=...
app.get("/api/gallery", async (req, res) => {
  try {
    let id = String(req.query.accountId || req.query.userId || "").trim();
    if (!id && req.query.username && User) {
      const u = await User.findOne({ username: new RegExp(`^${String(req.query.username)}$`, "i") }).select("_id").lean();
      if (u) id = String(u._id);
    }
    if (!id) return res.json([]); // empty list if unknown user
    const images = await GalleryImage.find({ accountId: id }).sort({ createdAt: -1 }).lean();
    return res.json(images);
  } catch (e) {
    console.error("List error:", e);
    return res.status(500).send("List failed");
  }
});

// GET /api/gallery/folders?accountId=... | userId=... | username=...
app.get("/api/gallery/folders", async (req, res) => {
  try {
    let id = String(req.query.accountId || req.query.userId || "").trim();
    if (!id && req.query.username && User) {
      const u = await User.findOne({ username: new RegExp(`^${String(req.query.username)}$`, "i") }).select("_id").lean();
      if (u) id = String(u._id);
    }
    if (!id) return res.json({ folders: ["All"] });
    const rows = await GalleryImage.aggregate([
      { $match: { accountId: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: "$folder", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const folders = ["All", ...rows.map((r) => r._id || "All").filter((f) => f && f !== "All")];
    return res.json({ folders });
  } catch (e) {
    console.error("Folders error:", e);
    return res.status(500).send("Folders failed");
  }
});

/* ------------ Your existing route modules ------------ */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/gallery", require("./routes/galleryRoutes"));
app.use("/api/users", require("./routes/users"));

app.get("/healthz", (_req, res) =>
  res.json({ ok: true, mongoConfigured: Boolean(MONGO_URI), uploadsMounted: UPLOAD_DIRS, remoteFallback: REMOTE_BASE || null })
);

/* ------------ HTTP + Socket.IO ------------ */
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: (origin, cb) => (isAllowedOrigin(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS"))), credentials: true, methods: ["GET", "POST"] },
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
