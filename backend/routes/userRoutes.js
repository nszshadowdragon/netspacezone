const express = require('express');
const router = express.Router();
const User = require('../models/User');
const requireAuth = require('../middleware/requireAuth');

// Save or update user's theme
router.post('/api/user/theme', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { theme } = req.body;

    if (!theme) {
      return res.status(400).json({ message: 'Theme value is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.theme = theme;
    await user.save();

    res.json({ success: true, theme });
  } catch (err) {
    console.error('Theme update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
