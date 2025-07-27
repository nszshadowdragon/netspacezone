const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(protect);

// Get notifications (most recent first)
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json((user.notifications || []).slice().reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark notification as read
router.post('/read/:id', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const notif = user.notifications.id(req.params.id);
    if (notif) notif.read = true;
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark all as read
router.post('/read-all', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.notifications.forEach(n => n.read = true);
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Push a notification (called internally by backend, not chat messages)
router.post('/', async (req, res) => {
  try {
    const { userId, message, type = 'system', link = '', fromId = null } = req.body;
    if (!userId || !message) return res.status(400).json({ error: 'userId and message required.' });

    if (userId === fromId) return res.json({ success: false, skip: true });
    if (type === 'message' || type === 'dm') return res.json({ success: false, skip: true });
    if (type === 'friend_request' && userId === fromId) return res.json({ success: false, skip: true });
    if (type === 'follow' && userId === fromId) return res.json({ success: false, skip: true });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // --- Add actor (profile image + username) if fromId is present ---
    let actor = null;
    if (fromId) {
      actor = await User.findById(fromId, 'username profileImage');
    }

    user.notifications.push({
      type,
      message,
      link,
      fromId,
      createdAt: new Date(),
      read: false,
      actor: actor ? {
        _id: actor._id,
        username: actor.username,
        profileImage: actor.profileImage
      } : undefined
    });

    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete (clear) a single notification by ID
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.notifications = user.notifications.filter(n => n._id.toString() !== req.params.id);
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
