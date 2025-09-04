const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Verify JWT token from Authorization header and attach admin to req
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Missing Authorization header' });
    }

    const parts = authHeader.split(' ');
    const token = parts.length === 2 ? parts[1] : parts[0];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Invalid Authorization header' });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('JWT_SECRET is not set.');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    // Verify token and decode payload
    const decoded = jwt.verify(token, JWT_SECRET);

    // Optionally fetch fresh admin data and ensure active
    const { rows } = await pool.query(
      'SELECT id, name, email, role, is_active FROM admins WHERE id = $1 LIMIT 1',
      [decoded.id]
    );

    if (rows.length === 0 || rows[0].is_active !== true) {
      return res.status(401).json({ success: false, message: 'Admin not found or inactive' });
    }

    req.admin = rows[0];
    return next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError' ? 401 : 500;
    return res.status(code).json({ success: false, message: code === 401 ? 'Invalid or expired token' : 'Auth middleware error' });
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.admin || req.admin.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin role required' });
  }
  return next();
};

module.exports = {
  verifyToken,
  isAdmin,
};
