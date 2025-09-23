const shiprocketService = require('./services/shiprocket');
const { pool } = require('./config/database');

async function testShiprocketIntegration() {
  console.log('🧪 Testing Shiprocket Integration...\n');

  try {
    // Test 1: Token generation
    console.log('1. Testing token generation...');
    const token = await shiprocketService.getValidToken();
    console.log('✅ Token generated successfully');
    console.log(`Token length: ${token.length} characters\n`);

    // Test 2: Create a test order in database
    console.log('2. Creating test order...');
    const testOrderData = {
      order_number: `TEST-${Date.now()}`,
      customer_name: 'Test Customer',
      customer_phone: '9876543210',
      items: JSON.stringify([{
        name: 'Gulacha Chaha Pack',
        price: 500,
        quantity: 2,
        weight: '1.2'
      }]),
      subtotal: 1000,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: 1000,
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'cash',
      order_type: 'delivery',
      delivery_address: JSON.stringify({
        street: 'City vista, Fountain road, Kharadi',
        city: 'Pune',
        taluka: 'Pune',
        district: 'Pune',
        state: 'Maharashtra',
        pincode: '411014'
      }),
      special_instructions: 'Test order for Shiprocket integration'
    };

    const { rows } = await pool.query(
      `INSERT INTO orders 
       (order_number, customer_name, customer_phone, items, subtotal, tax_amount, discount_amount, total_amount, status, payment_status, payment_method, order_type, delivery_address, special_instructions, order_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW(), NOW())
       RETURNING id`,
      [
        testOrderData.order_number,
        testOrderData.customer_name,
        testOrderData.customer_phone,
        testOrderData.items,
        testOrderData.subtotal,
        testOrderData.tax_amount,
        testOrderData.discount_amount,
        testOrderData.total_amount,
        testOrderData.status,
        testOrderData.payment_status,
        testOrderData.payment_method,
        testOrderData.order_type,
        testOrderData.delivery_address,
        testOrderData.special_instructions
      ]
    );

    const testOrderId = rows[0].id;
    console.log(`✅ Test order created with ID: ${testOrderId}\n`);

    // Test 3: Create shipment
    console.log('3. Creating shipment in Shiprocket...');
    const shipmentResult = await shiprocketService.createShipmentForOrder(testOrderId);
    console.log('✅ Shipment created successfully');
    console.log('Shipment details:', JSON.stringify(shipmentResult.data, null, 2));

    console.log('\n🎉 All tests passed! Shiprocket integration is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the test
testShiprocketIntegration();
