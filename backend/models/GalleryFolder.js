const mongoose = require('mongoose');
const GalleryFolderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});
GalleryFolderSchema.index({ user: 1, name: 1 }, { unique: true }); // unique per user
module.exports = mongoose.model('GalleryFolder', GalleryFolderSchema);
