const express = require('express');
const router = express.Router();

// Mock database
const users = [];

router.post('/create', (req, res) => {
  const { username, email, password, displayName, bio, avatar, captcha } = req.body;

  // ✅ Log the fake CAPTCHA for visibility
  console.log('Received CAPTCHA:', captcha);

  if (!username || !email || !password || !displayName) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  const existing = users.find((user) => user.username === username || user.email === 
email);
  if (existing) {
    return res.status(409).json({ message: 'Username or email already exists.' });
  }

  const newUser = {
    id: users.length + 1,
    username,
    email,
    password, // ⚠️ Store hashed in real app
    displayName,
    bio: bio || '',
    avatar: avatar || '',
    createdAt: new Date(),
    role: 'user',
  };

  users.push(newUser);
  console.log('✅ Account created:', newUser);

  return res.status(201).json({ message: 'Account created successfully.', user: newUser });
});

module.exports = router;
