

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
  if (db && typeof db.activateAllExistingUsers === 'function') {
    db.activateAllExistingUsers()
      .then(count => {
        if (count > 0) {
          console.log(`🚀 Legacy users activated: ${count}`);
        }
      })
      .catch(err => {
        console.warn('⚠️ Failed to auto-activate legacy users:', err.message);
      });
  }
} catch (error) {
  console.log('⚠️ Database module not available, using in-memory storage');
}

// Import routes
console.log('📦 Loading route modules...');
let authRoutes, expenseRoutes, categoryRoutes, budgetRoutes, reportRoutes;
let aiRoutes, emailRoutes, utilsRoutes, deviceRoutes, twofaRoutes, profileRoutes, adminRoutes, settingsRoutes, notificationRoutes;


try {
  authRoutes = require('./routes/auth');
  console.log('  ✅ auth routes loaded');
} catch (error) {
  console.error('  ❌ Failed to load auth routes:', error);
}

try {
  expenseRoutes = require('./routes/expenses');
  console.log('  ✅ expenses routes loaded');
} catch (error) {
  console.error('  ❌ Failed to load expenses routes:', error);
}

try {
  categoryRoutes = require('./routes/categories');
  console.log('  ✅ categories routes loaded');
} catch (error) {
  console.error('  ❌ Failed to load categories routes:', error);
}

try {
  budgetRoutes = require('./routes/budgets');
  console.log('  ✅ budgets routes loaded');
} catch (error) {
  console.error('  ❌ Failed to load budgets routes:', error);
}

try {
  reportRoutes = require('./routes/reports');
  console.log('  ✅ reports routes loaded');
} catch (error) {
  console.error('  ❌ Failed to load reports routes:', error);
}

try {
  aiRoutes = require('./routes/ai');
  console.log('  ✅ ai routes loaded');
} catch (error) {
  console.error('  ❌ Failed to load ai routes:', error);
}

try {
  emailRoutes = require('./routes/email');
  console.log('  ✅ email routes loaded');
} catch (error) {
  console.error('  ❌ Failed to load email routes:', error);
}

try {
  notificationRoutes = require('./routes/notifications');
  console.log('  ✅ notifications routes loaded');
} catch (error) {
  console.error('  ❌ Failed to load notifications routes:', error);
}

try {
  utilsRoutes = require('./routes/utils');
  console.log('  ✅ utils routes loaded');
} catch (error) {
  console.error('  ❌ Failed to load utils routes:', error);
}

try {
  deviceRoutes = require('./routes/devices');
  console.log('  ✅ devices routes loaded');
} catch (error) {
  console.error('  ❌ Failed to load devices routes:', error);
}

try {
  twofaRoutes = require('./routes/twofa');
  console.log('  ✅ twofa routes loaded');
} catch (error) {
  console.error('  ❌ Failed to load twofa routes:', error);
}

try {
  profileRoutes = require('./routes/profile');
  console.log('  ✅ profile routes loaded');
} catch (error) {
  console.error('  ❌ Failed to load profile routes:', error);
}

try {
  adminRoutes = require('./routes/admin');
  console.log('  ✅ admin routes loaded');
} catch (error) {
  console.error('  ❌ Failed to load admin routes:', error);
}

try {
  settingsRoutes = require('./routes/settings');
  console.log('  ✅ settings routes loaded');
} catch (error) {
  console.error('  ❌ Failed to load settings routes:', error);
}

// Load routes mới cho hệ thống AI riêng
try {
  aiRouteNew = require('./routes/ai.route');
  console.log('  ✅ ai.route (new) loaded');
} catch (error) {
  console.error('  ❌ Failed to load ai.route (new):', error);
}

try {
  expenseRouteNew = require('./routes/expense.route');
  console.log('  ✅ expense.route (new) loaded');
} catch (error) {
  console.error('  ❌ Failed to load expense.route (new):', error);
}

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
// Explicit CSP to allow frontend to load external images and call local API
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "https://accounts.google.com",
        "https://accounts.gstatic.com",
        "ws:",
        "wss:"
      ],
      // Allow Google Sign-In SDK and related scripts
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://accounts.google.com",
        "https://accounts.gstatic.com"
      ],
      scriptSrcAttr: [
        "'self'",
        "'unsafe-inline'"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://accounts.google.com",
        "https://accounts.gstatic.com"
      ],
      fontSrc: ["'self'", "https:", "data:"],
      // Allow rendering Google's Sign-In iframe
      frameSrc: [
        "'self'",
        "https://accounts.google.com",
        "https://accounts.gstatic.com"
      ],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"]
    }
  }
}));
app.use(compression());

