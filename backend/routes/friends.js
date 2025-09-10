// backend/routes/friends.js
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Friendship = require("../models/Friendship");
const User = require("../models/User");

const router = express.Router();

/* ----------------- helpers ----------------- */
function authId(req) {
  return String(req.user?._id || req.userId || req.authUserId || "").trim();
}

/** Decode JWT from Authorization or cookie if req.user is not set */
function ensureAuthFromToken(req) {
  if (authId(req)) return authId(req);

  const header = req.headers.authorization || req.headers.Authorization || "";
  const cookieToken =
    req.cookies?.token || req.cookies?.jwt || req.cookies?.authToken || "";

  const tryDecode = (tok) => {
    const secrets = [
      process.env.JWT_SECRET,
      process.env.JWT_KEY,
      process.env.TOKEN_SECRET,
    ].filter(Boolean);
    for (const sec of secrets) {
      try {
        const dec = jwt.verify(tok, sec);
        const uid =
          String(dec?.id || dec?._id || dec?.userId || dec?.uid || "").trim();
        if (uid) {
          req.user = req.user || {};
          req.user._id = uid;
          return uid;
        }
      } catch (_) {}
    }
    return "";
  };

  if (header.startsWith("Bearer ")) {
    const tok = header.slice(7).trim();
    const uid = tryDecode(tok);
    if (uid) return uid;
  }
  if (cookieToken) {
    const uid = tryDecode(cookieToken);
    if (uid) return uid;
  }
  return "";
}

function normPair(a, b) {
  const A = String(a), B = String(b);
  return A < B ? { userA: A, userB: B, pairKey: `${A}:${B}` } : { userA: B, userB: A, pairKey: `${B}:${A}` };
}
async function resolveUserId({ userId, username }) {
  const id = String(userId || "").trim();
  if (id) return id;
  const uname = String(username || "").trim();
  if (!uname) return "";
  const u = await User.findOne({ username: new RegExp(`^${uname}$`, "i") }).select("_id").lean();
  return u ? String(u._id) : "";
}
function statusFor(doc, meId, otherId) {
  if (!doc) return "none";
  if (doc.status === "accepted") return "friends";
  if (String(doc.requestedBy) === meId && String(doc.requestedTo) === otherId) return "pending";
  if (String(doc.requestedTo) === meId && String(doc.requestedBy) === otherId) return "incoming";
  return "none";
}
function requireAuth(req, res, next) {
  const id = ensureAuthFromToken(req);
  if (!id) return res.status(401).send("Not authenticated");
  req.meId = id;
  next();
}

/* ---- helpers for targeted notifications ---- */
async function buildActor(uId) {
  const u = await User.findById(uId).select("_id username profileImage profilePic").lean();
  if (!u) return null;
  return { _id: String(u._id), username: u.username, profileImage: u.profileImage || u.profilePic || "" };
}
/** 
 * Emit to the user's room AND broadcast with {toUserId} fallback so clients that
 * haven't joined yet still receive and locally filter.
 */
function emitNotif(req, toUserId, payload) {
  const io = req.app.get("io");
  if (!io) return;
  // room-target
  io.to(`user:${toUserId}`).emit("notification:new", payload);
  // broadcast fallback with explicit target so the client can filter
  io.emit("notification:new", { ...payload, toUserId: String(toUserId) });
}

/* ----------------- routes ----------------- */

// GET /status?userId=&username=
router.get("/status", requireAuth, async (req, res) => {
  try {
    const otherId = await resolveUserId({ userId: req.query.userId, username: req.query.username });
    if (!otherId) return res.json({ status: "none" });
    if (otherId === req.meId) return res.json({ status: "self" });

    const { pairKey } = normPair(req.meId, otherId);
    const doc = await Friendship.findOne({ pairKey }).lean();
    return res.json({ status: statusFor(doc, req.meId, otherId) });
  } catch (e) {
    console.error("friends/status", e);
    res.status(500).send("Failed");
  }
});

