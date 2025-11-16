const express = require('express');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Cố gắng nạp module database (MySQL). Nếu không có sẽ fallback sang bộ nhớ tạm.
let db = null;
try {
  db = require('../database');
} catch (error) {
  console.warn('⚠️ Không thể nạp database module cho admin routes, sẽ dùng dữ liệu in-memory nếu có.');
}

// Dữ liệu in-memory (fallback khi không có database thực)
const memoryExpenses = require('../data/expenses');
const { usersByEmail } = require('../middleware/auth');

/**
 * Chuẩn hoá role về dạng thường và bỏ khoảng trắng để so sánh.
 * @param {string} role
 * @returns {string}
 */
function normalizeRole(role) {
  return (role || '').toString().trim().toLowerCase();
}

/**
 * Kiểm tra role có phải admin hay không.
 * @param {string} role
 * @returns {boolean}
 */
function isAdminRole(role) {
  const normalized = normalizeRole(role);
  return ['admin', 'super_admin', 'superadmin', 'owner', 'root'].includes(normalized);
}

/**
 * Middleware: chỉ cho phép admin truy cập.
 */
function ensureAdmin(req, res, next) {
  if (!req.user || !isAdminRole(req.user.role)) {
    return res.status(403).json({
      message: 'Bạn không có quyền truy cập trang quản trị.',
      code: 'ADMIN_ONLY'
    });
  }
  next();
}

/**
 * Định dạng Date (hoặc chuỗi ngày) về dạng YYYY-MM-DD.
 * @param {Date|string} value
 * @returns {string}
 */
function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Loại bỏ dấu tiếng Việt để thuận tiện so sánh.
 * @param {string} value
 * @returns {string}
 */
