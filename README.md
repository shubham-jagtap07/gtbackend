# Graduate Chai Admin Backend

A Node.js backend API for managing Graduate Chai products with admin authentication and MySQL database integration.

## Features

- **Admin Authentication**: JWT-based login system
- **Product Management**: CRUD operations for products
- **MySQL Integration**: Database storage with connection pooling
- **Admin Panel**: Beautiful HTML interface for product management
- **API Endpoints**: RESTful API for frontend integration

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MySQL Server
- Database: `chai_admin_db`

### Database Setup

1. Create the database and tables:
```sql
CREATE DATABASE chai_admin_db;
USE chai_admin_db;

-- Admin table (already exists based on your setup)
-- Products table will be created automatically by the application
```

2. Ensure your admin user exists:
```sql
SELECT * FROM admins WHERE email = 'admin@chaiwala.com';
```

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
copy .env.example .env
```

3. Update `.env` with your database credentials:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=chai_admin_db
```

### Running the Server

1. Development mode:
```bash
npm run dev
```

2. Production mode:
```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `GET /api/auth/profile` - Get admin profile
- `POST /api/auth/logout` - Logout

### Products
- `GET /api/products` - Get all active products (public)
- `GET /api/products/:id` - Get single product (public)
- `GET /api/products/admin/all` - Get all products (admin only)
- `POST /api/products` - Create new product (admin only)
- `PUT /api/products/:id` - Update product (admin only)
- `DELETE /api/products/:id` - Delete product (admin only)

### Admin Panel
- `GET /admin` - Admin panel interface
- `GET /api/health` - Health check

## Admin Credentials

- **Email**: admin@chaiwala.com
- **Password**: admin123

## Usage

1. Start the backend server
2. Visit `http://localhost:5000/admin` for the admin panel
3. Login with the admin credentials
4. Manage products through the interface
5. Your Next.js frontend will automatically fetch products from `/api/products`

## Frontend Integration

Update your Next.js API calls to point to:
```javascript
const API_BASE = 'http://localhost:5000/api';
```

Or use relative paths if serving from the same domain:
```javascript
const API_BASE = '/api';
```
