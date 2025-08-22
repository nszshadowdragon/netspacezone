const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },

    // ✅ Extra fields from signup
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    birthday: { type: Date, default: null },
    profilePic: {
      type: String,
      default: "/assets/default-avatar.png", // fallback if no image uploaded
    },
    referral: { type: String, default: "" },
    interests: { type: [String], default: [] },
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
