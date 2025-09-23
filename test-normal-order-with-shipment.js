const axios = require('axios');

// Test the normal order creation API with automatic shipment creation
async function testNormalOrderWithShipment() {
  console.log('🧪 Testing Normal Order Creation with Automatic Shipment...\n');

  const testOrderData = {
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
    special_instructions: 'Test order with automatic shipment creation'
  };

  try {
    console.log('📦 Creating order with data:');
    console.log(JSON.stringify(testOrderData, null, 2));
    console.log('\n🚀 Sending request to POST /api/orders...\n');

    // Assuming your server is running on localhost:3000
    // Adjust the URL according to your server configuration
    const response = await axios.post('http://localhost:3000/api/orders', testOrderData);

    console.log('✅ Response received:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    if (response.data.success) {
      if (response.data.data.shipment) {
        console.log('\n🎉 SUCCESS: Order created and shipment initiated automatically!');
        console.log('Order Number:', response.data.data.order_number);
        console.log('Shipment ID:', response.data.data.shipment.shipment_id);
        console.log('Shiprocket Order ID:', response.data.data.shipment.order_id);
      } else if (response.data.data.shipment_error) {
        console.log('\n⚠️  PARTIAL SUCCESS: Order created but shipment failed');
        console.log('Order Number:', response.data.data.order_number);
        console.log('Shipment Error:', response.data.data.shipment_error);
      }
    } else {
      console.log('❌ Order creation failed:', response.data.message);
    }

  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    console.log('\n💡 Make sure your server is running on the correct port!');
  }
}

// Run the test
testNormalOrderWithShipment();
