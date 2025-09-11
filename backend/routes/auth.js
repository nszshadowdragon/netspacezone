// backend/routes/auth.js
const express = require("express");
const router = express.Router();

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const User = require("../models/User");
const { verifyToken } = require("../middleware/authMiddleware");

/* ---------------------------- env & paths ---------------------------- */
const UPLOAD_DIR =
  process.env.UPLOAD_DIR && process.env.UPLOAD_DIR.trim().length > 0
    ? process.env.UPLOAD_DIR
    : path.join(process.cwd(), "uploads"); // fallback for dev

/* ---------------------------- helpers & utils ---------------------------- */
const escapeRegExp = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isValidEmail = (v = "") => /^\S+@\S+\.\S+$/.test(String(v).trim());
const isValidUsername = (v = "") => /^[a-zA-Z0-9._-]{3,20}$/.test(String(v).trim());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
function signJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function ensureUploadsDir() { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); return UPLOAD_DIR; }
function saveBufferToUploads(buffer, originalName) {
  const dir = ensureUploadsDir();
  const ts = Date.now();
  const sanitized = (originalName || "image").replace(/[^\w.\-]+/g, "_");
  const filename = `${ts}_${sanitized}`;
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, buffer);
  return `/uploads/${filename}`;
}

/* ---------- avatar path → absolute URL ---------- */
function normalizeUploadsPath(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/\\/g, "/");
  if (/^https?:\/\//i.test(s) || /^data:/i.test(s)) return s;
  const low = s.toLowerCase();
  const idx = low.indexOf("/uploads/");
  if (idx >= 0) s = s.slice(idx);
  if (s.startsWith("uploads/")) s = "/" + s;
  if (!s.startsWith("/")) s = "/" + s;
  return s;
}
const apexFromHost = (h) => (h || "").replace(/^https?:\/\//i, "").replace(/\/.*$/,"").replace(/^www\./i,"");
const apiBaseFromHost = (h) => { const apex = apexFromHost(h); return apex ? `https://api.${apex}` : ""; };
function toPublicUrl(req, raw) {
  const p = normalizeUploadsPath(raw);
  if (!p) return null;

  const explicit = (process.env.UPLOADS_PUBLIC_BASE || "").trim().replace(/\/+$/,"");
  if (explicit) return `${explicit}${p}`;

  const origin = (req.get("origin") || "").trim();
  if (origin) {
    try {
      const u = new URL(origin);
      const isApi = /^api\./i.test(u.hostname);
      const base = isApi ? `${u.protocol}//${u.host}` : apiBaseFromHost(u.host);
      if (base) return `${base}${p}`;
    } catch {}
  }

  const fwdHost = (req.get("x-forwarded-host") || "").trim();
  if (fwdHost) {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const isApi = /^api\./i.test(fwdHost);
    const base = isApi ? `${proto}://${fwdHost}` : apiBaseFromHost(fwdHost);
    if (base) return `${base}${p}`;
  }

  const host = (req.get("host") || "").trim();
  if (host) {
    const proto = req.protocol || "https";
    const isApi = /^api\./i.test(host);
    const base = isApi ? `${proto}://${host}` : apiBaseFromHost(host);
    if (base) return `${base}${p}`;
  }

  return `https://api.netspacezone.com${p}`;
}

/* ---------------- cookie options (prod-ready cross-site) --------------- */
const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || ".netspacezone.com";
const BASE_COOKIE = {
  httpOnly: true,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
function cookieOpts() {
  if (!IS_PROD) return { ...BASE_COOKIE, sameSite: "lax", secure: false };
  return { ...BASE_COOKIE, sameSite: "none", secure: true, domain: COOKIE_DOMAIN };
}

/* --------------------------------- MULTER --------------------------------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files are allowed"));
    cb(null, true);
  },
});

/* --------------------------------- AUTH --------------------------------- */

// POST /api/auth/signup
router.post("/signup", upload.single("profilePic"), async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, birthday, referral } = req.body;

    let interests = [];
    if (Array.isArray(req.body.interests)) interests = req.body.interests;
    else if (typeof req.body.interests === "string")
      interests = req.body.interests.split(",").map((s) => s.trim()).filter(Boolean);

    if (!username || !email || !password || !firstName || !lastName || !birthday) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!req.file) return res.status(400).json({ error: "Profile image is required" });

    const usernameLower = String(username).trim().toLowerCase();
    const emailLower = String(email).trim().toLowerCase();

    const existing = await User.findOne({ $or: [{ email: emailLower }, { username: usernameLower }] });
    if (existing) return res.status(409).json({ error: "User already exists" });

    const imagePath = saveBufferToUploads(req.file.buffer, req.file.originalname);
    const birthDate = new Date(birthday);
    if (isNaN(birthDate.getTime())) return res.status(400).json({ error: "Invalid birthday format" });

    const user = await User.create({
      username: usernameLower,
      email: emailLower,
      password, // model hook hashes
      firstName,
      lastName,
      birthday: birthDate,
      referral: referral || "",
      interests,
      profilePic: imagePath,
    });

    const token = signJwt({ id: user._id, username: user.username });

    res
      .cookie("token", token, cookieOpts())
      .status(201)
      .json({
        token, // also return in body so SPA can set Authorization
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          birthday: user.birthday,
          profilePic: user.profilePic,
          profileImageUrl: toPublicUrl(req, user.profilePic),
          referral: user.referral || "",
          interests: user.interests || [],
        },
      });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: "Missing credentials" });

    const identLower = String(identifier).trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: identLower }, { username: identLower }],
    }).select("+password");
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signJwt({ id: user._id, username: user.username });

    res
      .cookie("token", token, cookieOpts())
      .json({
        token, // also return for SPA
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          birthday: user.birthday,
          profilePic: user.profilePic,
          profileImageUrl: toPublicUrl(req, user.profilePic),
          referral: user.referral || "",
          interests: user.interests || [],
        },
      });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * GET /api/auth/token-bridge
 * Returns a verified JWT for the SPA by reading the httpOnly cookie.
 * Accepts any cookie that validates as a JWT (handles legacy cookie names).
 */
