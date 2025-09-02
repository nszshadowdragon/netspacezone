// backend/routes/galleryRoutes.js
const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");

const GalleryImage = require("../models/GalleryImage");
const User = require("../models/User");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

/* ------------------------------ UPLOAD SETUP ------------------------------ */

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const base = path.parse(file.originalname).name.replace(/[^a-z0-9_\-]+/gi, "_");
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}_${Math.round(Math.random() * 1e9)}_${base}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image uploads allowed"));
    cb(null, true);
  },
});

const fileUrlPath = (filename) => `/uploads/${filename}`;

/* ------------------------------- UTILITIES -------------------------------- */

const USER_PROJECTION =
  "_id username profilePic profileImage avatar avatarUrl photoUrl photoURL picture";

const toObjectId = (v) => {
  if (!v) return undefined;
  if (typeof v === "object" && v._id) v = v._id;
  return mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(String(v)) : undefined;
};

function pickAvatar(u = {}) {
  return (
    u.profilePic ||
    u.profileImage ||
    u.avatar ||
    u.avatarUrl ||
    u.photoUrl ||
    u.photoURL ||
    u.picture ||
    ""
  );
}

function publicUser(owner) {
  if (!owner) return null;
  return {
    _id: owner._id,
    username: owner.username,
    name: owner.username || "User",
    avatar: pickAvatar(owner),
    profilePic: owner.profilePic || null,
  };
}

// Attach the same owner object under both `user` and `owner` for compatibility
function attachOwner(images = [], ownerDoc) {
  if (!ownerDoc) return images;
  const pub = publicUser(ownerDoc);
  return images.map((img) => ({ ...img, user: pub, owner: pub }));
}

// Normalize incoming comments (accept legacy keys) and CAST ids so Mongoose
// embedded schemas won't throw "Cast to embedded failed".
function normalizeIncomingComments(arr = [], fallbackUserId) {
  return arr.map((c) => {
    const userId =
      toObjectId(c.userId) ||
      toObjectId(c.user) ||
      toObjectId(c.userID) ||
      toObjectId(c.user_id) ||
      toObjectId(c.uid) ||
      toObjectId(fallbackUserId);

    const likes = Array.isArray(c.likes) ? c.likes.map(toObjectId).filter(Boolean) : [];
    const dislikes = Array.isArray(c.dislikes) ? c.dislikes.map(toObjectId).filter(Boolean) : [];

    const replies = Array.isArray(c.replies)
      ? c.replies.map((r) => ({
          _id: String(r._id || Math.random().toString(36).slice(2)),
          text: r.text || "",
          userId:
            toObjectId(r.userId) ||
            toObjectId(r.user) ||
            toObjectId(r.userID) ||
            toObjectId(r.user_id) ||
            toObjectId(r.uid) ||
            toObjectId(fallbackUserId),
          likes: Array.isArray(r.likes) ? r.likes.map(toObjectId).filter(Boolean) : [],
          dislikes: Array.isArray(r.dislikes) ? r.dislikes.map(toObjectId).filter(Boolean) : [],
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
        }))
      : [];

    return {
      _id: String(c._id || Math.random().toString(36).slice(2)),
      text: c.text || "",
      userId,
      likes,
      dislikes,
      createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
      replies,
    };
  });
}

// Ensure every comment/reply has a valid author (fallback to req.user._id)
function ensureAuthors(arr, authorId) {
  return (arr || []).map((c) => ({
    ...c,
    userId: c.userId || authorId,
    replies: (c.replies || []).map((r) => ({ ...r, userId: r.userId || authorId })),
  }));
}

/* ---------------------- realtime emit helper (rooms) ---------------------- */
/** Emits to gallery room using `io.emitGallery` if present; else falls back
 *  to io.to(`gallery:${ownerId}`).emit(`gallery:${event}`, { ownerId, payload, ts }).
 *  Also emits legacy flat events for backward compatibility.
 */
