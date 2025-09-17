const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Build Pool config (mirror logic from config/database.js)
let poolConfig;
if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 60000,
  };
  const wantSSL = (process.env.DB_SSL || 'true').toString().toLowerCase() === 'true';
  if (wantSSL) {
    poolConfig.ssl = {
      rejectUnauthorized: ((process.env.DB_SSL_REJECT_UNAUTHORIZED || 'false').toString().toLowerCase() === 'true')
    };
  }
} else {
  poolConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'graduatetea',
    password: process.env.DB_PASSWORD || 'password',
    port: Number(process.env.DB_PORT) || 5432,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 60000,
  };
  if ((process.env.DB_SSL || '').toString().toLowerCase() === 'true') {
    poolConfig.ssl = {
      rejectUnauthorized: ((process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toString().toLowerCase() === 'true')
    };
  }
}

const pool = new Pool(poolConfig);

async function runMigration() {
  try {
    console.log('Connecting to database...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'create_payment_transactions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration...');
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('Payment transactions table created.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    // If table already exists, that's okay
    if ((error.message || '').includes('already exists')) {
      console.log('✅ Table already exists, migration skipped.');
    }
  } finally {
    await pool.end();
  }
}

runMigration();
