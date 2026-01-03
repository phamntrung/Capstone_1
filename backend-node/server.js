/**
 * =====================================================
 * SmartExpense – server.js (Clean & Maintainable)
 * =====================================================
 */

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

/* =====================================================
 * Services & Database
 * ===================================================== */
const emailScheduler = require('./services/emailScheduler');



let db = null;
try {
  db = require('./database');
} catch {
  console.warn('⚠️ Database module not available');
}

/* =====================================================
 * Load Routes (REQUIRE ONCE)
 * ===================================================== */
// Core
const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const categoryRoutes = require('./routes/categories');
const budgetRoutes = require('./routes/budgets');
const reportRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const settingsRoutes = require('./routes/settings');
const profileRoutes = require('./routes/profile');
const deviceRoutes = require('./routes/devices');
const twofaRoutes = require('./routes/twofa');
const utilsRoutes = require('./routes/utils');
const adminReports = require('./routes/admin-reports');
// AI
const aiRoutes = require('./routes/ai');           // AI hiện tại
const aiRouteNew = require('./routes/ai.route');   // AI mới (Sequelize)

// Email
const emailRoutes = require('./routes/email');

// Admin
const adminRoutes = require('./routes/admin');
const adminNotificationRoutes = require('./routes/admin.notifications');
const adminSupportRoutes = require('./routes/admin-support');

// Support
const supportRoutes = require('./routes/support');

// New Expense System
const expenseRouteNew = require('./routes/expense.route');

/* =====================================================
 * App Init
 * ===================================================== */
const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

/* =====================================================
 * Middleware
 * ===================================================== */
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

app.use(helmet());
app.use(compression());
app.use(cors({ origin: true, credentials: true }));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

/* =====================================================
 * Rate Limit
 * ===================================================== */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

/* =====================================================
 * Static
 * ===================================================== */
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));

/* =====================================================
 * Health Check
 * ===================================================== */
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'SmartExpense API running',
  });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API routing OK', time: new Date().toISOString() });
});

/* =====================================================
 * API ROUTES (MOUNT ONCE)
 * ===================================================== */
// Core
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/2fa', twofaRoutes);
app.use('/api/utils', utilsRoutes);
app.use('/api/admin/reports', adminReports);
// Alias /api/me
const { authRequired } = require('./middleware/auth');
app.get('/api/me', authRequired, async (req, res) => {
  try {
    let userData = {
      userId: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
    };

    if (db?.getUserById) {
      const fullUser = await db.getUserById(req.user.id);
      if (fullUser) {
        userData = { ...userData, ...fullUser };
      }
    }

    res.json(userData);
  } catch (e) {
    res.status(500).json({ message: 'Lỗi lấy thông tin người dùng' });
  }
});

// AI
app.use('/api/ai', aiRoutes);
app.use('/api/ai-new', aiRouteNew);

// Email
app.use('/api/email', emailRoutes);

// Admin
app.use('/api/admin', adminRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);
app.use('/api/admin/support', adminSupportRoutes);

// Support
app.use('/api/support', supportRoutes);

// New Expense
app.use('/api/expense-new', expenseRouteNew);

/* =====================================================
 * 404 Handler
 * ===================================================== */
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Endpoint not found',
    method: req.method,
    path: req.path,
  });
});

/* =====================================================
 * Error Handler
 * ===================================================== */
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

/* =====================================================
 * Start Server
 * ===================================================== */
const server = http.createServer(app);

server.listen(PORT, HOST, async () => {
  console.log(`🚀 SmartExpense API running at http://${HOST}:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 AI Features: Enabled`);

  if (db?.testConnection) {
    await db.testConnection();
    console.log('✅ Database connected');
  }

  emailScheduler.start();
});

/* =====================================================
 * Graceful Shutdown
 * ===================================================== */
process.on('SIGINT', () => {
  console.log('\n✋ Server stopped');
  process.exit(0);
});

module.exports = app;
