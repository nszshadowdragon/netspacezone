// backend/models/Message.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  chatId:   { type: String, required: true },
  sender:   { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  text:     { type: String },
  gif:      { type: String },
  timestamp:{ type: Date, default: Date.now },
});

module.exports = mongoose.model('Message', MessageSchema);
