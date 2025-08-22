const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// Helper to create JWT and cookie
function createToken(res, userId) {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  const isProd = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",  // ✅ allow cross-site cookies in prod
    secure: isProd,                     // ✅ only send cookie over https in prod
    maxAge: 1000 * 60 * 60 * 24 * 7,    // 7 days
  });

  return token;
}

// Signup
router.post("/signup", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      birthday,
      profilePic,
      referral,
      interests,
    } = req.body;

    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      return res.status(400).json({ error: "User already exists" });
    }

    const user = new User({
      username,
      email,
      password,
      firstName,
      lastName,
      birthday,
      profilePic,
      referral,
      interests,
    });

    await user.save();
    createToken(res, user._id);

    // Exclude password when sending response
    const userObj = user.toObject();
    delete userObj.password;

    res.status(201).json({
      message: "Signup successful",
      user: userObj,
    });
  } catch (err) {
    res.status(400).json({ error: "Signup failed", details: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    createToken(res, user._id);

    const userObj = user.toObject();
    delete userObj.password;

    res.json({
      message: "Login successful",
      user: userObj,
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ message: "Logged out" });
});

// Get current user
router.get("/me", async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: "Invalid/expired token" });
  }
});

module.exports = router;
