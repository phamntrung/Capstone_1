/**
 * ============================================
 * SmartExpense - Database Helper Hoàn Chỉnh
 * ============================================
 * File này cung cấp tất cả các hàm để kết nối và làm việc với database
 * Hỗ trợ: Backend Node.js
 * Database: MySQL
 * ============================================
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// ============================================
// CẤU HÌNH KẾT NỐI DATABASE
// ============================================

let pool = null;

/**
 * Lấy database connection pool
 * @returns {Promise<mysql.Pool>} Connection pool
 */
function getPool() {
  if (!pool) {
    const dbConfig = {
      host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
      user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
      password: process.env.DB_PASS || process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'smart_expense',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
      timezone: '+00:00' // Sử dụng UTC để tránh vấn đề timezone
    };

    pool = mysql.createPool(dbConfig);
    console.log(`✅ Database pool created: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  }
  return pool;
}

// ============================================
// HÀM KIỂM TRA VÀ KẾT NỐI
// ============================================

/**
 * Kiểm tra kết nối database
 * @returns {Promise<boolean>} true nếu kết nối thành công
 */
async function testConnection() {
  try {
    const connection = await getPool().getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ Database connection: OK');
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    return false;
  }
}

/**
 * Kiểm tra xem database có tồn tại không
 * @returns {Promise<boolean>} true nếu database tồn tại
 */
async function checkDatabaseExists() {
  try {
    const [results] = await getPool().execute('SELECT DATABASE()');
    return results[0]['DATABASE()'] !== null;
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    return false;
  }
}

/**
 * Kiểm tra xem table có tồn tại không
 * @param {string} tableName - Tên table cần kiểm tra
 * @returns {Promise<boolean>} true nếu table tồn tại
 */
async function checkTableExists(tableName) {
  try {
    const [results] = await getPool().execute(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [tableName]
    );
    return results[0].count > 0;
  } catch (error) {
    console.error(`❌ Error checking table ${tableName}:`, error.message);
    return false;
  }
}

// ============================================
// HÀM QUERY CƠ BẢN
// ============================================

/**
 * Thực thi query SQL
 * @param {string} sql - SQL query
 * @param {Array} params - Tham số cho query (optional)
 * @returns {Promise<Array>} Kết quả query
 */
async function query(sql, params = []) {
  try {
    const [results] = await getPool().execute(sql, params);
    return results;
  } catch (error) {
    console.error('❌ Database query error:', error.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  }
}

/**
 * Thực thi transaction (multiple queries)
 * @param {Function} callback - Function chứa các queries cần thực thi
 * @returns {Promise<any>} Kết quả của callback
 */
async function transaction(callback) {
  const connection = await getPool().getConnection();
  await connection.beginTransaction();
  
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    console.error('❌ Transaction error:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// ============================================
// HÀM QUẢN LÝ USERS
// ============================================

/**
 * Lấy user theo email
 * @param {string} email - Email của user
 * @returns {Promise<Object|null>} User object hoặc null
 */
async function getUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const results = await query(
    'SELECT * FROM users WHERE email = ?',
    [normalizedEmail]
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Lấy user theo ID
 * @param {number} id - ID của user
 * @returns {Promise<Object|null>} User object hoặc null
 */
async function getUserById(id) {
  const results = await query(
    'SELECT * FROM users WHERE id = ?',
    [id]
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Lấy user theo Google ID
 * @param {string} googleId - Google ID của user
 * @returns {Promise<Object|null>} User object hoặc null
 */
async function getUserByGoogleId(googleId) {
  const results = await query(
    'SELECT * FROM users WHERE google_id = ?',
    [googleId]
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Tạo user mới
 * @param {Object} userData - Thông tin user
 * @returns {Promise<Object>} User object đã tạo
 */
async function createUser(userData) {
  const { 
    name, 
    email, 
    password_hash, 
    role = 'user',
    google_id = null,
    login_method = 'password',
    avatar_url = null,
    email_verified = false,
    gender = null,
    currency = 'VND',
    phone = null
  } = userData;
  
  const normalizedEmail = email.trim().toLowerCase();
  
  const result = await query(
    `INSERT INTO users (
      name, email, password_hash, role, 
      google_id, login_method, avatar_url, email_verified,
      gender, currency, phone,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      name.trim(), 
      normalizedEmail, 
      password_hash, 
      role,
      google_id,
      login_method,
      avatar_url,
      email_verified,
      gender,
      currency,
      phone
    ]
  );
  
  return await getUserById(result.insertId);
}

/**
 * Cập nhật thông tin user
 * @param {number} userId - ID của user
 * @param {Object} updates - Các field cần cập nhật
 * @returns {Promise<Object>} User object đã cập nhật
 */
async function updateUser(userId, updates) {
  const fields = [];
  const values = [];
  
  const allowedFields = [
    'name', 'email', 'password_hash', 'role', 'balance',
    'gender', 'currency', 'phone',
    'google_id', 'login_method', 'avatar_url', 'email_verified',
    'last_login_at'
  ];
  
  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key) && updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      if (updates[key] instanceof Date) {
        values.push(updates[key].toISOString().slice(0, 19).replace('T', ' '));
      } else {
        values.push(updates[key]);
      }
    }
  });
  
  if (fields.length === 0) {
    return await getUserById(userId);
  }
  
  fields.push('updated_at = NOW()');
  values.push(userId);
  
  await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
  
  return await getUserById(userId);
}

