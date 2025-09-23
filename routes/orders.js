const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const shiprocketService = require('../services/shiprocket');

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

    const { rows } = await pool.query(sql + ' RETURNING id', params);
    const orderId = rows[0].id;

    // Create order in Shiprocket (without shipment)
    try {
      const order = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
      const orderData = order.rows[0];
      
      // Transform order data to Shiprocket format
      const shiprocketOrderData = shiprocketService.transformOrderData(orderData);
      
      // Create order in Shiprocket using the direct API
      const shiprocketResponse = await shiprocketService.createOrder(shiprocketOrderData);
      
      // Update order with Shiprocket order ID only (no shipment data)
      await pool.query(
        'UPDATE orders SET shiprocket_order_id = $1, updated_at = NOW() WHERE id = $2',
        [shiprocketResponse.order_id, orderId]
      );

      return res.json({ 
        success: true, 
        message: 'Order created and registered with Shiprocket', 
        data: { 
          order_number: orderNumber,
          shiprocket_order_id: shiprocketResponse.order_id
        } 
      });
    } catch (shiprocketError) {
      console.error('Shiprocket order creation failed:', shiprocketError.message);
      
      // Order was created but Shiprocket registration failed
      return res.json({
        success: true,
        message: 'Order created successfully, but Shiprocket registration failed',
        data: {
          order_number: orderNumber,
          shiprocket_error: shiprocketError.message
        }
      });
    }
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/orders -> list orders (flatten first item for admin table)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, order_number, customer_name, customer_phone, items, total_amount, payment_method, status, order_date, delivery_address, 
              shiprocket_order_id, shipment_id, tracking_status, awb_code, courier_name
       FROM orders ORDER BY order_date DESC, id DESC LIMIT 200`
    );

    const data = rows.map((r) => {
      let firstItem = {};
      try { firstItem = (Array.isArray(r.items) ? r.items : JSON.parse(r.items || '[]'))[0] || {}; } catch {}

      let addr = {};
      try { addr = typeof r.delivery_address === 'object' ? r.delivery_address : JSON.parse(r.delivery_address || '{}'); } catch {}

      return {
        id: r.order_number,
        database_id: r.id,
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
        // Shiprocket fields
        shiprocket_order_id: r.shiprocket_order_id,
        shipment_id: r.shipment_id,
        tracking_status: r.tracking_status,
        awb_code: r.awb_code,
        courier_name: r.courier_name,
        has_shipment: !!r.shipment_id
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

// POST /api/orders/:orderId/create-shipment -> create shipment in Shiprocket
router.post('/:orderId/create-shipment', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }

    // Check if order exists
    const { rows } = await pool.query('SELECT id FROM orders WHERE id = $1', [orderId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const result = await shiprocketService.createShipmentForOrder(orderId);
    
    return res.json({
      success: true,
      message: 'Shipment created successfully',
      data: result.data
    });
  } catch (err) {
    console.error('Create shipment error:', err);
    return res.status(500).json({ 
      success: false, 
      message: err.message || 'Internal server error' 
    });
  }
});

// POST /api/orders/create-with-shipment -> create order and immediately create shipment
router.post('/create-with-shipment', async (req, res) => {
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

    const orderNumber = `ORD${Date.now()}`;

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

    // Create order in database
    const sql = `INSERT INTO orders 
      (order_number, customer_name, customer_phone, items, subtotal, tax_amount, discount_amount, total_amount, status, payment_status, payment_method, order_type, delivery_address, special_instructions, order_date, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'pending', $9, 'delivery', $10, $11, NOW(), NOW(), NOW())
      RETURNING id`;

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

    const { rows } = await pool.query(sql, params);
    const orderId = rows[0].id;

    // Create shipment in Shiprocket
    try {
      const shipmentResult = await shiprocketService.createShipmentForOrder(orderId);
      
      return res.json({
        success: true,
        message: 'Order created and shipment initiated successfully',
        data: {
          order_number: orderNumber,
          order_id: orderId,
          shipment: shipmentResult.data
        }
      });
    } catch (shipmentError) {
      console.error('Shipment creation failed:', shipmentError);
      
      // Order was created but shipment failed - return partial success
      return res.json({
        success: true,
        message: 'Order created successfully, but shipment creation failed',
        data: {
          order_number: orderNumber,
          order_id: orderId,
          shipment_error: shipmentError.message
        }
      });
    }
  } catch (err) {
    console.error('Create order with shipment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/orders/:orderId/tracking -> get tracking details
router.get('/:orderId/tracking', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Get order with shipment details
    const { rows } = await pool.query(
      'SELECT shipment_id, tracking_status, awb_code, courier_name FROM orders WHERE id = $1',
      [orderId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = rows[0];

    if (!order.shipment_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'No shipment found for this order' 
      });
    }

    // Get tracking details from Shiprocket
    const trackingData = await shiprocketService.getTrackingDetails(order.shipment_id);

    return res.json({
      success: true,
      data: {
        shipment_id: order.shipment_id,
        tracking_status: order.tracking_status,
        awb_code: order.awb_code,
        courier_name: order.courier_name,
        tracking_details: trackingData
      }
    });
  } catch (err) {
    console.error('Get tracking error:', err);
    return res.status(500).json({ 
      success: false, 
      message: err.message || 'Internal server error' 
    });
  }
});

// GET /api/orders/shiprocket/token -> get current token status (for debugging)
router.get('/shiprocket/token', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT expires_at, created_at FROM shiprocket_tokens WHERE expires_at > NOW() ORDER BY created_at DESC LIMIT 1'
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: { has_valid_token: false, message: 'No valid token found' }
      });
    }

    return res.json({
      success: true,
      data: {
        has_valid_token: true,
        expires_at: rows[0].expires_at,
        created_at: rows[0].created_at
      }
    });
  } catch (err) {
    console.error('Get token status error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
