const express = require("express");
const router = express.Router();

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const User = require("../models/User");
const { verifyToken } = require("../middleware/authMiddleware");

/* ---------- Multer: accept an image field named `profilePic` ---------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

/* ---------- Helpers ---------- */
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

function saveDataUrlToUploads(dataUrl, fallbackName = "image.png") {
  const m = /^data:(.+?);base64,(.+)$/i.exec(dataUrl || "");
  if (!m) throw new Error("Invalid image data URL");
  const mime = m[1];
  if (!/^image\//i.test(mime)) throw new Error("Only image data URLs are allowed");
  const buf = Buffer.from(m[2], "base64");
  const ext = mime.split("/")[1] || "png";
  return saveBufferToUploads(buf, `profile.${ext}`);
}

function signJwt(payload) {
  const secret = process.env.JWT_SECRET || "dev-secret";
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

/* ---------- Routes ---------- */

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

    // Accept either multipart file (preferred) or data URL string
    let imagePath;
    if (req.file) {
      imagePath = saveBufferToUploads(req.file.buffer, req.file.originalname);
    } else if (typeof req.body.profilePic === "string" && req.body.profilePic.startsWith("data:image")) {
      imagePath = saveDataUrlToUploads(req.body.profilePic);
    } else {
      return res.status(400).json({ error: "Profile image is required" });
    }

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
    });
    if (existing) return res.status(409).json({ error: "User already exists" });

    const birthDate = new Date(birthday);
    if (isNaN(birthDate.getTime())) {
      return res.status(400).json({ error: "Invalid birthday format" });
    }

    // Model hook hashes the password
    const user = await User.create({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      birthday: birthDate,
      referral: (referral || "").trim(),
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
        },
      });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: err.message || "Signup failed" });
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

module.exports = router;
