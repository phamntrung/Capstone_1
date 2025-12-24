const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { authRequired } = require('../middleware/auth');
const db = require('../database');
const twilioService = require('../services/twilioService');

const router = express.Router();

/**
 * GET /api/2fa/status - Lấy trạng thái 2FA của user
 */
router.get('/status', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    // Lấy setting từ database
    const settings = await db.query(
      'SELECT setting_key, setting_value FROM user_settings WHERE user_id = ? AND setting_key IN (?, ?)',
      [userId, 'two_factor_enabled', 'two_factor_method']
    );

    const enabled = settings.find(s => s.setting_key === 'two_factor_enabled');
    const method = settings.find(s => s.setting_key === 'two_factor_method');

    res.json({
      enabled: enabled && enabled.setting_value === 'true',
      method: method ? method.setting_value : null
    });
  } catch (error) {
    console.error('Get 2FA status error:', error);
    res.status(500).json({ message: 'Lỗi lấy trạng thái 2FA' });
  }
});

/**
 * POST /api/2fa/generate - Tạo secret và QR code mới
 */
router.post('/generate', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Tạo secret mới
    const secret = speakeasy.generateSecret({
      name: `SmartExpense (${userEmail})`,
      length: 32
    });

    // Đảm bảo secret không có khoảng trắng và uppercase
    const cleanSecret = secret.base32.replace(/\s+/g, '').toUpperCase();

    // Validate secret format (base32 chỉ chứa A-Z, 2-7)
    if (!/^[A-Z2-7]+$/.test(cleanSecret)) {
      console.error('❌ Invalid secret format:', cleanSecret);
      return res.status(500).json({ message: 'Lỗi tạo secret: format không hợp lệ' });
    }

    // Xóa tất cả secret_temp cũ trước khi tạo mới (đảm bảo chỉ có 1 secret)
    await db.query(
      'DELETE FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [userId, 'two_factor_secret_temp']
    );

    // Lưu secret tạm thời vào database (chưa kích hoạt)
    await db.query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [userId, 'two_factor_secret_temp', cleanSecret]
    );

    // Verify secret đã được lưu đúng
    const savedSecret = await db.query(
      'SELECT setting_value, updated_at FROM user_settings WHERE user_id = ? AND setting_key = ? ORDER BY updated_at DESC LIMIT 1',
      [userId, 'two_factor_secret_temp']
    );

    if (!savedSecret || savedSecret.length === 0 || savedSecret[0].setting_value !== cleanSecret) {
      console.error('❌ Secret not saved correctly:', {
        expected: cleanSecret,
        saved: savedSecret?.[0]?.setting_value
      });
      return res.status(500).json({ message: 'Lỗi lưu secret vào database' });
    }

    // Tạo QR code với secret đã clean
    const otpauthUrl = speakeasy.otpauthURL({
      secret: cleanSecret,
      label: `SmartExpense (${userEmail})`,
      issuer: 'SmartExpense',
      encoding: 'base32'
    });
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    // Generate test code để verify secret hoạt động
    const testCode = speakeasy.totp({
      secret: cleanSecret,
      encoding: 'base32'
    });

    console.log('2FA Generate:', {
      userId: userId,
      email: userEmail,
      secretLength: cleanSecret.length,
      secretPreview: cleanSecret.substring(0, 8) + '...',
      secretEnd: '...' + cleanSecret.substring(cleanSecret.length - 4),
      secretFull: cleanSecret, // Log full secret để debug (chỉ trong development)
      testCode: testCode, // Code được generate từ secret này
      savedSecretMatch: savedSecret[0].setting_value === cleanSecret,
      savedAt: savedSecret[0].updated_at
    });

    res.json({
      secret: cleanSecret,
      qrCode: qrCodeUrl,
      manualEntryKey: cleanSecret
    });
  } catch (error) {
    console.error('Generate 2FA secret error:', error);
    res.status(500).json({ message: 'Lỗi tạo secret' });
  }
});

/**
 * POST /api/2fa/verify - Verify mã 6 số và kích hoạt 2FA
 */
