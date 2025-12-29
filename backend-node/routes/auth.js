const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { authRequired, createToken, nextUserId, usersByEmail } = require('../middleware/auth');
const { verifyPassword } = require('../utils/password');
const emailService = require('../services/emailService');
const { createDevice, query } = require('../database');
const { getLocationFromIP } = require('../services/geoipService');

// Helper: Extract device info from request
async function extractDeviceInfo(req, clientPublicIP = null) {
  const userAgent = req.headers['user-agent'] || '';

  // Lấy IP - ưu tiên clientPublicIP (từ client gửi lên), sau đó x-forwarded-for, req.ip, remoteAddress
  let ipAddress = clientPublicIP;
  if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1') {
    ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim();
  }
  if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1') {
    ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown';
  }

  // Detect platform
  let platform = 'Unknown';
  if (userAgent.includes('Windows')) platform = 'Windows';
  else if (userAgent.includes('Mac OS X') || userAgent.includes('macOS')) platform = 'macOS';
  else if (userAgent.includes('Linux')) platform = 'Linux';
  else if (userAgent.includes('Android')) platform = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('iOS')) platform = 'iOS';

  // Detect browser
  let browser = 'Unknown';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edg')) browser = 'Edge';
  else if (userAgent.includes('Opera')) browser = 'Opera';

  // Generate device name
  let deviceName = `${platform} Device`;
  if (platform === 'iOS') {
    if (userAgent.includes('iPhone')) deviceName = 'iPhone';
    else if (userAgent.includes('iPad')) deviceName = 'iPad';
  } else if (platform === 'Android') {
    deviceName = 'Android Device';
  } else if (platform === 'macOS') {
    deviceName = 'MacBook';
  } else if (platform === 'Windows') {
    deviceName = 'Windows PC';
  }

  // Lấy location từ IP (async)
  let location = { city: null, country: null };
  try {
    location = await getLocationFromIP(ipAddress);
  } catch (error) {
    // Nếu không lấy được location, vẫn tiếp tục với city/country = null
  }

  return {
    deviceName,
    platform,
    browser,
    ipAddress,
    city: location.city,
    country: location.country
  };
}

// Helper: Generate fingerprint
function generateFingerprint(deviceInfo) {
  const str = `${deviceInfo.platform}-${deviceInfo.browser}-${deviceInfo.ipAddress}`;
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 16).toUpperCase();
}

