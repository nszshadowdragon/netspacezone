const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateSignup } = require('../middlewares/validation');

// Signup route
router.post('/signup', validateSignup, authController.signup);

// Email verification route (with a different name now)
router.get('/verify-user-email/:token', authController.verifyUserEmail);

module.exports = router;