router.post('/verify', authRequired, async (req, res) => {
  try {
    const { code, method = 'app' } = req.body;
    const userId = req.user.id;

    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: 'Mã phải là 6 chữ số' });
    }

    // Lấy secret tạm thời (lấy secret mới nhất)
    const secretResult = await db.query(
      'SELECT setting_value, updated_at FROM user_settings WHERE user_id = ? AND setting_key = ? ORDER BY updated_at DESC LIMIT 1',
      [userId, 'two_factor_secret_temp']
    );

    if (!secretResult || secretResult.length === 0) {
      return res.status(400).json({ message: 'Chưa tạo secret. Vui lòng tạo secret mới trước.' });
    }

    let secret = secretResult[0].setting_value;

    // Xóa khoảng trắng và chuyển về uppercase (nếu có)
    secret = secret.replace(/\s+/g, '').toUpperCase();

    // Validate secret format
    if (!/^[A-Z2-7]+$/.test(secret)) {
      console.error('❌ Invalid secret format in database:', secret);
      return res.status(500).json({ message: 'Secret trong database không hợp lệ. Vui lòng tạo secret mới.' });
    }

    // Generate test code từ secret để verify
    const testCodeFromSecret = speakeasy.totp({
      secret: secret,
      encoding: 'base32'
    });

    console.log('2FA Verify Debug:', {
      userId: userId,
      code: code,
      codeLength: code.length,
      secretLength: secret.length,
      secretPreview: secret.substring(0, 8) + '...',
      secretEnd: '...' + secret.substring(secret.length - 4),
      secretFull: secret, // Log full secret để debug (chỉ trong development)
      secretUpdatedAt: secretResult[0].updated_at,
      testCodeFromSecret: testCodeFromSecret, // Code được generate từ secret này
      codesMatch: testCodeFromSecret === code
    });

    // Verify mã với window mặc định
    let verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: code,
      window: 2 // Cho phép ±2 time steps (120 giây)
    });

    console.log('2FA Setup Verify Result:', {
      userId: userId,
      codeLength: code.length,
      secretLength: secret.length,
      verified: verified,
      currentTime: Math.floor(Date.now() / 1000),
      timeStep: Math.floor(Date.now() / 1000 / 30)
    });

    // Nếu verify fail, thử với window lớn hơn (có thể do time drift)
    if (!verified) {
      console.log('⚠️ First verification failed, trying with larger window (window=10)...');

      // Thử với các window khác nhau: 5, 10, 15 (để compensate time drift lớn)
      let verifiedAlt = false;
      for (let window = 5; window <= 15; window += 5) {
        verifiedAlt = speakeasy.totp.verify({
          secret: secret,
          encoding: 'base32',
          token: code,
          window: window
        });

        if (verifiedAlt) {
          console.log(`✅ Verification succeeded with window=${window}`);
          verified = true;
          break;
        }
      }

      if (!verified) {
        console.log('❌ Verification failed even with window up to 15');
        console.log('🔍 Debug Info:', {
          secretLength: secret.length,
          secretPreview: secret.substring(0, 8) + '...' + secret.substring(secret.length - 4),
          testCodeFromSecret: testCodeFromSecret,
          userEnteredCode: code,
          codesMatch: testCodeFromSecret === code,
          currentTime: Math.floor(Date.now() / 1000),
          timeStep: Math.floor(Date.now() / 1000 / 30),
          message: 'Có thể user đang dùng secret cũ hoặc scan QR code từ lần generate trước. Vui lòng tạo secret mới và scan QR code mới.'
        });
      }
    }

    if (!verified) {
      return res.status(401).json({
        message: 'Mã không đúng. Vui lòng kiểm tra lại:\n1. Mã 6 số từ ứng dụng Authenticator\n2. Thời gian trên điện thoại đã được đồng bộ đúng\n3. Đảm bảo bạn đang dùng QR code/secret mới nhất (nếu đã tạo lại, vui lòng scan lại QR code mới)'
      });
    }

    // Tạo recovery codes
    const recoveryCodes = [];
    for (let i = 0; i < 8; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      recoveryCodes.push(code.slice(0, 4) + '-' + code.slice(4));
    }

    // Lưu secret chính thức (đảm bảo không có khoảng trắng)
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    await db.query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [userId, 'two_factor_secret', cleanSecret]
    );

    await db.query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [userId, 'two_factor_recovery_codes', JSON.stringify(recoveryCodes)]
    );

    await db.query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [userId, 'two_factor_enabled', 'true']
    );

    await db.query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [userId, 'two_factor_method', method]
    );

    // Xóa secret tạm thời
    await db.query(
      'DELETE FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [userId, 'two_factor_secret_temp']
    );

    res.json({
      message: 'Đã kích hoạt 2FA thành công',
      recoveryCodes: recoveryCodes
    });
  } catch (error) {
    console.error('Verify 2FA error:', error);
    res.status(500).json({ message: 'Lỗi kích hoạt 2FA' });
  }
});