// Import database module (optional - fallback to in-memory if not available)
let db = null;
let dbAvailable = false;
try {
  db = require('../database');
  // Test database connection (async, but don't block - will check on first use)
  db.testConnection().then(connected => {
    dbAvailable = connected;
    if (connected) {
      console.log('✅ Using MySQL database for authentication');
    } else {
      console.log('⚠️ Database not available, using in-memory storage');
    }
  }).catch((err) => {
    console.log('⚠️ Database connection test failed:', err.message);
    console.log('   Will retry on first database operation');
    dbAvailable = false;
  });
} catch (error) {
  console.log('⚠️ Database module not available, using in-memory storage');
  db = null;
}

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({ message: 'Thiếu dữ liệu hoặc mật khẩu quá ngắn' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user exists (database or in-memory)
    let existingUser = null;
    if (db) {
      try {
        existingUser = await db.getUserByEmail(normalizedEmail);
        if (existingUser) {
          return res.status(409).json({ message: 'Email đã tồn tại' });
        }
      } catch (error) {
        console.error('❌ Database error checking existing user:', error.message);
        // Fallback to in-memory check
        if (usersByEmail.has(normalizedEmail)) {
          return res.status(409).json({ message: 'Email đã tồn tại' });
        }
      }
    } else {
      if (usersByEmail.has(normalizedEmail)) {
        return res.status(409).json({ message: 'Email đã tồn tại' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let user;
    if (db) {
      try {
        // Save to database
        user = await db.createUser({
          name: name.trim(),
          email: normalizedEmail,
          password_hash: hashedPassword,
          role: 'user',
          email_verified: true // Đánh dấu tài khoản vừa đăng ký là active
        });
        console.log(`✅ User registered in database: ${user.id} - ${user.email}`);
      } catch (error) {
        console.error('❌ Database error creating user:', error.message);
        // Fallback to in-memory
        user = {
          id: nextUserId(),
          name: name.trim(),
          email: normalizedEmail,
          password_hash: hashedPassword,
          role: 'user',
          email_verified: true // Đảm bảo trạng thái active cho dữ liệu fallback
        };
        usersByEmail.set(normalizedEmail, user);
        console.log(`⚠️ User saved to in-memory storage: ${user.id}`);
      }
    } else {
      // Save to in-memory
      user = {
        id: nextUserId(),
        name: name.trim(),
        email: normalizedEmail,
        password_hash: hashedPassword,
        role: 'user',
        email_verified: true // Mặc định kích hoạt luôn để hiển thị Active trong admin
      };
      usersByEmail.set(normalizedEmail, user);
    }

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Lỗi đăng ký' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Thiếu email/password' });
    }

    const normalizedEmail = email.trim().toLowerCase();


    // Get user from database or in-memory
    let user;
    if (db) {
      try {
        user = await db.getUserByEmail(normalizedEmail);
      } catch (error) {
        console.error('❌ Database query error:', error.message);
        user = usersByEmail.get(normalizedEmail);
      }
    } else {
      user = usersByEmail.get(normalizedEmail);
    }

    if (!user) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }


  // Ngăn đăng nhập nếu tài khoản đã bị khóa bởi admin
  const isUserBlocked =
    user.is_blocked === true ||
    user.is_blocked === 1 ||
    user.is_blocked === '1' ||
    user.status === 'blocked';
  if (isUserBlocked) {
    return res.status(403).json({
      message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.'
    });
  }


    // Check if user has password_hash (for Google login users, they might not have password)
    if (!user.password_hash) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    // Check password (supports both bcrypt and scrypt formats)
    const passwordMatch = await verifyPassword(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }


    // Update last_login_at if using database
    if (db && user.id) {
      try {
        await db.updateUser(user.id, { last_login_at: new Date() });
      } catch (err) {
        console.warn('Failed to update last_login_at:', err.message);
      }
    }

    // Kiểm tra user có bật 2FA không
    let requires2FA = false;
    if (db && user.id) {
      try {
        const twoFAStatus = await db.query(
          'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?',
          [user.id, 'two_factor_enabled']
        );
        if (twoFAStatus && twoFAStatus.length > 0 && twoFAStatus[0].setting_value === 'true') {
          requires2FA = true;
        }
      } catch (err) {
        console.warn('Failed to check 2FA status:', err.message);
      }
    }

    // Nếu cần 2FA, trả về response yêu cầu mã 2FA (không trả token)
    if (requires2FA) {
      return res.status(200).json({
        requires2FA: true,
        message: 'Vui lòng nhập mã 2FA',
        email: normalizedEmail
      });
    }

    const token = createToken(user);

    // Lấy public IP từ client (nếu có)
    const clientPublicIP = req.body.clientIP || req.headers['x-client-ip'] || null;

    // Kiểm tra thiết bị có bị chặn không
    if (db && user.id) {
      try {
        const deviceInfo = await extractDeviceInfo(req, clientPublicIP);
        const fingerprint = generateFingerprint(deviceInfo);

        // Kiểm tra xem device này có bị blocked không
        const existingDevice = await query(
          'SELECT * FROM devices WHERE user_id = ? AND fingerprint = ?',
          [user.id, fingerprint]
        );

        if (existingDevice.length > 0 && existingDevice[0].is_blocked) {
          return res.status(403).json({
            message: 'Thiết bị này đã bị chặn. Vui lòng liên hệ quản trị viên.'
          });
        }
      } catch (err) {
        console.warn('Failed to check device status:', err.message);
        // Không fail login nếu không check được
      }
    }

    // Tạo device session khi login
    if (db && user.id) {
      try {
        // Đặt is_current = false cho tất cả devices cũ
        await query('UPDATE devices SET is_current = FALSE WHERE user_id = ?', [user.id]);

        const deviceInfo = await extractDeviceInfo(req, clientPublicIP);
        const fingerprint = generateFingerprint(deviceInfo);

        // Kiểm tra device đã tồn tại chưa (cùng fingerprint)
        const existingDevice = await query(
          'SELECT * FROM devices WHERE user_id = ? AND fingerprint = ?',
          [user.id, fingerprint]
        );

        if (existingDevice.length > 0) {
          // Cập nhật device hiện có
          await query(
            `UPDATE devices SET
              is_current = TRUE,
              last_activity_at = NOW(),
              session_token = ?,
              ip_address = ?,
              updated_at = NOW()
            WHERE id = ?`,
            [token, deviceInfo.ipAddress, existingDevice[0].id]
          );
        } else {
          // Tạo device mới
          await createDevice({
            userId: user.id,
            deviceName: deviceInfo.deviceName,
            platform: deviceInfo.platform,
            browser: deviceInfo.browser,
            ipAddress: deviceInfo.ipAddress,
            city: deviceInfo.city || null,
            country: deviceInfo.country || null,
            fingerprint: fingerprint,
            sessionToken: token,
            isCurrent: true,
            isTrusted: false,
            isBlocked: false
          });
          console.log(`✅ Created new device for user ${user.id}, fingerprint: ${fingerprint}`);
        }
      } catch (err) {
        console.error('❌ Failed to create device session:', err.message);
        console.error('Stack:', err.stack);
        // Không fail login nếu không tạo được device
      }
    }

    // Set httpOnly cookie với token (bảo mật hơn)
    const isSecure = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isSecure, // Chỉ dùng HTTPS trong production
      sameSite: 'lax', // CSRF protection
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (khớp với JWT expiration)
      path: '/' // Đảm bảo cookie available cho tất cả routes
    };

    // Không set domain cho localhost (browser sẽ tự động xử lý)
    // Nếu set domain cho localhost, cookie sẽ không hoạt động
    if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }

    res.cookie('auth_token', token, cookieOptions);

    console.log('✅ Cookie set:', {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      maxAge: cookieOptions.maxAge,
      path: cookieOptions.path,
      domain: cookieOptions.domain || 'not set (localhost)'
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'user'
      },
      token // Vẫn trả về token trong body để backward compatibility
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    res.status(500).json({
      message: 'Lỗi đăng nhập: ' + (error.message || 'Lỗi không xác định'),
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Google Login
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    console.log('🔵 Google login request received');
    console.log('   Has credential:', !!credential);
    console.log('   Credential length:', credential ? credential.length : 0);
    console.log('   GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set');

    if (!credential) {
      console.error('❌ Missing credential in request');
      return res.status(400).json({ message: 'Thiếu idToken' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('❌ GOOGLE_CLIENT_ID not configured');
      return res.status(500).json({ message: 'Google OAuth chưa được cấu hình. Vui lòng kiểm tra GOOGLE_CLIENT_ID trong .env' });
    }

    console.log('🔵 Verifying Google token...');
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = payload.email?.toLowerCase();
    const name = payload.name || email?.split('@')[0] || 'User';
    const googleId = payload.sub;
    const avatarUrl = payload.picture;

    console.log('✅ Google token verified successfully');
    console.log('   Email:', email);
    console.log('   Name:', name);
    console.log('   Google ID:', googleId);
    console.log('   Avatar URL:', avatarUrl ? 'Present' : 'Not present');


    if (!email) {
      console.error('❌ No email in Google token payload');
      return res.status(400).json({ message: 'Không lấy được email từ Google token' });
    }

    // Get user from database or in-memory
    let user;
    if (db) {
      try {
        console.log('🔵 Checking database for user with email:', email);
        user = await db.getUserByEmail(email);

        if (!user) {
          console.log('🆕 User not found, creating new user...');
          // Create new user in database
          const hashedPassword = await bcrypt.hash(Math.random().toString(36), 10); // Random password
          user = await db.createUser({
            name,
            email,
            password_hash: hashedPassword,
            role: 'user',
            google_id: googleId,
            login_method: 'google',
            avatar_url: avatarUrl,
            email_verified: payload.email_verified || false
          });
          console.log('✅ New user created:', user.id, user.email);
        } else {
          console.log('🔄 User exists, updating info...');
          // Update existing user info
          await db.updateUser(user.id, {
            last_login_at: new Date(),
            google_id: googleId,
            login_method: 'google',
            avatar_url: avatarUrl,
            email_verified: payload.email_verified || false
          });
          user = await db.getUserByEmail(email);
          console.log('✅ User updated:', user.id, user.email);
        }
      } catch (error) {
        console.error('❌ Google login database error:', error);
        console.error('   Error message:', error.message);
        console.error('   Error stack:', error.stack);
        return res.status(500).json({ message: 'Đăng nhập Google thất bại: ' + error.message });
      }
    } else {
      console.log('⚠️ Database not available, using in-memory storage');
      user = usersByEmail.get(email);

      if (!user) {
        user = {
          id: nextUserId(),
          name,
          email,
          role: 'user',
          google_id: googleId,
          login_method: 'google'
        };
        usersByEmail.set(email, user);
        console.log('✅ New user created in-memory:', user.id, user.email);
      }
    }

    const token = createToken(user);

    // Lấy public IP từ client (nếu có)
    const clientPublicIP = req.body.clientIP || req.headers['x-client-ip'] || null;

    // Kiểm tra thiết bị có bị chặn không
    if (db && user.id) {
      try {
        const deviceInfo = await extractDeviceInfo(req, clientPublicIP);
        const fingerprint = generateFingerprint(deviceInfo);

        // Kiểm tra xem device này có bị blocked không
        const existingDevice = await query(
          'SELECT * FROM devices WHERE user_id = ? AND fingerprint = ?',
          [user.id, fingerprint]
        );

        if (existingDevice.length > 0 && existingDevice[0].is_blocked) {
          return res.status(403).json({
            message: 'Thiết bị này đã bị chặn. Vui lòng liên hệ quản trị viên.'
          });
        }
      } catch (err) {
        console.warn('Failed to check device status:', err.message);
        // Không fail login nếu không check được
      }
    }

    // Tạo device session khi Google login
    if (db && user.id) {
      try {
        // Đặt is_current = false cho tất cả devices cũ
        await query('UPDATE devices SET is_current = FALSE WHERE user_id = ?', [user.id]);

        const deviceInfo = await extractDeviceInfo(req, clientPublicIP);
        const fingerprint = generateFingerprint(deviceInfo);

        // Kiểm tra device đã tồn tại chưa (cùng fingerprint)
        const existingDevice = await query(
          'SELECT * FROM devices WHERE user_id = ? AND fingerprint = ?',
          [user.id, fingerprint]
        );

        if (existingDevice.length > 0) {
          // Cập nhật device hiện có
          await query(
            `UPDATE devices SET
              is_current = TRUE,
              last_activity_at = NOW(),
              session_token = ?,
              ip_address = ?,
              updated_at = NOW()
            WHERE id = ?`,
            [token, deviceInfo.ipAddress, existingDevice[0].id]
          );
        } else {
          // Tạo device mới
          await createDevice({
            userId: user.id,
            deviceName: deviceInfo.deviceName,
            platform: deviceInfo.platform,
            browser: deviceInfo.browser,
            ipAddress: deviceInfo.ipAddress,
            city: deviceInfo.city || null,
            country: deviceInfo.country || null,
            fingerprint: fingerprint,
            sessionToken: token,
            isCurrent: true,
            isTrusted: false,
            isBlocked: false
          });
        }
      } catch (err) {
        console.warn('Failed to create device session:', err.message);
        // Không fail login nếu không tạo được device
      }
    }

    // Set httpOnly cookie với token (bảo mật hơn)
    const isSecure = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isSecure, // Chỉ dùng HTTPS trong production
      sameSite: 'lax', // CSRF protection
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (khớp với JWT expiration)
      path: '/' // Đảm bảo cookie available cho tất cả routes
    };

    // Không set domain cho localhost (browser sẽ tự động xử lý)
    // Nếu set domain cho localhost, cookie sẽ không hoạt động
    if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }

    res.cookie('auth_token', token, cookieOptions);

    console.log('✅ Cookie set:', {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      maxAge: cookieOptions.maxAge,
      path: cookieOptions.path,
      domain: cookieOptions.domain || 'not set (localhost)'
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        avatar_url: user.avatar_url || null,
        login_method: user.login_method || 'google'
      },
      token // Vẫn trả về token trong body để backward compatibility
    });
  } catch (error) {
    console.error('❌ Google login error:', error);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);

    // Xử lý các loại lỗi khác nhau
    if (error.message && error.message.includes('Token used too early')) {
      return res.status(401).json({ message: 'Token Google chưa hợp lệ. Vui lòng thử lại.' });
    }
    if (error.message && error.message.includes('Token expired')) {
      return res.status(401).json({ message: 'Token Google đã hết hạn. Vui lòng thử lại.' });
    }
    if (error.message && error.message.includes('Invalid token')) {
      return res.status(401).json({ message: 'Token Google không hợp lệ.' });
    }
    if (error.message && error.message.includes('Invalid audience')) {
      return res.status(401).json({ message: 'Google Client ID không đúng. Vui lòng kiểm tra cấu hình.' });
    }

    res.status(401).json({
      message: 'Đăng nhập Google thất bại: ' + (error.message || 'Lỗi không xác định'),
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Forgot Password - Gửi link reset password qua email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Vui lòng nhập email' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Tìm user
    let user;
    if (db) {
      try {
        user = await db.getUserByEmail(normalizedEmail);
      } catch (error) {
        console.error('❌ Database error:', error.message);
        user = usersByEmail.get(normalizedEmail);
      }
    } else {
      user = usersByEmail.get(normalizedEmail);
    }

    // Không báo lỗi nếu email không tồn tại (bảo mật)
    if (!user) {
      return res.json({ message: 'Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu' });
    }

    // Tạo reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 120000); // 2 phút

    // Lưu token vào database (user_settings)
    if (db) {
      try {
        // Xóa token cũ nếu có
        await db.query(
          'DELETE FROM user_settings WHERE user_id = ? AND setting_key = ?',
          [user.id, 'password_reset_token']
        );
        // Lưu token mới
        await db.query(
          'INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          [user.id, 'password_reset_token', JSON.stringify({ token: resetToken, expires_at: expiresAt.toISOString() })]
        );
      } catch (error) {
        console.error('❌ Error saving reset token:', error.message);
        // Fallback: có thể dùng in-memory nhưng không an toàn
      }
    }

    // Tạo reset link
const resetLink = `http://localhost:5050/frontend/User/UI_User/datlaimatkhau.html?token=${resetToken}`;

    // Gửi email
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white !important; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .button:hover { background: #1f49cf; color: white !important; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Đặt lại mật khẩu - SmartExpense</h2>
            <p>Xin chào <strong>${user.name || user.email}</strong>,</p>
            <p>Bạn đã yêu cầu đặt lại mật khẩu. Click vào nút bên dưới để đặt lại mật khẩu:</p>
            <a href="${resetLink}" class="button">Đặt lại mật khẩu</a>
            <p>Hoặc copy link này vào trình duyệt:</p>
            <p style="word-break: break-all;">${resetLink}</p>
            <p><strong>Lưu ý:</strong> Link này chỉ có hiệu lực trong 2 phút.</p>
            <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">Email này được gửi tự động từ hệ thống SmartExpense.</p>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail(
        user.email,
        'Đặt lại mật khẩu - SmartExpense',
        htmlContent,
        `Đặt lại mật khẩu - SmartExpense\n\nClick vào link sau để đặt lại mật khẩu:\n${resetLink}\n\nLink này chỉ có hiệu lực trong 2 phút.`
      );

    } catch (error) {
      console.error('❌ Error sending email:', error.message);
      // Không trả về lỗi 500, vẫn trả về success
    }

    res.json({ message: 'Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Lỗi xử lý yêu cầu' });
  }
});

