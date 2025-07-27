const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const GalleryImage = require('../models/GalleryImage');
const GalleryFolder = require('../models/GalleryFolder');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

router.use(protect);

// --- FOLDER CRUD ---
// CREATE, PATCH, DELETE should ALWAYS use req.user._id (only modify your own)
// GET can take ?accountId= to view another user's folders

router.post('/folders', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Folder name required' });
  try {
    const exists = await GalleryFolder.findOne({ user: req.user._id, name });
    if (exists) return res.status(409).json({ error: 'Folder already exists' });
    const folder = await GalleryFolder.create({ name, user: req.user._id });
    res.json(folder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/folders/:oldName', async (req, res) => {
  const { newName } = req.body;
  if (!newName) return res.status(400).json({ error: 'New folder name required' });
  try {
    const folder = await GalleryFolder.findOneAndUpdate(
      { user: req.user._id, name: req.params.oldName },
      { name: newName },
      { new: true }
    );
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    await GalleryImage.updateMany(
      { user: req.user._id, folder: req.params.oldName },
      { $set: { folder: newName } }
    );
    res.json(folder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/folders/:name', async (req, res) => {
  if (req.params.name === 'All') return res.status(400).json({ error: 'Cannot delete "All"' });
  try {
    await GalleryFolder.findOneAndDelete({ user: req.user._id, name: req.params.name });
    await GalleryImage.updateMany(
      { user: req.user._id, folder: req.params.name },
      { $set: { folder: 'All' } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// **UPDATED GET: allow folders of another account via ?accountId=**
router.get('/folders', async (req, res) => {
  try {
    const targetUserId = req.query.accountId || req.user._id;
    const folders = await GalleryFolder.find({ user: targetUserId }).sort({ createdAt: 1 });
    res.json(['All', ...folders.map(f => f.name).filter(f => f !== 'All')]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- IMAGES ---
// Only POST, PATCH, DELETE your own images. GET can view any account.

router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const folder = req.body.folder || 'All';
  try {
    if (folder !== 'All') {
      let exists = await GalleryFolder.findOne({ user: req.user._id, name: folder });
      if (!exists) {
        exists = await GalleryFolder.create({ name: folder, user: req.user._id });
      }
    }
    const image = await GalleryImage.create({
      filename: req.file.filename,
      path: '/uploads/' + req.file.filename,
      folder,
      user: req.user._id,
      caption: req.body.caption || ""
    });
    res.json({
      path: image.path,
      folder: image.folder,
      filename: image.filename,
      caption: image.caption,
      likes: image.likes || [],
      dislikes: image.dislikes || [],
      comments: image.comments || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// **UPDATED GET: allow ?accountId= for profile viewing**
router.get('/', async (req, res) => {
  const folder = req.query.folder;
  const targetUserId = req.query.accountId || req.user._id;
  const filter = { user: targetUserId };
  if (folder) filter.folder = folder;
  try {
    const images = await GalleryImage.find(filter).sort({ uploadedAt: -1 });
    res.json(images.map(img => ({
      path: img.path,
      folder: img.folder,
      filename: img.filename,
      uploadedAt: img.uploadedAt,
      caption: img.caption || "",
      likes: img.likes || [],
      dislikes: img.dislikes || [],
      comments: img.comments || []
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH, DELETE, LIKE, DISLIKE, COMMENT: only operate on req.user._id images as before
router.patch('/:filename', async (req, res) => {
  const { folder, caption, likes, dislikes, comments } = req.body;
  const updateFields = {};
  if (folder) updateFields.folder = folder;
  if (caption !== undefined) updateFields.caption = caption;
  if (likes !== undefined) {
    updateFields.likes = likes.map(u => u && u._id ? u._id : u);
  }
  if (dislikes !== undefined) {
    updateFields.dislikes = dislikes.map(u => u && u._id ? u._id : u);
  }
  if (comments !== undefined) {
    updateFields.comments = comments.map(c => ({
      user: c.user && c.user._id ? c.user._id : c.user,
      text: c.text,
      createdAt: c.createdAt
    }));
  }

  try {
    if (folder && folder !== 'All') {
      let exists = await GalleryFolder.findOne({ user: req.user._id, name: folder });
      if (!exists) {
        exists = await GalleryFolder.create({ name: folder, user: req.user._id });
      }
    }
    const img = await GalleryImage.findOneAndUpdate(
      { filename: req.params.filename, user: req.user._id },
      updateFields,
      { new: true }
    );
    if (!img) return res.status(404).json({ error: 'Image not found' });
    res.json({ success: true, img });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:filename', async (req, res) => {
  try {
    const img = await GalleryImage.findOneAndDelete({ filename: req.params.filename, user: req.user._id });
    if (img) {
      const filePath = path.join(uploadDir, img.filename);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Failed to delete file: ${filePath}`, err);
        }
      });
    }
    res.json({ success: !!img });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LIKE/DISLIKE/COMMENT: as before
router.patch('/:filename/like', async (req, res) => {
  try {
    const img = await GalleryImage.findOne({ filename: req.params.filename });
    if (!img) return res.status(404).json({ error: 'Image not found' });
    const userId = req.user._id.toString();

    let liked;
    if (img.likes.map(id => id.toString()).includes(userId)) {
      // Unlike
      img.likes = img.likes.filter(id => id.toString() !== userId);
      liked = false;
    } else {
      // Like
      img.likes.push(req.user._id);
      // Remove dislike if present
      img.dislikes = (img.dislikes || []).filter(id => id.toString() !== userId);
      liked = true;
    }
    await img.save();
    res.json({ success: true, liked, likes: img.likes.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:filename/dislike', async (req, res) => {
  try {
    const img = await GalleryImage.findOne({ filename: req.params.filename });
    if (!img) return res.status(404).json({ error: 'Image not found' });
    const userId = req.user._id.toString();

    if (!img.dislikes) img.dislikes = [];
    let disliked;
    if (img.dislikes.map(id => id.toString()).includes(userId)) {
      // Remove dislike
      img.dislikes = img.dislikes.filter(id => id.toString() !== userId);
      disliked = false;
    } else {
      // Add dislike, remove like if present
      img.dislikes.push(req.user._id);
      img.likes = img.likes.filter(id => id.toString() !== userId);
      disliked = true;
    }
    await img.save();
    res.json({ success: true, disliked, dislikes: img.dislikes.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:filename/comment', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Empty comment.' });

    const img = await GalleryImage.findOne({ filename: req.params.filename });
    if (!img) return res.status(404).json({ error: 'Image not found' });

    const comment = {
      user: req.user._id,
      text,
      createdAt: new Date()
    };
    img.comments.push(comment);
    await img.save();

    res.json({ success: true, comment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:filename/comments', async (req, res) => {
  try {
    const img = await GalleryImage.findOne({ filename: req.params.filename });
    if (!img) return res.status(404).json({ error: 'Image not found' });
    res.json(img.comments || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
