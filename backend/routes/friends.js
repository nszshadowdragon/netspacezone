// backend/routes/friends.js
// A robust friends router that uses the Friendship model for all friend flows.
// - Defensive casts for user id
// - Emits socket events via req.app.get('io')
// - Returns shapes the frontend expects (counts, incoming/outgoing arrays)
// - Uses requireAuth middleware (tries common paths)

// Normalize requireAuth so it can accept several export shapes
let requireAuthRaw = null;
try {
  requireAuthRaw = require("../requireAuth");
} catch (e1) {
  try {
    requireAuthRaw = require("../middleware/authMiddleware");
  } catch (e2) {
    try {
      requireAuthRaw = require("../authMiddleware");
    } catch (e3) {
      requireAuthRaw = null;
    }
  }
}

/**
 * normalizeRequireAuth -> returns a middleware function (req,res,next)
 * Handles:
 *  - module that exports middleware function directly
 *  - module that exports { verifyToken, middleware, default, verify } etc.
 *  - null -> no-op middleware (allows local dev while you fix auth)
 */
function normalizeRequireAuth(raw) {
  if (!raw) {
    // no auth available: return no-op middleware (not ideal long-term — keep for dev)
    return (req, res, next) => next();
  }
  // raw is a function: use it directly
  if (typeof raw === "function") return raw;

  // try common property names
  const candidates = ["verifyToken", "verify", "middleware", "default", "auth", "ensureAuth"];
  for (const k of candidates) {
    if (raw[k] && typeof raw[k] === "function") return raw[k];
  }

  // if it has .default which is a function
  if (raw.default && typeof raw.default === "function") return raw.default;

  // fallback: if it's an object with a function-valued property, pick first function
  for (const key of Object.keys(raw)) {
    if (typeof raw[key] === "function") return raw[key];
  }

  // otherwise return a noop so routes don't crash (useful for dev)
  return (req, res, next) => next();
}

const requireAuth = normalizeRequireAuth(requireAuthRaw);

// Friendship & User model resolution (try multiple paths)
let Friendship;
let User;
try { Friendship = require("../Friendship"); } catch (e) { try { Friendship = require("../models/Friendship"); } catch (err) { Friendship = null; } }
try { User = require("../User"); } catch (e) { try { User = require("../models/User"); } catch (err) { User = null; } }

const express = require("express");
const router = express.Router();

