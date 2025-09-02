// middleware/requireAuth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'changemeverywhereelse';

/**
 * Extract a JWT from the request, preferring the httpOnly cookie ("token"),
 * then falling back to Authorization: Bearer <token>.
 */
function getTokenFromRequest(req) {
  const cookieToken = (req.cookies && req.cookies.token) || (req.signedCookies && req.signedCookies.token);
  if (cookieToken && typeof cookieToken === 'string') return cookieToken;

  const hdr = req.headers['authorization'] || req.headers['Authorization'];
  if (hdr && typeof hdr === 'string') {
    const parts = hdr.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  }
  return null;
}

/**
 * Verifies JWT and attaches { _id, id, username?, email? } to req.user.
 * Accepts payloads with uid | id | _id (your login uses "uid").
 */
function requireAuth(req, res, next) {
  if (req.method === 'OPTIONS') return next();

  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const uid = decoded.uid || decoded.userId || decoded.id || decoded._id; // <-- accept "uid"
    if (!uid) return res.status(401).json({ error: 'Invalid token payload' });

    // Normalize to a consistent shape used by the FE
    req.user = {
      _id: String(uid),
      id: String(uid),
      username: decoded.username, // if present
      email: decoded.email,       // if present
    };
    req.userId = req.user._id; // convenience alias

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Backwards compatibility export
module.exports = requireAuth;
module.exports.protect = requireAuth;