// CORS configuration
// In development, allow all localhost origins for easier testing
const corsOptions = process.env.NODE_ENV === 'production' ? {
  origin: [
    'http://localhost:5000',    // Backend API (không serve frontend)
    'http://127.0.0.1:5000',   // Backend API (không serve frontend)
    'http://localhost:5050',   // Frontend Python HTTP server (CHÍNH)
    'http://127.0.0.1:5050',   // Frontend Python HTTP server (CHÍNH)
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

// Request logging middleware for debugging
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`📥 ${req.method} ${req.path}`, {
      query: req.query,
      body: req.body,
      headers: {
        'authorization': req.headers['authorization'] ? 'Bearer ***' : 'none',
        'content-type': req.headers['content-type']
      }
    });
  }
  next();
});

// Serve static frontend files
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));

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

// Test route to verify routing works
app.get('/api/test', (req, res) => {
  res.json({ message: 'API routing is working!', timestamp: new Date().toISOString() });
});

// API routes
console.log('🔌 Mounting API routes...');
if (authRoutes) {
  try {
    app.use('/api/auth', authRoutes);
    console.log('  ✅ /api/auth mounted');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/auth:', error);
  }
} else {
  console.error('  ❌ /api/auth not mounted (route module not loaded)');
}

// Alias /api/me to /api/auth/me for compatibility (must be before /api/expenses to avoid route conflict)
try {
  const { authRequired } = require('./middleware/auth');
  app.get('/api/me', authRequired, async (req, res) => {
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
  console.log('  ✅ /api/me mounted');
} catch (error) {
  console.error('  ❌ Failed to mount /api/me:', error);
}

if (expenseRoutes) {
  try {
    app.use('/api/expenses', expenseRoutes);
    console.log('  ✅ /api/expenses mounted');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/expenses:', error);
  }
} else {
  console.error('  ❌ /api/expenses not mounted (route module not loaded)');
}

if (categoryRoutes) {
  try {
    app.use('/api/categories', categoryRoutes);
    console.log('  ✅ /api/categories mounted');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/categories:', error);
  }
} else {
  console.error('  ❌ /api/categories not mounted (route module not loaded)');
}

if (deviceRoutes) {
  try {
    app.use('/api/devices', deviceRoutes);
    console.log('  ✅ /api/devices mounted');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/devices:', error);
  }
} else {
  console.error('  ❌ /api/devices not mounted (route module not loaded)');
}

if (twofaRoutes) {
  try {
    app.use('/api/2fa', twofaRoutes);
    console.log('  ✅ /api/2fa mounted');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/2fa:', error);
  }
} else {
  console.error('  ❌ /api/2fa not mounted (route module not loaded)');
}

if (profileRoutes) {
  try {
    app.use('/api/profile', profileRoutes);
    console.log('  ✅ /api/profile mounted');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/profile:', error);
  }
} else {
  console.error('  ❌ /api/profile not mounted (route module not loaded)');
}

// Log all requests to /api/admin for debugging
app.use('/api/admin', (req, res, next) => {
  console.log('🔍 /api/admin request:', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    url: req.url
  });
  next();
});

if (adminRoutes) {
  try {
    app.use('/api/admin', adminRoutes);
    console.log('  ✅ /api/admin mounted');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/admin:', error);
  }
} else {
  console.error('  ❌ /api/admin not mounted (route module not loaded)');
}

if (budgetRoutes) {
  try {
    app.use('/api/budgets', budgetRoutes);
    console.log('  ✅ /api/budgets mounted');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/budgets:', error);
  }
} else {
  console.error('  ❌ /api/budgets not mounted (route module not loaded)');
}

if (reportRoutes) {
  try {
    app.use('/api/reports', reportRoutes);
    console.log('  ✅ /api/reports mounted');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/reports:', error);
  }
} else {
  console.error('  ❌ /api/reports not mounted (route module not loaded)');
}

if (aiRoutes) {
  try {
    app.use('/api/ai', aiRoutes);
    console.log('  ✅ /api/ai mounted');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/ai:', error);
  }
} else {
  console.error('  ❌ /api/ai not mounted (route module not loaded)');
}

if (emailRoutes) {
  try {
    app.use('/api/email', emailRoutes);
    console.log('  ✅ /api/email mounted');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/email:', error);
  }
} else {
  console.error('  ❌ /api/email not mounted (route module not loaded)');
}

if (notificationRoutes) {
  try {
    app.use('/api/notifications', notificationRoutes);
    console.log('  ✅ /api/notifications mounted');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/notifications:', error);
  }
} else {
  console.error('  ❌ /api/notifications not mounted (route module not loaded)');
}

if (utilsRoutes) {
  try {
    app.use('/api/utils', utilsRoutes);
    console.log('  ✅ /api/utils mounted');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/utils:', error);
  }
} else {
  console.error('  ❌ /api/utils not mounted (route module not loaded)');
}

if (settingsRoutes) {
  try {
    app.use('/api/settings', settingsRoutes);
    console.log('  ✅ /api/settings mounted');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/settings:', error);
  }
} else {
  console.error('  ❌ /api/settings not mounted (route module not loaded)');
}

// Mount routes mới cho hệ thống AI riêng (đường dẫn khác để không ảnh hưởng code cũ)
if (aiRouteNew) {
  try {
    app.use('/api/ai-new', aiRouteNew);
    console.log('  ✅ /api/ai-new mounted (hệ thống AI mới)');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/ai-new:', error);
  }
} else {
  console.error('  ❌ /api/ai-new not mounted (route module not loaded)');
}

if (expenseRouteNew) {
  try {
    app.use('/api/expense-new', expenseRouteNew);
    console.log('  ✅ /api/expense-new mounted (hệ thống expense mới)');
  } catch (error) {
    console.error('  ❌ Failed to mount /api/expense-new:', error);
  }
} else {
  console.error('  ❌ /api/expense-new not mounted (route module not loaded)');
}

console.log('✅ All API routes mounted successfully');

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});
// ===== ADMIN SUPPORT NOTIFICATIONS =====

