// backend/routes/friendRequests.js

const express = require('express');
const router  = express.Router();
const { authenticateToken } = require('./auth');
const User    = require('../models/User');
const FriendRequest = require('../models/FriendRequest');

// ─── Outgoing ────────────────────────────────────────────────────────────
// List my pending outgoing requests
router.get(
  '/friend-requests/outgoing',
  authenticateToken,
  async (req, res) => {
    try {
      const outgoing = await FriendRequest.find({
        from:   req.user.id,
        status: 'pending'
      })
      .populate('to', 'username profilePic')
      .lean();
      res.json(outgoing);
    } catch (err) {
      console.error('GET /friend-requests/outgoing error:', err);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// ─── Cancel outgoing ──────────────────────────────────────────────────────
router.delete(
  '/users/:username/friend-request',
  authenticateToken,
  async (req, res) => {
    try {
      const toUser = await User.findOne({ username: req.params.username });
      if (!toUser) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const fr = await FriendRequest.findOneAndDelete({
        from:   req.user.id,
        to:     toUser._id,
        status: 'pending'
      });

      if (!fr) {
        return res.status(404).json({ message: 'No pending request to cancel.' });
      }

      res.json({ message: 'Friend request cancelled.' });
    } catch (err) {
      console.error('DELETE /users/:username/friend-request error:', err);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// ─── Send new ─────────────────────────────────────────────────────────────
router.post(
  '/users/:username/friend-request',
  authenticateToken,
  async (req, res) => {
    try {
      const fromId = req.user.id;
      const toUser = await User.findOne({ username: req.params.username });
      if (!toUser) {
        return res.status(404).json({ message: 'User not found.' });
      }
      if (toUser._id.equals(fromId)) {
        return res.status(400).json({ message: 'Cannot friend yourself.' });
      }

      const already = await FriendRequest.findOne({
        from:   fromId,
        to:     toUser._id,
        status: 'pending'
      });
      if (already) {
        return res.status(400).json({ message: 'Request already pending.' });
      }

      await FriendRequest.create({ from: fromId, to: toUser._id });
      res.status(201).json({ message: 'Friend request sent.' });
    } catch (err) {
      console.error('POST /users/:username/friend-request error:', err);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// ─── Incoming (generic) ──────────────────────────────────────────────────
// For mounts at /api, this gives GET /api/friend-requests
router.get(
  '/friend-requests',
  authenticateToken,
  async (req, res) => {
    try {
      const pending = await FriendRequest.find({
        to:     req.user.id,
        status: 'pending'
      })
      .populate('from', 'username profilePic')
      .lean();
      res.json(pending);
    } catch (err) {
      console.error('GET /friend-requests error:', err);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// ─── Incoming (alias) ────────────────────────────────────────────────────
// For mounts at /api/friend-requests, this gives GET /api/friend-requests/incoming
router.get(
  '/incoming',
  authenticateToken,
  async (req, res) => {
    try {
      const incoming = await FriendRequest.find({
        to:     req.user.id,
        status: 'pending'
      })
      .populate('from', 'username profilePic')
      .sort({ createdAt: -1 })
      .lean();
      res.json(incoming);
    } catch (err) {
      console.error('GET /incoming error:', err);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// ─── New alias so front-end GET /api/friend-requests/incoming also works ─
router.get(
  '/friend-requests/incoming',
  authenticateToken,
  async (req, res) => {
    try {
      const incoming = await FriendRequest.find({
        to:     req.user.id,
        status: 'pending'
      })
      .populate('from', 'username profilePic')
      .sort({ createdAt: -1 })
      .lean();
      res.json(incoming);
    } catch (err) {
      console.error('GET /friend-requests/incoming alias error:', err);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// ─── Accept ───────────────────────────────────────────────────────────────
router.post(
  '/friend-requests/:id/accept',
  authenticateToken,
  async (req, res) => {
    try {
      const fr = await FriendRequest.findById(req.params.id);
      if (!fr || fr.to.toString() !== req.user.id) {
        return res.status(404).json({ message: 'Request not found.' });
      }
      fr.status = 'accepted';
      await fr.save();

      await User.findByIdAndUpdate(fr.from, { $addToSet: { friends: fr.to } });
      await User.findByIdAndUpdate(fr.to,   { $addToSet: { friends: fr.from } });

      res.json({ message: 'Friend request accepted.' });
    } catch (err) {
      console.error('POST /friend-requests/:id/accept error:', err);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// ─── Reject ───────────────────────────────────────────────────────────────
router.post(
  '/friend-requests/:id/reject',
  authenticateToken,
  async (req, res) => {
    try {
      const fr = await FriendRequest.findById(req.params.id);
      if (!fr || fr.to.toString() !== req.user.id) {
        return res.status(404).json({ message: 'Request not found.' });
      }
      fr.status = 'rejected';
      await fr.save();
      res.json({ message: 'Friend request rejected.' });
    } catch (err) {
      console.error('POST /friend-requests/:id/reject error:', err);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

module.exports = router;
