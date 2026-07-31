// middleware/auth.js
const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  // also accept ?token=... — needed for plain <a href> download links,
  // which can't set custom headers
  const token = headerToken || req.query.token || null;

  if (!token) {
    return res.status(401).json({ error: 'Login required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

module.exports = { requireAdmin };
