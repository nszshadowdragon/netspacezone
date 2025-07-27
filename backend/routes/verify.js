// backend/routes/verify.js
const express = require('express');
const router  = express.Router();
const { sendVerificationEmail, verifyEmail } = require('../controllers/verifyUserEmail');
const User    = require('../models/User');

// POST /api/verify/send  → email the link
router.post('/send', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'User not found' });
  await sendVerificationEmail(email, user._id);
  res.json({ message: 'Verification email sent' });
});

// GET /api/verify/:token  → click-through verification
router.get('/:token', verifyEmail);

module.exports = router;
