// backend/routes/auth.js
const express = require("express");
const router = express.Router();

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const User = require("../models/User");
const { verifyToken } = require("../middleware/authMiddleware");

/* ---------------------------- helpers & utils ---------------------------- */
const escapeRegExp = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isValidEmail = (v = "") => /^\S+@\S+\.\S+$/.test(String(v).trim());
const isValidUsername = (v = "") => /^[a-zA-Z0-9._-]{3,20}$/.test(String(v).trim());

function signJwt(payload) {
  const secret = process.env.JWT_SECRET || "dev-secret";
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

function ensureUploadsDir() {
  const dir = path.join(__dirname, "..", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function saveBufferToUploads(buffer, originalName) {
  const uploadDir = ensureUploadsDir();
  const ts = Date.now();
  const sanitized = (originalName || "image").replace(/[^\w.\-]+/g, "_");
  const filename = `${ts}_${sanitized}`;
  const fullPath = path.join(uploadDir, filename);
  fs.writeFileSync(fullPath, buffer);
  return `/uploads/${filename}`;
}

/* ----------------------------- multer config ---------------------------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // up to 10MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

/* --------------------------------- AUTH --------------------------------- */

// POST /api/auth/signup
router.post("/signup", upload.single("profilePic"), async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, birthday, referral } = req.body;

    // interests can be "a,b,c" or an array
    let interests = [];
    if (Array.isArray(req.body.interests)) {
      interests = req.body.interests;
    } else if (typeof req.body.interests === "string") {
      interests = req.body.interests.split(",").map((s) => s.trim()).filter(Boolean);
    }

    if (!username || !email || !password || !firstName || !lastName || !birthday) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Profile image is required" });
    }

    const usernameLower = String(username).trim().toLowerCase();
    const emailLower = String(email).trim().toLowerCase();

    const existing = await User.findOne({
      $or: [{ email: emailLower }, { username: usernameLower }],
    });
    if (existing) return res.status(409).json({ error: "User already exists" });

    const imagePath = saveBufferToUploads(req.file.buffer, req.file.originalname);

    const birthDate = new Date(birthday);
    if (isNaN(birthDate.getTime())) {
      return res.status(400).json({ error: "Invalid birthday format" });
    }

    // Let the model pre('save') hook hash the password
    const user = await User.create({
      username: usernameLower, // store lower-case for consistency in this app
      email: emailLower,
      password,
      firstName,
      lastName,
      birthday: birthDate,
      referral: referral || "",
      interests,
      profilePic: imagePath,
    });

    const token = signJwt({ id: user._id });
    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(201)
      .json({
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          birthday: user.birthday,
          profilePic: user.profilePic,
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
    });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signJwt({ id: user._id });
    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          birthday: user.birthday,
          profilePic: user.profilePic,
          referral: user.referral || "",
          interests: user.interests || [],
        },
      });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// GET /api/auth/me
router.get("/me", verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId).select("-password");
    if (!me) return res.status(401).json({ error: "Not authenticated" });
    res.json({ user: me });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/*   CHECK USERNAME AVAILABILITY (case-insensitive exact match)       */
/*   GET /api/auth/check-username?username=<string> -> {available}    */
/* ------------------------------------------------------------------ */
router.get("/check-username", async (req, res) => {
  try {
    const raw = String(req.query.username || "").trim();
    if (!raw || !isValidUsername(raw)) {
      return res.status(200).json({ available: false, reason: "invalid" });
    }

    // Case-insensitive exact match on "username"
    const exists = await User.exists({
      username: new RegExp("^" + escapeRegExp(raw) + "$", "i"),
    });

    return res.json({ available: !exists });
  } catch (e) {
    console.error("check-username error:", e);
    return res.status(500).json({ available: false });
  }
});

/* ------------------------------------------------------------------ */
/* Update profile (names, birthday, referral, interests, avatar,      */
/*                and now ALSO username & email w/ validation)        */
/* ------------------------------------------------------------------ */
// PATCH /api/auth/profile
router.patch("/profile", verifyToken, upload.single("profilePic"), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const payload = req.body || {};

    // ---- Optional: username change
    if (payload.username !== undefined) {
      const desired = String(payload.username).trim();
      if (!isValidUsername(desired)) {
        return res.status(400).json({ error: "Invalid username format" });
      }
      const desiredLower = desired.toLowerCase();
      const same = desiredLower === String(user.username || "").toLowerCase();
      if (!same) {
        const taken = await User.exists({
          username: new RegExp("^" + escapeRegExp(desired) + "$", "i"),
        });
        if (taken) return res.status(409).json({ error: "Username already taken" });
        user.username = desiredLower; // stored lowercase in this app
      }
    }

    // ---- Optional: email change
    if (payload.email !== undefined) {
      const newEmail = String(payload.email).trim();
      if (!isValidEmail(newEmail)) {
        return res.status(400).json({ error: "Invalid email address" });
      }
      const newLower = newEmail.toLowerCase();
      const same = newLower === String(user.email || "").toLowerCase();
      if (!same) {
        const exists = await User.exists({ email: newLower });
        if (exists) return res.status(409).json({ error: "Email already in use" });
        user.email = newLower;
      }
    }

    // ---- Names / referral
    if (payload.firstName !== undefined) user.firstName = String(payload.firstName).trim();
    if (payload.lastName !== undefined) user.lastName = String(payload.lastName).trim();
    if (payload.referral !== undefined) user.referral = String(payload.referral).trim();

    // ---- Birthday (UI keeps read-only; still validate if present)
    if (payload.birthday !== undefined) {
      const d = new Date(payload.birthday);
      if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid birthday format" });
      user.birthday = d;
    }

    // ---- Interests
    if (payload.interests !== undefined) {
      let interests = [];
      if (Array.isArray(payload.interests)) interests = payload.interests;
      else if (typeof payload.interests === "string")
        interests = payload.interests.split(",").map((s) => s.trim()).filter(Boolean);
      user.interests = interests;
    }

    // ---- Profile image
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
        referral: user.referral || "",
        interests: user.interests || [],
      },
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

/* -------------------------------------- */
/* Change password (secure, verified)     */
/* -------------------------------------- */
// PATCH /api/auth/password
router.patch("/password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Missing currentPassword or newPassword" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const ok = await user.comparePassword(currentPassword);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

    user.password = newPassword; // pre('save') hook should hash this
    await user.save();

    res.json({ ok: true });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

module.exports = router;
