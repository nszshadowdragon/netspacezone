// backend/models/User.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },

  // your personal info
  firstName: { type: String, trim: true },
  lastName:  { type: String, trim: true },
  birthday:  { type: Date },
  bio:       { type: String, default: '' },

  // theme preference
  theme: {
    type: String,
    enum: ['light','normal','dark','custom'],
    default: 'normal'
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // profile images
  profilePic: {
    type: String,
    default: ''        // URL or path to the avatar
  },
  avatarUrl: {
    type: String,
    default: ''
  },

  // “verified” badge & “online” dot on friend cards
  verified: {
    type: Boolean,
    default: false
  },
  online: {
    type: Boolean,
    default: false
  },

  // relationships
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true,
  strictPopulate: false,    // allow populate even if you miss adding a path later
  toJSON: { virtuals: true } // include virtuals in JSON output
});

// Virtual alias for avatar so populate('friends', 'username avatar online') works
userSchema.virtual('avatar').get(function() {
  // prefer explicit avatarUrl, fallback to profilePic
  return this.avatarUrl || this.profilePic || '';
});

// Strip out the password whenever we convert a User doc to JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
