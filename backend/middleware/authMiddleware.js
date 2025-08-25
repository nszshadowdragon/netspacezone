// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

/** Get a JWT from cookies or Authorization header */
function extractToken(req) {
  if (req.cookies?.token) return req.cookies.token;

  const auth = req.get("authorization") || req.get("Authorization");
  if (!auth) return null;
  const parts = auth.trim().split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return auth.trim();
}

function verifyToken(req, res, next) {
  if (req.method === "OPTIONS") return next();

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const secret = process.env.JWT_SECRET || "dev-secret"; // align with routes
    const decoded = jwt.verify(token, secret);
    req.userId = decoded.id || decoded._id || decoded.userId;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid/expired token" });
  }
}

module.exports = { verifyToken };
