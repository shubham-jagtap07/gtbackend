const { Pool } = require('pg');
require('dotenv').config();

// Build Database configuration (PostgreSQL)
let dbConfig;

// Prefer DATABASE_URL if provided (common on Render/Heroku). Fall back to discrete vars.
if (process.env.DATABASE_URL) {
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 60000,
  };
  // Determine SSL behavior
  // - If DATABASE_URL host is Render internal (".internal"), disable SSL by default
  // - Otherwise default to SSL true unless explicitly disabled via DB_SSL=false
  let isInternalHost = false;
  try {
    const u = new URL(process.env.DATABASE_URL);
    isInternalHost = (u.hostname || '').includes('.internal');
  } catch (_) {}

  const wantSSL = (process.env.DB_SSL || (isInternalHost ? 'false' : 'true')).toString().toLowerCase() === 'true';
  if (wantSSL) {
    dbConfig.ssl = {
      // Many providers use self-signed certs; allow override via env
      rejectUnauthorized: ((process.env.DB_SSL_REJECT_UNAUTHORIZED || 'false').toString().toLowerCase() === 'true')
    };
  }
} else {
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'chai_admin_db',
    port: Number(process.env.DB_PORT) || 5432,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 60000,
  };
  // Optional SSL (for managed DBs). Enable with DB_SSL=true
  if ((process.env.DB_SSL || '').toString().toLowerCase() === 'true') {
    dbConfig.ssl = {
      rejectUnauthorized: ((process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toString().toLowerCase() === 'true')
    };
  }
}

// Create connection pool
const pool = new Pool(dbConfig);

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    // Log effective configuration (sans secrets) to aid diagnostics
    const effective = {
      usingDatabaseUrl: !!process.env.DATABASE_URL,
      host: dbConfig.host || '(from DATABASE_URL)',
      database: dbConfig.database || '(from DATABASE_URL)',
      port: dbConfig.port || '(from DATABASE_URL)',
      ssl: !!dbConfig.ssl,
      sslRejectUnauthorized: dbConfig.ssl ? dbConfig.ssl.rejectUnauthorized : undefined,
      nodeEnv: process.env.NODE_ENV,
    };
    console.error('❌ Database connection failed:', error?.message || error);
    console.error('🧪 Effective DB config (safe):', effective);
    return false;
  }
};

// Initialize database tables if they don't exist (PostgreSQL)
const initializeTables = async () => {
  let client;
  try {
    client = await pool.connect();

    // Create products table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        original_price DECIMAL(10,2),
        image_url VARCHAR(500),
        is_popular BOOLEAN DEFAULT false,
        weight VARCHAR(50),
        features JSONB DEFAULT '[]',
        rating DECIMAL(3,2) DEFAULT 0,
        reviews INTEGER DEFAULT 0,
        tags JSONB DEFAULT '[]',
        category VARCHAR(100),
        stock_quantity INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create orders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(100) UNIQUE NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        items JSONB NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        payment_status VARCHAR(50) DEFAULT 'pending',
        payment_method VARCHAR(50) DEFAULT 'cash',
        order_type VARCHAR(50) DEFAULT 'delivery',
        delivery_address JSONB,
        special_instructions TEXT,
        order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create payment_transactions table for Easebuzz integration
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        transaction_id VARCHAR(255) UNIQUE NOT NULL,
        gateway_transaction_id VARCHAR(255),
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'initiated',
        payment_gateway VARCHAR(50) DEFAULT 'easebuzz',
        gateway_response JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for payment_transactions
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_txn_id ON payment_transactions(transaction_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status)
    `);

    // Ensure columns exist (idempotent)
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2)`);
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100)`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS features JSONB`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS reviews INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS tags JSONB`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()`);

    // Insert default products if table is empty
    const countRes = await client.query('SELECT COUNT(*)::int AS count FROM products');
    const count = countRes.rows[0]?.count || 0;
    if (count === 0) {
      await client.query(
        `INSERT INTO products 
          (name, description, price, original_price, image_url, weight, category, features, rating, reviews, tags, stock_quantity, is_popular)
         VALUES 
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13),
          ($14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [
          'Chai Sukh',
          'Premium jaggery-sweetened blend crafted with finest tea leaves and pure gur for an authentic taste experience.',
          225, 250, '/images/gram500.webp', '500g', 'Chai Powder',
          JSON.stringify(['Natural Jaggery', 'Premium Quality', 'Rich Flavor']),
          4.8, 156, JSON.stringify(['Bestseller', 'Organic']), 45, true,

          'Jaggery Premix',
          'Signature premix delivering rich aroma and authentic taste in every cup. Perfect blend for tea connoisseurs.',
          320, 400, '/images/gram900.webp', '900g', 'Chai Powder',
          JSON.stringify(['Premium Blend', 'Rich Aroma', 'Perfect Taste']),
          4.9, 203, JSON.stringify(['Large Pack', 'Value']), 32, true,
        ]
      );
      console.log('✅ Default products inserted');
    }

    // Seed default admin if none exists
    const adminCountRes = await client.query('SELECT COUNT(*)::int AS count FROM admins');
    const adminCount = adminCountRes.rows[0]?.count || 0;
    if (adminCount === 0) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@chaiwala.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'; // Note: plain for now
      await client.query(
        `INSERT INTO admins (name, email, password, role, is_active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING`,
        ['Admin', adminEmail, adminPassword, 'admin', true]
      );
      console.log('✅ Default admin ensured');
    }

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Error initializing tables:', error.message);
  } finally {
    if (client) client.release();
  }
};

module.exports = {
  pool,
  testConnection,
  initializeTables
};
