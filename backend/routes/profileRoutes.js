const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Get current user profile (requires auth)
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('friends', 'username profileImage fullName')
      .populate('topFriends', 'username profileImage fullName')
      .populate('friendRequests', 'username profileImage fullName'); // POPULATE friendRequests

    if (!user) return res.status(404).json({ error: 'User not found' });

    await user.populate('friends', 'username profileImage fullName');
    await user.populate('friendRequests', 'username profileImage fullName'); // Ensure populated

    res.json({
      ...user.toObject(),
      isFriend: false,
      isFollowing: false
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get profile by username (returns a single user object)
router.get('/:username', protect, async (req, res) => {
  try {
    const profileUser = await User.findOne({ username: req.params.username })
      .select('-password')
      .populate('friends', 'username profileImage fullName')
      .populate('topFriends', 'username profileImage fullName')
      .populate('friendRequests', 'username profileImage fullName'); // POPULATE friendRequests

    if (!profileUser) return res.status(404).json({ error: 'User not found' });

    await profileUser.populate('friends', 'username profileImage fullName');
    await profileUser.populate('friendRequests', 'username profileImage fullName'); // Ensure populated

    const myId = req.user._id.toString();

    const isFriend = profileUser.friends && profileUser.friends.some(f => f._id.toString() === myId);
    const isFollowing = profileUser.followers && profileUser.followers.map(id => id.toString()).includes(myId);

    res.json({
      ...profileUser.toObject(),
      isFriend,
      isFollowing
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
