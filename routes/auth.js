const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// Login endpoint
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 }).trim()
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Surface validation failure in a header for proxy-side debugging
      res.set('x-login-debug', 'validation_failed');
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    // Minimal safe logging (no passwords)
    console.log(`[auth/login] Attempt for`, email);

    // Find admin by email
    let rows;
    try {
      const q = await pool.query(
        'SELECT * FROM admins WHERE email = $1 AND is_active = true',
        [email]
      );
      rows = q.rows;
    } catch (dbErr) {
      console.error('[auth/login] DB query error:', dbErr?.message || dbErr);
      res.set('x-login-debug', 'db_query_error');
      return res.status(500).json({
        success: false,
        message: 'Server error during login (DB)'
      });
    }

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const admin = rows[0];

    // Check if account is locked
    if (admin.locked_until && new Date() < new Date(admin.locked_until)) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to multiple failed login attempts'
      });
    }

    // For demo purposes, we'll do simple password comparison
    // In production, you should hash passwords
    const isValidPassword = password === admin.password;

    if (!isValidPassword) {
      // Increment login attempts; lock for 30 minutes after 5th failed attempt
      try {
        await pool.query(
          `UPDATE admins 
           SET login_attempts = login_attempts + 1,
               locked_until = CASE WHEN login_attempts >= 4 THEN (NOW() + interval '30 minutes') ELSE NULL END
           WHERE id = $1`,
          [admin.id]
        );
      } catch (dbUpdateErr) {
        console.error('[auth/login] DB update error on failed attempt:', dbUpdateErr?.message || dbUpdateErr);
        res.set('x-login-debug', 'db_update_error');
        return res.status(500).json({
          success: false,
          message: 'Server error during login (DB update)'
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    try {
      await pool.query(
        'UPDATE admins SET login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
        [admin.id]
      );
    } catch (dbResetErr) {
      console.error('[auth/login] DB reset error on success:', dbResetErr?.message || dbResetErr);
      res.set('x-login-debug', 'db_reset_error');
      return res.status(500).json({
        success: false,
        message: 'Server error during login (DB reset)'
      });
    }

    // Generate JWT token
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('JWT_SECRET is not set. Please create backend/.env with JWT_SECRET.');
      res.set('x-login-debug', 'jwt_secret_missing');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: JWT secret missing. Please set JWT_SECRET in backend/.env and restart the server.'
      });
    }

    let token;
    try {
      token = jwt.sign(
        { 
          id: admin.id, 
          email: admin.email, 
          role: admin.role 
        },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );
    } catch (jwtErr) {
      console.error('[auth/login] JWT sign error:', jwtErr?.message || jwtErr);
      res.set('x-login-debug', 'jwt_sign_error');
      return res.status(500).json({
        success: false,
        message: 'Server error during login (JWT)'
      });
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    // Help proxy/frontend diagnose where the 500 originated
    res.set('x-login-error', error?.message || 'unknown_error');
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Get current admin profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, created_at, last_login FROM admins WHERE id = $1',
      [req.admin.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching profile'
    });
  }
});

// Logout endpoint (optional - mainly for client-side token removal)
router.post('/logout', verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;
