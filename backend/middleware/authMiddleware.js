// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Get a JWT from cookies or Authorization header (or raw token)
 */
function extractToken(req) {
  if (req.cookies?.token) return req.cookies.token;

  const auth = req.get("authorization") || req.get("Authorization");
  if (!auth) return null;
  const parts = auth.trim().split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return auth.trim();
}

/**
 * Verify the token, load the user from DB and attach to req.user
 * - Sets req.userId and req.user (user doc without password)
 * - Allows OPTIONS through for CORS preflight
 */
async function verifyToken(req, res, next) {
  if (req.method === "OPTIONS") return next();

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const secret = process.env.JWT_SECRET || "dev-secret";
    const decoded = jwt.verify(token, secret);

    // Try to derive an identifier from the token payload
    const userId = decoded?.id || decoded?._id || decoded?.userId || decoded?.sub || null;
    const userEmail = decoded?.email || null;

    let user = null;

    if (userId) {
      user = await User.findById(userId).select("-password").lean();
    } else if (userEmail) {
      user = await User.findOne({ email: userEmail }).select("-password").lean();
    }

    if (!user) {
      // token might contain full user data (rare) — fall back to attaching decoded payload
      // but deny access since we prefer authoritative DB-backed user
      return res.status(401).json({ error: "Invalid or expired token (user not found)" });
    }

    req.userId = String(user._id);
    req.user = user;
    return next();
  } catch (err) {
    // token decode/verify errors or DB issues
    // keep the error message generic for security
    // eslint-disable-next-line no-console
    console.warn("authMiddleware.verifyToken error:", err?.message || err);
    return res.status(401).json({ error: "Invalid/expired token" });
  }
}

module.exports = { verifyToken, extractToken };
