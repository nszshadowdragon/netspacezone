require('dotenv').config();
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');

// ─── Auth middleware ───────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'Missing Authorization header' });
  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Malformed Authorization header' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, username, iat, exp }
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// ─── SIGN UP ───────────────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { email, username, password, firstName, lastName, birthday } = req.body;
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(400).json({ message: 'Email or username already in use.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const u = await User.create({
      email, username, password: hash, firstName, lastName, birthday
    });

    const token = jwt.sign(
      { id: u._id, username: u.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: { id: u._id, username: u.username } });
  } catch (err) {
    console.error('POST /signup error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const filter = email ? { email } : { username };
    const u = await User.findOne(filter);
    if (!u) return res.status(400).json({ message: 'Invalid credentials.' });
    if (!u.isActive) return res.status(403).json({ message: 'Account is suspended.' });

    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials.' });

    const token = jwt.sign(
      { id: u._id, username: u.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: u._id, username: u.username } });
  } catch (err) {
    console.error('POST /login error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── CHECK USERNAME AVAILABILITY ──────────────────────────────────────────
router.get('/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: 'Username required.' });
    const exists = await User.exists({ username });
    res.json({ available: !exists });
  } catch (err) {
    console.error('GET /check-username error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── GET CURRENT USER ─────────────────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const u = await User.findById(req.user.id).lean();
    if (!u) return res.status(404).json({ message: 'User not found.' });
    delete u.password;
    res.json(u);
  } catch (err) {
    console.error('GET /me error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── UPDATE CURRENT USER ───────────────────────────────────────────────────
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const updates = {
      username:  req.body.username,
      email:     req.body.email,
      firstName: req.body.firstName,
      lastName:  req.body.lastName,
      bio:       req.body.bio,
      theme:     req.body.theme,
    };
    const u = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    ).lean();
    if (!u) return res.status(404).json({ message: 'User not found.' });
    delete u.password;
    res.json(u);
  } catch (err) {
    console.error('PUT /me error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── DEACTIVATE / ACTIVATE / DELETE ────────────────────────────────────────
router.post('/me/deactivate', authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { isActive: false });
    res.json({ message: 'Account has been suspended.' });
  } catch (err) {
    console.error('POST /me/deactivate error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

router.post('/me/activate', authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { isActive: true });
    res.json({ message: 'Account has been reactivated.' });
  } catch (err) {
    console.error('POST /me/activate error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

router.delete('/me', authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);
    res.json({ message: 'Account permanently deleted.' });
  } catch (err) {
    console.error('DELETE /me error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── PUBLIC USER SEARCH ───────────────────────────────────────────────────
router.get('/users/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { email:    { $regex: q, $options: 'i' } },
      ]
    })
      .select('username email firstName lastName profilePic theme')
      .lean();
    res.json(users);
  } catch (err) {
    console.error('GET /users/search error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── PUBLIC USER FETCH ────────────────────────────────────────────────────
router.get('/users/:username', async (req, res) => {
  try {
    const u = await User.findOne({ username: req.params.username })
      .populate({
        path: 'friends',
        select: 'username profilePic avatarUrl verified online'
      })
      .lean();
    if (!u) return res.status(404).json({ message: 'User not found.' });
    delete u.password;
    res.json(u);
  } catch (err) {
    console.error('GET /users/:username error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
