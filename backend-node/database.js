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

/**
 * Lấy tất cả categories của user
 */
async function getCategoriesByUserId(userId) {
  const results = await query(
    'SELECT * FROM categories WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return results;
}

/**
 * Lấy category theo ID
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
 */
async function createCategory(userData) {
  const {
    userId,
    name,
    color = '#3b82f6',
    note = '',
    isActive = true
  } = userData;

  const result = await query(
    `INSERT INTO categories (user_id, name, color, note, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [userId, name.trim(), color, note, isActive ? 1 : 0]
  );

  return await getCategoryById(result.insertId, userId);
}

/**
 * Cập nhật category
 */
async function updateCategory(categoryId, userId, updates) {
  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name.trim());
  }
  if (updates.color !== undefined) {
    fields.push('color = ?');
    values.push(updates.color);
  }
  if (updates.note !== undefined) {
    fields.push('note = ?');
    values.push(updates.note);
  }
  if (updates.isActive !== undefined) {
    fields.push('is_active = ?');
    values.push(updates.isActive ? 1 : 0);
  }

  if (fields.length === 0) {
    return await getCategoryById(categoryId, userId);
  }

  fields.push('updated_at = NOW()');
  values.push(categoryId, userId);

  await query(
    `UPDATE categories SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    values
  );

  return await getCategoryById(categoryId, userId);
}

/**
 * Xóa category
 */
async function deleteCategory(categoryId, userId) {
  const result = await query(
    'DELETE FROM categories WHERE id = ? AND user_id = ?',
    [categoryId, userId]
  );
  return result.affectedRows > 0;
}

/**
 * Lấy tất cả devices của user
 */
async function getDevicesByUserId(userId) {
  const results = await query(
    'SELECT * FROM devices WHERE user_id = ? ORDER BY last_activity_at DESC, created_at DESC',
    [userId]
  );
  return results;
}

/**
 * Lấy device theo ID
 */
async function getDeviceById(deviceId, userId) {
  const results = await query(
    'SELECT * FROM devices WHERE id = ? AND user_id = ?',
    [deviceId, userId]
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Tạo device mới
 */
async function createDevice(deviceData) {
  const {
    userId,
    deviceName,
    platform,
    browser,
    ipAddress,
    city,
    country,
    fingerprint,
    sessionToken,
    isTrusted = false,
    isBlocked = false,
    isCurrent = false
  } = deviceData;

  const result = await query(
    `INSERT INTO devices (
      user_id, device_name, platform, browser,
      ip_address, city, country, fingerprint, session_token,
      is_trusted, is_blocked, is_current, last_activity_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
    [
      userId, deviceName, platform, browser,
      ipAddress, city, country, fingerprint, sessionToken,
      isTrusted ? 1 : 0, isBlocked ? 1 : 0, isCurrent ? 1 : 0
    ]
  );

  return await getDeviceById(result.insertId, userId);
}

/**
 * Cập nhật device
 */
async function updateDevice(deviceId, userId, updates) {
  const fields = [];
  const values = [];

  if (updates.deviceName !== undefined) {
    fields.push('device_name = ?');
    values.push(updates.deviceName);
  }
  if (updates.platform !== undefined) {
    fields.push('platform = ?');
    values.push(updates.platform);
  }
  if (updates.browser !== undefined) {
    fields.push('browser = ?');
    values.push(updates.browser);
  }
  if (updates.isTrusted !== undefined) {
    fields.push('is_trusted = ?');
    values.push(updates.isTrusted ? 1 : 0);
  }
  if (updates.isBlocked !== undefined) {
    fields.push('is_blocked = ?');
    values.push(updates.isBlocked ? 1 : 0);
  }
  if (updates.isCurrent !== undefined) {
    fields.push('is_current = ?');
    values.push(updates.isCurrent ? 1 : 0);
  }
  if (updates.lastActivityAt !== undefined) {
    fields.push('last_activity_at = NOW()');
  }

  if (fields.length === 0) {
    return await getDeviceById(deviceId, userId);
  }

  fields.push('updated_at = NOW()');
  values.push(deviceId, userId);

  await query(
    `UPDATE devices SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    values
  );

  return await getDeviceById(deviceId, userId);
}

/**
 * Xóa device
 */
async function deleteDevice(deviceId, userId) {
  const result = await query(
    'DELETE FROM devices WHERE id = ? AND user_id = ?',
    [deviceId, userId]
  );
  return result.affectedRows > 0;
}

/**
 * Xóa tất cả devices của user (trừ thiết bị hiện tại)
 */
async function deleteAllDevicesExceptCurrent(userId, currentDeviceId) {
  const result = await query(
    'DELETE FROM devices WHERE user_id = ? AND id != ?',
    [userId, currentDeviceId]
  );
  return result.affectedRows;
}

module.exports = {
  getPool,
  testConnection,
  query,
  getUserByEmail,
  getUserById,
  createUser,
  updateUser,
  getCategoriesByUserId,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getDevicesByUserId,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  deleteAllDevicesExceptCurrent
};