// Reset Password - Đặt lại mật khẩu với token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Thiếu token hoặc mật khẩu mới' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    // Tìm user có token này
    let user = null;
    let tokenData = null;

    if (db) {
      try {
        // Tìm user có token
        const results = await db.query(
          `SELECT u.*, us.setting_value
           FROM users u
           INNER JOIN user_settings us ON u.id = us.user_id
           WHERE us.setting_key = ?`,
          ['password_reset_token']
        );

        // Tìm token khớp
        for (const row of results) {
          try {
            const setting = JSON.parse(row.setting_value);
            if (setting.token === token) {
              const expiresAt = new Date(setting.expires_at);
              if (expiresAt > new Date()) {
                user = row;
                tokenData = setting;
                break;
              }
            }
          } catch (e) {
            continue;
          }
        }

        if (!user) {
          return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
        }

        // Hash mật khẩu mới
        const hashedPassword = await bcrypt.hash(password, 10);

        // Cập nhật mật khẩu
        await db.query(
          'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
          [hashedPassword, user.id]
        );

        // Xóa token đã dùng
        await db.query(
          'DELETE FROM user_settings WHERE user_id = ? AND setting_key = ?',
          [user.id, 'password_reset_token']
        );

      } catch (error) {
        console.error('❌ Database error:', error.message);
        return res.status(500).json({ message: 'Lỗi cập nhật mật khẩu' });
      }
    } else {
      // In-memory fallback (không an toàn, chỉ để test)
      return res.status(503).json({ message: 'Tính năng này yêu cầu database' });
    }

    res.json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Lỗi đặt lại mật khẩu' });
  }
});

