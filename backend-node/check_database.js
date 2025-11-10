/**
 * Script kiểm tra database MySQL
 * Kiểm tra xem có thiếu bảng, cột, hoặc dữ liệu nào không
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
  let connection;

  try {
    // Kết nối database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
      user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
      password: process.env.DB_PASS || process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'smart_expense'
    });

    console.log('✅ Đã kết nối database');
    console.log('');

    // 1. Kiểm tra các bảng cần thiết
    console.log('📋 Kiểm tra các bảng:');
    const [tables] = await connection.execute(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      ORDER BY table_name
    `);

    const requiredTables = [
      'users',
      'categories',
      'expenses',
      'budgets',
      'reports',
      'report_cache',
      'user_settings',
      'notifications',
      'devices'
    ];

    const existingTables = tables.map(t => t.table_name);
    console.log('   Bảng hiện có:', existingTables.join(', '));
    console.log('');

    for (const table of requiredTables) {
      if (existingTables.includes(table)) {
        console.log(`   ✅ ${table} - Tồn tại`);
      } else {
        console.log(`   ❌ ${table} - THIẾU`);
      }
    }
    console.log('');

    // 2. Kiểm tra cấu trúc bảng user_settings
    console.log('📋 Kiểm tra cấu trúc bảng user_settings:');
    try {
      const [columns] = await connection.execute(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'user_settings'
        ORDER BY ordinal_position
      `);

      if (columns.length > 0) {
        console.log('   Các cột trong user_settings:');
        columns.forEach(col => {
          console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
        });

        // Kiểm tra các cột cần thiết
        const requiredColumns = ['id', 'user_id', 'setting_key', 'setting_value', 'created_at', 'updated_at'];
        const existingColumns = columns.map(c => c.column_name);

        console.log('');
        for (const col of requiredColumns) {
          if (existingColumns.includes(col)) {
            console.log(`   ✅ ${col} - Tồn tại`);
          } else {
            console.log(`   ❌ ${col} - THIẾU`);
          }
        }
      } else {
        console.log('   ❌ Bảng user_settings không tồn tại!');
      }
    } catch (error) {
      console.log('   ❌ Lỗi kiểm tra bảng user_settings:', error.message);
    }
    console.log('');

    // 3. Kiểm tra indexes và constraints
    console.log('📋 Kiểm tra indexes và constraints của user_settings:');
    try {
      const [indexes] = await connection.execute(`
        SELECT index_name, column_name, non_unique
        FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = 'user_settings'
        ORDER BY index_name, seq_in_index
      `);

      if (indexes.length > 0) {
        console.log('   Các indexes:');
        const indexMap = {};
        indexes.forEach(idx => {
          if (!indexMap[idx.index_name]) {
            indexMap[idx.index_name] = [];
          }
          indexMap[idx.index_name].push(idx.column_name);
        });

        Object.keys(indexMap).forEach(indexName => {
          const isUnique = indexes.find(i => i.index_name === indexName)?.non_unique === 0;
          console.log(`   - ${indexName} (${isUnique ? 'UNIQUE' : 'INDEX'}): ${indexMap[indexName].join(', ')}`);
        });

        // Kiểm tra unique constraint cho (user_id, setting_key)
        const hasUniqueConstraint = indexes.some(
          idx => idx.index_name === 'unique_user_setting' && idx.non_unique === 0
        );
        if (hasUniqueConstraint) {
          console.log('   ✅ unique_user_setting constraint - Tồn tại');
        } else {
          console.log('   ❌ unique_user_setting constraint - THIẾU');
        }
      }
    } catch (error) {
      console.log('   ❌ Lỗi kiểm tra indexes:', error.message);
    }
    console.log('');

    // 4. Kiểm tra dữ liệu 2FA trong user_settings
    console.log('📋 Kiểm tra dữ liệu 2FA trong user_settings:');
    try {
      const [settings] = await connection.execute(`
        SELECT user_id, setting_key, setting_value, updated_at
        FROM user_settings
        WHERE setting_key LIKE 'two_factor%'
        ORDER BY user_id, setting_key, updated_at DESC
      `);

      if (settings.length > 0) {
        console.log(`   Tìm thấy ${settings.length} settings liên quan đến 2FA:`);

        const userSettings = {};
        settings.forEach(setting => {
          if (!userSettings[setting.user_id]) {
            userSettings[setting.user_id] = {};
          }
          // Chỉ lưu setting mới nhất nếu có nhiều
          if (!userSettings[setting.user_id][setting.setting_key] ||
              new Date(setting.updated_at) > new Date(userSettings[setting.user_id][setting.setting_key].updated_at)) {
            userSettings[setting.user_id][setting.setting_key] = {
              value: setting.setting_value?.substring(0, 50) + (setting.setting_value?.length > 50 ? '...' : ''),
              updated_at: setting.updated_at
            };
          }
        });

        Object.keys(userSettings).forEach(userId => {
          console.log(`   User ID ${userId}:`);
          Object.keys(userSettings[userId]).forEach(key => {
            const setting = userSettings[userId][key];
            console.log(`     - ${key}: ${setting.value} (updated: ${setting.updated_at})`);
          });
        });

        // Kiểm tra secret_temp có bị duplicate không
        const [duplicates] = await connection.execute(`
          SELECT user_id, setting_key, COUNT(*) as count
          FROM user_settings
          WHERE setting_key = 'two_factor_secret_temp'
          GROUP BY user_id, setting_key
          HAVING count > 1
        `);

        if (duplicates.length > 0) {
          console.log('');
          console.log('   ⚠️ CẢNH BÁO: Tìm thấy duplicate secret_temp:');
          duplicates.forEach(dup => {
            console.log(`     - User ${dup.user_id}: ${dup.count} records`);
          });
          console.log('');
          console.log('   💡 Giải pháp: Xóa duplicate records (giữ lại record mới nhất)');

          // Hiển thị tất cả secret_temp records để user biết
          const [allSecrets] = await connection.execute(`
            SELECT id, user_id, setting_key, setting_value, updated_at
            FROM user_settings
            WHERE setting_key = 'two_factor_secret_temp'
            ORDER BY user_id, updated_at DESC
          `);

          console.log('   Tất cả secret_temp records:');
          allSecrets.forEach(secret => {
            console.log(`     - ID ${secret.id}: User ${secret.user_id}, updated: ${secret.updated_at}, secret: ${secret.setting_value?.substring(0, 20)}...`);
          });
        } else {
          console.log('   ✅ Không có duplicate secret_temp');

          // Kiểm tra xem có nhiều secret_temp records cho cùng 1 user không (không phải duplicate do unique constraint)
          const [allSecrets] = await connection.execute(`
            SELECT id, user_id, setting_key, setting_value, updated_at
            FROM user_settings
            WHERE setting_key = 'two_factor_secret_temp'
            ORDER BY user_id, updated_at DESC
          `);

          const userSecretCount = {};
          allSecrets.forEach(secret => {
            if (!userSecretCount[secret.user_id]) {
              userSecretCount[secret.user_id] = [];
            }
            userSecretCount[secret.user_id].push(secret);
          });

          Object.keys(userSecretCount).forEach(userId => {
            if (userSecretCount[userId].length > 1) {
              console.log('');
              console.log(`   ⚠️ User ${userId} có ${userSecretCount[userId].length} secret_temp records:`);
              userSecretCount[userId].forEach((secret, index) => {
                console.log(`     ${index + 1}. ID ${secret.id}, updated: ${secret.updated_at}, secret: ${secret.setting_value?.substring(0, 20)}...`);
              });
              console.log(`   💡 Nên xóa các secret cũ, chỉ giữ lại secret mới nhất (ID ${userSecretCount[userId][0].id})`);
            }
          });
        }
      } else {
        console.log('   ℹ️ Chưa có dữ liệu 2FA nào');
      }
    } catch (error) {
      console.log('   ❌ Lỗi kiểm tra dữ liệu:', error.message);
    }
    console.log('');

    // 5. Kiểm tra users table
    console.log('📋 Kiểm tra bảng users:');
    try {
      const [users] = await connection.execute(`
        SELECT id, email, name, login_method
        FROM users
        ORDER BY id
        LIMIT 10
      `);

      if (users.length > 0) {
        console.log(`   Tìm thấy ${users.length} users:`);
        users.forEach(user => {
          console.log(`     - ID ${user.id}: ${user.email} (${user.name}, method: ${user.login_method})`);
        });
      } else {
        console.log('   ℹ️ Chưa có user nào');
      }
    } catch (error) {
      console.log('   ❌ Lỗi kiểm tra users:', error.message);
    }
    console.log('');

    console.log('✅ Hoàn tất kiểm tra database!');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    console.error(error.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Chạy script
checkDatabase();

