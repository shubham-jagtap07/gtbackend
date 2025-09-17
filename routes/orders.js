const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Map frontend payment to DB enum
const mapPaymentMethod = (method) => {
  switch ((method || '').toLowerCase()) {
    case 'cod':
      return 'cash';
    case 'upi':
      return 'upi';
    case 'card':
      return 'card';
    case 'wallet':
      return 'wallet';
    default:
      return 'cash';
  }
};

// POST /api/orders -> create order
router.post('/', async (req, res) => {
  try {
    const {
      name,
      phone,
      street,
      landmark,
      city,
      taluka,
      district,
      state,
      pincode,
      product,
      image,
      image2,
      weight,
      price,
      qty,
      payment,
      special_instructions,
    } = req.body || {};

    if (!name || !phone || !street || !city || !taluka || !district || !pincode || !product || !price || !qty) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const orderNumber = `ORD${Date.now()}`; // simple unique generator

    const items = [
      {
        name: product,
        price: Number(price),
        quantity: Number(qty),
        weight: weight || null,
        image1: image || null,
        image2: image2 || image || null,
      },
    ];

    const subtotal = Number(price) * Number(qty);
    const tax_amount = 0.0;
    const discount_amount = 0.0;
    const total_amount = subtotal + tax_amount - discount_amount;

    const delivery_address = {
      street,
      landmark: landmark || '',
      city,
      taluka,
      district,
      state: state || 'Maharashtra',
      pincode,
    };

    const payment_method = mapPaymentMethod(payment);

    const sql = `INSERT INTO orders 
      (order_number, customer_name, customer_phone, items, subtotal, tax_amount, discount_amount, total_amount, status, payment_status, payment_method, order_type, delivery_address, special_instructions, order_date, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'pending', $9, 'delivery', $10, $11, NOW(), NOW(), NOW())`;

    const params = [
      orderNumber,
      name,
      phone,
      JSON.stringify(items),
      subtotal,
      tax_amount,
      discount_amount,
      total_amount,
      payment_method,
      JSON.stringify(delivery_address),
      special_instructions || null,
    ];

    await pool.query(sql, params);

    return res.json({ success: true, message: 'Order created', data: { order_number: orderNumber } });
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/orders -> list orders (flatten first item for admin table)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, order_number, customer_name, customer_phone, items, total_amount, payment_method, status, order_date, delivery_address
       FROM orders ORDER BY order_date DESC, id DESC LIMIT 200`
    );

    const data = rows.map((r) => {
      let firstItem = {};
      try { firstItem = (Array.isArray(r.items) ? r.items : JSON.parse(r.items || '[]'))[0] || {}; } catch {}

      let addr = {};
      try { addr = typeof r.delivery_address === 'object' ? r.delivery_address : JSON.parse(r.delivery_address || '{}'); } catch {}

      return {
        id: r.order_number,
        customer: r.customer_name,
        mobile: r.customer_phone,
        address: [addr.street, addr.city, addr.taluka, addr.district, addr.state, addr.pincode]
          .filter(Boolean)
          .join(', '),
        product: firstItem.name || 'Item',
        quantity: Number(firstItem.quantity || 1),
        weight: firstItem.weight || null,
        price: Number(firstItem.price || 0),
        total: Number(r.total_amount || 0),
        payment: r.payment_method === 'cash' ? 'COD' : (r.payment_method || '').toUpperCase(),
        status: (r.status || 'pending').replace(/\b\w/g, (c) => c.toUpperCase()),
        date: r.order_date ? new Date(r.order_date).toISOString().slice(0, 10) : '',
        image1: firstItem.image1 || null,
        image2: firstItem.image2 || null,
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('List orders error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/orders/summary -> simple totals
router.get('/summary', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
         COUNT(*)::int AS total_orders,
         COALESCE(SUM(total_amount), 0) AS revenue,
         SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END)::int AS pending_orders,
         SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END)::int AS delivered_orders
       FROM orders`
    );

    const row = rows && rows[0] ? rows[0] : {};
    return res.json({ success: true, data: {
      total_orders: Number(row.total_orders || 0),
      revenue: Number(row.revenue || 0),
      pending_orders: Number(row.pending_orders || 0),
      delivered_orders: Number(row.delivered_orders || 0),
    }});
  } catch (err) {
    console.error('Summary error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/orders/:orderNumber -> delete specific order
router.delete('/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params || {};
    if (!orderNumber) {
      return res.status(400).json({ success: false, message: 'orderNumber is required' });
    }

    const { rowCount } = await pool.query(
      'DELETE FROM orders WHERE order_number = $1',
      [orderNumber]
    );

    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.json({ success: true, message: 'Order deleted' });
  } catch (err) {
    console.error('Delete order error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