router.get("/token-bridge", (req, res) => {
  try {
    const cookies = req.cookies || {};
    const secrets = [
      process.env.JWT_SECRET,
      process.env.JWT_KEY,
      process.env.TOKEN_SECRET,
    ].filter(Boolean);

    // Gather candidate values: common names + anything that looks like a JWT
    const candidates = [];
    ["token", "jwt", "authToken", "access_token"].forEach((n) => { if (cookies[n]) candidates.push(cookies[n]); });
    for (const [name, val] of Object.entries(cookies)) {
      if (typeof val === "string" && val.split(".").length === 3 && !candidates.includes(val)) {
        candidates.push(val);
      }
    }

    let decoded = null;
    let token = null;
    outer: for (const cand of candidates) {
      for (const sec of secrets) {
        try { decoded = jwt.verify(cand, sec); token = cand; break outer; } catch {}
      }
      // also try default secret as last resort
      try { decoded = jwt.verify(cand, JWT_SECRET); token = cand; break; } catch {}
    }

    if (!decoded || !token) return res.status(401).send("No valid auth cookie");

    return res.json({
      token,
      user: {
        id: String(decoded?.id || decoded?._id || decoded?.userId || ""),
        username: decoded?.username || "",
      },
    });
  } catch (e) {
    console.error("token-bridge error", e?.message || e);
    return res.status(500).send("Failed");
  }
});

// GET /api/auth/me
router.get("/me", verifyToken, async (req, res) => {
  try {
    const uid = req.userId;
    const me = await User.findById(uid).select("-password");
    if (!me) return res.status(401).json({ error: "Not authenticated" });
    res.json({
      user: {
        id: me._id,
        username: me.username,
        email: me.email,
        firstName: me.firstName,
        lastName: me.lastName,
        birthday: me.birthday,
        profilePic: me.profilePic,
        profileImageUrl: toPublicUrl(req, me.profilePic),
        referral: me.referral || "",
        interests: me.interests || [],
      },
    });
  } catch (err) {
    if (err?.name === "JsonWebTokenError" || err?.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    console.error("Me error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", cookieOpts()); // match attrs so it actually clears
  res.json({ ok: true });
});

module.exports = router;
