const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const User = require('../models/User');

let FriendRequest = null;
try { FriendRequest = require('../models/FriendRequest'); } catch {}

let requireAuth = (req, res, next) => next();
try {
  const am = require('../middleware/authMiddleware');
  if (typeof am?.verifyToken === 'function') requireAuth = am.verifyToken;
  else if (typeof am?.protect === 'function') requireAuth = am.protect;
} catch {}

/* ---------------- helpers ---------------- */
const ALLOWED_THEMES = new Set(['light', 'normal1', 'normal2', 'dark']);
const sanitizeTheme = (t) => (ALLOWED_THEMES.has(String(t)) ? String(t) : null);
const escapeRx = (s='') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function normalizeUploadsPath(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/\\/g, '/');

  // Already absolute or data URI
  if (/^https?:\/\//i.test(s) || /^data:/i.test(s)) return s;

  // Normalize to "/uploads/..."
  const low = s.toLowerCase();
  const idx = low.indexOf('/uploads/');
  if (idx >= 0) s = s.slice(idx);
  if (s.startsWith('uploads/')) s = '/' + s;
  if (!s.startsWith('/')) s = '/' + s;

  return s; // "/uploads/xyz.png"
}

/** Build a public absolute URL for a stored pic path with robust base selection. */
function toPublicUrl(req, raw) {
  const p = normalizeUploadsPath(raw);
  if (!p) return null;

  const trim = (x) => (x || '').toString().trim().replace(/\/+$/,'');
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host') || '';
  const origin = trim(req.get('origin'));
  const fwdHost = trim(req.get('x-forwarded-host'));

  const candidates = [
    trim(process.env.UPLOADS_PUBLIC_BASE),                            // 1) explicit env
    origin,                                                           // 2) page origin (deployed site)
    fwdHost ? `${proto}://${fwdHost}` : '',                           // 3) proxy forward host
    `${proto}://${host}`,                                             // 4) current server host
    'https://api.netspacezone.com',                                   // 5) safe fallbacks
    'https://www.netspacezone.com',
    'https://netspacezone.com',
  ].filter(Boolean);

  // Pick the first non-empty candidate
  const base = candidates[0];
  return `${base}${p}`;
}

/* ---------------- me ---------------- */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const id = req.userId || req.user?._id || req.user?.id;
    const user = await User.findById(id).select('-password -securityAnswer');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('/api/users/me GET error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/me', requireAuth, async (req, res) => {
  try {
    const id = req.userId || req.user?._id || req.user?.id;
    const updates = req.body || {};
    const allowedFields = [
      'username','email','firstName','lastName','birthday','gender',
      'securityQuestion','securityAnswer','profilePic','bio','favoriteQuote',
      'interests','theme','location','isActive','verified','online'
    ];
    const updateData = {};
    for (const f of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(updates, f)) updateData[f] = updates[f];
    }
    if (updates.password) {
      if (String(updates.password).length < 8) return res.status(400).json({ error: 'Password too short' });
      updateData.password = await bcrypt.hash(String(updates.password), 10);
    }
    if ('interests' in updateData && !Array.isArray(updateData.interests)) {
      return res.status(400).json({ error: 'Interests must be an array' });
    }
    if ('theme' in updateData) {
      const clean = sanitizeTheme(updateData.theme);
      if (!clean) delete updateData.theme; else updateData.theme = clean;
    }
    const user = await User.findByIdAndUpdate(
      id, { $set: updateData }, { new: true, runValidators: true }
    ).select('-password -securityAnswer');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('/api/users/me PUT error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ---------------- username check ---------------- */
router.get('/check-username', requireAuth, async (req, res) => {
  const username = (req.query.username || '').trim().toLowerCase();
  if (!username || username.length < 3) return res.json({ available: false });
  try {
    if (username === String(req.user?.username || '').toLowerCase()) {
      return res.json({ available: true });
    }
    const exists = await User.findOne({ username: new RegExp(`^${escapeRx(username)}$`, 'i') });
    res.json({ available: !exists });
  } catch {
    res.json({ available: false });
  }
});

/* ---------------- search ---------------- */
router.get('/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ users: [] });

    const meId = req.userId || req.user?._id || req.user?.id || null;
    const rx = new RegExp(escapeRx(q), 'i');

    const filter = {
      ...(meId ? { _id: { $ne: meId } } : {}),
      $or: [{ username: rx }, { firstName: rx }, { lastName: rx }, { fullName: rx }],
    };

    const raw = await User.find(
      filter,
      { username: 1, firstName: 1, lastName: 1, fullName: 1, profileImage: 1, profilePic: 1, friends: 1 }
    ).limit(12).lean();

    const me = meId ? await User.findById(meId, { friends: 1 }).lean() : null;
    const friendSet = new Set((me?.friends || []).map(String));

    let pendingTo = new Set();
    if (FriendRequest && meId) {
      const outgoing = await FriendRequest.find({ from: meId, status: 'pending' }, { to: 1 }).lean();
      pendingTo = new Set(outgoing.map((r) => String(r.to)));
    }

    const users = raw.map((u) => {
      const rawPic = u.profileImage || u.profilePic || null;
      return {
        _id: u._id,
        username: u.username,
        fullName: u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username,
        profileImageUrl: toPublicUrl(req, rawPic), // always absolute (prod-safe)
        isFriend: meId ? friendSet.has(String(u._id)) : false,
        requestPending: meId ? pendingTo.has(String(u._id)) : false,
      };
    });

    res.json({ users });
  } catch (err) {
    console.error('GET /api/users/search error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

/* ---------------- friend request ---------------- */
router.post('/friends/request', requireAuth, async (req, res) => {
  try {
    if (!FriendRequest) return res.status(500).json({ error: 'FriendRequest model not available' });

    const from = req.userId || req.user?._id || req.user?.id;
    const { toUserId } = req.body || {};
    if (!toUserId) return res.status(400).json({ error: 'toUserId required' });
    if (String(from) === String(toUserId))
      return res.status(400).json({ error: 'Cannot friend yourself' });

    const me = await User.findById(from, { friends: 1 }).lean();
    if (me?.friends?.some((id) => String(id) === String(toUserId))) {
      return res.json({ isFriend: true, requestPending: false });
    }

    const fr = await FriendRequest.findOneAndUpdate(
      { from, to: toUserId },
      { $setOnInsert: { status: 'pending' } },
      { upsert: true, new: true }
    ).lean();

    return res.json({ isFriend: false, requestPending: fr?.status === 'pending' });
  } catch (err) {
    console.error('POST /api/users/friends/request error:', err);
    return res.status(500).json({ error: 'Request failed' });
  }
});

module.exports = router;
