// backend/routes/auth.js
const express = require("express");
const router = express.Router();

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");               // <-- use bcrypt (installed in your repo)
const jwt = require("jsonwebtoken");
const multer = require("multer");

const User = require("../models/User");         // ../models/User.js
const { verifyToken } = require("../middleware/authMiddleware");

// ---------- Multer (require an image named `profilePic`) ----------
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

// ---------- Helpers ----------
function saveBufferToUploads(buffer, originalName) {
  const uploadDir = path.join(__dirname, "..", "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  // simple unique filename
  const ts = Date.now();
  const sanitized = originalName.replace(/[^\w.\-]+/g, "_");
  const filename = `${ts}_${sanitized}`;
  const fullPath = path.join(uploadDir, filename);
  fs.writeFileSync(fullPath, buffer);
  // return relative path you store on the user
  return `/uploads/${filename}`;
}

function signJwt(payload) {
  const secret = process.env.JWT_SECRET || "dev-secret";
  // 7 days, adjust if you like
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

// ---------- Routes ----------

// POST /api/auth/signup
// Requires: username, email, password, and multipart `profilePic`
router.post(
  "/signup",
  upload.single("profilePic"),
  async (req, res) => {
    try {
      const { username, email, password, birthday, firstName, lastName, interests } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Profile image is required" });
      }

      const existing = await User.findOne({
        $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
      });
      if (existing) {
        return res.status(409).json({ error: "User already exists" });
      }

      const hashed = await bcrypt.hash(password, 10);

      // Save image to /backend/uploads
      const imagePath = saveBufferToUploads(req.file.buffer, req.file.originalname);

      const user = await User.create({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password: hashed,
        birthday: birthday || null,
        firstName: firstName || "",
        lastName: lastName || "",
        interests: interests || [],
        profileImage: imagePath,  // field name can be whatever your model uses
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
            profileImage: user.profileImage,
          },
        });
    } catch (err) {
      console.error("Signup error:", err);
      // Multer validation error shows up as 400
      if (err && err.message && /image files/.test(err.message)) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({ error: "Signup failed" });
    }
  }
);

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { username: identifier.toLowerCase() }],
    });

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
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
          profileImage: user.profileImage,
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
