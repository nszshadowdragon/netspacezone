require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

// Middleware
app.use(express.json({ limit: "50mb" }));   // ✅ raise limit for JSON payloads
app.use(express.urlencoded({ limit: "50mb", extended: true })); // ✅ for form data
app.use(cookieParser());

// ✅ Redirect www API calls → api.netspacezone.com
app.use((req, res, next) => {
  const host = req.headers.host;
  if (host && host.includes("www.netspacezone.com")) {
    const newUrl = `https://api.netspacezone.com${req.originalUrl}`;
    return res.redirect(301, newUrl);
  }
  next();
});

// ✅ Allow only dev + correct production domains
app.use(
  cors({
    origin: [
      "http://localhost:5173",        // dev
      "https://netspacezone.com",     // production frontend
      "https://api.netspacezone.com"  // production API domain
    ],
    credentials: true,
  })
);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