const adminNotificationRoutes = require("./routes/admin.notifications");
app.use("/api/admin/notifications", adminNotificationRoutes);

const adminSupportRoutes = require("./routes/admin-support");
app.use("/api/admin/support", adminSupportRoutes);

// ===== API routes =====
app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
// ...
app.use("/api/notifications", notificationRoutes);

// ✅ SUPPORT PHẢI Ở ĐÂY
const supportRoutes = require("./routes/support");
app.use("/api/support", supportRoutes);

// ❌ 404 LUÔN LUÔN CUỐI CÙNG
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});



// 404 handler - must be last
app.use('*', (req, res) => {
  console.warn('⚠️ 404 - Route not found:', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    url: req.url,
    headers: {
      'user-agent': req.headers['user-agent'],
      'referer': req.headers['referer']
    }
  });
  res.status(404).json({ 
    message: 'Endpoint not found',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      'GET /',
      'GET /api/test',
      'GET /api/me',
      'GET /api/expenses',
      'GET /api/categories',
      'GET /api/reports/summary',
      'GET /api/utils/current-date'
    ]
  });
});

// Start server with graceful port fallback (tries a small set of common dev ports)

async function afterServerStarted(effectivePort) {
  console.log(`🚀 SmartExpense API running on http://${HOST}:${effectivePort}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 AI Features: ${process.env.DISABLE_AI === 'true' ? 'Disabled' : 'Enabled'}`);

  // Khởi tạo và sync Sequelize database (cho hệ thống AI mới)
  try {
    const sequelize = require('./config/database');
    await sequelize.authenticate();
    console.log('✅ Sequelize database connection successful');
    
    // Sync models với database (tạo bảng nếu chưa có)
    await sequelize.sync({ alter: false }); // alter: false để không thay đổi cấu trúc bảng hiện có
    console.log('✅ Sequelize models synced');
  } catch (error) {
    console.warn('⚠️ Sequelize database connection failed:', error.message);
    console.log('   Hệ thống AI mới có thể không hoạt động đúng');
  }

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

  // ⭐ LUỒNG CẢNH BÁO NGÂN SÁCH:
  // Trước đây scheduler chỉ được bật khi có cấu hình EMAIL_USER/EMAIL_PASS,
  // nên nếu chưa cấu hình email thì toàn bộ job (bao gồm cảnh báo trong app) sẽ KHÔNG chạy.
  // Việc này làm cho ngưỡng cảnh báo ngân sách không hoạt động dù đã cài đặt trong giao diện.
  //
  // Sửa lại: luôn khởi động emailScheduler để job cảnh báo ngân sách và các job khác vẫn chạy bình thường.
  // Nếu thiếu cấu hình email thì chỉ không gửi được email, nhưng thông báo trong app vẫn hoạt động.
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('📧 Đã tìm thấy cấu hình email, scheduler sẽ gửi cả email và thông báo trong ứng dụng.');
  } else {
    console.log('📧 Chưa cấu hình email, scheduler vẫn chạy nhưng CHỈ gửi thông báo trong ứng dụng (không gửi email).');
  }

  emailScheduler.start();
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

