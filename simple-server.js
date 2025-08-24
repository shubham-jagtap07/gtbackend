const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 5001;

// Simple in-memory data
const JWT_SECRET = 'graduate_chai_super_secret_jwt_key_2024';
const admin = {
  email: 'admin@chaiwala.com',
  password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // admin123
  name: 'Admin'
};

const products = [
  {
    id: 1,
    name: 'Chai Sukh',
    description: 'Premium jaggery-sweetened blend crafted with finest tea leaves and pure gur for an authentic taste experience.',
    price: 225,
    original_price: 250,
    image_url: '/images/gram500.webp',
    weight: '500g',
    category: 'Chai Powder',
    features: ['Natural Jaggery', 'Premium Quality', 'Rich Flavor'],
    rating: 4.8,
    reviews: 156,
    tags: ['Bestseller', 'Organic'],
    stock_quantity: 45,
    is_active: true,
    is_popular: true
  },
  {
    id: 2,
    name: 'Jaggery Premix',
    description: 'Signature premix delivering rich aroma and authentic taste in every cup. Perfect blend for tea connoisseurs.',
    price: 320,
    original_price: 400,
    image_url: '/images/gram900.webp',
    weight: '900g',
    category: 'Chai Powder',
    features: ['Premium Blend', 'Rich Aroma', 'Perfect Taste'],
    rating: 4.9,
    reviews: 203,
    tags: ['Large Pack', 'Value'],
    stock_quantity: 32,
    is_active: true,
    is_popular: true
  }
];

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json());

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (email !== admin.email) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: 1, email: admin.email, name: admin.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: { token, admin: { name: admin.name, email: admin.email } }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/auth/profile', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: { name: admin.name, email: admin.email }
  });
});

app.get('/api/products', (req, res) => {
  res.json({
    success: true,
    data: products.filter(p => p.is_active)
  });
});

app.get('/api/products/admin/all', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: products
  });
});

app.post('/api/products', authenticateToken, (req, res) => {
  const newProduct = {
    id: products.length + 1,
    ...req.body,
    is_active: true
  };
  products.push(newProduct);
  res.json({
    success: true,
    message: 'Product created successfully',
    data: newProduct
  });
});

app.delete('/api/products/:id', authenticateToken, (req, res) => {
  const id = parseInt(req.params.id);
  const index = products.findIndex(p => p.id === id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  
  products.splice(index, 1);
  res.json({ success: true, message: 'Product deleted successfully' });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Graduate Chai Backend running on port ${PORT}`);
  console.log(`📱 Admin Panel: http://localhost:3000/admin`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
});
