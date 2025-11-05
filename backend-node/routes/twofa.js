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

    // Lưu secret tạm thời vào database (chưa kích hoạt)
    await db.query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [userId, 'two_factor_secret_temp', cleanSecret]
    );

    // Tạo QR code với secret đã clean
    const otpauthUrl = speakeasy.otpauthURL({
      secret: cleanSecret,
      label: `SmartExpense (${userEmail})`,
      issuer: 'SmartExpense',
      encoding: 'base32'
    });
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    console.log('2FA Generate:', {
      userId: userId,
      email: userEmail,
      secretLength: cleanSecret.length,
      secretPreview: cleanSecret.substring(0, 8) + '...'
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

    // Lấy secret tạm thời
    const secretResult = await db.query(
      'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [userId, 'two_factor_secret_temp']
    );

    if (!secretResult || secretResult.length === 0) {
      return res.status(400).json({ message: 'Chưa tạo secret. Vui lòng tạo secret mới trước.' });
    }

    let secret = secretResult[0].setting_value;

    // Xóa khoảng trắng và chuyển về uppercase (nếu có)
    secret = secret.replace(/\s+/g, '').toUpperCase();

    // Verify mã
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: code,
      window: 2 // Cho phép ±2 time steps (120 giây)
    });

    console.log('2FA Setup Verify:', {
      userId: userId,
      codeLength: code.length,
      secretLength: secret.length,
      verified: verified
    });

    if (!verified) {
      return res.status(401).json({ message: 'Mã không đúng. Vui lòng thử lại.' });
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

