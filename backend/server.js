// backend/server.js
require("dotenv").config();
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();

/* ---------- CORS ---------- */
const WHITELIST = [
  "https://netspacezone.com",
  "https://www.netspacezone.com",
  "http://localhost:5173",
  "http://localhost:3000",
];
const corsOptions = {
  origin(origin, cb) {
    // allow same-origin/fetches with no origin (curl, SSR)
    if (!origin || WHITELIST.includes(origin)) return cb(null, true);
    cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
// make sure every preflight gets an OK
app.options("*", cors(corsOptions));

/* ---------- Body & cookies ---------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ---------- Static for uploaded images ---------- */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ---------- Routes ---------- */
const authRoutes = require("./routes/auth"); // this file is below
app.use("/api/auth", authRoutes);

/* ---------- Health ---------- */
app.get("/health", (req, res) => res.json({ ok: true }));

/* ---------- Start ---------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on ${PORT}`);
});
