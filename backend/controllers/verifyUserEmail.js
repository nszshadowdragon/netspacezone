// controllers/verifyUserEmail.js

const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');

// ─── SEND VERIFICATION EMAIL ────────────────────────────────────────────────
/**
 * Sends a verification email containing a link that hits your backend verify route.
 * @param {string} userEmail  The email address to send to
 * @param {ObjectId} userId   The MongoDB _id of the user
 */
exports.sendVerificationEmail = async (userEmail, userId) => {
  // Create a JWT that expires in 1 hour
  const token = jwt.sign(
    { userId },
    process.env.JWT_SECRET_KEY,
    { expiresIn: '1h' }
  );

  // POINT TO YOUR BACKEND VERIFY ENDPOINT:
  const verificationUrl = `http://localhost:5000/api/auth/verify-user-email/${token}`;

  // Configure your transporter (using Gmail in this example)
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,       // e.g. "gmail"
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Build the email
  const mailOptions = {
    from: `"NetSpace Zone" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: 'Verify your email',
    html: `
      <h2>Welcome to NetSpace Zone!</h2>
      <p>Click <a href="${verificationUrl}">here</a> to verify your email address.</p>
      <p>This link will expire in 1 hour.</p>
    `,
  };

  // Send it
  await transporter.sendMail(mailOptions);
};

// ─── VERIFY EMAIL ROUTE HANDLER ─────────────────────────────────────────────
/**
 * GET /api/auth/verify-user-email/:token
 * Verifies the user’s email by decoding the token and marking them verified.
 */
exports.verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    // Decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // Look up the user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token.' });
    }

    // Mark verified
    user.isVerified = true;
    await user.save();

    // Success
    return res.status(200).json({ message: 'Email verified successfully!' });
  } catch (err) {
    console.error('Email verification error:', err);
    return res.status(500).json({ message: 'Server error during email verification.' });
  }
};
