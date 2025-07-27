// controllers/signupController.js
const User               = require('../models/User');
const jwt                = require('jsonwebtoken');
const bcrypt             = require('bcrypt');
const { validationResult } = require('express-validator');

// POST /api/signup
exports.signup = async (req, res) => {
  /* 1️⃣ short-circuit if basic validation failed */
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  /* 2️⃣ pull the required fields */
  const {
    email,
    username,
    password,
    fullName,
    birthday,   // ISO string coming from the wizard
  } = req.body;

  try {
    /* 3️⃣ ensure e-mail OR username is not already taken */
    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) {
      return res
        .status(400)
        .json({ message: 'Email or username already exists' });
    }

    /* 4️⃣ hash pwd & create the user document */
    const hashedPwd = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      username,
      fullName,
      birthday: new Date(birthday),
      password: hashedPwd,
    });

    await newUser.save();

    // Optionally send a verification e-mail here…

    res.status(201).json({ message: 'User created successfully!' });
  } catch (err) {
    console.error('Signup failed:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
