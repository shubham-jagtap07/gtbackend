const { generateHash, verifyHash, generateTransactionId, preparePaymentParams } = require('./utils/easebuzz');

// Test the Easebuzz utility functions
console.log('Testing Easebuzz Integration...\n');

// Test environment variables
console.log('Environment Variables:');
console.log('EASEBUZZ_KEY:', process.env.EASEBUZZ_KEY || 'Not set');
console.log('EASEBUZZ_SALT:', process.env.EASEBUZZ_SALT || 'Not set');
console.log('PAYMENT_ENV:', process.env.PAYMENT_ENV || 'Not set');
console.log('');

// Test transaction ID generation
const txnid = generateTransactionId();
console.log('Generated Transaction ID:', txnid);
console.log('');

// Test payment parameters preparation
const testParams = {
  txnid: txnid,
  amount: 500,
  productinfo: 'Chai Sukh - 500g',
  firstname: 'Test User',
  email: 'test@graduatechai.in',
  phone: '9876543210',
  address1: 'Test Address, Test City, Test District, Maharashtra - 411001',
  udf1: 'Test Street',
  udf2: 'Test City',
  udf3: 'Test District',
  udf4: '411001',
  udf5: '2'
};

console.log('Test Payment Parameters:');
console.log(JSON.stringify(testParams, null, 2));
console.log('');

// Test hash generation
const hash = generateHash(testParams);
console.log('Generated Hash:', hash);
console.log('');

// Test payment params preparation
const paymentParams = preparePaymentParams(testParams);
console.log('Final Payment Parameters:');
console.log(JSON.stringify(paymentParams, null, 2));
console.log('');

// Test hash verification
const isValid = verifyHash(paymentParams, hash);
console.log('Hash Verification:', isValid ? 'VALID' : 'INVALID');
console.log('');

console.log('✅ Easebuzz integration test completed!');
console.log('');
console.log('Test Card Details for Easebuzz:');
console.log('MasterCard: 5553 0422 4198 4105, Expiry: 07/2028, CVV: 123');
console.log('Visa: 4012 8888 8888 1881, Expiry: 07/2028, CVV: 123');
console.log('');
console.log('Test UPI IDs:');
console.log('Success: success@easebuzz');
console.log('Failure: failure@easebuzz');