/**
 * GET /api/2fa/recovery-codes - Lấy recovery codes
 */
router.get('/recovery-codes', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [userId, 'two_factor_recovery_codes']
    );

    if (!result || result.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy recovery codes' });
    }

    const codes = JSON.parse(result[0].setting_value);
    res.json({ recoveryCodes: codes });
  } catch (error) {
    console.error('Get recovery codes error:', error);
    res.status(500).json({ message: 'Lỗi lấy recovery codes' });
  }
});

/**
 * POST /api/2fa/send-sms - Gửi OTP qua SMS
 */
router.post('/send-sms', authRequired, async (req, res) => {
  try {
    const { phone } = req.body;
    const userId = req.user.id;

    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập số điện thoại' });
    }

    // Gửi OTP qua Twilio
    const result = await twilioService.sendSMSOTP(phone);

    if (!result.success) {
      console.error('❌ Send SMS failed:', {
        userId: userId,
        phone: phone,
        error: result.message
      });
      // Trả về 400 nếu là lỗi unverified (không phải lỗi server)
      // Check cả tiếng Anh và tiếng Việt
      const isUnverifiedError = result.message.includes('unverified') ||
        result.message.includes('chưa được verify') ||
        result.message.includes('Verify Service');
      const statusCode = isUnverifiedError ? 400 : 500;
      return res.status(statusCode).json({ message: result.message });
    }

    // Lưu số điện thoại tạm thời (chưa kích hoạt)
    await db.query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [userId, 'two_factor_phone_temp', result.phone]
    );

    res.json({
      message: 'Đã gửi mã OTP qua SMS',
      phone: result.phone
    });
  } catch (error) {
    console.error('Send SMS OTP error:', error);
    res.status(500).json({ message: 'Lỗi gửi SMS OTP' });
  }
});

/**
 * POST /api/2fa/verify-sms - Verify OTP SMS và kích hoạt 2FA
 */
router.post('/verify-sms', authRequired, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: 'Mã phải là 6 chữ số' });
    }

    // Lấy số điện thoại tạm thời
    const phoneResult = await db.query(
      'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [userId, 'two_factor_phone_temp']
    );

    if (!phoneResult || phoneResult.length === 0) {
      return res.status(400).json({ message: 'Chưa có số điện thoại. Vui lòng gửi mã trước.' });
    }

    const phone = phoneResult[0].setting_value;

    // Verify OTP
    const verifyResult = await twilioService.verifySMSOTP(phone, code);

    if (!verifyResult.verified) {
      return res.status(401).json({ message: verifyResult.message || 'Mã OTP không đúng' });
    }

    // Tạo recovery codes
    const recoveryCodes = [];
    for (let i = 0; i < 8; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      recoveryCodes.push(code.slice(0, 4) + '-' + code.slice(4));
    }

    // Lưu số điện thoại chính thức và recovery codes
    await db.query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [userId, 'two_factor_phone', phone]
    );

    await db.query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [userId, 'two_factor_recovery_codes', JSON.stringify(recoveryCodes)]
    );

    await db.query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [userId, 'two_factor_enabled', 'true']
    );

    await db.query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [userId, 'two_factor_method', 'sms']
    );

    // Xóa số điện thoại tạm thời
    await db.query(
      'DELETE FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [userId, 'two_factor_phone_temp']
    );

    res.json({
      message: 'Đã kích hoạt 2FA bằng SMS thành công',
      recoveryCodes: recoveryCodes
    });
  } catch (error) {
    console.error('Verify SMS 2FA error:', error);
    res.status(500).json({ message: 'Lỗi kích hoạt 2FA SMS' });
  }
});

/**
 * POST /api/2fa/disable - Tắt 2FA
 */
router.post('/disable', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    // Xóa tất cả 2FA settings
    await db.query(
      'DELETE FROM user_settings WHERE user_id = ? AND setting_key IN (?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        'two_factor_enabled',
        'two_factor_secret',
        'two_factor_secret_temp',
        'two_factor_phone',
        'two_factor_phone_temp',
        'two_factor_recovery_codes',
        'two_factor_method'
      ]
    );

    res.json({ message: 'Đã tắt 2FA thành công' });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({ message: 'Lỗi tắt 2FA' });
  }
});

module.exports = router;

