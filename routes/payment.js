const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const EasebuzzUtils = require('../utils/easebuzz');

const easebuzz = new EasebuzzUtils();

// POST /api/payment/initiate -> initiate payment with Easebuzz
router.post('/initiate', async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
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
      special_instructions,
    } = req.body || {};

    // Validate required fields
    const requiredFields = { name, phone, email, street, city, taluka, district, pincode, product, price, qty };
    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);
    
    if (missingFields.length > 0) {
      console.log('Missing fields:', missingFields);
      console.log('Received payload:', req.body);
      return res.status(400).json({ 
        success: false, 
        message: `Missing required fields: ${missingFields.join(', ')}. Please provide all customer and product details.` 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid email address.' 
      });
    }

    // Generate order number
    const orderNumber = `ORD${Date.now()}`;

    // Calculate amounts
    const subtotal = Number(price) * Number(qty);
    const tax_amount = 0.0;
    const discount_amount = 0.0;
    const total_amount = subtotal + tax_amount - discount_amount;

    // Prepare order data for database
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

    const delivery_address = {
      street,
      landmark: landmark || '',
      city,
      taluka,
      district,
      state: state || 'Maharashtra',
      pincode,
    };

    // Save order to database with pending status
    const sql = `INSERT INTO orders 
      (order_number, customer_name, customer_phone, items, subtotal, tax_amount, discount_amount, total_amount, status, payment_status, payment_method, order_type, delivery_address, special_instructions, order_date, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'pending', 'online', 'delivery', $9, $10, NOW(), NOW(), NOW())
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
      JSON.stringify(delivery_address),
      special_instructions || null,
    ];

    const result = await pool.query(sql, params);
    const orderId = result.rows[0].id;

    // Prepare payment parameters for Easebuzz
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const backendBase = process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 5001}`;
    const paymentData = {
      amount: total_amount,
      customerName: (name || 'Customer').replace(/[^a-zA-Z0-9\s]/g, '').trim(),
      customerEmail: email,
      customerPhone: phone,
      productInfo: (product || 'Graduate Chai Product').replace(/[^a-zA-Z0-9\s\-\.]/g, '').trim(),
      orderId: orderNumber,
      // Always post back to backend callback so we can verify hash, then redirect to frontend
      successUrl: `${backendBase}/api/payment/callback`,
      failureUrl: `${backendBase}/api/payment/callback`
    };

    const paymentParams = easebuzz.preparePaymentParams(paymentData);

    // Store transaction details
    const txnSql = `INSERT INTO payment_transactions 
      (order_id, transaction_id, amount, status, payment_gateway, created_at, updated_at)
      VALUES ($1, $2, $3, 'initiated', 'easebuzz', NOW(), NOW())`;
    
    await pool.query(txnSql, [orderId, paymentParams.txnid, total_amount]);

    // Call Easebuzz Initiate Payment API to get access key
    const isProduction = process.env.PAYMENT_ENV === 'production';
    const initiateUrl = isProduction 
      ? 'https://pay.easebuzz.in/payment/initiateLink' 
      : 'https://testpay.easebuzz.in/payment/initiateLink';

    try {
      const response = await fetch(initiateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(paymentParams).toString()
      });

      const apiResponse = await response.json();
      
      if (apiResponse.status === 1) {
        const accessKey = apiResponse.data;
        const basePaymentUrl = isProduction ? 'https://pay.easebuzz.in/pay' : 'https://testpay.easebuzz.in/pay';
        
        return res.json({ 
          success: true, 
          message: 'Payment initiated successfully',
          data: {
            order_number: orderNumber,
            payment_url: basePaymentUrl,
            access_key: accessKey,
            data: accessKey
          }
        });
      } else {
        throw new Error(`Easebuzz API error: ${apiResponse.error_desc || 'Unknown error'}`);
      }
    } catch (apiError) {
      console.error('Easebuzz API call failed:', apiError);
      // Fallback to direct form submission if API fails
      return res.json({ 
        success: true, 
        message: 'Payment initiated successfully',
        data: {
          order_number: orderNumber,
          payment_url: easebuzz.getPaymentUrl(),
          payment_params: paymentParams
        }
      });
    }

  } catch (err) {
    console.error('Payment initiation error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to initiate payment. Please try again.' 
    });
  }
});

