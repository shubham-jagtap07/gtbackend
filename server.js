const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Robust env loading: try multiple common locations inside the backend
const envCandidates = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '.env.local'),
  path.join(__dirname, '.env.example'),
  path.join(process.cwd(), 'backend', '.env'),
  path.join(process.cwd(), 'backend', '.env.example'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '.env.example')
];

let loadedEnvPath = null;
const candidateStatus = [];
for (const p of envCandidates) {
  const exists = fs.existsSync(p);
  candidateStatus.push(`${exists ? '✔' : '✖'} ${p}`);
  // Try to load regardless; ignore errors
  const result = dotenv.config({ path: p });
  if (!result.error && exists && !loadedEnvPath) {
    loadedEnvPath = p;
  }
}

const { testConnection, initializeTables } = require('./config/database');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 5001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for admin panel HTML
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5001',
    'http://127.0.0.1:5001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (admin panel)
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// Redirect admin routes to Next.js frontend
app.get('/admin*', (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}${req.path}`);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Graduate Chai Admin API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Graduate Chai Admin Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      products: '/api/products',
      admin: '/admin'
    }
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: error.message })
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    console.log('🚀 Starting Graduate Chai Admin Backend...');
    
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Initialize database tables
    await initializeTables();

    // Start server
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📱 Admin Panel: http://localhost:${PORT}/admin`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗂️ CWD: ${process.cwd()}`);
      console.log(`🗺️ Backend dir (__dirname): ${__dirname}`);
      console.log('📄 .env candidates:');
      candidateStatus.forEach(s => console.log(`   ${s}`));
      console.log(`📄 Loaded .env path: ${loadedEnvPath || 'none'}`);
      console.log(`🔐 JWT secret loaded: ${process.env.JWT_SECRET ? 'yes' : 'no'}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();
