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
const paymentRoutes = require('./routes/payment');

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

// CORS configuration (allow local, FRONTEND_URL, *.vercel.app, and LAN IPs in dev)
const defaultOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5001',
  'http://127.0.0.1:5001'
];
const envFrontend = process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [];
const extraAllowed = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean) : [];
const allowedOrigins = [...defaultOrigins, ...envFrontend, ...extraAllowed];

const allowAllInDev = process.env.NODE_ENV !== 'production';
const vercelRegex = /https?:\/\/([a-z0-9-]+)\.vercel\.app$/i;
// Private LAN IPs (10.x.x.x, 172.16-31.x.x, 192.168.x.x) and localhost with optional port
const lanRegex = /https?:\/\/(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?::\d+)?$/i;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser clients
    if (allowAllInDev) return callback(null, true);
    const isAllowed = allowedOrigins.includes(origin) || vercelRegex.test(origin) || lanRegex.test(origin);
    if (isAllowed) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
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
app.use('/api/payment', paymentRoutes);

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

// Initialize database and start server with retry
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const startServer = async () => {
  try {
    console.log('🚀 Starting Graduate Chai Admin Backend...');

    const maxAttempts = Number(process.env.DB_BOOT_MAX_ATTEMPTS || 10);
    const backoffMs = Number(process.env.DB_BOOT_BACKOFF_MS || 5000);
    let connected = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const ok = await testConnection();
      if (ok) { connected = true; break; }
      console.error(`⚠️ DB not ready (attempt ${attempt}/${maxAttempts}). Retrying in ${backoffMs}ms...`);
      await sleep(backoffMs);
    }
    if (!connected) {
      console.error('❌ Failed to connect to database after retries. Exiting...');
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
