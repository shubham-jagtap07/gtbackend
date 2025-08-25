const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Verify JWT token (disabled: always allow and attach a default admin)
const verifyToken = async (req, res, next) => {
  req.admin = {
    id: 0,
    email: 'guest@local',
    name: 'Admin',
    role: 'admin',
    is_active: true,
  };
  return next();
};

// Check if user is admin
const isAdmin = (req, res, next) => next();

module.exports = {
  verifyToken,
  isAdmin
};
