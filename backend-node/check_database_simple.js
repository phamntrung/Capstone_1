/**
 * Script kiểm tra database MySQL - Phiên bản đơn giản
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
      user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
      password: process.env.DB_PASS || process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'smart_expense'
    });

    console.log('✅ Đã kết nối database\n');

    // 1. Kiểm tra bảng user_settings có tồn tại không
    console.log('📋 Kiểm tra bảng user_settings:');
    try {
      const [tables] = await connection.execute("SHOW TABLES LIKE 'user_settings'");
      if (tables.length > 0) {
        console.log('   ✅ Bảng user_settings tồn tại');

        // Kiểm tra cấu trúc bảng
        const [columns] = await connection.execute("DESCRIBE user_settings");
        console.log('   Các cột:');
        columns.forEach(col => {
          console.log(`     - ${col.Field} (${col.Type}, ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });
      } else {
        console.log('   ❌ Bảng user_settings KHÔNG tồn tại!');
        console.log('   💡 Cần chạy database_schema.sql để tạo bảng');
      }
    } catch (error) {
      console.log('   ❌ Lỗi:', error.message);
    }
    console.log('');

    // 2. Kiểm tra dữ liệu 2FA
    console.log('📋 Kiểm tra dữ liệu 2FA:');
    try {
      const [settings] = await connection.execute(`
        SELECT id, user_id, setting_key,
               LEFT(setting_value, 30) as secret_preview,
               LENGTH(setting_value) as secret_length,
               updated_at
        FROM user_settings
        WHERE setting_key LIKE 'two_factor%'
        ORDER BY user_id, setting_key, updated_at DESC
      `);

      if (settings.length > 0) {
        console.log(`   Tìm thấy ${settings.length} records:`);
        settings.forEach(s => {
          console.log(`     - ID ${s.id}: User ${s.user_id}, Key: ${s.setting_key}`);
          console.log(`       Secret: ${s.secret_preview}... (length: ${s.secret_length})`);
          console.log(`       Updated: ${s.updated_at}`);
          console.log('');
        });

        // Kiểm tra secret_temp cho user 1
        const [user1Secrets] = await connection.execute(`
          SELECT id, setting_key, setting_value, updated_at
          FROM user_settings
          WHERE user_id = 1 AND setting_key = 'two_factor_secret_temp'
          ORDER BY updated_at DESC
        `);

        if (user1Secrets.length > 0) {
          console.log(`   User ID 1 có ${user1Secrets.length} secret_temp record(s):`);
          user1Secrets.forEach((secret, index) => {
            console.log(`     ${index + 1}. ID ${secret.id}: ${secret.setting_value} (updated: ${secret.updated_at})`);
          });

          if (user1Secrets.length > 1) {
            console.log('');
            console.log('   ⚠️ CẢNH BÁO: User 1 có nhiều secret_temp records!');
            console.log('   💡 Nên xóa các secret cũ, chỉ giữ lại secret mới nhất');
            console.log('   💡 Secret mới nhất: ID', user1Secrets[0].id);
          }
        }
      } else {
        console.log('   ℹ️ Chưa có dữ liệu 2FA');
      }
    } catch (error) {
      console.log('   ❌ Lỗi:', error.message);
    }
    console.log('');

    // 3. Kiểm tra unique constraint
    console.log('📋 Kiểm tra unique constraint:');
    try {
      const [indexes] = await connection.execute(`
        SHOW INDEXES FROM user_settings
      `);

      console.log('   Các indexes:');
      indexes.forEach(idx => {
        console.log(`     - ${idx.Key_name} (${idx.Non_unique === 0 ? 'UNIQUE' : 'INDEX'}): ${idx.Column_name}`);
      });

      const hasUnique = indexes.some(idx =>
        idx.Key_name === 'unique_user_setting' && idx.Non_unique === 0
      );

      if (hasUnique) {
        console.log('   ✅ unique_user_setting constraint tồn tại');
      } else {
        console.log('   ❌ unique_user_setting constraint THIẾU');
        console.log('   💡 Cần thêm unique constraint:');
        console.log('      ALTER TABLE user_settings ADD UNIQUE KEY unique_user_setting (user_id, setting_key);');
      }
    } catch (error) {
      console.log('   ❌ Lỗi:', error.message);
    }
    console.log('');

    console.log('✅ Hoàn tất kiểm tra!');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkDatabase();

