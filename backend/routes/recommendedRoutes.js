const express = require('express');
const router = express.Router();
const User = require('../models/User');
const requireAuth = require('../middleware/requireAuth');

router.get('/api/recommended-users', requireAuth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const currentUser = await User.findById(currentUserId).lean();
    if (!currentUser) {
      console.log('[RECOMMENDED] Current user not found');
      return res.status(404).json([]);
    }

    const friendIds = (currentUser.friends || []).map(id => id.toString());
    const blockedIds = (currentUser.blocked || []).map(id => id.toString());
    const followingIds = (currentUser.following || []).map(id => id.toString());

    console.log(`\n--- RECOMMENDED USERS DEBUG ---`);
    console.log('Logged in user ID:', currentUserId);
    console.log('Friends:', friendIds);
    console.log('Blocked:', blockedIds);
    console.log('Following:', followingIds);

    let mutualIds = [];
    if (currentUser.friends && currentUser.friends.length > 0) {
      const mutuals = await User.aggregate([
        { $match: { _id: { $in: currentUser.friends } } },
        { $unwind: "$friends" },
        { $group: { _id: "$friends", count: { $sum: 1 } } },
        {
          $match: {
            _id: {
              $nin: [
                currentUser._id,
                ...currentUser.friends,
                ...(currentUser.blocked || [])
              ]
            }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 15 }
      ]);
      mutualIds = mutuals.map(u => u._id.toString());
    }

    const alreadyExcluded = [
      currentUser._id.toString(),
      ...friendIds,
      ...blockedIds,
      ...mutualIds
    ];

    const fallback = await User.find({
      _id: { $nin: alreadyExcluded }
    }).sort({ createdAt: -1 }).limit(10).lean();

    let idsToFetch = [...mutualIds, ...fallback.map(u => u._id.toString())];
    idsToFetch = [...new Set(idsToFetch)];

    let users = await User.find({ _id: { $in: idsToFetch } })
      .select('username name avatar friends following')
      .lean();

    users = users.map(u => ({
      id: u._id.toString(),
      username: u.username,
      name: u.name,
      avatar: u.avatar,
      mutualFriends: (u.friends || []).filter(fid => friendIds.includes(fid.toString())).length,
      isFriend: friendIds.includes(u._id.toString()),
      isFollowing: followingIds.includes(u._id.toString()),
    }));

    // ✅ Fixed crash on missing .name
    users.sort((a, b) => {
      const aName = a.name || a.username || '';
      const bName = b.name || b.username || '';
      return (b.mutualFriends - a.mutualFriends) || aName.localeCompare(bName);
    });

    console.log('Final recommended users:', users.map(u => u.username));
    console.log('--- END DEBUG ---\n');

    res.json(users);
  } catch (err) {
    console.error("Recommended users error:", err);
    res.status(500).json([]);
  }
});

module.exports = router;
