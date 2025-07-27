// controllers/authController.js
const User   = require('../models/User');
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const { validationResult } = require('express-validator');

/* ─────────── POST /api/signup ─────────── */
exports.signup = async (req, res) => {
  // ... unchanged ...
};

/* ─────────── POST /api/login ─────────── */
exports.login = async (req, res) => {
  // ... unchanged ...
};

/* ───────── GET /api/me ───────── */
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('username email fullName birthday bio avatarUrl referralCode isVerified');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ───────── PUT /api/me ───────── */
exports.updateProfile = async (req, res) => {
  try {
    // Only allow specific fields to be updated
    const updates = (({ fullName, birthday, bio, avatarUrl, referralCode }) => 
      ({ fullName, birthday, bio, avatarUrl, referralCode }))(req.body);

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('username email fullName birthday bio avatarUrl referralCode isVerified');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    // If validation failed (e.g. wrong birthday format), send 400
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

/* ─────── placeholder for email verification ─────── */
exports.verifyUserEmail = async (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
};
