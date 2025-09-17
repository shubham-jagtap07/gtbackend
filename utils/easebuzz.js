const crypto = require('crypto');

/**
 * Easebuzz Payment Gateway Utility Functions
 */
class EasebuzzUtils {
  constructor() {
    this.isProduction = process.env.PAYMENT_ENV === 'production';
    this.key = this.isProduction ? process.env.EASEBUZZ_PROD_KEY : process.env.EASEBUZZ_TEST_KEY;
    this.salt = this.isProduction ? process.env.EASEBUZZ_PROD_SALT : process.env.EASEBUZZ_TEST_SALT;
    this.baseUrl = this.isProduction ? process.env.EASEBUZZ_PROD_URL : process.env.EASEBUZZ_TEST_URL;
  }

  /**
   * Generate hash for payment request
   * @param {Object} params - Payment parameters
   * @returns {string} - Generated hash
   */
  generateHash(params) {
    const {
      key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1 = '',
      udf2 = '',
      udf3 = '',
      udf4 = '',
      udf5 = '',
      udf6 = '',
      udf7 = '',
      udf8 = '',
      udf9 = '',
      udf10 = ''
    } = params;

    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}|${udf6}|${udf7}|${udf8}|${udf9}|${udf10}|${this.salt}`;
    
    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  /**
   * Verify payment response hash
   * @param {Object} response - Payment response from Easebuzz
   * @returns {boolean} - Hash verification result
   */
  verifyHash(response) {
    const {
      key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      status,
      udf1 = '',
      udf2 = '',
      udf3 = '',
      udf4 = '',
      udf5 = '',
      udf6 = '',
      udf7 = '',
      udf8 = '',
      udf9 = '',
      udf10 = '',
      hash
    } = response;

    const hashString = `${this.salt}|${status}|${udf10}|${udf9}|${udf8}|${udf7}|${udf6}|${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    
    const generatedHash = crypto.createHash('sha512').update(hashString).digest('hex');
    
    return generatedHash === hash;
  }

  /**
   * Generate unique transaction ID
   * @returns {string} - Unique transaction ID
   */
  generateTxnId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `TXN${timestamp}${random}`.toUpperCase();
  }

  /**
   * Prepare payment parameters for Easebuzz
   * @param {Object} orderData - Order data
   * @returns {Object} - Payment parameters
   */
  preparePaymentParams(orderData) {
    const {
      amount,
      customerName,
      customerEmail,
      customerPhone,
      productInfo,
      orderId,
      successUrl,
      failureUrl
    } = orderData;

    const txnid = this.generateTxnId();
    
    const params = {
      key: this.key,
      txnid,
      amount: parseFloat(amount).toFixed(2),
      productinfo: productInfo,
      firstname: customerName,
      email: customerEmail,
      phone: customerPhone,
      surl: successUrl,
      furl: failureUrl,
      udf1: orderId || '',
      udf2: customerPhone || '',
      udf3: '',
      udf4: '',
      udf5: '',
      udf6: '',
      udf7: '',
      udf8: '',
      udf9: '',
      udf10: ''
    };

    // Generate hash
    params.hash = this.generateHash(params);

    return params;
  }

  /**
   * Get payment URL
   * @returns {string} - Payment URL
   */
  getPaymentUrl() {
    return `${this.baseUrl}payment/initiateLink`;
  }

  /**
   * Get payment status check URL
   * @returns {string} - Status check URL
   */
  getStatusUrl() {
    return `${this.baseUrl}transaction/v2.1/retrieve`;
  }

  /**
   * Generate hash for status check
   * @param {string} txnid - Transaction ID
   * @returns {string} - Hash for status check
   */
  generateStatusHash(txnid) {
    const hashString = `${this.key}|${txnid}|${this.salt}`;
    return crypto.createHash('sha512').update(hashString).digest('hex');
  }
}

module.exports = EasebuzzUtils;
