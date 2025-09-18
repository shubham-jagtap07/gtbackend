const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Get all inquiries (admin only)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        id,
        name,
        phone,
        email,
        city,
        subject,
        message,
        source,
        status,
        created_at,
        updated_at
      FROM inquiries 
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Error fetching inquiries:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching inquiries'
    });
  }
});

// Create new inquiry (public endpoint)
router.post('/', [
  body('name').optional().trim().isLength({ min: 1 }).withMessage('Name must be at least 1 character'),
  body('phone').trim().isLength({ min: 10, max: 15 }).matches(/^[0-9+\-\s()]+$/).withMessage('Phone number must be 10-15 characters and contain only numbers, +, -, spaces, or parentheses'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('city').optional().trim(),
  body('subject').optional().trim(),
  body('message').optional().trim(),
  body('source').optional().isIn(['popup', 'contact']).withMessage('Source must be popup or contact')
], async (req, res) => {
  try {
    console.log('=== INQUIRY SUBMISSION ===');
    console.log('Request body:', req.body);
    
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      name,
      phone,
      email,
      city,
      subject,
      message,
      source
    } = req.body;

    console.log('Inserting inquiry with data:', {
      name: name || '',
      phone,
      email: email || '',
      city: city || '',
      subject: subject || '',
      message: message || '',
      source: source || 'popup',
      status: 'new'
    });

    const result = await pool.query(`
      INSERT INTO inquiries (
        name, phone, email, city, subject, message, source, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      name || '',
      phone,
      email || '',
      city || '',
      subject || '',
      message || '',
      source || 'popup',
      'new'
    ]);

    console.log('Inquiry created successfully with ID:', result.rows[0].id);

    res.status(201).json({
      success: true,
      message: 'Inquiry submitted successfully',
      data: {
        id: result.rows[0].id
      }
    });

  } catch (error) {
    console.error('Error creating inquiry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating inquiry'
    });
  }
});

// Update inquiry status (admin only)
router.put('/:id/status', verifyToken, [
  body('status').isIn(['new', 'contacted', 'resolved', 'closed']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    // Check if inquiry exists
    const existing = await pool.query('SELECT id FROM inquiries WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inquiry not found'
      });
    }

    await pool.query(
      'UPDATE inquiries SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );

    res.json({
      success: true,
      message: 'Inquiry status updated successfully'
    });

  } catch (error) {
    console.error('Error updating inquiry status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating inquiry'
    });
  }
});

// Delete inquiry (admin only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if inquiry exists
    const existing = await pool.query('SELECT id FROM inquiries WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inquiry not found'
      });
    }

    await pool.query('DELETE FROM inquiries WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Inquiry deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting inquiry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting inquiry'
    });
  }
});

module.exports = router;
