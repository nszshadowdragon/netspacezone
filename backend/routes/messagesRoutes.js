const express = require('express');
const User = require('../models/User');
const Message = require('../models/Message');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(protect);

// --- CRUCIAL ENDPOINT MUST BE FIRST ---
// Get all users you've ever messaged or been messaged by (including last message date)
router.get('/chat-users', async (req, res) => {
  const myId = req.user._id;

  try {
    const sentToUsers = await Message.distinct('to', { from: myId });
    const receivedFromUsers = await Message.distinct('from', { to: myId });
    let userIds = Array.from(new Set([...sentToUsers, ...receivedFromUsers]))
      .filter(id => id.toString() !== myId.toString());

    const lastMessages = await Message.aggregate([
      {
        $match: {
          $or: [
            { from: myId, to: { $in: userIds } },
            { to: myId, from: { $in: userIds } }
          ]
        }
      },
      {
        $project: {
          withUser: {
            $cond: [
              { $eq: ["$from", myId] }, "$to", "$from"
            ]
          },
          createdAt: 1
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: "$withUser",
          lastMessageAt: { $first: "$createdAt" }
        }
      }
    ]);

    const lastMessageMap = {};
    lastMessages.forEach(item => {
      lastMessageMap[item._id.toString()] = item.lastMessageAt;
    });

    const users = await User.find({ _id: { $in: userIds } })
      .select('username profileImage fullName')
      .lean();

    users.forEach(u => {
      u.lastMessageAt = lastMessageMap[u._id.toString()] || null;
    });

    users.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
    });

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- NEW: Get all message requests for the logged-in user ---
router.get('/message-requests', async (req, res) => {
  const me = await User.findById(req.user._id).populate('messageRequests', 'username profileImage fullName');
  res.json(me.messageRequests || []);
});

// --- NEW: Accept a message request (move to main chat, remove from messageRequests) ---
router.post('/accept-message-request/:fromId', async (req, res) => {
  const me = await User.findById(req.user._id);
  me.messageRequests = (me.messageRequests || []).filter(uid => uid.toString() !== req.params.fromId);
  await me.save();
  res.json({ accepted: true });
});

// --- NEW: Decline a message request (remove from messageRequests) ---
router.post('/decline-message-request/:fromId', async (req, res) => {
  const me = await User.findById(req.user._id);
  me.messageRequests = (me.messageRequests || []).filter(uid => uid.toString() !== req.params.fromId);
  await me.save();
  // Optionally, delete all messages from this user to you here
  res.json({ declined: true });
});

// Get unread DM counts for each user (for badges)
router.get('/unread/counts', async (req, res) => {
  const myId = req.user._id;
  const unreadCounts = await Message.aggregate([
    { $match: { to: myId, isRead: false } },
    { $group: { _id: "$from", count: { $sum: 1 } } }
  ]);
  res.json(unreadCounts.map(({ _id, count }) => ({ userId: _id.toString(), count })));
});

// Get conversation history with another user (DMs, sorted oldest to newest)
router.get('/:userId', async (req, res) => {
  const myId = req.user._id;
  const otherId = req.params.userId;
  try {
    await Message.updateMany(
      { from: otherId, to: myId, isRead: false },
      { $set: { isRead: true } }
    );
    const messages = await Message.find({
      $or: [
        { from: myId, to: otherId },
        { from: otherId, to: myId }
      ]
    })
      .populate('from', 'username profileImage')
      .populate('to', 'username profileImage')
      .sort('createdAt');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send message to a user (now creates a message request instead of a friend request)
router.post('/:userId', async (req, res) => {
  const myId = req.user._id;
  const toId = req.params.userId;
  const { text } = req.body;
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Text required.' });

  try {
    const me = await User.findById(myId);
    const them = await User.findById(toId);

    const isFriend = me.friends.map(id => id.toString()).includes(toId.toString());
    const alreadyRequested = them.messageRequests?.map(id => id.toString()).includes(myId.toString());
    // --- Do NOT send friend request! Instead, create message request if not friends ---
    if (!isFriend && !alreadyRequested) {
      them.messageRequests = them.messageRequests || [];
      them.messageRequests.push(myId);
      await them.save();
    }

    const message = await Message.create({
      from: myId,
      to: toId,
      text,
      createdAt: new Date(),
      isRead: false,
      edited: false,
      reactions: []
    });
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit a message (only by sender)
router.patch('/:msgId/edit', async (req, res) => {
  const { text } = req.body;
  try {
    const msg = await Message.findById(req.params.msgId);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });
    if (msg.from.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Not your message." });

    msg.text = text;
    msg.edited = true;
    await msg.save();
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// React to a message (one reaction per user per message)
router.patch('/:msgId/react', async (req, res) => {
  const { emoji } = req.body;
  try {
    const msg = await Message.findById(req.params.msgId);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });

    msg.reactions = msg.reactions.filter(r => r.user.toString() !== req.user._id.toString());
    msg.reactions.push({ emoji, user: req.user._id });
    await msg.save();
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
