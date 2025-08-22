// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

/**
 * Try to extract a JWT from cookies or Authorization header.
 */
function extractToken(req) {
  // Prefer cookie set by the backend (e.g., res.cookie('token', ...))
  if (req.cookies && req.cookies.token) return req.cookies.token;

  // Fallback: Authorization header (Bearer <token> or raw token)
  const auth = req.get("authorization") || req.get("Authorization");
  if (!auth) return null;

  const parts = auth.trim().split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return auth.trim();
}

function authMiddleware(req, res, next) {
  // Let CORS preflight through so browsers can proceed
  if (req.method === "OPTIONS") return next();

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // normalize the id field, just in case the payload uses a different key
    req.userId = decoded.id || decoded._id || decoded.userId;
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid/expired token" });
  }
}

module.exports = authMiddleware;
