// backend/routes/auth.js
const express = require("express");
const router = express.Router();

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const User = require("../models/User");
const { verifyToken } = require("../middleware/authMiddleware");

// ---------- Multer (require an image named `profilePic`) ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // allow up to 10MB now
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

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
function signJwt(payload) {
  const secret = process.env.JWT_SECRET || "dev-secret";
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

// POST /api/auth/signup
router.post("/signup", upload.single("profilePic"), async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, birthday, referral } = req.body;

    // interests can be "a,b,c" or an array
    let interests = [];
    if (Array.isArray(req.body.interests)) {
      interests = req.body.interests;
    } else if (typeof req.body.interests === "string") {
      interests = req.body.interests.split(",").map(s => s.trim()).filter(Boolean);
    }

    if (!username || !email || !password || !firstName || !lastName || !birthday) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Profile image is required" });
    }

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
    });
    if (existing) return res.status(409).json({ error: "User already exists" });

    const imagePath = saveBufferToUploads(req.file.buffer, req.file.originalname);

    const birthDate = new Date(birthday);
    if (isNaN(birthDate.getTime())) {
      return res.status(400).json({ error: "Invalid birthday format" });
    }

    // Let the model pre('save') hook hash the password
    const user = await User.create({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      birthday: birthDate,
      referral: referral || "",
      interests,
      profilePic: imagePath, // <-- match schema
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

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { username: identifier.toLowerCase() }],
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
/* NEW: Update profile (names, birthday, referral, interests, avatar) */
/* ------------------------------------------------------------------ */
// PATCH /api/auth/profile
router.patch("/profile", verifyToken, upload.single("profilePic"), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const allowed = ["firstName", "lastName", "referral"];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        user[k] = String(req.body[k]).trim();
      }
    }

    if (req.body.birthday !== undefined) {
      const d = new Date(req.body.birthday);
      if (!isNaN(d.getTime())) user.birthday = d;
      else return res.status(400).json({ error: "Invalid birthday format" });
    }

    // interests can be "a,b,c" or array
    if (req.body.interests !== undefined) {
      let interests = [];
      if (Array.isArray(req.body.interests)) interests = req.body.interests;
      else if (typeof req.body.interests === "string")
        interests = req.body.interests.split(",").map(s => s.trim()).filter(Boolean);
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
/* NEW: Change password (secure, verified)*/
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