// Change Password - Đổi mật khẩu
router.post('/change-password', authRequired, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Thiếu mật khẩu cũ hoặc mật khẩu mới' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    // Lấy user từ database
    let user = null;
    if (db) {
      try {
        user = await db.getUserById(req.user.id);
      } catch (error) {
        console.error('❌ Database error:', error.message);
        return res.status(500).json({ message: 'Lỗi truy vấn database' });
      }
    } else {
      return res.status(503).json({ message: 'Tính năng này yêu cầu database' });
    }

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Kiểm tra mật khẩu cũ
    if (!user.password_hash) {
      return res.status(400).json({ message: 'Tài khoản này không có mật khẩu (đăng nhập bằng Google)' });
    }

    const passwordMatch = await verifyPassword(oldPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Mật khẩu cũ không đúng' });
    }

    // Kiểm tra mật khẩu mới không được trùng với mật khẩu cũ
    const samePassword = await verifyPassword(newPassword, user.password_hash);
    if (samePassword) {
      return res.status(400).json({ message: 'Mật khẩu mới phải khác mật khẩu cũ' });
    }

    // Hash mật khẩu mới
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Cập nhật mật khẩu
    if (db) {
      try {
        await db.updateUser(user.id, { password_hash: hashedPassword });
      } catch (error) {
        console.error('❌ Database error:', error.message);
        return res.status(500).json({ message: 'Lỗi cập nhật mật khẩu' });
      }
    }

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Lỗi đổi mật khẩu' });
  }
});

