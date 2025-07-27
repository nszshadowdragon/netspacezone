const mongoose = require('mongoose');

const ReplySchema = new mongoose.Schema({
  text: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now }
});

const CommentSchema = new mongoose.Schema({
  text: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  replies: [ReplySchema]
});

const PostSchema = new mongoose.Schema({
  content: { type: String, required: true },
  image: { type: String },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  avatar: { type: String },
  date: { type: Date, default: Date.now },
  comments: [CommentSchema],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  // Add more fields as needed: poll, advanced, etc.
});

module.exports = mongoose.model('Post', PostSchema);
