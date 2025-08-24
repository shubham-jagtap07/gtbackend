const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'chai_admin_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Initialize database tables if they don't exist
const initializeTables = async () => {
  try {
    const connection = await pool.getConnection();
    
    // Create products table if not exists
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        original_price DECIMAL(10,2),
        image_url VARCHAR(500),
        weight VARCHAR(50),
        category VARCHAR(100),
        features JSON,
        rating DECIMAL(3,2) DEFAULT 0,
        reviews INT DEFAULT 0,
        tags JSON,
        stock_quantity INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        is_popular BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Check and add missing columns
    try {
      // Check if original_price column exists
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'original_price'
      `, [process.env.DB_NAME || 'chai_admin_db']);

      if (columns.length === 0) {
        await connection.execute(`ALTER TABLE products ADD COLUMN original_price DECIMAL(10,2) DEFAULT NULL`);
        console.log('✅ Added original_price column to products table');
      }
      
      // Check if image_url column exists
      const [imageUrlColumns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'image_url'
      `, [process.env.DB_NAME || 'chai_admin_db']);

      if (imageUrlColumns.length === 0) {
        await connection.execute(`ALTER TABLE products ADD COLUMN image_url VARCHAR(500) DEFAULT NULL`);
        console.log('✅ Added image_url column to products table');
      }

      // Check and add other potentially missing columns used by queries/inserts
      const ensureColumn = async (name, ddl) => {
        const [cols] = await connection.execute(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = ?
        `, [process.env.DB_NAME || 'chai_admin_db', name]);
        if (cols.length === 0) {
          await connection.execute(`ALTER TABLE products ADD COLUMN ${ddl}`);
          console.log(`✅ Added ${name} column to products table`);
        }
      };

      await ensureColumn('weight', 'weight VARCHAR(50) DEFAULT NULL');
      await ensureColumn('category', "category VARCHAR(100) DEFAULT 'Chai Powder'");
      await ensureColumn('features', 'features JSON');
      await ensureColumn('rating', 'rating DECIMAL(3,2) DEFAULT 0');
      await ensureColumn('reviews', 'reviews INT DEFAULT 0');
      await ensureColumn('tags', 'tags JSON');
      await ensureColumn('stock_quantity', 'stock_quantity INT DEFAULT 0');
      await ensureColumn('is_active', 'is_active BOOLEAN DEFAULT true');
      await ensureColumn('is_popular', 'is_popular BOOLEAN DEFAULT false');
    } catch (error) {
      console.log('Note: Column check/add:', error.message);
    }

    // Insert default products if table is empty
    try {
      const [rows] = await connection.execute('SELECT COUNT(*) as count FROM products');
      if (rows[0].count === 0) {
        await connection.execute(`
          INSERT INTO products (name, description, price, original_price, image_url, weight, category, features, rating, reviews, tags, stock_quantity, is_popular) VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          'Chai Sukh', 
          'Premium jaggery-sweetened blend crafted with finest tea leaves and pure gur for an authentic taste experience.',
          225, 250, '/images/gram500.webp', '500g', 'Chai Powder',
          JSON.stringify(['Natural Jaggery', 'Premium Quality', 'Rich Flavor']),
          4.8, 156, JSON.stringify(['Bestseller', 'Organic']), 45, true,
          
          'Jaggery Premix',
          'Signature premix delivering rich aroma and authentic taste in every cup. Perfect blend for tea connoisseurs.',
          320, 400, '/images/gram900.webp', '900g', 'Chai Powder',
          JSON.stringify(['Premium Blend', 'Rich Aroma', 'Perfect Taste']),
          4.9, 203, JSON.stringify(['Large Pack', 'Value']), 32, true
        ]);
        console.log('✅ Default products inserted');
      }
    } catch (error) {
      console.log('Note: Default products insertion:', error.message);
    }

    connection.release();
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Error initializing tables:', error.message);
  }
};

module.exports = {
  pool,
  testConnection,
  initializeTables
};
