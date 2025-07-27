// backend/routes/chatRoutes.js

const express  = require('express');
const router   = express.Router();
const Message  = require('../models/Message');
const User     = require('../models/User');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

/**
 * GET /api/chat/
 * Return all “chat rooms” for the current user:
 *  • For each friend, include id, name, online, lastMessage, time.
 *  • Friends with messages come first (newest → oldest),
 *    then friends with no messages A→Z.
 */
router.get('/', async (req, res) => {
  try {
    // 1) load current user + their friends
    const me = await User.findById(req.user.id)
      .populate('friends', 'username avatar online')
      .lean();
    if (!me) return res.status(404).json({ error: 'User not found' });

    const friends = me.friends || [];

    // 2) for each friend, fetch their latest message with me
    const withMsgs = [];
    const noMsgs   = [];

    await Promise.all(friends.map(async (fr) => {
      // assuming you use `${userId}_${friendId}` or similar as your chatId
      // adjust the query if your chatId scheme differs
      const chatIdA = `${req.user.id}_${fr._id}`;
      const chatIdB = `${fr._id}_${req.user.id}`;

      const last = await Message.findOne({
        chatId: { $in: [chatIdA, chatIdB] }
      })
      .sort({ timestamp: -1 })
      .lean();

      if (last) {
        withMsgs.push({
          id:         fr._id,
          name:       fr.username,
          online:     fr.online,
          lastMessage: last.text || '📷 GIF',
          time:       last.timestamp,
        });
      } else {
        noMsgs.push({
          id:         fr._id,
          name:       fr.username,
          online:     fr.online,
          lastMessage: null,
          time:       null,
        });
      }
    }));

    // 3) sort lists
    withMsgs.sort((a, b) => new Date(b.time) - new Date(a.time));
    noMsgs.sort((a, b) => a.name.localeCompare(b.name));

    // 4) return combined
    res.json({ chats: [...withMsgs, ...noMsgs] });
  } catch (err) {
    console.error('Error in GET /api/chat:', err);
    res.status(500).json({ error: 'Failed to load chats' });
  }
});

/**
 * GET /api/chat/:chatId/messages
 * POST /api/chat/:chatId/messages
 *   – unchanged from before
 */

router.get('/:chatId/messages', /* … */);
router.post('/:chatId/messages', /* … */);

module.exports = router;
