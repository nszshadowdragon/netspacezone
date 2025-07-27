// backend/models/FriendRequest.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const FriendRequestSchema = new Schema({
  from: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  to: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  }
}, { timestamps: true });

// Instance method to accept
FriendRequestSchema.methods.accept = function() {
  this.status = 'accepted';
  return this.save();
};

// Instance method to reject
FriendRequestSchema.methods.reject = function() {
  this.status = 'rejected';
  return this.save();
};

module.exports = mongoose.model('FriendRequest', FriendRequestSchema);
