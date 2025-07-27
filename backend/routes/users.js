// backend/routes/users.js
const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { authenticateToken } = require('./auth');

// GET /api/users/search?q=foo
router.get('/search', authenticateToken, async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.status(400).json({ message: 'Query parameter `q` is required' });

  try {
    const regex = new RegExp(q, 'i');
    const results = await User.find({
      isActive: true,
      $or: [
        { username:  regex },
        { firstName: regex },
        { lastName:  regex },
      ]
    })
    .limit(10)
    .select('username firstName lastName profilePic');  // only send what you need

    res.json(results);
  } catch (err) {
    console.error('GET /api/users/search error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
