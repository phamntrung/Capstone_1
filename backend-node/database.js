const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;

/**
 * Lấy database connection pool
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
      charset: 'utf8mb4'
    };

    pool = mysql.createPool(dbConfig);
    console.log(`✅ Database pool created: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  }
  return pool;
}

/**
 * Kiểm tra kết nối database
 */
async function testConnection() {
  try {
    const connection = await getPool().getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    return false;
  }
}

/**
 * Query database
 */
async function query(sql, params = []) {
  try {
    const [results] = await getPool().execute(sql, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Lấy user theo email
 */
async function getUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  console.log(`🔍 Querying user by email: ${normalizedEmail}`);
  const results = await query(
    'SELECT * FROM users WHERE email = ?',
    [normalizedEmail]
  );
  if (results.length > 0) {
    console.log(`✅ User found: ${results[0].email} (ID: ${results[0].id})`);
  } else {
    console.log(`❌ User not found: ${normalizedEmail}`);
  }
  return results.length > 0 ? results[0] : null;
}

/**
 * Lấy user theo ID
 */
async function getUserById(id) {
  const results = await query(
    'SELECT * FROM users WHERE id = ?',
    [id]
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Tạo user mới
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
    email_verified = false
  } = userData;
  const normalizedEmail = email.trim().toLowerCase();
  
  const result = await query(
    `INSERT INTO users (
      name, email, password_hash, role, 
      google_id, login_method, avatar_url, email_verified,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      name.trim(), 
      normalizedEmail, 
      password_hash, 
      role,
      google_id,
      login_method,
      avatar_url,
      email_verified
    ]
  );
  
  return await getUserById(result.insertId);
}

/**
 * Cập nhật user
 */
async function updateUser(userId, updates) {
  const fields = [];
  const values = [];
  
  // Map JavaScript property names to database column names
  const columnMap = {
    last_login_at: 'last_login_at',
    google_id: 'google_id',
    login_method: 'login_method',
    avatar_url: 'avatar_url',
    email_verified: 'email_verified'
  };
  
  Object.keys(updates).forEach(key => {
    if (updates[key] !== undefined) {
      const dbColumn = columnMap[key] || key;
      fields.push(`${dbColumn} = ?`);
      // Convert Date objects to MySQL datetime format
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

module.exports = {
  getPool,
  testConnection,
  query,
  getUserByEmail,
  getUserById,
  createUser,
  updateUser
};