function stripVietnameseTone(value) {
  return (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Quy đổi tên danh mục chi tiêu về 4 nhóm cố định.
 * @param {string} categoryName
 * @param {string} type
 * @returns {'Ăn uống'|'Cố định'|'Chơi'|'Khác'}
 */
function mapCategoryGroup(categoryName, type) {
  const normalized = stripVietnameseTone(categoryName);

  if (normalized.includes('an uong') || normalized.includes('food') || normalized.includes('drink') || normalized.includes('coffee') || normalized.includes('eat')) {
    return 'Ăn uống';
  }

  if (
    normalized.includes('co dinh') ||
    normalized.includes('dinh ky') ||
    normalized.includes('rent') ||
    normalized.includes('nha') ||
    normalized.includes('dien') ||
    normalized.includes('nuoc') ||
    normalized.includes('internet') ||
    normalized.includes('bill') ||
    normalized.includes('hoa don')
  ) {
    return 'Cố định';
  }

  if (
    normalized.includes('choi') ||
    normalized.includes('giai tri') ||
    normalized.includes('game') ||
    normalized.includes('travel') ||
    normalized.includes('du lich') ||
    normalized.includes('sport') ||
    normalized.includes('movie')
  ) {
    return 'Chơi';
  }

  // Nếu là thu nhập (income) thì cũng gom vào "Khác" để không làm sai lệch biểu đồ chi tiêu.
  if ((type || '').toLowerCase() === 'income') {
    return 'Khác';
  }

  return 'Khác';
}

/**
 * Tạo danh sách ngày liên tiếp cho biểu đồ.
 * @param {number} rangeDays
 * @returns {string[]}
 */
function generateDateSeries(rangeDays) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const series = [];
  for (let i = rangeDays - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    series.push(formatDate(day));
  }
  return series;
}

/**
 * Tổng hợp dữ liệu từ database MySQL.
 */
async function collectOverviewFromDatabase(rangeDays) {
  const startSeries = generateDateSeries(rangeDays);
  const startDate = startSeries[0];

  const [userRows, txRows, revenueRows, trendRows, categoryRows, recentRows] = await Promise.all([
    db.query('SELECT COUNT(*) AS total_users FROM users'),
    db.query('SELECT COUNT(*) AS total_transactions FROM expenses'),
    db.query(`SELECT
                IFNULL(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS total_income,
                IFNULL(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0) AS total_spending
              FROM expenses`),
    db.query(
      `SELECT
         DATE_FORMAT(date, '%Y-%m-%d') AS day,
         COUNT(*) AS tx_count,
         SUM(ABS(amount)) AS total_amount
       FROM expenses
       WHERE date >= ?
       GROUP BY day
       ORDER BY day ASC`,
      [startDate]
    ),
    // Query phân bố giao dịch: lấy tất cả chi tiêu từ tất cả user accounts
    // Đảm bảo JOIN category đúng với user_id để đồng bộ dữ liệu từ các tài khoản
    db.query(
      `SELECT
         COALESCE(LOWER(c.name), '') AS category_name,
         e.type,
         SUM(ABS(e.amount)) AS total_amount
       FROM expenses e
       LEFT JOIN categories c ON e.category_id = c.id AND c.user_id = e.user_id
       WHERE e.amount < 0
       GROUP BY category_name, e.type`
    ),
    db.query(
      `SELECT
         e.id,
         e.user_id,
         DATE_FORMAT(e.date, '%Y-%m-%d') AS date,
         DATE_FORMAT(e.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         e.amount,
         e.type,
         e.note,
         u.name AS user_name,
         u.email AS user_email
       FROM expenses e
       LEFT JOIN users u ON u.id = e.user_id
       ORDER BY e.date DESC, e.created_at DESC
       LIMIT 6`
    )
  ]);

  // ===== Metrics =====
  const totalUsers = Number(userRows?.[0]?.total_users || 0);
  const totalTransactions = Number(txRows?.[0]?.total_transactions || 0);
  const totalRevenue = Number(revenueRows?.[0]?.total_income || 0);
  const totalExpense = Math.abs(Number(revenueRows?.[0]?.total_spending || 0));

  // ===== Trend (biểu đồ đường) =====
  const trendMap = new Map(startSeries.map((day) => [day, { amount: 0, count: 0 }]));
  trendRows.forEach((row) => {
    const dayKey = row.day;
    if (!trendMap.has(dayKey)) return;
    const current = trendMap.get(dayKey);
    current.amount = Number(row.total_amount || 0);
    current.count = Number(row.tx_count || 0);
  });

  const trendLabels = [];
  const trendValues = [];
  let trendAmountTotal = 0;
  let trendCountTotal = 0;

  trendMap.forEach((value, key) => {
    trendLabels.push(key);
    trendValues.push(value.amount);
    trendAmountTotal += value.amount;
    trendCountTotal += value.count;
  });

  // ===== Categories =====
  const categoryTotals = {
    'Ăn uống': 0,
    'Cố định': 0,
    'Chơi': 0,
    'Khác': 0
  };

  categoryRows.forEach((row) => {
    const groupName = mapCategoryGroup(row.category_name, row.type);
    categoryTotals[groupName] += Number(row.total_amount || 0);
  });

  const totalCategoryAmount = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
  const categories = Object.entries(categoryTotals).map(([name, amount]) => ({
    name,
    amount,
    percentage: totalCategoryAmount > 0 ? Math.round((amount / totalCategoryAmount) * 100) : 0
  }));

  // ===== Recent transactions =====
  const recentTransactions = recentRows.map((row) => ({
    id: row.id,
    code: `#TX${String(row.id).padStart(5, '0')}`,
    userId: row.user_id,
    userName: row.user_name || 'Không rõ',
    userEmail: row.user_email || '',
    amount: Number(row.amount || 0),
    type: row.type || 'expense',
    note: row.note || '',
    date: row.date,
    createdAt: row.created_at
  }));

  return {
    metrics: {
      totalUsers,
      totalTransactions,
      totalRevenue,
      totalExpense
    },
    trend: {
      range: rangeDays,
      labels: trendLabels,
      values: trendValues,
      totalAmount: trendAmountTotal,
      totalTransactions: trendCountTotal
    },
    categories,
    recentTransactions
  };
}

/**
 * Tổng hợp dữ liệu từ bộ nhớ tạm (khi không có database).
 * Dữ liệu in-memory đơn giản nên chỉ trả về con số cơ bản.
 */
function collectOverviewFromMemory(rangeDays) {
  const memoryUsers = Array.from(usersByEmail.values());
  const expenses = Array.isArray(memoryExpenses) ? memoryExpenses : [];

  const metrics = {
    totalUsers: memoryUsers.length,
    totalTransactions: expenses.length,
    totalRevenue: expenses
      .filter((item) => Number(item.amount || 0) > 0)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    totalExpense: expenses
      .filter((item) => Number(item.amount || 0) < 0)
      .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0)
  };

  const labels = generateDateSeries(rangeDays);
  const values = labels.map(() => 0);

  const categories = [
    { name: 'Ăn uống', amount: 0, percentage: 0 },
    { name: 'Cố định', amount: 0, percentage: 0 },
    { name: 'Chơi', amount: 0, percentage: 0 },
    { name: 'Khác', amount: metrics.totalExpense, percentage: metrics.totalExpense > 0 ? 100 : 0 }
  ];

  const recentTransactions = expenses
    .slice(-6)
    .reverse()
    .map((item, index) => ({
      id: item.id || index + 1,
      code: item.id ? `#TX${String(item.id).padStart(5, '0')}` : `#TX${String(index + 1).padStart(5, '0')}`,
      userId: item.userId || null,
      userName: 'Người dùng',
      userEmail: '',
      amount: Number(item.amount || 0),
      type: item.type || 'expense',
      note: item.note || '',
      date: formatDate(item.date || new Date()),
      createdAt: formatDate(item.date || new Date())
    }));

  return {
    metrics,
    trend: {
      range: rangeDays,
      labels,
      values,
      totalAmount: 0,
      totalTransactions: metrics.totalTransactions
    },
    categories,
    recentTransactions,
    fallback: true
  };
}

