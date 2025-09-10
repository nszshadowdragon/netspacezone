// backend/models/Friendship.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * One document per user-pair.
 * pairKey = "minId:maxId" prevents duplicates regardless of direction.
 * status: "pending" | "accepted"
 * When pending, requestedBy=requestedTo define direction.
 */
const FriendshipSchema = new Schema(
  {
    userA: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }, // smaller id in string compare
    userB: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }, // larger id
    pairKey: { type: String, required: true, unique: true, index: true },

    status: { type: String, enum: ["pending", "accepted"], required: true, index: true },

    // For "pending" only
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    requestedTo: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true }
);

// Normalize pair + direction before validation
FriendshipSchema.pre("validate", function (next) {
  const a = String(this.userA || "");
  const b = String(this.userB || "");
  if (!a || !b) return next(new Error("userA and userB required"));

  // enforce sorted ends
  const [minId, maxId] = a < b ? [a, b] : [b, a];
  this.userA = minId;
  this.userB = maxId;
  this.pairKey = `${minId}:${maxId}`;

  // when pending, ensure requestedBy/requestedTo are set and valid
  if (this.status === "pending") {
    const rb = String(this.requestedBy || "");
    const rt = String(this.requestedTo || "");
    if (!rb || !rt) return next(new Error("requestedBy/requestedTo required for pending"));
    if (rb === rt) return next(new Error("requestedBy and requestedTo must differ"));
  } else {
    this.requestedBy = undefined;
    this.requestedTo = undefined;
  }

  next();
});

module.exports =
  mongoose.models.Friendship || mongoose.model("Friendship", FriendshipSchema);
