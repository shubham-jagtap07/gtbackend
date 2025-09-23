const axios = require('axios');
const { pool } = require('../config/database');

class ShiprocketService {
  constructor() {
    this.baseURL = 'https://apiv2.shiprocket.in/v1/external';
    this.credentials = {
      email: 'panditprashant5365@gmail.com',
      password: 'zwTy0B$ADt&fDi^G'
    };
  }


  /**
   * Create order with a fresh token (do NOT save token to DB)
   * Flow: login -> get token -> create order -> return response
   */
  async createOrderWithFreshToken(orderData) {
    try {
      // 1) Login to Shiprocket to get a fresh token
      const authResp = await axios.post(
        `${this.baseURL}/auth/login`,
        this.credentials,
        { timeout: 15000 }
      );

      const token = authResp?.data?.token;
      if (!token) {
        throw new Error('Failed to generate Shiprocket token');
      }

      // 2) Use token immediately to create the order
      const response = await axios.post(
        `${this.baseURL}/orders/create/adhoc`,
        orderData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 20000
        }
      );

      if (!response.data) {
        throw new Error('Invalid response from Shiprocket create order API');
      }

      return response.data;
    } catch (error) {
      console.error('Error creating Shiprocket order with fresh token:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Extract first name from full name
   */
  getFirstName(fullName) {
    if (!fullName || typeof fullName !== 'string') return 'Customer';
    const nameParts = fullName.trim().split(/\s+/);
    return nameParts[0] || 'Customer';
  }

  /**
   * Extract last name from full name
   */
  getLastName(fullName) {
    if (!fullName || typeof fullName !== 'string') return '';
    const nameParts = fullName.trim().split(/\s+/);
    if (nameParts.length <= 1) return '';
    // Return the last part as last name
    return nameParts[nameParts.length - 1];
  }

  /**
   * Convert weight from grams to kilograms
   * Handles various input formats: "900g", "900", 900, "1.2kg", etc.
   */
  convertWeightToKg(weight) {
    if (!weight) return 1.2; // Default weight in kg
    
    let weightStr = weight.toString().toLowerCase().trim();
    let weightValue = 0;
    
    if (weightStr.includes('kg')) {
      // Already in kg format like "1.2kg"
      weightValue = parseFloat(weightStr.replace('kg', ''));
    } else if (weightStr.includes('g')) {
      // In grams format like "900g"
      weightValue = parseFloat(weightStr.replace('g', '')) / 1000;
    } else {
      // Assume it's in grams if no unit specified
      weightValue = parseFloat(weightStr) / 1000;
    }
    
    // Return valid weight or default
    return isNaN(weightValue) || weightValue <= 0 ? 1.2 : weightValue;
  }

  /**
   * Transform order data from our format to Shiprocket format
   */
  transformOrderData(order) {
    try {
      // Parse items if it's a string
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      const deliveryAddress = typeof order.delivery_address === 'string' 
        ? JSON.parse(order.delivery_address) 
        : order.delivery_address;

      // Generate unique order ID with timestamp
      const orderIdSuffix = Date.now().toString().slice(-6);
      const channelOrderId = `GG-ORDER-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${orderIdSuffix}`;

      // Calculate totals
      const subtotal = Number(order.subtotal || 0);
      const total = Number(order.total_amount || subtotal);

      // Transform order items
      const orderItems = items.map(item => ({
        name: item.name || 'Gulacha Chaha Pack',
        sku: `GGC-${Date.now()}`, // Generate SKU with timestamp
        units: Number(item.quantity || 1),
        selling_price: Number(item.price || 0),
        tax_amount: 0,
        discount: 0
      }));

      // Map payment method
      const paymentMethod = order.payment_method === 'cash' ? 'COD' : 'Prepaid';

      // Build Shiprocket order data
      const shiprocketOrder = {
        order_id: channelOrderId,
        order_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        channel_id: 8207072,
        pickup_location: "GRADUATE GULACHA CHAHA&LASSI PVTLTD",
        
        // Billing details (company details)
        billing_customer_name: "GRADUATE GULACHA CHAHA",
        billing_last_name: "- ",
        billing_email: "info@gradgulachacha.in",
        billing_phone: "8459005790",
        billing_address: "01 AIRPORT ROAD GANESHWADI, OPPOSITE NISARGA DAIRY, SHIRDI, Ahmed Nagar, Maharashtra, India, 423109",
        billing_city: "Shirdi",
        billing_state: "Maharashtra",
        billing_country: "India",
        billing_pincode: "423109",

        // Shipping details (customer details)
        shipping_is_billing: false,
        shipping_customer_name: this.getFirstName(order.customer_name || 'Customer'),
        shipping_last_name: this.getLastName(order.customer_name || 'Customer'),
        shipping_address: `${deliveryAddress.street || ''}, ${deliveryAddress.landmark || ''}`.trim().replace(/^,\s*/, ''),
        shipping_city: deliveryAddress.city || 'Unknown',
        shipping_state: deliveryAddress.state || 'Maharashtra',
        shipping_country: "India",
        shipping_pincode: deliveryAddress.pincode || '000000',
        shipping_phone: order.customer_phone || '0000000000',

        payment_method: paymentMethod,
        order_items: orderItems,
        sub_total: subtotal,
        other_charges: 0,
        total: total,

        // Package dimensions (default values)
        length: 30,
        breadth: 20,
        height: 10,
        weight: this.convertWeightToKg(items[0]?.weight),

        volumetric_weight: null,
        shipping_charges: 0,
        remarks: "Warehouse SPOC: GRADUATE GULACHA CHAHA | 8459005790",

        extra: {
          warehouse_spoc_name: "GRADUATE GULACHA CHAHA",
          warehouse_spoc_phone: "8459005790",
          pickup_address_full: "01 AIRPORT ROAD GANESHWADI, OPPOSITE NISARGA DAIRY, SHIRDI, Ahmed Nagar, Maharashtra-423109"
        }
      };

      return shiprocketOrder;
    } catch (error) {
      console.error('Error transforming order data:', error);
      throw error;
    }
  }

  /**
   * Normal flow helper: ONLY create Shiprocket order.
   * - Transforms internal order to Shiprocket format
   * - Generates a fresh token (NOT saved in DB)
   * - Calls Shiprocket Create Order API
   * - Does NOT assign AWB, pickup, or create shipment
   */
  async createShiprocketOrderOnly(order) {
    const payload = this.transformOrderData(order);
    return await this.createOrderWithFreshToken(payload);
  }

  }

module.exports = new ShiprocketService();
