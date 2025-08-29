// backend/server.js (entry point)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

const app = express();

/* ------------ ENV ------------ */
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "";
const CORS_ORIGIN = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

/* ------------ Ensure upload directory exists ------------ */
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ------------ CORS ------------ */
app.use(
  cors({
    origin: (origin, cb) => {
      // allow server-to-server / curl (no origin)
      if (!origin) return cb(null, true);
      // allow exact matches in list; otherwise deny
      if (CORS_ORIGIN.includes(origin)) return cb(null, true);
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
   In prod (Render): /uploads => /var/data/uploads (persistent disk) */
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    maxAge: "365d",
    etag: true,
    index: false,
    setHeaders(res) {
      // Hint browsers to cache but allow revalidation
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

/* ------------ Start ------------ */
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Serving uploads from: ${UPLOAD_DIR}`);
});
