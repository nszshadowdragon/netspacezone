const express = require('express');
const router = express.Router();
const signupController = require('../controllers/signupController');
const { sendVerificationEmail } = require('../controllers/verifyUserEmail');

// Signup endpoint
router.post('/', signupController.signup);

// ✅ New endpoint: Send email verification
router.post('/verifyUserEmail', async (req, res) => {
  try {
    const { email, userId } = req.body;
    await sendVerificationEmail(email, userId);
    res.status(200).json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Failed to send verification email' });
  }
});

module.exports = router;