function emitGalleryEvent(io, ownerId, eventSuffix, payload, legacy) {
  if (!io) return;
  const owner = String(ownerId);

  if (typeof io.emitGallery === "function") {
    io.emitGallery(owner, `image:${eventSuffix}`, payload);
  } else {
    io.to(`gallery:${owner}`).emit(`gallery:image:${eventSuffix}`, {
      ownerId: owner,
      payload,
      ts: Date.now(),
    });
  }

  // Legacy broadcasts (previous client listeners)
  if (legacy === "created") {
    io.emit("gallery:new", { accountId: owner, image: payload });
  } else if (legacy === "updated") {
    io.emit("gallery:updated", { accountId: owner, filename: payload.filename, image: payload });
  } else if (legacy === "deleted") {
    io.emit("gallery:deleted", { accountId: owner, filename: payload.filename || payload.id });
  }
}

/* --------------------------------- ROUTES --------------------------------- */

// GET /api/gallery?accountId=...
router.get("/", async (req, res) => {
  try {
    const { accountId } = req.query;
    if (!accountId) return res.status(400).json({ error: "accountId required" });

    const [images, owner] = await Promise.all([
      GalleryImage.find({ accountId })
        .sort({ createdAt: -1 })
        .populate("comments.userId", USER_PROJECTION)
        .populate("comments.replies.userId", USER_PROJECTION)
        .lean(),
      User.findById(accountId).select(USER_PROJECTION).lean(),
    ]);

    // Back-compat: ensure legacy comment `user` shows up as `userId`
    const stamped = (images || []).map((img) => ({
      ...img,
      comments: (img.comments || []).map((c) => ({
        ...c,
        userId: c.userId || c.user || img.accountId,
        replies: (c.replies || []).map((r) => ({
          ...r,
          userId: r.userId || r.user || img.accountId,
        })),
      })),
    }));

    const withOwner = attachOwner(stamped, owner);
    res.json(withOwner);
  } catch (e) {
    console.error("GET /api/gallery error:", e);
    res.status(500).json({ error: "Failed to fetch gallery" });
  }
});

// POST /api/gallery (upload image)
router.post("/", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const io = req.app.get("io");
    const { accountId, folder = "All" } = req.body;
    if (!accountId) return res.status(400).json({ error: "accountId required" });
    if (!req.file) return res.status(400).json({ error: "image file required" });

    const doc = await GalleryImage.create({
      accountId,
      filename: req.file.filename,
      path: fileUrlPath(req.file.filename),
      caption: "",
      folder,
      likes: [],
      dislikes: [],
      comments: [],
    });

    const owner = await User.findById(accountId).select(USER_PROJECTION).lean();
    const out = attachOwner([doc.toObject()], owner)[0];

    emitGalleryEvent(io, accountId, "created", out, "created");
    res.status(201).json(out);
  } catch (e) {
    console.error("POST /api/gallery error:", e);
    res.status(500).json({ error: "Upload failed" });
  }
});

// PATCH /api/gallery/:filename  (caption/folder/likes/dislikes/comments)
router.patch("/:filename", requireAuth, async (req, res) => {
  try {
    const io = req.app.get("io");
    const { filename } = req.params;
    const { accountId, caption, folder } = req.body;
    let { likes, dislikes, comments } = req.body;

    if (!filename) return res.status(400).json({ error: "filename required" });
    if (!accountId) return res.status(400).json({ error: "accountId required" });

    const update = {};
    if (typeof caption === "string") update.caption = caption;
    if (typeof folder === "string") update.folder = folder;

    // cast top-level reaction arrays
    if (Array.isArray(likes)) update.likes = likes.map(toObjectId).filter(Boolean);
    if (Array.isArray(dislikes)) update.dislikes = dislikes.map(toObjectId).filter(Boolean);

    if (Array.isArray(comments)) {
      const stamped = ensureAuthors(
        normalizeIncomingComments(comments, req.user && req.user._id),
        req.user && req.user._id
      );
      update.comments = stamped;
    }

    let updated = await GalleryImage.findOneAndUpdate(
      { filename, accountId },
      { $set: update },
      { new: true, runValidators: true }
    )
      .populate("comments.userId", USER_PROJECTION)
      .populate("comments.replies.userId", USER_PROJECTION);

    if (!updated) return res.status(404).json({ error: "Image not found" });

    updated = updated.toObject();

    const owner = await User.findById(accountId).select(USER_PROJECTION).lean();
    const withOwner = attachOwner([updated], owner)[0];

    emitGalleryEvent(io, accountId, "updated", withOwner, "updated");
    res.json(withOwner);
  } catch (e) {
    console.error("PATCH /api/gallery error:", e);
    res.status(500).json({ error: `Update failed: ${e.message || e}` });
  }
});

