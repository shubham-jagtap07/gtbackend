const { pool } = require('./config/database');
const shiprocketService = require('./services/shiprocket');

// Test direct order creation with automatic shipment (without HTTP server)
async function testDirectOrderCreation() {
  console.log('🧪 Testing Direct Order Creation with Automatic Shipment...\n');

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
      weight: '1.2',
      price: 500,
      qty: 2,
      payment: 'cod',
      special_instructions: 'Direct test order with automatic shipment creation'
    };

    console.log('📦 Creating order with data:');
    console.log(`Customer: ${orderData.name}`);
    console.log(`Phone: ${orderData.phone}`);
    console.log(`Address: ${orderData.street}, ${orderData.city}, ${orderData.state} - ${orderData.pincode}`);
    console.log(`Product: ${orderData.product} x ${orderData.qty}`);
    console.log(`Payment: ${orderData.payment.toUpperCase()}`);
    console.log('');

    // Step 1: Create order in database (simulating the API logic)
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

    // Step 2: Create shipment in Shiprocket
    console.log('\n🚀 Creating shipment in Shiprocket...');
    try {
      const shipmentResult = await shiprocketService.createShipmentForOrder(orderId);
      
      console.log('✅ Shipment created successfully!');
      console.log('Shipment Details:');
      console.log(`  - Shiprocket Order ID: ${shipmentResult.data.order_id}`);
      console.log(`  - Shipment ID: ${shipmentResult.data.shipment_id}`);
      console.log(`  - Status: ${shipmentResult.data.status}`);
      console.log(`  - Channel Order ID: ${shipmentResult.data.channel_order_id}`);

      console.log('\n🎉 SUCCESS: Order created and shipment initiated automatically!');
      
    } catch (shipmentError) {
      console.error('⚠️  Shipment creation failed:', shipmentError.message);
      console.log('Order was created successfully but shipment creation failed.');
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
testDirectOrderCreation();
