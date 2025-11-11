


const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const http = require('http');
require('dotenv').config();

// Import email scheduler
const emailScheduler = require('./services/emailScheduler');

// Global reference to HTTP server to keep process alive
let globalServer = null;

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
const profileRoutes = require('./routes/profile');

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

// CORS configuration
// In development, allow all localhost origins for easier testing
const corsOptions = process.env.NODE_ENV === 'production' ? {
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ],
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Apply CORS as early as possible (before rate limiting and routes) and handle preflight
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Rate limiting
// Development: relax limits to avoid accidental 429 during local testing
const isProd = process.env.NODE_ENV === 'production';
const limiter = rateLimit({
  windowMs: isProd ? 15 * 60 * 1000 : 60 * 1000, // 15m in prod, 1m in dev
  max: isProd ? 300 : 10000, // allow much higher throughput locally
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later.',
  keyGenerator: (req, _res) => {
    // Use IP by default; in production behind proxies, trust proxy is set above
    return req.ip || 'unknown';
  },
  skip: (req, _res) => {
    // Optionally skip health checks and utils in dev
    if (!isProd) {
      if (req.path === '/' || req.path.startsWith('/api/utils')) return true;
    }
    return false;
  }
});
app.use('/api/', limiter);

// Cookie parser middleware (phải đặt trước routes)
app.use(cookieParser());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Serve static frontend files
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));

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
      'GET/PUT /api/profile',
      'GET/POST /api/expenses',
      'GET/PUT/DELETE /api/expenses/:id',
      'GET/POST /api/categories',
      'GET/PUT/DELETE /api/categories/:id',
      'GET/PUT /api/budgets/:yyyymm',
      'GET /api/reports/summary',
      'GET /api/expenses/stats',
      'GET /api/devices',
      'GET /api/2fa/status',
      'POST /api/2fa/generate',
      'POST /api/2fa/verify',
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
// Alias /api/me to /api/auth/me for compatibility (must be before /api/expenses to avoid route conflict)
app.get('/api/me', require('./middleware/auth').authRequired, async (req, res) => {
  try {
    // Load full user data from database if available
    let userData = {
      userId: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    };

    if (db) {
      try {
        const fullUser = await db.getUserById(req.user.id);
        if (fullUser) {
          userData = {
            userId: fullUser.id,
            email: fullUser.email,
            name: fullUser.name,
            role: fullUser.role || 'user',
            balance: fullUser.balance || 0,
            gender: fullUser.gender || null,
            currency: fullUser.currency || 'VND',
            phone: fullUser.phone || null,
            avatar_url: fullUser.avatar_url || null,
            login_method: fullUser.login_method || 'password'
          };
        }
      } catch (error) {
        console.warn('Failed to load full user data:', error.message);
        // Continue with basic user data
      }
    }

    res.json(userData);
  } catch (error) {
    console.error('Error in /api/me:', error);
    res.status(500).json({ message: 'Lỗi lấy thông tin người dùng' });
  }
});
app.use('/api/expenses', expenseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/2fa', twofaRoutes);
app.use('/api/profile', profileRoutes);
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

// Start server with graceful port fallback (tries a small set of common dev ports)

async function afterServerStarted(effectivePort) {
  console.log(`🚀 SmartExpense API running on http://${HOST}:${effectivePort}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 AI Features: ${process.env.DISABLE_AI === 'true' ? 'Disabled' : 'Enabled'}`);

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
        console.log(`   📊 Database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
      } else {
        console.log('⚠️ Database connection failed - using in-memory storage');
      }
    } catch (error) {
      console.log('⚠️ Database connection error:', error.message);
      console.log('   Using in-memory storage');
    }
  } else {
    console.log('⚠️ Database module not available - using in-memory storage');
  }

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    emailScheduler.start();
  } else {
    console.log('📧 Email scheduler disabled (no email configuration)');
  }
}

function listenOnPort(desiredPort, onSuccess, onError) {
  const server = http.createServer(app);
  server.once('error', (err) => onError(err));
  server.once('listening', () => onSuccess(server));
  server.listen(parseInt(desiredPort, 10), HOST);
  return server;
}

async function startWithFallback() {
  // Ensure unique ordered list: prefer env PORT, then 5000, 5002, 5003
  const preferredPorts = Array.from(new Set([
    parseInt(PORT, 10) || 5000,
    5000,
    5002,
    5003
  ])).filter(Boolean);

  let lastError = null;
  for (const p of preferredPorts) {
    try {
      await new Promise((resolve, reject) => {
        const server = listenOnPort(p, async (srv) => {
          try {
            // Keep global reference to server to prevent process exit
            globalServer = srv;
            await afterServerStarted(p);
            resolve(srv); // Server is running, keep it alive
          } catch (err) {
            reject(err);
          }
        }, (err) => {
          lastError = err;
          if (err && err.code === 'EADDRINUSE') {
            console.error(`❌ Port ${p} is in use, trying next...`);
          } else {
            console.error('❌ Failed to start server:', err);
          }
          reject(err);
        });
      });
      // Successfully started, stop trying others
      return;
    } catch (_e) {
      // try next port
    }
  }

  // If we reach here, all attempts failed
  if (lastError && lastError.code === 'EADDRINUSE') {
    console.error('❌ All preferred ports are in use. Please free a port or set PORT to an available value.');
  }
  console.error('❌ Failed to start server');
}

startWithFallback().catch(err => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});

// Keep process running
process.on('SIGINT', () => {
  console.log('\n✋ Server stopped');
  process.exit(0);
});

module.exports = app;

