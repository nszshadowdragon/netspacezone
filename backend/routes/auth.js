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
function signJwt(payload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" }); }

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
function getTokenFromReq(req) {
  const hdr = req.headers?.authorization || "";
  if (/^Bearer\s+/i.test(hdr)) return hdr.replace(/^Bearer\s+/i, "").trim();
  const c = req.cookies || {};
  return c.token || c.jwt || "";
}

/* ---------- avatar -> public URL (same policy as users.js) ---------- */
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
  if (!IS_PROD) {
    return { ...BASE_COOKIE, sameSite: "lax", secure: false };
  }
  return {
    ...BASE_COOKIE,
    sameSite: "none",   // allow app → api cross-site
    secure: true,
    domain: COOKIE_DOMAIN,
  };
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
      password, // model hook should hash
      firstName,
      lastName,
      birthday: birthDate,
      referral: referral || "",
      interests,
      profilePic: imagePath,
    });

    const token = signJwt({ id: user._id });

    res
      .cookie("token", token, cookieOpts())
      .status(201)
      .json({
        token, // ✅ return token so frontend can set Authorization as fallback
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

    const token = signJwt({ id: user._id });

    res
      .cookie("token", token, cookieOpts())
      .json({
        token, // ✅ return token so frontend can send Authorization header
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

// 🔹 GET /api/auth/token-bridge — surface JWT from httpOnly cookie for SPA Authorization
router.get("/token-bridge", (req, res) => {
  try {
    const raw =
      req.cookies?.token || req.cookies?.jwt || req.cookies?.authToken || "";
    if (!raw) return res.status(401).send("No auth cookie");

    const secrets = [
      process.env.JWT_SECRET,
      process.env.JWT_KEY,
      process.env.TOKEN_SECRET,
    ].filter(Boolean);

    let dec = null;
    for (const sec of secrets) {
      try { dec = jwt.verify(raw, sec); break; } catch (_) {}
    }
    if (!dec) return res.status(401).send("Invalid token");

    return res.json({
      token: raw,
      user: { id: String(dec?.id || dec?._id || dec?.userId || ""), username: dec?.username || "" },
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
  // clear cookie with the same attrs we set (domain/samesite/secure/path)
  res.clearCookie("token", cookieOpts());
  res.json({ ok: true });
});

/* check-username (kept) */
router.get("/check-username", async (req, res) => {
  try {
    const raw = String(req.query.username || "").trim();
    if (!raw || !isValidUsername(raw)) {
      return res.status(200).json({ available: false, reason: "invalid" });
    }
    const exists = await User.exists({ username: new RegExp("^" + escapeRegExp(raw) + "$", "i") });
    return res.json({ available: !exists });
  } catch (e) {
    console.error("check-username error:", e);
    return res.status(500).json({ available: false });
  }
});

/* PATCH /api/auth/profile (returns absolute profileImageUrl too) */
router.patch("/profile", verifyToken, upload.single("profilePic"), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const payload = req.body || {};

    if (payload.username !== undefined) {
      const desired = String(payload.username).trim();
      if (!isValidUsername(desired)) return res.status(400).json({ error: "Invalid username format" });
      const desiredLower = desired.toLowerCase();
      const same = desiredLower === String(user.username || "").toLowerCase();
      if (!same) {
        const taken = await User.exists({ username: new RegExp("^" + escapeRegExp(desired) + "$", "i") });
        if (taken) return res.status(409).json({ error: "Username already taken" });
        user.username = desiredLower;
      }
    }

    if (payload.email !== undefined) {
      const newEmail = String(payload.email).trim();
      if (!isValidEmail(newEmail)) return res.status(400).json({ error: "Invalid email address" });
      const newLower = newEmail.toLowerCase();
      const same = newLower === String(user.email || "").toLowerCase();
      if (!same) {
        const exists = await User.exists({ email: newLower });
        if (exists) return res.status(409).json({ error: "Email already in use" });
        user.email = newLower;
      }
    }

    if (payload.firstName !== undefined) user.firstName = String(payload.firstName).trim();
    if (payload.lastName !== undefined) user.lastName = String(payload.lastName).trim();
    if (payload.referral !== undefined) user.referral = String(payload.referral).trim();

    if (payload.birthday !== undefined) {
      const d = new Date(payload.birthday);
      if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid birthday format" });
      user.birthday = d;
    }

    if (payload.interests !== undefined) {
      let interests = [];
      if (Array.isArray(payload.interests)) interests = payload.interests;
      else if (typeof payload.interests === "string")
        interests = payload.interests.split(",").map((s) => s.trim()).filter(Boolean);
      user.interests = interests;
    }

    if (req.file) {
      const imagePath = saveBufferToUploads(req.file.buffer, req.file.originalname);
      user.profilePic = imagePath;
    }

    await user.save();

    res.json({
      ok: true,
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
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

module.exports = router;
