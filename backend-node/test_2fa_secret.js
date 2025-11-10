/**
 * Script test 2FA secret - Kiểm tra secret có hoạt động đúng không
 */

const mysql = require('mysql2/promise');
const speakeasy = require('speakeasy');
require('dotenv').config();

async function test2FASecret() {
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

    // Lấy secret của user 1
    const [secrets] = await connection.execute(`
      SELECT id, user_id, setting_key, setting_value, updated_at
      FROM user_settings
      WHERE user_id = 1 AND setting_key = 'two_factor_secret_temp'
      ORDER BY updated_at DESC
      LIMIT 1
    `);

    if (secrets.length === 0) {
      console.log('❌ Không tìm thấy secret_temp cho user 1');
      return;
    }

    const secret = secrets[0];
    console.log('📋 Secret trong database:');
    console.log(`   ID: ${secret.id}`);
    console.log(`   User ID: ${secret.user_id}`);
    console.log(`   Key: ${secret.setting_key}`);
    console.log(`   Secret: ${secret.setting_value}`);
    console.log(`   Updated: ${secret.updated_at}`);
    console.log('');

    // Clean secret
    const cleanSecret = secret.setting_value.replace(/\s+/g, '').toUpperCase();
    console.log('📋 Secret sau khi clean:');
    console.log(`   ${cleanSecret}`);
    console.log(`   Length: ${cleanSecret.length}`);
    console.log('');

    // Generate test codes
    console.log('📋 Generate test codes:');
    const now = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(now / 30);

    console.log(`   Current time: ${now}`);
    console.log(`   Time step: ${timeStep}`);
    console.log('');

    // Generate code hiện tại
    const currentCode = speakeasy.totp({
      secret: cleanSecret,
      encoding: 'base32'
    });
    console.log(`   Code hiện tại (time step ${timeStep}): ${currentCode}`);

    // Generate code cho các time step trước và sau
    for (let i = -5; i <= 5; i++) {
      const testTimeStep = timeStep + i;
      const testTime = testTimeStep * 30;
      const testCode = speakeasy.totp({
        secret: cleanSecret,
        encoding: 'base32',
        time: testTime
      });
      console.log(`   Code time step ${testTimeStep} (${i > 0 ? '+' : ''}${i}): ${testCode}`);
    }
    console.log('');

    // Test verify với code hiện tại
    console.log('📋 Test verify:');
    const verified = speakeasy.totp.verify({
      secret: cleanSecret,
      encoding: 'base32',
      token: currentCode,
      window: 2
    });
    console.log(`   Verify code hiện tại (${currentCode}): ${verified ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    // Test với code từ user (173122)
    const userCode = '173122';
    console.log(`   Verify code từ user (${userCode}):`);
    const verifiedUserCode = speakeasy.totp.verify({
      secret: cleanSecret,
      encoding: 'base32',
      token: userCode,
      window: 15
    });
    console.log(`   Result: ${verifiedUserCode ? '✅ PASS' : '❌ FAIL'}`);

    if (!verifiedUserCode) {
      console.log('');
      console.log('   ⚠️ Code từ user không khớp với secret trong database!');
      console.log('   💡 Có thể user đang dùng secret cũ hoặc QR code từ lần generate trước');
      console.log('   💡 Giải pháp: User cần tạo secret mới và scan QR code mới');
    }

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    console.error(error.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

test2FASecret();

