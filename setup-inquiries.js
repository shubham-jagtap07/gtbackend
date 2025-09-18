const { pool } = require('./config/database');
const fs = require('fs');
const path = require('path');

async function setupInquiriesTable() {
  try {
    console.log('Setting up inquiries table...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'migrations', 'create_inquiries_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Inquiries table created successfully!');
    
    // Insert some sample data for testing
    const sampleData = [
      {
        name: 'John Doe',
        phone: '9876543210',
        email: 'john@example.com',
        city: 'Mumbai',
        subject: 'Product Information',
        message: 'I would like to know more about your premium chai products.',
        source: 'contact',
        status: 'new'
      },
      {
        name: 'Priya Sharma',
        phone: '8765432109',
        email: '',
        city: 'Delhi',
        subject: '',
        message: 'Interested in bulk orders for my restaurant.',
        source: 'popup',
        status: 'contacted'
      }
    ];
    
    for (const data of sampleData) {
      await pool.query(`
        INSERT INTO inquiries (name, phone, email, city, subject, message, source, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        data.name,
        data.phone,
        data.email,
        data.city,
        data.subject,
        data.message,
        data.source,
        data.status
      ]);
    }
    
    console.log('✅ Sample inquiry data inserted!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up inquiries table:', error);
    process.exit(1);
  }
}

setupInquiriesTable();
