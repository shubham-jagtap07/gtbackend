const { pool } = require('./config/database');
const shiprocketService = require('./services/shiprocket');

// Test order creation with Shiprocket order registration (no shipment)
async function testOrderOnlyShiprocket() {
  console.log('🧪 Testing Order Creation with Shiprocket Registration (No Shipment)...\n');

  try {
    // Simulate the order creation process
    const orderData = {
      name: 'Jaywant Namdeora Mhala',
      phone: '919527243062',
      street: 'City vista, Fountain road, Kharadi',
      landmark: 'Near IT Park',
      city: 'Pune',
      taluka: 'Pune',
      district: 'Pune',
      state: 'Maharashtra',
      pincode: '411014',
      product: 'Gulacha Chaha Pack',
      image: '/images/gram500.webp',
      weight: '900g',
      price: 500,
      qty: 2,
      payment: 'cod',
      special_instructions: 'Test order with Shiprocket registration only'
    };

    console.log('📦 Creating order with data:');
    console.log(`Customer: ${orderData.name}`);
    console.log(`Phone: ${orderData.phone}`);
    console.log(`Product: ${orderData.product} x ${orderData.qty} (${orderData.weight})`);
    console.log(`Payment: ${orderData.payment.toUpperCase()}`);
    console.log('');

    // Step 1: Create order in database
    const orderNumber = `ORD${Date.now()}`;
    
    const items = [{
      name: orderData.product,
      price: Number(orderData.price),
      quantity: Number(orderData.qty),
      weight: orderData.weight || null,
      image1: orderData.image || null,
      image2: orderData.image || null,
    }];

    const subtotal = Number(orderData.price) * Number(orderData.qty);
    const total_amount = subtotal;

    const delivery_address = {
      street: orderData.street,
      landmark: orderData.landmark || '',
      city: orderData.city,
      taluka: orderData.taluka,
      district: orderData.district,
      state: orderData.state || 'Maharashtra',
      pincode: orderData.pincode,
    };

    const payment_method = orderData.payment === 'cod' ? 'cash' : orderData.payment;

    const sql = `INSERT INTO orders 
      (order_number, customer_name, customer_phone, items, subtotal, tax_amount, discount_amount, total_amount, status, payment_status, payment_method, order_type, delivery_address, special_instructions, order_date, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'pending', $9, 'delivery', $10, $11, NOW(), NOW(), NOW())
      RETURNING id`;

    const params = [
      orderNumber,
      orderData.name,
      orderData.phone,
      JSON.stringify(items),
      subtotal,
      0, // tax_amount
      0, // discount_amount
      total_amount,
      payment_method,
      JSON.stringify(delivery_address),
      orderData.special_instructions || null,
    ];

    console.log('💾 Inserting order into database...');
    const { rows } = await pool.query(sql, params);
    const orderId = rows[0].id;
    console.log(`✅ Order created with ID: ${orderId} and Order Number: ${orderNumber}`);

    // Step 2: Create order in Shiprocket (no shipment)
    console.log('\n🚀 Registering order with Shiprocket...');
    try {
      const order = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
      const dbOrderData = order.rows[0];
      
      // Transform order data to Shiprocket format
      const shiprocketOrderData = shiprocketService.transformOrderData(dbOrderData);
      console.log('📋 Shiprocket order data prepared:');
      console.log(`  - Order ID: ${shiprocketOrderData.order_id}`);
      console.log(`  - Customer: ${shiprocketOrderData.shipping_customer_name} ${shiprocketOrderData.shipping_last_name}`);
      console.log(`  - Weight: ${shiprocketOrderData.weight} kg`);
      console.log(`  - Payment: ${shiprocketOrderData.payment_method}`);
      
      // Create order in Shiprocket
      const shiprocketResponse = await shiprocketService.createOrder(shiprocketOrderData);
      
      // Update order with Shiprocket order ID only
      await pool.query(
        'UPDATE orders SET shiprocket_order_id = $1, updated_at = NOW() WHERE id = $2',
        [shiprocketResponse.order_id, orderId]
      );

      console.log('✅ Order registered with Shiprocket successfully!');
      console.log('Shiprocket Response:');
      console.log(`  - Shiprocket Order ID: ${shiprocketResponse.order_id}`);
      console.log(`  - Status: ${shiprocketResponse.status || 'CREATED'}`);
      console.log(`  - Channel Order ID: ${shiprocketOrderData.order_id}`);

      // Verify no shipment was created
      if (!shiprocketResponse.shipment_id) {
        console.log('✅ Confirmed: No shipment was created (as expected)');
      } else {
        console.log('⚠️  Warning: Shipment was created unexpectedly');
      }

      console.log('\n🎉 SUCCESS: Order created and registered with Shiprocket (no shipment)!');
      
    } catch (shiprocketError) {
      console.error('⚠️  Shiprocket registration failed:', shiprocketError.message);
      console.log('Order was created successfully but Shiprocket registration failed.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the test
testOrderOnlyShiprocket();
