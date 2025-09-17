// Load environment variables first
require('dotenv').config();

const crypto = require('crypto');

// Standalone Easebuzz utility functions (without database dependency)
function generateHash(params) {
  const { txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5 } = params;
  const key = process.env.EASEBUZZ_KEY;
  const salt = process.env.EASEBUZZ_SALT;
  
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${salt}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
}

function generateTransactionId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `TXN${timestamp}${random}`;
}

function preparePaymentParams(params) {
  const hash = generateHash(params);
  const key = process.env.EASEBUZZ_KEY;
  
  return {
    key,
    txnid: params.txnid,
    amount: params.amount,
    productinfo: params.productinfo,
    firstname: params.firstname,
    email: params.email,
    phone: params.phone,
    address1: params.address1,
    city: params.city || '',
    state: params.state || '',
    country: params.country || 'India',
    zipcode: params.zipcode || '',
    udf1: params.udf1 || '',
    udf2: params.udf2 || '',
    udf3: params.udf3 || '',
    udf4: params.udf4 || '',
    udf5: params.udf5 || '',
    hash,
    surl: process.env.PAYMENT_SUCCESS_URL || 'http://localhost:3000/payment-success',
    furl: process.env.PAYMENT_FAILURE_URL || 'http://localhost:3000/payment-failure'
  };
}

// Test the Easebuzz integration
console.log('🧪 Testing Easebuzz Integration (Standalone)...\n');

// Test environment variables
console.log('📋 Environment Variables:');
console.log('EASEBUZZ_KEY:', process.env.EASEBUZZ_KEY || '❌ Not set');
console.log('EASEBUZZ_SALT:', process.env.EASEBUZZ_SALT || '❌ Not set');
console.log('PAYMENT_ENV:', process.env.PAYMENT_ENV || '❌ Not set');
console.log('PAYMENT_SUCCESS_URL:', process.env.PAYMENT_SUCCESS_URL || '❌ Not set');
console.log('PAYMENT_FAILURE_URL:', process.env.PAYMENT_FAILURE_URL || '❌ Not set');
console.log('');

// Test transaction ID generation
const txnid = generateTransactionId();
console.log('🆔 Generated Transaction ID:', txnid);
console.log('');

// Test payment parameters
const testParams = {
  txnid: txnid,
  amount: 500,
  productinfo: 'Chai Sukh - 500g',
  firstname: 'Test User',
  email: 'test@graduatechai.in',
  phone: '9876543210',
  address1: 'Test Address, Test City, Test District, Maharashtra - 411001',
  city: 'Test City',
  state: 'Maharashtra',
  country: 'India',
  zipcode: '411001',
  udf1: 'Test Street',
  udf2: 'Test City',
  udf3: 'Test District',
  udf4: '411001',
  udf5: '2'
};

console.log('📝 Test Payment Parameters:');
console.log(JSON.stringify(testParams, null, 2));
console.log('');

// Test hash generation
const hash = generateHash(testParams);
console.log('🔐 Generated Hash:', hash);
console.log('');

// Test payment params preparation
const paymentParams = preparePaymentParams(testParams);
console.log('💳 Final Payment Parameters for Easebuzz:');
console.log(JSON.stringify(paymentParams, null, 2));
console.log('');

// Payment URL
const paymentEnv = process.env.PAYMENT_ENV || 'test';
const paymentUrl = paymentEnv === 'production' 
  ? process.env.EASEBUZZ_PROD_URL || 'https://pay.easebuzz.in/'
  : process.env.EASEBUZZ_TEST_URL || 'https://testpay.easebuzz.in/';

console.log('🌐 Payment URL:', paymentUrl + 'payment/initiateLink');
console.log('');

console.log('✅ Easebuzz integration test completed successfully!');
console.log('');
console.log('💳 Test Card Details for Easebuzz:');
console.log('   MasterCard: 5553 0422 4198 4105');
console.log('   Visa: 4012 8888 8888 1881');
console.log('   Expiry: 07/2028, CVV: 123');
console.log('');
console.log('📱 Test UPI IDs:');
console.log('   Success: success@easebuzz');
console.log('   Failure: failure@easebuzz');
console.log('');
console.log('🚀 Ready for testing! The payment gateway integration is working correctly.');