// Verify 2FA và hoàn tất login
router.post('/verify-2fa', async (req, res) => {
  try {
    console.log('🔐 2FA Verify Request:', {
      body: req.body,
      email: req.body?.email,
      code: req.body?.code
    });

    const { email, code } = req.body;

    if (!email || !code) {
      console.log('❌ Missing email or code');
      return res.status(400).json({ message: 'Thiếu email hoặc mã 2FA' });
    }

    // Loại bỏ khoảng trắng và chỉ lấy số
    const cleanCode = code.replace(/\s+/g, '').replace(/\D/g, '');

    if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      console.log('❌ Invalid code format:', { original: code, cleaned: cleanCode });
      return res.status(400).json({ message: 'Mã 2FA phải là 6 chữ số' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log('📧 Looking up user:', normalizedEmail);

    // Lấy user
    let user;
    if (db) {
      try {
        user = await db.getUserByEmail(normalizedEmail);
        console.log('👤 User found:', user ? { id: user.id, email: user.email } : 'NOT FOUND');
      } catch (error) {
        console.error('❌ Database query error:', error.message);
        return res.status(500).json({ message: 'Lỗi truy vấn database' });
      }
    } else {
      return res.status(503).json({ message: 'Tính năng này yêu cầu database' });
    }

    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({ message: 'Email không tồn tại' });
    }

    // Kiểm tra user có bật 2FA không
    const twoFAStatus = await db.query(
      'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [user.id, 'two_factor_enabled']
    );

    console.log('🔍 2FA Status:', twoFAStatus);

    if (!twoFAStatus || twoFAStatus.length === 0 || twoFAStatus[0].setting_value !== 'true') {
      console.log('❌ 2FA not enabled');
      return res.status(400).json({ message: 'Tài khoản này chưa bật 2FA' });
    }

    // Lấy method (app hoặc sms)
    const methodResult = await db.query(
      'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [user.id, 'two_factor_method']
    );
    const method = methodResult && methodResult.length > 0 ? methodResult[0].setting_value : 'app';

    console.log('📱 2FA Method:', method);

    let verified = false;

    if (method === 'sms') {
      // SMS 2FA: Verify qua Twilio
      const phoneResult = await db.query(
        'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?',
        [user.id, 'two_factor_phone']
      );

      if (!phoneResult || phoneResult.length === 0) {
        console.log('❌ Phone not found for SMS 2FA');
        return res.status(500).json({ message: 'Không tìm thấy số điện thoại 2FA' });
      }

      const phone = phoneResult[0].setting_value;
      const twilioService = require('../services/twilioService');
      const verifyResult = await twilioService.verifySMSOTP(phone, cleanCode);

      verified = verifyResult.verified;

      console.log('🔐 SMS 2FA Verify Result:', {
        userId: user.id,
        email: user.email,
        phone: phone,
        code: cleanCode,
        verified: verified
      });
    } else {
      // App 2FA (TOTP): Verify qua speakeasy
      const secretResult = await db.query(
        'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?',
        [user.id, 'two_factor_secret']
      );

      console.log('🔑 Secret result:', secretResult ? 'Found' : 'NOT FOUND');

      if (!secretResult || secretResult.length === 0) {
        console.log('❌ Secret not found');
        return res.status(500).json({ message: 'Không tìm thấy 2FA secret' });
      }

      let secret = secretResult[0].setting_value;
      console.log('🔑 Secret raw:', secret.substring(0, 20) + '...');

      // Xóa khoảng trắng và chuyển về uppercase (nếu có)
      secret = secret.replace(/\s+/g, '').toUpperCase();
      console.log('🔑 Secret cleaned:', secret.substring(0, 20) + '...');

      const speakeasy = require('speakeasy');

      // Thử generate code để debug
      const testCode = speakeasy.totp({
        secret: secret,
        encoding: 'base32'
      });

      verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: cleanCode,
        window: 2 // Cho phép ±2 time steps (120 giây)
      });

      console.log('🔐 TOTP 2FA Verify Result:', {
        userId: user.id,
        email: user.email,
        originalCode: code,
        cleanCode: cleanCode,
        codeLength: cleanCode.length,
        secretLength: secret.length,
        secretPreview: secret.substring(0, 12) + '...',
        testCode: testCode,
        verified: verified,
        timestamp: Math.floor(Date.now() / 1000),
        timeStep: Math.floor(Date.now() / 1000 / 30)
      });
    }

    if (!verified) {
      // Kiểm tra recovery code
      const recoveryCodesResult = await db.query(
        'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?',
        [user.id, 'two_factor_recovery_codes']
      );

      let isRecoveryCode = false;
      if (recoveryCodesResult && recoveryCodesResult.length > 0) {
        try {
          const recoveryCodes = JSON.parse(recoveryCodesResult[0].setting_value);
          const codeIndex = recoveryCodes.indexOf(code);
          if (codeIndex !== -1) {
            // Xóa recovery code đã dùng
            recoveryCodes.splice(codeIndex, 1);
            await db.query(
              `UPDATE user_settings SET setting_value = ?, updated_at = NOW() WHERE user_id = ? AND setting_key = ?`,
              [JSON.stringify(recoveryCodes), user.id, 'two_factor_recovery_codes']
            );
            isRecoveryCode = true;
          }
        } catch (e) {
          // Ignore parse error
        }
      }

      if (!isRecoveryCode) {
        return res.status(401).json({ message: 'Mã 2FA không đúng' });
      }
    }

    // Tạo token và hoàn tất login
    const token = createToken(user);

    // Update last_login_at
    if (db && user.id) {
      try {
        await db.updateUser(user.id, { last_login_at: new Date() });
      } catch (err) {
        console.warn('Failed to update last_login_at:', err.message);
      }
    }

    // Lấy public IP từ client
    const clientPublicIP = req.body.clientIP || req.headers['x-client-ip'] || null;

    // Tạo device session
    if (db && user.id) {
      try {
        const deviceInfo = await extractDeviceInfo(req, clientPublicIP);
        const fingerprint = generateFingerprint(deviceInfo);

        await query('UPDATE devices SET is_current = FALSE WHERE user_id = ?', [user.id]);

        const existingDevice = await query(
          'SELECT * FROM devices WHERE user_id = ? AND fingerprint = ?',
          [user.id, fingerprint]
        );

        if (existingDevice.length > 0) {
          await query(
            `UPDATE devices SET
              is_current = TRUE,
              last_activity_at = NOW(),
              session_token = ?,
              ip_address = ?,
              updated_at = NOW()
            WHERE id = ?`,
            [token, deviceInfo.ipAddress, existingDevice[0].id]
          );
        } else {
          const { createDevice } = require('../database');
          await createDevice({
            userId: user.id,
            deviceName: deviceInfo.deviceName,
            platform: deviceInfo.platform,
            browser: deviceInfo.browser,
            ipAddress: deviceInfo.ipAddress,
            city: deviceInfo.city || null,
            country: deviceInfo.country || null,
            fingerprint: fingerprint,
            sessionToken: token,
            isCurrent: true,
            isTrusted: false,
            isBlocked: false
          });
        }
      } catch (err) {
        console.error('❌ Failed to create device session:', err.message);
        // Không fail login nếu không tạo được device
      }
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'user'
      },
      token
    });
  } catch (error) {
    console.error('Verify 2FA error:', error);
    res.status(500).json({ message: 'Lỗi xác thực 2FA' });
  }
});

// Get current user
router.get('/me', authRequired, async (req, res) => {
  try {
    // Load full user data from database if available
    let userData = {
      userId: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    };

    if (db) {
      try {
        const fullUser = await db.getUserById(req.user.id);
        if (fullUser) {
          userData = {
            userId: fullUser.id,
            email: fullUser.email,
            name: fullUser.name,
            role: fullUser.role || 'user',
            balance: fullUser.balance || 0,
            gender: fullUser.gender || null,
            currency: fullUser.currency || 'VND',
            phone: fullUser.phone || null,
            avatar_url: fullUser.avatar_url || null,
            login_method: fullUser.login_method || 'password'
          };
        }
      } catch (error) {
        console.warn('Failed to load full user data:', error.message);
        // Continue with basic user data
      }
    }

    res.json(userData);
  } catch (error) {
    console.error('Error in /api/me:', error);
    res.status(500).json({ message: 'Lỗi lấy thông tin người dùng' });
  }
});

module.exports = router;