// POST /api/payment/callback -> handle payment callback from Easebuzz
// Easebuzz may redirect with POST (server-to-server) OR GET (browser redirect) depending on flow
router.all('/callback', async (req, res) => {
  try {
    const paymentResponse = req.method === 'POST' ? req.body : req.query;
    
    // Verify hash
    if (!easebuzz.verifyHash(paymentResponse)) {
      console.error('Hash verification failed:', paymentResponse);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment response' 
      });
    }

    const { txnid, status, amount, udf1: orderNumber, easepayid } = paymentResponse;

    // Update order status based on payment status
    let orderStatus = 'pending';
    let paymentStatus = 'pending';

    if (status === 'success') {
      orderStatus = 'confirmed';
      paymentStatus = 'completed';
    } else if (status === 'failure') {
      orderStatus = 'cancelled';
      paymentStatus = 'failed';
    }

    // Update order in database
    const updateOrderSql = `UPDATE orders 
      SET status = $1, payment_status = $2, updated_at = NOW() 
      WHERE order_number = $3`;
    
    await pool.query(updateOrderSql, [orderStatus, paymentStatus, orderNumber]);

    // Update transaction record
    const updateTxnSql = `UPDATE payment_transactions 
      SET status = $1, gateway_transaction_id = $2, gateway_response = $3, updated_at = NOW() 
      WHERE transaction_id = $4`;
    
    await pool.query(updateTxnSql, [
      paymentStatus, 
      easepayid || null, 
      JSON.stringify(paymentResponse), 
      txnid
    ]);

    // Redirect based on payment status
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/payment/success?order=${encodeURIComponent(orderNumber || '')}&txn=${encodeURIComponent(txnid || '')}`;
    const failureUrl = `${baseUrl}/payment/failure?order=${encodeURIComponent(orderNumber || '')}&txn=${encodeURIComponent(txnid || '')}`;
    if (status === 'success') {
      return res.redirect(successUrl);
    } else {
      return res.redirect(failureUrl);
    }
  
  } catch (err) {
    console.error('Payment callback error:', err);
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${baseUrl}/payment/failure?error=callback_failed`);
  }
});

// GET /api/payment/status/:txnid -> check payment status
router.get('/status/:txnid', async (req, res) => {
  try {
    const { txnid } = req.params;

    // Get transaction from database
    const txnQuery = `SELECT pt.*, o.order_number, o.status as order_status 
      FROM payment_transactions pt 
      JOIN orders o ON pt.order_id = o.id 
      WHERE pt.transaction_id = $1`;
    
    const result = await pool.query(txnQuery, [txnid]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }

    const transaction = result.rows[0];

    return res.json({ 
      success: true, 
      data: {
        transaction_id: transaction.transaction_id,
        order_number: transaction.order_number,
        amount: transaction.amount,
        status: transaction.status,
        order_status: transaction.order_status,
        created_at: transaction.created_at
      }
    });

  } catch (err) {
    console.error('Payment status check error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to check payment status' 
    });
  }
});

// POST /api/payment/verify -> verify payment with Easebuzz API
router.post('/verify', async (req, res) => {
  try {
    const { txnid } = req.body;

    if (!txnid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Transaction ID is required' 
      });
    }

    // Prepare verification request
    const verificationData = {
      key: easebuzz.key,
      txnid: txnid,
      hash: easebuzz.generateStatusHash(txnid)
    };

    // Make API call to Easebuzz (you would implement this with axios or fetch)
    // For now, return the local database status
    const txnQuery = `SELECT * FROM payment_transactions WHERE transaction_id = $1`;
    const result = await pool.query(txnQuery, [txnid]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }

    const transaction = result.rows[0];

    return res.json({ 
      success: true, 
      data: {
        transaction_id: transaction.transaction_id,
        status: transaction.status,
        amount: transaction.amount,
        gateway_response: transaction.gateway_response
      }
    });

  } catch (err) {
    console.error('Payment verification error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to verify payment' 
    });
  }
});

module.exports = router;
