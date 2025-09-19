// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const THEMES = ["light", "normal1", "normal2", "dark", "custom"];

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },

    // required profile fields
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    birthday: { type: Date, required: true },

    // profile picture (base64 string or url)
    profilePic: { type: String, required: true },

    // optional extras
    referral: { type: String, default: "" },
    interests: { type: [String], default: [] },

    // new: theme preference (persisted per user)
    theme: { type: String, enum: THEMES, default: "normal1" },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