/**
 * API tổng quan cho trang Admin.
 * Trả về số liệu tổng hợp được tính từ toàn bộ tài khoản người dùng.
 */
// Test route to verify routing works
router.get('/test', (req, res) => {
  console.log('✅ /api/admin/test route hit');
  res.json({ ok: true, message: 'Admin routes are working!' });
});

router.get('/overview', authRequired, ensureAdmin, async (req, res) => {
  try {
    const rawRange = parseInt(req.query.range, 10);
    let rangeDays = Number.isFinite(rawRange) ? rawRange : 30;
    if (rangeDays < 7) rangeDays = 7;
    if (rangeDays > 90) rangeDays = 90;

    const overview = db && db.query
      ? await collectOverviewFromDatabase(rangeDays)
      : collectOverviewFromMemory(rangeDays);

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      data: overview
    });
  } catch (error) {
    console.error('❌ Lỗi lấy dữ liệu tổng quan admin:', error);
    res.status(500).json({
      ok: false,
      message: 'Không thể lấy dữ liệu tổng quan admin.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * API lấy danh sách users cho trang Admin.
 * Trả về danh sách tất cả users trong hệ thống với thông tin chi tiết.
 */
router.get('/users', authRequired, ensureAdmin, async (req, res) => {
  try {
    console.log('📥 API /api/admin/users được gọi');
    console.log('📥 Request details:', {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      url: req.url,
      hasUser: !!req.user,
      userRole: req.user?.role
    });
    let users = [];

    if (db && db.query) {
      console.log('✅ Database có sẵn, đang query...');
      try {
        // Test connection trước
        try {
          await db.query('SELECT 1 as test');
          console.log('✅ Database connection test thành công');
        } catch (testError) {
          console.error('❌ Database connection test failed:', testError);
          throw new Error(`Database connection failed: ${testError.message}`);
        }

        // Lấy từ database
        let userRows, txCountRows;
        try {
          userRows = await db.query(`
            SELECT 
              u.id,
              u.name,
              u.email,
              u.role,
              u.avatar_url,
              DATE_FORMAT(u.created_at, '%Y-%m-%d') AS joined,
              u.email_verified,
              u.is_blocked
            FROM users u
            ORDER BY u.created_at DESC
          `);
          console.log('✅ Query users thành công');
        } catch (userQueryError) {
          console.error('❌ Lỗi query users:', userQueryError);
          console.error('❌ SQL Error Code:', userQueryError.code);
          console.error('❌ SQL Error SQL State:', userQueryError.sqlState);
          throw new Error(`Query users failed: ${userQueryError.message}`);
        }

        try {
          txCountRows = await db.query(`
            SELECT 
              user_id,
              COUNT(*) AS tx_count
            FROM expenses
            GROUP BY user_id
          `);
          console.log('✅ Query transaction counts thành công');
        } catch (txQueryError) {
          console.error('⚠️ Lỗi query transaction counts (sẽ dùng 0):', txQueryError.message);
          txCountRows = []; // Fallback về empty array
        }

        console.log('📊 Số lượng users từ DB:', userRows?.length || 0);
        console.log('📊 Số lượng transaction counts:', txCountRows?.length || 0);
        console.log('📋 Sample user row:', userRows?.[0]);
        
        // Validate userRows
        if (!Array.isArray(userRows)) {
          console.error('❌ userRows không phải array:', typeof userRows, userRows);
          throw new Error('Invalid userRows format from database');
        }

        // Tạo map số lượng giao dịch theo user_id
        const txCountMap = new Map();
        (txCountRows || []).forEach(row => {
          txCountMap.set(row.user_id, Number(row.tx_count || 0));
        });

        // Format users
        console.log('🔄 Đang format users...');
        users = (userRows || []).map((row, index) => {
          try {
            const userId = row.id;
            if (!userId) {
              console.warn(`⚠️ User row ${index} không có id:`, row);
            }
            const txCount = txCountMap.get(userId) || 0;
            
            // Xác định status
            let status = 'active';
            if (row.is_blocked) {
              status = 'blocked';
            } else if (!row.email_verified) {
              status = 'pending';
            }

            // Xác định tags
            const tags = [];
            if (txCount >= 200) {
              tags.push('active');
            }
            
            // Parse joined date safely
            let joinedDateStr = row.joined || formatDate(new Date());
            try {
              if (row.joined) {
                const joinedDate = new Date(row.joined + 'T00:00:00');
                if (!isNaN(joinedDate.getTime())) {
                  const daysSinceJoined = (Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24);
                  if (daysSinceJoined <= 7) {
                    tags.push('new');
                  }
                }
              }
            } catch (dateError) {
              console.warn(`⚠️ Lỗi parse date cho user ${userId}:`, dateError.message);
            }

            return {
              id: String(userId || `unknown_${index}`),
              name: row.name || 'Không có tên',
              email: row.email || '',
              avatar: row.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name || 'User')}&background=random`,
              joined: joinedDateStr,
              tx: txCount,
              status: status,
              role: (row.role || 'user').toLowerCase(),
              tags: tags
            };
          } catch (rowError) {
            console.error(`❌ Lỗi format user row ${index}:`, rowError, row);
            // Return a safe default user object
            return {
              id: String(row?.id || `error_${index}`),
              name: row?.name || 'Lỗi dữ liệu',
              email: row?.email || '',
              avatar: `https://ui-avatars.com/api/?name=Error&background=random`,
              joined: formatDate(new Date()),
              tx: 0,
              status: 'active',
              role: 'user',
              tags: []
            };
          }
        });
        console.log('✅ Đã format xong, số lượng users:', users.length);
      } catch (dbError) {
        console.error('❌ Lỗi khi query database:', dbError);
        console.error('❌ Error stack:', dbError.stack);
        console.error('❌ Error message:', dbError.message);
        // Fallback về memory nếu có lỗi database
        throw dbError; // Re-throw để catch ở ngoài xử lý
      }
    } else {
      console.log('⚠️ Database không có sẵn, dùng fallback từ memory');
      // Fallback: lấy từ memory (usersByEmail)
      const memoryUsers = Array.from(usersByEmail.values());
      users = memoryUsers.map((user, index) => ({
        id: String(user.id || `U${String(index + 1).padStart(3, '0')}`),
        name: user.name || 'Người dùng',
        email: user.email || '',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`,
        joined: formatDate(user.createdAt || new Date()),
        tx: 0,
        status: 'active',
        role: (user.role || 'user').toLowerCase(),
        tags: []
      }));
    }

    console.log('📤 Trả về response với', users.length, 'users');
    res.json({
      ok: true,
      data: users,
      total: users.length
    });
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách users admin:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    res.status(500).json({
      ok: false,
      message: 'Không thể lấy danh sách users.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;