// POST /request { toUserId?, username? }
router.post("/request", requireAuth, async (req, res) => {
  try {
    const toId = await resolveUserId({ userId: req.body.toUserId, username: req.body.username });
    if (!toId) return res.status(400).send("Missing target");
    if (toId === req.meId) return res.status(400).send("Cannot friend yourself");

    const { userA, userB, pairKey } = normPair(req.meId, toId);
    const existing = await Friendship.findOne({ pairKey });

    if (existing) {
      if (existing.status === "accepted") return res.json({ status: "friends" });
      const alreadyMine = String(existing.requestedBy) === req.meId;
      if (alreadyMine) return res.json({ status: "pending" });
      // they sent → accept
      existing.status = "accepted";
      existing.requestedBy = undefined;
      existing.requestedTo = undefined;
      await existing.save();
      try { req.app.get("io")?.emit("friend:accepted", { a: userA, b: userB }); } catch {}
      // notify original requester (they get accepted)
      const actor = await buildActor(req.meId);
      if (actor) {
        emitNotif(req, toId, {
          _id: new mongoose.Types.ObjectId().toString(),
          type: "friend_accept",
          actor,
          message: " accepted your friend request",
          link: actor.username ? `/profile/${actor.username}` : "",
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
      return res.json({ status: "friends" });
    }

    const doc = await Friendship.create({
      userA, userB, pairKey,
      status: "pending",
      requestedBy: req.meId,
      requestedTo: toId,
    });

    try { req.app.get("io")?.emit("friend:request:created", { fromUserId: req.meId, toUserId: toId, id: doc._id }); } catch {}

    // notify receiver for All tab
    const actor = await buildActor(req.meId);
    if (actor) {
      emitNotif(req, toId, {
        _id: new mongoose.Types.ObjectId().toString(),
        type: "friend_request",
        actor,
        message: " sent you a friend request",
        link: actor.username ? `/profile/${actor.username}` : "",
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    return res.status(201).json({ status: "pending" });
  } catch (e) {
    console.error("friends/request", e);
    res.status(500).send("Failed");
  }
});

// POST /cancel { toUserId?, username? }
router.post("/cancel", requireAuth, async (req, res) => {
  try {
    const toId = await resolveUserId({ userId: req.body.toUserId, username: req.body.username });
    if (!toId) return res.status(400).send("Missing target");
    const { pairKey } = normPair(req.meId, toId);

    const doc = await Friendship.findOne({ pairKey });
    if (!doc || doc.status !== "pending" || String(doc.requestedBy) !== req.meId)
      return res.json({ status: "none" });

    await doc.deleteOne();
    try { req.app.get("io")?.emit("friend:request:canceled", { fromUserId: req.meId, toUserId: toId }); } catch {}
    return res.json({ status: "none" });
  } catch (e) {
    console.error("friends/cancel", e);
    res.status(500).send("Failed");
  }
});

// POST /accept { fromUserId?, username? }
router.post("/accept", requireAuth, async (req, res) => {
  try {
    const fromId = await resolveUserId({ userId: req.body.fromUserId, username: req.body.username });
    if (!fromId) return res.status(400).send("Missing source");
    const { userA, userB, pairKey } = normPair(req.meId, fromId);

    const doc = await Friendship.findOne({ pairKey });
    if (!doc || doc.status !== "pending" || String(doc.requestedTo) !== req.meId)
      return res.json({ status: "none" });

    doc.status = "accepted";
    doc.requestedBy = undefined;
    doc.requestedTo = undefined;
    await doc.save();

    try { req.app.get("io")?.emit("friend:accepted", { a: userA, b: userB }); } catch {}

    // notify original sender (their request was accepted)
    const actor = await buildActor(req.meId);
    if (actor) {
      emitNotif(req, fromId, {
        _id: new mongoose.Types.ObjectId().toString(),
        type: "friend_accept",
        actor,
        message: " accepted your friend request",
        link: actor.username ? `/profile/${actor.username}` : "",
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    return res.json({ status: "friends" });
  } catch (e) {
    console.error("friends/accept", e);
    res.status(500).send("Failed");
  }
});

// POST /decline { fromUserId?, username? }
router.post("/decline", requireAuth, async (req, res) => {
  try {
    const fromId = await resolveUserId({ userId: req.body.fromUserId, username: req.body.username });
    if (!fromId) return res.status(400).send("Missing source");
    const { pairKey } = normPair(req.meId, fromId);

    const doc = await Friendship.findOne({ pairKey });
    if (!doc || doc.status !== "pending" || String(doc.requestedTo) !== req.meId)
      return res.json({ status: "none" });

    await doc.deleteOne();
    try { req.app.get("io")?.emit("friend:declined", { fromUserId: fromId, toUserId: req.meId }); } catch {}
    return res.json({ status: "none" });
  } catch (e) {
    console.error("friends/decline", e);
    res.status(500).send("Failed");
  }
});

// POST /unfriend { userId?, username? }
router.post("/unfriend", requireAuth, async (req, res) => {
  try {
    const otherId = await resolveUserId({ userId: req.body.userId, username: req.body.username });
    if (!otherId) return res.status(400).send("Missing target");
    const { userA, userB, pairKey } = normPair(req.meId, otherId);

    const doc = await Friendship.findOne({ pairKey });
    if (!doc || doc.status !== "accepted") return res.json({ status: "none" });

    await doc.deleteOne();
    try { req.app.get("io")?.emit("friend:removed", { a: userA, b: userB }); } catch {}
    return res.json({ status: "none" });
  } catch (e) {
    console.error("friends/unfriend", e);
    res.status(500).send("Failed");
  }
});

// GET /counts
router.get("/counts", requireAuth, async (req, res) => {
  try {
    const me = mongoose.Types.ObjectId.createFromHexString(req.meId);
    const [incoming, outgoing, friends] = await Promise.all([
      Friendship.countDocuments({ status: "pending", requestedTo: me }),
      Friendship.countDocuments({ status: "pending", requestedBy: me }),
      Friendship.countDocuments({ status: "accepted", $or: [{ userA: me }, { userB: me }] }),
    ]);
    res.json({ incoming, outgoing, friends });
  } catch (e) {
    console.error("friends/counts", e);
    res.status(500).send("Failed");
  }
});

// GET /incoming
router.get("/incoming", requireAuth, async (req, res) => {
  try {
    const rows = await Friendship.find({ status: "pending", requestedTo: req.meId })
      .sort({ createdAt: -1 })
      .lean();

    const ids = Array.from(new Set(rows.map(r => String(r.requestedBy))));
    const users = await User.find({ _id: { $in: ids } })
      .select("_id username profileImage profilePic fullName")
      .lean();

    const uMap = new Map(users.map(u => [String(u._id), u]));

    const out = rows.map(r => ({
      id: r._id,
      fromUserId: String(r.requestedBy),
      toUserId: String(r.requestedTo),
      fromUser: uMap.get(String(r.requestedBy)) || null,
      toUser: uMap.get(String(r.requestedTo)) || null,
      createdAt: r.createdAt,
    }));
    res.json(out);
  } catch (e) {
    console.error("friends/incoming", e);
    res.status(500).send("Failed");
  }
});

// GET /outgoing
router.get("/outgoing", requireAuth, async (req, res) => {
  try {
    const rows = await Friendship.find({ status: "pending", requestedBy: req.meId })
      .sort({ createdAt: -1 })
      .lean();

    const ids = Array.from(new Set(rows.map(r => String(r.requestedTo))));
    const users = await User.find({ _id: { $in: ids } })
      .select("_id username profileImage profilePic fullName")
      .lean();

    const uMap = new Map(users.map(u => [String(u._id), u]));

    const out = rows.map(r => ({
      id: r._id,
      fromUserId: String(r.requestedBy),
      toUserId: String(r.requestedTo),
      toUser: uMap.get(String(r.requestedTo)) || null,
      createdAt: r.createdAt,
    }));
    res.json(out);
  } catch (e) {
    console.error("friends/outgoing", e);
    res.status(500).send("Failed");
  }
});

// GET /list
router.get("/list", requireAuth, async (req, res) => {
  try {
    const rows = await Friendship.find({
      status: "accepted",
      $or: [{ userA: req.meId }, { userB: req.meId }],
    })
      .sort({ updatedAt: -1 })
      .lean();

    const otherIds = rows.map(r =>
      String(r.userA) === req.meId ? String(r.userB) : String(r.userA)
    );
    const uniq = Array.from(new Set(otherIds));
    const users = await User.find({ _id: { $in: uniq } })
      .select("_id username profileImage profilePic fullName")
      .lean();

    res.json(users);
  } catch (e) {
    console.error("friends/list", e);
    res.status(500).send("Failed");
  }
});

module.exports = router;