// DELETE /api/gallery/:filename?accountId=...
router.delete("/:filename", requireAuth, async (req, res) => {
  try {
    const io = req.app.get("io");
    const { filename } = req.params;
    const { accountId } = req.query;

    if (!filename) return res.status(400).json({ error: "filename required" });
    if (!accountId) return res.status(400).json({ error: "accountId required" });

    const doc = await GalleryImage.findOneAndDelete({ filename, accountId });
    if (!doc) return res.status(404).json({ error: "Image not found" });

    fs.promises.unlink(path.join(uploadsDir, filename)).catch(() => null);

    emitGalleryEvent(io, accountId, "deleted", doc.toObject(), "deleted");
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/gallery error:", e);
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ------------------------------- FOLDERS ---------------------------------- */

router.get("/folders", async (req, res) => {
  try {
    const { accountId } = req.query;
    if (!accountId) return res.status(400).json({ error: "accountId required" });
    const folders = await GalleryImage.distinct("folder", { accountId });
    res.json(["All", ...folders.filter((f) => f && f !== "All")]);
  } catch (e) {
    res.status(500).json({ error: "Failed to list folders" });
  }
});

router.post("/folders", requireAuth, async (req, res) => {
  try {
    const io = req.app.get("io");
    const { name, accountId } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    if (!accountId) return res.status(400).json({ error: "accountId required" });

    const exists = await GalleryImage.exists({ accountId, folder: name });
    if (exists) return res.status(409).json({ error: "Folder exists" });

    // Soft-create (naming only); images make folders concrete
    if (typeof io?.to === "function") {
      io.to(`gallery:${String(accountId)}`).emit("gallery:folder:new", {
        ownerId: String(accountId),
        payload: { name },
        ts: Date.now(),
      });
    }
    return res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to create folder" });
  }
});

router.patch("/folders/:oldName", requireAuth, async (req, res) => {
  try {
    const io = req.app.get("io");
    const { oldName } = req.params;
    const { newName, accountId } = req.body;
    if (!oldName || !newName) return res.status(400).json({ error: "oldName & newName required" });
    if (!accountId) return res.status(400).json({ error: "accountId required" });
    if (oldName === "All") return res.status(400).json({ error: "Can't rename All" });

    await GalleryImage.updateMany({ accountId, folder: oldName }, { $set: { folder: newName } });

    if (typeof io?.to === "function") {
      io.to(`gallery:${String(accountId)}`).emit("gallery:folder:renamed", {
        ownerId: String(accountId),
        payload: { oldName, newName },
        ts: Date.now(),
      });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to rename folder" });
  }
});

router.delete("/folders/:name", requireAuth, async (req, res) => {
  try {
    const io = req.app.get("io");
    const { name } = req.params;
    const { accountId } = req.body || {};
    if (!name) return res.status(400).json({ error: "name required" });
    if (!accountId) return res.status(400).json({ error: "accountId required" });
    if (name === "All") return res.status(400).json({ error: "Can't delete All" });

    await GalleryImage.updateMany({ accountId, folder: name }, { $set: { folder: "All" } });

    if (typeof io?.to === "function") {
      io.to(`gallery:${String(accountId)}`).emit("gallery:folder:deleted", {
        ownerId: String(accountId),
        payload: { name },
        ts: Date.now(),
      });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete folder" });
  }
});

/* ------------------------------- REORDER ---------------------------------- */
// Fire a realtime "reordered" so clients refresh; storing a full order is optional.
router.post("/reorder", requireAuth, async (req, res) => {
  try {
    const io = req.app.get("io");
    const { accountId, order = [] } = req.body || {};
    if (!accountId) return res.status(400).json({ error: "accountId required" });

    if (typeof io?.emitGallery === "function") {
      io.emitGallery(String(accountId), "reordered", { order });
    } else {
      io?.to(`gallery:${String(accountId)}`).emit("gallery:reordered", {
        ownerId: String(accountId),
        payload: { order },
        ts: Date.now(),
      });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to reorder" });
  }
});

module.exports = router;
