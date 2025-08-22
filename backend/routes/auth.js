const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const User = require("../models/User");

const router = express.Router();

// Multer config — store files in memory so we can convert to base64
const storage = multer.memoryStorage();
const upload = multer({ storage });

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ================== AUTH ROUTES ================== //

// ✅ Signup (with required profilePic)
router.post("/signup", upload.single("profilePic"), async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, birthday, referral, interests } = req.body;

    // Require profilePic
    if (!req.file) {
      return res.status(400).json({ error: "Profile picture is required" });
    }

    // Convert file buffer to base64
    const profilePicBase64 = req.file.buffer.toString("base64");

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      birthday,
      referral,
      interests: interests ? interests.split(",") : [],
      profilePic: profilePicBase64,
    });

    await newUser.save();

    res.status(201).json({ message: "Signup successful", user: newUser });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error during signup" });
  }
});

// ✅ Login
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Find user by username or email
    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    });

    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    // Generate JWT
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });

    res
      .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      })
      .json({ message: "Login successful", user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ✅ Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token").json({ message: "Logged out" });
});

// ✅ Auth check (who is logged in?)
router.get("/me", async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: "Not authenticated" });
  }
});

module.exports = router;
