const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(protect);

// --- Notification helper: Now adds actor info! ---
async function pushNotification(userId, message, type = 'system', link = '', fromId = null) {
  const user = await User.findById(userId);
  let actor = null;
  if (fromId) {
    actor = await User.findById(fromId, 'username profileImage');
  }
  if (user) {
    user.notifications.push({
      type,
      message,
      link,
      fromId,
      read: false,
      createdAt: new Date(),
      actor: actor ? {
        _id: actor._id,
        username: actor.username,
        profileImage: actor.profileImage
      } : undefined
    });
    await user.save();
  }
}

// --- FRIEND/REQUEST GETTERS (unchanged) ---

router.get('/friends', async (req, res) => { /* unchanged */ });
router.get('/friendRequests', async (req, res) => { /* unchanged */ });

// --- FRIEND REQUEST SYSTEM ---
// Send friend request (notify only recipient)
router.post('/friend/request/:userId', async (req, res) => {
  const myId = req.user._id;
  const targetId = req.params.userId;
  if (myId.toString() === targetId) return res.status(400).json({ error: "Can't friend yourself." });
  try {
    const me = await User.findById(myId);
    const them = await User.findById(targetId);
    if (!me || !them) return res.status(404).json({ error: "User not found." });

    const alreadyRequested = them.friendRequests.map(id => id.toString()).includes(myId.toString());
    const alreadyFriends = them.friends.map(id => id.toString()).includes(myId.toString());

    if (!alreadyRequested && !alreadyFriends) {
      them.friendRequests.push(myId);
      await them.save();
      await pushNotification(
        targetId,
        `${me.username} sent you a friend request.`,
        'friend-request',
        `/profile/${me.username}`,
        myId
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Accept friend request (notify only sender)
router.post('/friend/accept/:userId', async (req, res) => {
  const myId = req.user._id;
  const requesterId = req.params.userId;
  try {
    const me = await User.findById(myId);
    const requester = await User.findById(requesterId);
    if (!me || !requester) return res.status(404).json({ error: "User not found." });

    const pending = me.friendRequests.map(id => id.toString()).includes(requesterId);
    if (!pending) {
      return res.status(400).json({ error: "No pending friend request from this user." });
    }

    me.friendRequests = me.friendRequests.filter(id => id.toString() !== requesterId);

    if (!me.friends.map(id => id.toString()).includes(requesterId)) me.friends.push(requesterId);
    if (!requester.friends.map(id => id.toString()).includes(myId)) requester.friends.push(myId);

    await me.save();
    await requester.save();

    await pushNotification(
      requesterId,
      `${me.username} accepted your friend request!`,
      'friend-accept',
      `/profile/${me.username}`,
      myId
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Decline friend request (mutual remove from both sides)
router.post('/friend/decline/:userId', async (req, res) => {
  const myId = req.user._id;
  const requesterId = req.params.userId;
  try {
    const me = await User.findById(myId);
    const requester = await User.findById(requesterId);
    if (!me || !requester) return res.status(404).json({ error: "User not found." });

    me.friendRequests = me.friendRequests.filter(id => id.toString() !== requesterId);
    requester.friendRequests = requester.friendRequests.filter(id => id.toString() !== myId.toString());

    await me.save();
    await requester.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove friend (mutual)
router.post('/friend/remove/:userId', async (req, res) => {
  const myId = req.user._id;
  const friendId = req.params.userId;
  try {
    const me = await User.findById(myId);
    const them = await User.findById(friendId);
    if (!me || !them) return res.status(404).json({ error: "User not found." });

    me.friends = me.friends.filter(id => id.toString() !== friendId);
    them.friends = them.friends.filter(id => id.toString() !== myId.toString());

    me.topFriends = (me.topFriends || []).filter(id => id.toString() !== friendId);
    them.topFriends = (them.topFriends || []).filter(id => id.toString() !== myId.toString());

    await me.save();
    await them.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- FOLLOW SYSTEM ---
router.post('/follow/:userId', async (req, res) => {
  const myId = req.user._id;
  const targetId = req.params.userId;
  if (myId.toString() === targetId) return res.status(400).json({ error: "Can't follow yourself." });
  try {
    const me = await User.findById(myId);
    const them = await User.findById(targetId);
    if (!me || !them) return res.status(404).json({ error: "User not found." });

    if (!me.following.map(id=>id.toString()).includes(targetId)) me.following.push(targetId);
    if (!them.followers.map(id=>id.toString()).includes(myId.toString())) them.followers.push(myId);

    await me.save();
    await them.save();

    await pushNotification(targetId, `${me.username} started following you.`, 'follow', `/profile/${me.username}`, myId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/unfollow/:userId', async (req, res) => {
  const myId = req.user._id;
  const targetId = req.params.userId;
  try {
    const me = await User.findById(myId);
    const them = await User.findById(targetId);
    if (!me || !them) return res.status(404).json({ error: "User not found." });

    me.following = me.following.filter(id => id.toString() !== targetId);
    them.followers = them.followers.filter(id => id.toString() !== myId.toString());

    await me.save();
    await them.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TOP FRIENDS PATCH ---
router.patch('/top-friends', async (req, res) => {
  try {
    const { topFriends } = req.body;
    if (!Array.isArray(topFriends) || topFriends.length > 8)
      return res.status(400).json({ error: 'Top friends must be an array of up to 8 user IDs.' });

    const user = await User.findById(req.user._id);
    const validFriends = user.friends.map(id => id.toString());
    const cleanedTopFriends = topFriends.filter(id => validFriends.includes(id));
    user.topFriends = cleanedTopFriends;
    await user.save();
    res.json({ success: true, topFriends: user.topFriends });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- FOLLOWERS/FOLLOWING API for popup/profile ---
router.get('/followers/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('followers', 'username profileImage fullName');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user.followers || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/following/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('following', 'username profileImage fullName');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user.following || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
