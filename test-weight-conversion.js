const shiprocketService = require('./services/shiprocket');

// Test weight conversion functionality
console.log('🧪 Testing Weight Conversion Functionality\n');

const testWeights = [
  '900g',      // 900 grams -> 0.9 kg
  '500g',      // 500 grams -> 0.5 kg
  '1200g',     // 1200 grams -> 1.2 kg
  '900',       // 900 (assumed grams) -> 0.9 kg
  '1500',      // 1500 (assumed grams) -> 1.5 kg
  '1.2kg',     // 1.2 kg -> 1.2 kg
  '2.5kg',     // 2.5 kg -> 2.5 kg
  '1.2',       // 1.2 (assumed grams) -> 0.0012 kg (will use default)
  '',          // empty -> default 1.2 kg
  null,        // null -> default 1.2 kg
  undefined,   // undefined -> default 1.2 kg
  '0g',        // 0 grams -> default 1.2 kg
  'invalid'    // invalid -> default 1.2 kg
];

testWeights.forEach((weight, index) => {
  const convertedWeight = shiprocketService.convertWeightToKg(weight);
  console.log(`Test ${index + 1}: "${weight}" -> ${convertedWeight} kg`);
});

console.log('\n✅ Weight conversion tests completed!');

// Test with actual order data transformation
console.log('\n🧪 Testing with Order Data Transformation...\n');

const testOrder = {
  customer_name: 'Test Customer',
  customer_phone: '9876543210',
  items: JSON.stringify([{
    name: 'Gulacha Chaha Pack',
    price: 500,
    quantity: 2,
    weight: '900g'  // This should be converted to 0.9 kg
  }]),
  subtotal: 1000,
  total_amount: 1000,
  payment_method: 'cash',
  delivery_address: JSON.stringify({
    street: 'Test Street',
    city: 'Test City',
    state: 'Maharashtra',
    pincode: '411014'
  })
};

try {
  const transformedData = shiprocketService.transformOrderData(testOrder);
  console.log('Transformed weight for Shiprocket:', transformedData.weight, 'kg');
  console.log('Original weight from order:', JSON.parse(testOrder.items)[0].weight);
  console.log('\n✅ Order transformation test completed!');
} catch (error) {
  console.error('❌ Order transformation test failed:', error.message);
}