/** utilities **/
function strId(x) {
  try {
    if (!x && x !== 0) return "";
    return String(x);
  } catch {
    return "";
  }
}
function makePairKey(aId, bId) {
  const a = strId(aId);
  const b = strId(bId);
  if (!a || !b) return "";
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/* ---------- GET /api/users/friends/counts ---------- */
router.get("/counts", requireAuth, async (req, res) => {
  try {
    // support various middleware outputs: req.meId, req.userId, req.user._id
    const meId = strId(req.meId || req.userId || req.user?._id || req.user?.id || "");
    if (!meId) return res.status(401).json({ error: "Unauthorized" });

    // Let Mongoose cast the strings; avoid manual ObjectId creation
    const [incoming, outgoing, friends] = await Promise.all([
      Friendship ? Friendship.countDocuments({ status: "pending", requestedTo: meId }) : 0,
      Friendship ? Friendship.countDocuments({ status: "pending", requestedBy: meId }) : 0,
      Friendship ? Friendship.countDocuments({ status: "accepted", $or: [{ userA: meId }, { userB: meId }] }) : 0,
    ]);

    return res.json({ incoming: Number(incoming || 0), outgoing: Number(outgoing || 0), friends: Number(friends || 0) });
  } catch (err) {
    console.error("friends/counts error:", err);
    return res.status(500).json({ error: "Failed to compute counts" });
  }
});

/* ---------- GET /api/users/friends/incoming ---------- */
router.get("/incoming", requireAuth, async (req, res) => {
  try {
    const meId = strId(req.meId || req.userId || req.user?._id || req.user?.id || "");
    if (!meId) return res.status(401).json({ error: "Unauthorized" });

    const rows = Friendship
      ? await Friendship.find({ status: "pending", requestedTo: meId })
          .populate("requestedBy", "username displayName profileImage")
          .sort({ createdAt: -1 })
          .limit(200)
          .lean()
      : [];

    const mapped = (rows || []).map((r) => ({
      _id: r._id,
      pairKey: r.pairKey,
      status: r.status,
      requestedBy: r.requestedBy
        ? { _id: r.requestedBy._id, username: r.requestedBy.username, displayName: r.requestedBy.displayName, profileImage: r.requestedBy.profileImage }
        : undefined,
      fromUserId: strId(r.requestedBy?._id || r.requestedBy),
      createdAt: r.createdAt,
    }));

    return res.json(mapped);
  } catch (err) {
    console.error("friends/incoming error:", err);
    return res.status(500).json({ error: "Failed to load incoming" });
  }
});

/* ---------- GET /api/users/friends/outgoing ---------- */
router.get("/outgoing", requireAuth, async (req, res) => {
  try {
    const meId = strId(req.meId || req.userId || req.user?._id || req.user?.id || "");
    if (!meId) return res.status(401).json({ error: "Unauthorized" });

    const rows = Friendship
      ? await Friendship.find({ status: "pending", requestedBy: meId })
          .populate("requestedTo", "username displayName profileImage")
          .sort({ createdAt: -1 })
          .limit(200)
          .lean()
      : [];

    const mapped = (rows || []).map((r) => ({
      _id: r._id,
      pairKey: r.pairKey,
      status: r.status,
      requestedTo: r.requestedTo
        ? { _id: r.requestedTo._id, username: r.requestedTo.username, displayName: r.requestedTo.displayName, profileImage: r.requestedTo.profileImage }
        : undefined,
      toUserId: strId(r.requestedTo?._id || r.requestedTo),
      createdAt: r.createdAt,
    }));

    return res.json(mapped);
  } catch (err) {
    console.error("friends/outgoing error:", err);
    return res.status(500).json({ error: "Failed to load outgoing" });
  }
});

/* ---------- POST /api/users/friends/request ---------- */
/**
 * body: { toUserId?, username? }
 * Creates a pending Friendship doc if one doesn't exist.
 * If an inverse pending exists, it will accept instead.
 */
router.post("/request", requireAuth, async (req, res) => {
  try {
    if (!Friendship) return res.status(500).json({ error: "Friendship model not available" });

    const from = strId(req.userId || req.user?._id || req.user?.id || req.body?.fromUserId || "");
    if (!from) return res.status(401).json({ error: "Unauthorized" });

    let { toUserId, username } = req.body || {};
    let to = strId(toUserId || "");
    if (!to && username && User) {
      const u = await User.findOne({ username }).lean();
      to = strId(u?._id || u?.id || "");
    }
    if (!to) return res.status(400).json({ error: "toUserId or username required" });
    if (from === to) return res.status(400).json({ error: "Cannot friend yourself" });

    const pairKey = makePairKey(from, to);

    const existing = await Friendship.findOne({ pairKey }).lean();
    if (existing) {
      if (existing.status === "accepted") return res.json({ isFriend: true, requestPending: false });
      if (existing.status === "pending") {
        // if existing requestedBy is the same user, it's already pending
        if (String(existing.requestedBy) === String(from)) {
          return res.json({ isFriend: false, requestPending: true, data: existing });
        } else {
          // inverse pending -> accept it
          await Friendship.findOneAndUpdate({ _id: existing._id }, { status: "accepted", $unset: { requestedBy: "", requestedTo: "" } }, { new: true });
          const io = req.app?.get("io");
          try {
            io?.to(`user:${existing.requestedBy}`).emit("friend:accepted", { a: existing.requestedBy, b: existing.requestedTo });
            io?.to(`user:${existing.requestedTo}`).emit("friend:accepted", { a: existing.requestedBy, b: existing.requestedTo });
          } catch {}
          return res.json({ isFriend: true, requestPending: false });
        }
      }
    }

    // create a pending friendship
    const parts = pairKey.split(":");
    const ua = parts[0] || "";
    const ub = parts[1] || "";

    const doc = await Friendship.findOneAndUpdate(
      { pairKey },
      { $setOnInsert: { userA: ua, userB: ub, pairKey, status: "pending", requestedBy: from, requestedTo: to } },
      { upsert: true, new: true }
    );

    // emit socket for recipient
    try {
      const io = req.app?.get("io");
      io?.to(`user:${to}`).emit("friend:request:created", { fromUserId: from, toUserId: to, friendshipId: String(doc._id) });
    } catch (e) {}

    return res.json({ isFriend: false, requestPending: doc?.status === "pending", data: doc });
  } catch (err) {
    console.error("friends/request error:", err);
    return res.status(500).json({ error: "Request failed" });
  }
});

/* ---------- POST /api/users/friends/accept ---------- */
/**
 * body: { fromUserId? , friendshipId? }
 */
router.post("/accept", requireAuth, async (req, res) => {
  try {
    if (!Friendship) return res.status(500).json({ error: "Friendship model not available" });

    const me = strId(req.userId || req.user?._id || req.user?.id || "");
    if (!me) return res.status(401).json({ error: "Unauthorized" });

    const { fromUserId, friendshipId } = req.body || {};
    let criteria = {};
    if (friendshipId) criteria = { _id: friendshipId };
    else if (fromUserId) criteria = { pairKey: makePairKey(me, fromUserId) };
    else return res.status(400).json({ error: "fromUserId or friendshipId required" });

    const doc = await Friendship.findOne(criteria).lean();
    if (!doc) return res.status(404).json({ error: "Not found" });

    if (doc.status !== "pending") return res.status(400).json({ error: "Not pending" });
    if (String(doc.requestedTo) !== String(me)) return res.status(403).json({ error: "Not permitted" });

    await Friendship.findOneAndUpdate({ _id: doc._id }, { status: "accepted", $unset: { requestedBy: "", requestedTo: "" } }, { new: true });

    // emit accepted
    try {
      const io = req.app?.get("io");
      io?.to(`user:${doc.requestedBy}`).emit("friend:accepted", { a: doc.requestedBy, b: doc.requestedTo });
      io?.to(`user:${doc.requestedTo}`).emit("friend:accepted", { a: doc.requestedBy, b: doc.requestedTo });
    } catch (e) {}

    return res.json({ ok: true });
  } catch (err) {
    console.error("friends/accept error:", err);
    return res.status(500).json({ error: "Failed to accept" });
  }
});

/* ---------- POST /api/users/friends/decline ---------- */
/**
 * body: { fromUserId?, friendshipId? }
 */
router.post("/decline", requireAuth, async (req, res) => {
  try {
    if (!Friendship) return res.status(500).json({ error: "Friendship model not available" });

    const me = strId(req.userId || req.user?._id || req.user?.id || "");
    if (!me) return res.status(401).json({ error: "Unauthorized" });

    const { fromUserId, friendshipId } = req.body || {};
    let criteria = {};
    if (friendshipId) criteria = { _id: friendshipId };
    else if (fromUserId) criteria = { pairKey: makePairKey(me, fromUserId) };
    else return res.status(400).json({ error: "fromUserId or friendshipId required" });

    const doc = await Friendship.findOne(criteria).lean();
    if (!doc) return res.status(404).json({ error: "Not found" });

    if (doc.status !== "pending") return res.status(400).json({ error: "Not pending" });
    if (String(doc.requestedTo) !== String(me)) return res.status(403).json({ error: "Not permitted" });

    await Friendship.deleteOne({ _id: doc._id });

    // emit declined
    try {
      const io = req.app?.get("io");
      io?.to(`user:${doc.requestedBy}`).emit("friend:declined", { a: doc.requestedBy, b: doc.requestedTo });
      io?.to(`user:${doc.requestedTo}`).emit("friend:declined", { a: doc.requestedBy, b: doc.requestedTo });
    } catch (e) {}

    return res.json({ ok: true });
  } catch (err) {
    console.error("friends/decline error:", err);
    return res.status(500).json({ error: "Failed to decline" });
  }
});

/* ---------- POST /api/users/friends/cancel ---------- */
/**
 * body: { toUserId?, friendshipId? }
 * Only requester can cancel their pending request.
 */
router.post("/cancel", requireAuth, async (req, res) => {
  try {
    if (!Friendship) return res.status(500).json({ error: "Friendship model not available" });

    const me = strId(req.userId || req.user?._id || req.user?.id || "");
    if (!me) return res.status(401).json({ error: "Unauthorized" });

    const { toUserId, friendshipId } = req.body || {};
    let criteria = {};
    if (friendshipId) criteria = { _id: friendshipId };
    else if (toUserId) criteria = { pairKey: makePairKey(me, toUserId) };
    else return res.status(400).json({ error: "toUserId or friendshipId required" });

    const doc = await Friendship.findOne(criteria).lean();
    if (!doc) return res.status(404).json({ error: "Not found" });

    if (String(doc.requestedBy) !== String(me)) return res.status(403).json({ error: "Not permitted" });

    await Friendship.deleteOne({ _id: doc._id });

    try {
      const io = req.app?.get("io");
      io?.to(`user:${doc.requestedTo}`).emit("friend:request:canceled", { a: doc.requestedBy, b: doc.requestedTo });
      io?.to(`user:${doc.requestedBy}`).emit("friend:request:canceled", { a: doc.requestedBy, b: doc.requestedTo });
    } catch (e) {}

    return res.json({ ok: true });
  } catch (err) {
    console.error("friends/cancel error:", err);
    return res.status(500).json({ error: "Failed to cancel" });
  }
});

/* ---------- POST /api/users/friends/unfriend ---------- */
/**
 * body: { userId }
 */
router.post("/unfriend", requireAuth, async (req, res) => {
  try {
    if (!Friendship) return res.status(500).json({ error: "Friendship model not available" });

    const me = strId(req.userId || req.user?._id || req.user?.id || "");
    if (!me) return res.status(401).json({ error: "Unauthorized" });

    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });

    const pairKey = makePairKey(me, userId);
    const doc = await Friendship.findOne({ pairKey }).lean();
    if (!doc) return res.status(404).json({ error: "Not found" });

    await Friendship.deleteOne({ _id: doc._id });

    try {
      const io = req.app?.get("io");
      io?.to(`user:${userId}`).emit("friend:removed", { a: doc.userA, b: doc.userB });
      io?.to(`user:${me}`).emit("friend:removed", { a: doc.userA, b: doc.userB });
    } catch (e) {}

    return res.json({ ok: true });
  } catch (err) {
    console.error("friends/unfriend error:", err);
    return res.status(500).json({ error: "Failed to unfriend" });
  }
});

module.exports = router;
