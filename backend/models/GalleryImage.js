// backend/models/GalleryImage.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const likeArray = [{ type: Schema.Types.ObjectId, ref: 'User' }];

const ReplySchema = new Schema(
  {
    _id: { type: String, required: true },        // client generates short id
    text: { type: String, trim: true, default: '' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    likes: likeArray,
    dislikes: likeArray,
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const CommentSchema = new Schema(
  {
    _id: { type: String, required: true },        // client generates short id
    text: { type: String, trim: true, default: '' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    likes: likeArray,
    dislikes: likeArray,
    createdAt: { type: Date, default: Date.now },
    replies: { type: [ReplySchema], default: [] }
  },
  { _id: false }
);

const GalleryImageSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    filename:  { type: String, required: true, unique: true },
    path:      { type: String, required: true },
    url:       { type: String, default: '' },     // optional absolute/served URL
    caption:   { type: String, default: '' },
    folder:    { type: String, default: 'All', index: true },
    likes:     likeArray,
    dislikes:  likeArray,
    comments:  { type: [CommentSchema], default: [] }
  },
  { timestamps: true }
);

// Helpful compound indexes for list views
GalleryImageSchema.index({ accountId: 1, createdAt: -1 });
GalleryImageSchema.index({ accountId: 1, folder: 1, createdAt: -1 });

// IMPORTANT: guard against OverwriteModelError on hot reloads
module.exports =
  mongoose.models.GalleryImage ||
  mongoose.model('GalleryImage', GalleryImageSchema);
