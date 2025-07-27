const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware'); // <--- Correct import

const router = express.Router();

// Debug log: check token in headers
router.get('/users', (req, res, next) => {
  const auth = req.headers['authorization'];
  console.log('DEBUG - Authorization header:', auth);
  if (!auth) {
    console.log('DEBUG - No token received');
  }
  // Continue to real protected handler
  next();
}, protect, async (req, res) => {
  const q = req.query.q ? req.query.q.trim() : '';
  if (!q) return res.json([]);

  // Search by username, fullName, or email (case-insensitive)
  const users = await User.find({
    $or: [
      { username: { $regex: q, $options: 'i' } },
      { fullName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } }
    ]
  })
    .select('username fullName profileImage bio')
    .limit(10);

  // LOG ADDED BELOW:
  console.log('SEARCH:', q, '| Users found:', users.length, '| Usernames:', users.map(u => u.username));

  res.json(users);
});

module.exports = router;
