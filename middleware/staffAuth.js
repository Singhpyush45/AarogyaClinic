// middleware/staffAuth.js
const jwt = require('jsonwebtoken');

// requireStaffRole(['doctor']) or requireStaffRole(['doctor','billing']) etc.
function requireStaffRole(allowedRoles) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = headerToken || req.query.token || null;

    if (!token) {
      return res.status(401).json({ error: 'Login required.' });
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.type !== 'staff' || !allowedRoles.includes(payload.role)) {
        return res.status(403).json({ error: 'You do not have access to this section.' });
      }
      req.staff = payload; // { type: 'staff', staffId, username, role }
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
  };
}

module.exports = { requireStaffRole };
