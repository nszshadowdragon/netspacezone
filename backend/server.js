// backend/server.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const mongoose = require("mongoose");

const app = express();

/* --- Middleware --- */
const ORIGINS = [
  "https://netspacezone.com",
  "https://www.netspacezone.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

app.use(cors({ origin: ORIGINS, credentials: true }));
app.use(express.json({ limit: "10mb" })); // allow data-URL images if needed
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* --- Routes --- */
app.get("/healthz", (_req, res) =>
  res.json({ ok: true, db: mongoose.connection.readyState })
);

app.use("/api/auth", require("./routes/auth"));

/* --- DB + Server start (wait for Mongo) --- */
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URL;

if (!MONGO_URI) {
  console.error("❌ Missing MONGODB_URI (or MONGO_URI/MONGO_URL).");
  process.exit(1);
}

mongoose.set("strictQuery", true);
// Avoid query buffering errors before connection:
mongoose.set("bufferCommands", false);

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  })
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`✅ API listening on :${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

module.exports = app;
