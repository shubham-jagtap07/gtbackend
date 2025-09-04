const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Get all products (public endpoint)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        id,
        name,
        description,
        price,
        original_price,
        image_url,
        weight,
        category,
        features,
        rating,
        reviews,
        tags,
        stock_quantity,
        is_active,
        is_popular,
        created_at,
        updated_at
      FROM products 
      WHERE is_active = true 
      ORDER BY is_popular DESC, created_at DESC
    `);

    // Helper to safely parse JSON or fall back to comma-separated values
    const parseMaybeJsonArray = (val) => {
      if (val == null) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'object') return val;
      try {
        return JSON.parse(val);
      } catch (e) {
        // Fallback: split by comma if it's a simple string like "a,b,c"
        return String(val)
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }
    };

    // Parse JSON fields
    const products = rows.map(product => ({
      ...product,
      features: parseMaybeJsonArray(product.features),
      tags: parseMaybeJsonArray(product.tags)
    }));

    res.json({
      success: true,
      data: products
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching products'
    });
  }
});

// Get single product by ID (public endpoint)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(`
      SELECT 
        id,
        name,
        description,
        price,
        original_price,
        image_url,
        weight,
        category,
        features,
        rating,
        reviews,
        tags,
        stock_quantity,
        is_active,
        is_popular,
        created_at,
        updated_at
      FROM products 
      WHERE id = $1 AND is_active = true
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const parseMaybeJsonArray = (val) => {
      if (val == null) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'object') return val;
      try {
        return JSON.parse(val);
      } catch (e) {
        return String(val)
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }
    };

    const product = {
      ...rows[0],
      features: parseMaybeJsonArray(rows[0].features),
      tags: parseMaybeJsonArray(rows[0].tags)
    };

    res.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching product'
    });
  }
});

// Admin endpoints (require authentication)

// Get all products for admin (including inactive)
router.get('/admin/all', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        id,
        name,
        description,
        price,
        original_price,
        image_url,
        weight,
        category,
        features,
        rating,
        reviews,
        tags,
        stock_quantity,
        is_active,
        is_popular,
        created_at,
        updated_at
      FROM products 
      ORDER BY created_at DESC
    `);

    // Parse JSON fields safely
    const parseMaybeJsonArray = (val) => {
      if (val == null) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'object') return val;
      try {
        return JSON.parse(val);
      } catch (e) {
        return String(val)
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }
    };

    const products = rows.map(product => ({
      ...product,
      features: parseMaybeJsonArray(product.features),
      tags: parseMaybeJsonArray(product.tags)
    }));

    res.json({
      success: true,
      data: products
    });

  } catch (error) {
    console.error('Error fetching admin products:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching products'
    });
  }
});

// Create new product
router.post('/', verifyToken, [
  body('name').trim().isLength({ min: 1 }).withMessage('Product name is required'),
  body('description').trim().isLength({ min: 1 }).withMessage('Description is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('original_price').optional().isFloat({ min: 0 }).withMessage('Original price must be a positive number'),
  body('image_url').trim().isLength({ min: 1 }).withMessage('Image URL is required'),
  body('weight').optional().trim(),
  body('category').optional().trim(),
  body('features').optional().isArray(),
  body('tags').optional().isArray(),
  body('stock_quantity').optional().isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      name,
      description,
      price,
      original_price,
      image_url,
      weight,
      category,
      features,
      tags,
      stock_quantity,
      is_popular
    } = req.body;

    const result = await pool.query(`
      INSERT INTO products (
        name, description, price, original_price, image_url, weight, 
        category, features, tags, stock_quantity, is_popular
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [
      name,
      description,
      price,
      original_price || price,
      image_url,
      weight || '',
      category || 'Chai Powder',
      JSON.stringify(features || []),
      JSON.stringify(tags || []),
      stock_quantity || 0,
      Boolean(is_popular)
    ]);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        id: result.rows[0].id,
        name,
        price
      }
    });

  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating product'
    });
  }
});

// Update product
router.put('/:id', verifyToken, [
  body('name').optional().trim().isLength({ min: 1 }),
  body('description').optional().trim().isLength({ min: 1 }),
  body('price').optional().isFloat({ min: 0 }),
  body('original_price').optional().isFloat({ min: 0 }),
  body('image_url').optional().trim().isLength({ min: 1 }),
  body('weight').optional().trim(),
  body('category').optional().trim(),
  body('features').optional().isArray(),
  body('tags').optional().isArray(),
  body('stock_quantity').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
  body('is_popular').optional().isBoolean()
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
    const updates = req.body;

    // Check if product exists
    const existing = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        if (key === 'features' || key === 'tags') {
          updateFields.push(`${key} = $${updateValues.length + 1}`);
          updateValues.push(JSON.stringify(updates[key]));
        } else {
          updateFields.push(`${key} = $${updateValues.length + 1}`);
          updateValues.push(updates[key]);
        }
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    updateValues.push(id);

    await pool.query(
      `UPDATE products 
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $${updateValues.length}`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Product updated successfully'
    });

  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating product'
    });
  }
});

// Delete product (hard delete)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product exists
    const existing = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Hard delete: permanently remove the product
    await pool.query('DELETE FROM products WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Product permanently deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting product'
    });
  }
});

module.exports = router;