// ============================================
// HÀM QUẢN LÝ CATEGORIES
// ============================================

/**
 * Lấy tất cả categories của user
 * @param {number} userId - ID của user
 * @returns {Promise<Array>} Danh sách categories
 */
async function getCategoriesByUserId(userId) {
  return await query(
    'SELECT * FROM categories WHERE user_id = ? ORDER BY name ASC',
    [userId]
  );
}

/**
 * Lấy category theo ID
 * @param {number} categoryId - ID của category
 * @param {number} userId - ID của user (để kiểm tra quyền sở hữu)
 * @returns {Promise<Object|null>} Category object hoặc null
 */
async function getCategoryById(categoryId, userId) {
  const results = await query(
    'SELECT * FROM categories WHERE id = ? AND user_id = ?',
    [categoryId, userId]
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Tạo category mới
 * @param {number} userId - ID của user
 * @param {string} name - Tên category
 * @returns {Promise<Object>} Category object đã tạo
 */
async function createCategory(userId, name) {
  const result = await query(
    'INSERT INTO categories (user_id, name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
    [userId, name.trim()]
  );
  return await getCategoryById(result.insertId, userId);
}

/**
 * Cập nhật category
 * @param {number} categoryId - ID của category
 * @param {number} userId - ID của user
 * @param {string} name - Tên mới
 * @returns {Promise<Object>} Category object đã cập nhật
 */
async function updateCategory(categoryId, userId, name) {
  await query(
    'UPDATE categories SET name = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
    [name.trim(), categoryId, userId]
  );
  return await getCategoryById(categoryId, userId);
}

/**
 * Xóa category
 * @param {number} categoryId - ID của category
 * @param {number} userId - ID của user
 * @returns {Promise<boolean>} true nếu xóa thành công
 */
async function deleteCategory(categoryId, userId) {
  const result = await query(
    'DELETE FROM categories WHERE id = ? AND user_id = ?',
    [categoryId, userId]
  );
  return result.affectedRows > 0;
}

// ============================================
// HÀM QUẢN LÝ EXPENSES
// ============================================

/**
 * Lấy tất cả expenses của user với filter
 * @param {number} userId - ID của user
 * @param {Object} filters - Các filter: date_from, date_to, categoryId, type
 * @returns {Promise<Array>} Danh sách expenses
 */
async function getExpensesByUserId(userId, filters = {}) {
  let sql = 'SELECT e.*, c.name as category_name FROM expenses e LEFT JOIN categories c ON e.category_id = c.id WHERE e.user_id = ?';
  const params = [userId];
  
  if (filters.date_from) {
    sql += ' AND e.date >= ?';
    params.push(filters.date_from);
  }
  
  if (filters.date_to) {
    sql += ' AND e.date <= ?';
    params.push(filters.date_to);
  }
  
  if (filters.categoryId) {
    sql += ' AND e.category_id = ?';
    params.push(filters.categoryId);
  }
  
  if (filters.type) {
    sql += ' AND e.type = ?';
    params.push(filters.type);
  }
  
  sql += ' ORDER BY e.date DESC, e.created_at DESC';
  
  return await query(sql, params);
}

/**
 * Lấy expense theo ID
 * @param {number} expenseId - ID của expense
 * @param {number} userId - ID của user
 * @returns {Promise<Object|null>} Expense object hoặc null
 */
async function getExpenseById(expenseId, userId) {
  const results = await query(
    `SELECT e.*, c.name as category_name 
     FROM expenses e 
     LEFT JOIN categories c ON e.category_id = c.id 
     WHERE e.id = ? AND e.user_id = ?`,
    [expenseId, userId]
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Tạo expense mới
 * @param {Object} expenseData - Thông tin expense
 * @returns {Promise<Object>} Expense object đã tạo
 */
async function createExpense(expenseData) {
  const {
    user_id,
    date,
    amount,
    type,
    category_id = null,
    note = null
  } = expenseData;
  
  const result = await query(
    `INSERT INTO expenses (user_id, date, amount, type, category_id, note, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [user_id, date, amount, type, category_id, note]
  );
  
  return await getExpenseById(result.insertId, user_id);
}

/**
 * Cập nhật expense
 * @param {number} expenseId - ID của expense
 * @param {number} userId - ID của user
 * @param {Object} updates - Các field cần cập nhật
 * @returns {Promise<Object>} Expense object đã cập nhật
 */
async function updateExpense(expenseId, userId, updates) {
  const fields = [];
  const values = [];
  
  const allowedFields = ['date', 'amount', 'type', 'category_id', 'note'];
  
  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key) && updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  });
  
  if (fields.length === 0) {
    return await getExpenseById(expenseId, userId);
  }
  
  fields.push('updated_at = NOW()');
  values.push(expenseId, userId);
  
  await query(
    `UPDATE expenses SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    values
  );
  
  return await getExpenseById(expenseId, userId);
}

/**
 * Xóa expense
 * @param {number} expenseId - ID của expense
 * @param {number} userId - ID của user
 * @returns {Promise<boolean>} true nếu xóa thành công
 */
async function deleteExpense(expenseId, userId) {
  const result = await query(
    'DELETE FROM expenses WHERE id = ? AND user_id = ?',
    [expenseId, userId]
  );
  return result.affectedRows > 0;
}

/**
 * Lấy tổng chi tiêu/thu nhập theo tháng
 * @param {number} userId - ID của user
 * @param {string} month - Tháng (format: YYYY-MM)
 * @returns {Promise<Object>} Tổng expense và income
 */
async function getMonthlySummary(userId, month) {
  const results = await query(
    `SELECT 
      COALESCE(SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END), 0) AS total_expense,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
      COUNT(*) AS transaction_count
     FROM expenses
     WHERE user_id = ? AND DATE_FORMAT(date, '%Y-%m') = ?`,
    [userId, month]
  );
  return results[0];
}

// ============================================
// HÀM QUẢN LÝ BUDGETS
// ============================================

/**
 * Lấy budget của user cho tháng
 * @param {number} userId - ID của user
 * @param {string} month - Tháng (format: YYYY-MM)
 * @returns {Promise<Object|null>} Budget object hoặc null
 */
async function getBudgetByMonth(userId, month) {
  const results = await query(
    'SELECT * FROM budgets WHERE user_id = ? AND month = ?',
    [userId, month]
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Tạo hoặc cập nhật budget
 * @param {number} userId - ID của user
 * @param {string} month - Tháng (format: YYYY-MM)
 * @param {number} amount - Số tiền budget
 * @returns {Promise<Object>} Budget object
 */
async function upsertBudget(userId, month, amount) {
  await query(
    `INSERT INTO budgets (user_id, month, amount, created_at, updated_at)
     VALUES (?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE amount = ?, updated_at = NOW()`,
    [userId, month, amount, amount]
  );
  return await getBudgetByMonth(userId, month);
}

/**
 * Lấy trạng thái budget (ngân sách vs chi tiêu thực tế)
 * @param {number} userId - ID của user
 * @param {string} month - Tháng (format: YYYY-MM)
 * @returns {Promise<Object>} Trạng thái budget
 */
async function getBudgetStatus(userId, month) {
  const results = await query(
    `CALL GetBudgetStatus(?, ?)`,
    [userId, month]
  );
  return results[0][0] || {
    budget_amount: 0,
    actual_expense: 0,
    remaining: 0,
    percentage_used: 0
  };
}

// ============================================
// HÀM QUẢN LÝ REPORTS
// ============================================

/**
 * Lấy report từ cache hoặc tính toán mới
 * @param {number} userId - ID của user
 * @param {string} reportType - Loại report: daily, monthly, category, summary
 * @param {string} period - Chu kỳ: YYYY-MM-DD hoặc YYYY-MM
 * @returns {Promise<Object|null>} Report object hoặc null
 */
async function getReport(userId, reportType, period) {
  const results = await query(
    'SELECT * FROM reports WHERE user_id = ? AND report_type = ? AND period = ?',
    [userId, reportType, period]
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Lưu report vào database
 * @param {Object} reportData - Dữ liệu report
 * @returns {Promise<Object>} Report object đã lưu
 */
async function saveReport(reportData) {
  const {
    user_id,
    report_type,
    period,
    amount,
    budget = null,
    transactions = 0,
    category_id = null,
    category_name = null,
    percentage = null,
    metadata = null
  } = reportData;
  
  await query(
    `INSERT INTO reports (
      user_id, report_type, period, amount, budget, transactions,
      category_id, category_name, percentage, metadata,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      amount = VALUES(amount),
      budget = VALUES(budget),
      transactions = VALUES(transactions),
      category_id = VALUES(category_id),
      category_name = VALUES(category_name),
      percentage = VALUES(percentage),
      metadata = VALUES(metadata),
      updated_at = NOW()`,
    [user_id, report_type, period, amount, budget, transactions,
     category_id, category_name, percentage, metadata ? JSON.stringify(metadata) : null]
  );
  
  return await getReport(user_id, report_type, period);
}

/**
 * Lấy cache report
 * @param {number} userId - ID của user
 * @param {string} cacheKey - Key của cache
 * @returns {Promise<Object|null>} Cache data hoặc null nếu đã hết hạn
 */
async function getReportCache(userId, cacheKey) {
  const results = await query(
    'SELECT * FROM report_cache WHERE user_id = ? AND cache_key = ? AND expires_at > NOW()',
    [userId, cacheKey]
  );
  
  if (results.length === 0) {
    return null;
  }
  
  const cache = results[0];
  try {
    cache.cache_data = JSON.parse(cache.cache_data);
  } catch (e) {
    console.error('Error parsing cache data:', e);
  }
  
  return cache;
}

/**
 * Lưu cache report
 * @param {number} userId - ID của user
 * @param {string} cacheKey - Key của cache
 * @param {Object} cacheData - Dữ liệu cache
 * @param {number} expiresInMinutes - Số phút hết hạn (mặc định 60 phút)
 * @returns {Promise<Object>} Cache object đã lưu
 */
async function saveReportCache(userId, cacheKey, cacheData, expiresInMinutes = 60) {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);
  
  await query(
    `INSERT INTO report_cache (user_id, cache_key, cache_data, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       cache_data = VALUES(cache_data),
       expires_at = VALUES(expires_at),
       updated_at = NOW()`,
    [userId, cacheKey, JSON.stringify(cacheData), expiresAt]
  );
  
  return await getReportCache(userId, cacheKey);
}

// ============================================
// HÀM QUẢN LÝ USER SETTINGS
// ============================================

/**
 * Lấy setting của user
 * @param {number} userId - ID của user
 * @param {string} settingKey - Key của setting
 * @returns {Promise<Object|null>} Setting object hoặc null
 */
async function getUserSetting(userId, settingKey) {
  const results = await query(
    'SELECT * FROM user_settings WHERE user_id = ? AND setting_key = ?',
    [userId, settingKey]
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Lấy tất cả settings của user
 * @param {number} userId - ID của user
 * @returns {Promise<Array>} Danh sách settings
 */
async function getUserSettings(userId) {
  return await query(
    'SELECT * FROM user_settings WHERE user_id = ?',
    [userId]
  );
}

/**
 * Lưu setting của user
 * @param {number} userId - ID của user
 * @param {string} settingKey - Key của setting
 * @param {string} settingValue - Giá trị setting
 * @returns {Promise<Object>} Setting object đã lưu
 */
async function saveUserSetting(userId, settingKey, settingValue) {
  await query(
    `INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at)
     VALUES (?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       setting_value = VALUES(setting_value),
       updated_at = NOW()`,
    [userId, settingKey, settingValue]
  );
  
  return await getUserSetting(userId, settingKey);
}

// ============================================
// HÀM UTILITY
// ============================================

/**
 * Đóng connection pool
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ Database pool closed');
  }
}

/**
 * Lấy thông tin database
 * @returns {Promise<Object>} Thông tin database
 */
async function getDatabaseInfo() {
  try {
    const [tables] = await query('SHOW TABLES');
    const [dbInfo] = await query('SELECT DATABASE() as db_name');
    
    return {
      database: dbInfo.db_name,
      tables: tables.map(t => Object.values(t)[0]),
      connectionPool: pool ? 'Active' : 'Inactive'
    };
  } catch (error) {
    console.error('Error getting database info:', error);
    return null;
  }
}

// ============================================
// EXPORT MODULE
// ============================================

module.exports = {
  // Connection
  getPool,
  testConnection,
  checkDatabaseExists,
  checkTableExists,
  closePool,
  getDatabaseInfo,
  
  // Basic Query
  query,
  transaction,
  
  // Users
  getUserByEmail,
  getUserById,
  getUserByGoogleId,
  createUser,
  updateUser,
  
  // Categories
  getCategoriesByUserId,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  
  // Expenses
  getExpensesByUserId,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getMonthlySummary,
  
  // Budgets
  getBudgetByMonth,
  upsertBudget,
  getBudgetStatus,
  
  // Reports
  getReport,
  saveReport,
  getReportCache,
  saveReportCache,
  
  // Settings
  getUserSetting,
  getUserSettings,
  saveUserSetting
};

