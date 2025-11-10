const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import email scheduler
const emailScheduler = require('./services/emailScheduler');

// Import database module (optional - fallback to in-memory if not available)
let db = null;
try {
  db = require('./database');
} catch (error) {
  console.log('⚠️ Database module not available, using in-memory storage');
}

// Import routes
const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const categoryRoutes = require('./routes/categories');
const budgetRoutes = require('./routes/budgets');
const reportRoutes = require('./routes/reports');
const aiRoutes = require('./routes/ai');
const emailRoutes = require('./routes/email');
const utilsRoutes = require('./routes/utils');
const deviceRoutes = require('./routes/devices');
const twofaRoutes = require('./routes/twofa');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Trust proxy để lấy IP đúng từ reverse proxy/load balancer
// Chỉ trust khi có reverse proxy thật (production), không trust tất cả trong dev
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Chỉ trust 1 proxy hop
} else {
  // Development: không trust proxy để tránh warning rate limiting
  app.set('trust proxy', false);
}

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration
// In development, allow all localhost origins for easier testing
const corsOptions = process.env.NODE_ENV === 'production' ? {
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ],
  credentials: true
} : {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Allow all localhost origins in development
    if (origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.startsWith('file://')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};
app.use(cors(corsOptions));

// Cookie parser middleware (phải đặt trước routes)
app.use(cookieParser());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'SmartExpense API running (Node.js)',
    endpoints: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/google',
      'GET /api/me',
      'GET/POST /api/expenses',
      'GET/PUT/DELETE /api/expenses/:id',
      'GET/POST /api/categories',
      'GET/PUT/DELETE /api/categories/:id',
      'GET/PUT /api/budgets/:yyyymm',
      'GET /api/reports/summary',
      'POST /api/ai/categorize',
      'GET /api/ai/forecast',
      'GET /api/ai/alerts',
      'GET /api/ai/insights',
      'POST /api/ai/chat',
      'POST /api/email/send-daily-report',
      'POST /api/email/send-budget-alert',
      'POST /api/email/send-welcome',
      'POST /api/email/send-verification-email',
      'POST /api/email/test',
      'GET /api/email/status',
    ],
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/2fa', twofaRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/utils', utilsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Start server
app.listen(PORT, HOST, async () => {
  console.log(`🚀 SmartExpense API running on http://${HOST}:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 AI Features: ${process.env.DISABLE_AI === 'true' ? 'Disabled' : 'Enabled'}`);

  // Test database connection
  if (db && db.testConnection) {
    try {
      const connected = await db.testConnection();
      if (connected) {
        console.log('✅ Database connection successful');
        const dbConfig = {
          host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
          database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'smart_expense'
        };
        console.log(`   📊 Database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
      } else {
        console.log('⚠️ Database connection failed - using in-memory storage');
      }
    } catch (error) {
      console.log('⚠️ Database connection error:', error.message);
      console.log('   Using in-memory storage');
    }
  } else {
    console.log('⚠️ Database module not available - using in-memory storage');
  }

  // Start email scheduler if email is configured
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    emailScheduler.start();
  } else {
    console.log('📧 Email scheduler disabled (no email configuration)');
  }
});

module.exports = app;
