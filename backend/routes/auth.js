// backend/routes/auth.js
const express = require("express");
const router = express.Router();

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");

// adjust if your model path is different:
const User = require("../models/User");

/* ---------- Multer: require an image named `profilePic` ---------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

/* ---------- Helpers ---------- */
function saveBufferToUploads(buffer, originalName) {
  const uploadDir = path.join(__dirname, "..", "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  const safeName = `${Date.now()}-${originalName.replace(/\s+/g, "_")}`;
  const filePath = path.join(uploadDir, safeName);
  fs.writeFileSync(filePath, buffer);
  // public URL served by server.js
  return `/uploads/${safeName}`;
}

function setAuthCookie(res, userId) {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
  res.cookie("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

/* ---------- CORS preflight for this route ---------- */
router.options("/signup", (req, res) => res.sendStatus(204));

/* ---------- POST /api/auth/signup ---------- */
router.post("/signup", upload.single("profilePic"), async (req, res) => {
  try {
    // enforce required image
    if (!req.file) {
      return res.status(400).json({ error: "Profile picture is required" });
    }

    const {
      username,
      email,
      password,
      firstName,
      lastName,
      birthday,
      referral,
      interests, // comma-separated list from the client
    } = req.body;

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "username, email and password are required" });
    }

    const exists =
      (await User.findOne({ username })) || (await User.findOne({ email }));
    if (exists) return res.status(409).json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const interestsArray = (interests || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const profileImageUrl = saveBufferToUploads(
      req.file.buffer,
      req.file.originalname
    );

    const user = await User.create({
      username,
      email,
      password: hashed,
      firstName,
      lastName,
      birthday,
      referralCode: referral || undefined,
      interests: interestsArray,
      profileImageUrl,
    });

    setAuthCookie(res, user._id);
    return res.status(201).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Signup failed" });
  }
});

/* ---------- (Keep your existing /login, /logout, /me routes) ---------- */
// Example stubs (if you already have working versions, keep those!)
router.post("/login", express.json(), async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user =
      (await User.findOne({ username: identifier })) ||
      (await User.findOne({ email: identifier }));
    if (!user) return res.status(400).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: "Invalid credentials" });

    setAuthCookie(res, user._id);
    res.json({
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (e) {
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select(
      "_id username email profileImageUrl"
    );
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    res.json({ user });
  } catch (e) {
    res.status(401).json({ error: "Not authenticated" });
  }
});

module.exports = router;
