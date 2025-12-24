const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// In-memory user store (same as Flask version)
const usersByEmail = new Map();

// Helper functions
function createToken(user) {
  // Validate user.id
  if (!user.id || user.id === null || user.id === undefined) {
    console.error('❌ createToken called with invalid user.id:', user);
    throw new Error('Invalid user.id when creating token');
  }
  
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role || 'user',
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days (khớp với cookie maxAge)
  };
  
  console.log('🎫 Creating token for user:', {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  });
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret');
}

function nextUserId() {
  return usersByEmail.size + 1;
}

// Helper: Extract device info from request
function extractDeviceInfo(req) {
  const userAgent = req.headers['user-agent'] || '';
  const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || 'Unknown';

  let platform = 'Unknown';
  if (userAgent.includes('Windows')) platform = 'Windows';
  else if (userAgent.includes('Mac OS X') || userAgent.includes('macOS')) platform = 'macOS';
  else if (userAgent.includes('Linux')) platform = 'Linux';
  else if (userAgent.includes('Android')) platform = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('iOS')) platform = 'iOS';

  let browser = 'Unknown';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edg')) browser = 'Edge';
  else if (userAgent.includes('Opera')) browser = 'Opera';

  return { platform, browser, ipAddress };
}

// Helper: Generate fingerprint
function generateFingerprint(deviceInfo) {
  const str = `${deviceInfo.platform}-${deviceInfo.browser}-${deviceInfo.ipAddress}`;
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 16).toUpperCase();
}

// Auth middleware
async function authRequired(req, res, next) {
  // Priority 1: Try to get token from httpOnly cookie (most secure)
  let token = req.cookies?.auth_token;

  // Priority 2: Fallback to Authorization header (for compatibility)
  if (!token) {
    const authHeader = req.headers.authorization;
    token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;
  }

  if (!token) {
    // Log chi tiết để debug
    console.warn('⚠️ No token found:', {
      hasCookies: !!req.cookies,
      cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
      hasAuthHeader: !!req.headers.authorization,
      endpoint: req.path,
      method: req.method
    });
    return res.status(401).json({
      message: 'Thiếu token',
      code: 'NO_TOKEN'
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    const userId = payload.sub;
    
    // Log để debug - kiểm tra user_id có đúng không
    console.log('🔐 Auth middleware - User authenticated:', {
      userId: userId,
      email: payload.email,
      name: payload.name,
      role: payload.role || 'user',
      path: req.path,
      method: req.method
    });
    
    req.user = {
      id: userId,
      email: payload.email,
      name: payload.name,
      role: payload.role || 'user'
    };

    // Auto-refresh token nếu token sắp hết hạn (còn < 7 ngày)
    // Điều này giúp session không bị hết hạn khi user đang active
    const tokenExpiration = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const daysUntilExpiration = (tokenExpiration - now) / (1000 * 60 * 60 * 24);

    if (daysUntilExpiration < 7 && daysUntilExpiration > 0) {
      // Token sắp hết hạn, tạo token mới và cập nhật cookie
      const newToken = createToken(req.user);

      const isSecure = process.env.NODE_ENV === 'production';
      const cookieOptions = {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/'
      };

      if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
        cookieOptions.domain = process.env.COOKIE_DOMAIN;
      }

      res.cookie('auth_token', newToken, cookieOptions);
      console.log('✅ Token auto-refreshed:', {
        userId: req.user.id,
        daysUntilExpiration: daysUntilExpiration.toFixed(2),
        newTokenExpiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });

      // Cập nhật token trong database device nếu có
      req.token = newToken; // Lưu token mới vào request để dùng cho device update
    } else {
      req.token = token; // Giữ nguyên token cũ
    }

    // Kiểm tra thiết bị có bị chặn không
    let db = null;
    try {
      db = require('../database');
    } catch (err) {
      // Database không có, skip check
    }

    if (db && req.user.id) {
      try {
        // Kiểm tra device có bị blocked không qua session_token (dùng token cũ hoặc mới)
        const device = await db.query(
          'SELECT * FROM devices WHERE user_id = ? AND session_token = ?',
          [req.user.id, token]
        );

        if (device.length > 0 && device[0].is_blocked) {
          return res.status(403).json({
            message: 'Thiết bị này đã bị chặn. Vui lòng liên hệ quản trị viên.',
            blocked: true
          });
        }

        // Cập nhật last_activity_at và session_token (nếu đã refresh) cho device hiện tại
        if (device.length > 0) {
          if (req.token !== token) {
            // Token đã được refresh, cập nhật session_token
            await db.query(
              'UPDATE devices SET last_activity_at = NOW(), session_token = ?, updated_at = NOW() WHERE id = ?',
              [req.token, device[0].id]
            );
          } else {
            // Chỉ cập nhật last_activity_at
            await db.query(
              'UPDATE devices SET last_activity_at = NOW() WHERE id = ?',
              [device[0].id]
            );
          }
        }
      } catch (err) {
        // Không fail request nếu không check được device
        console.warn('Device check error:', err.message);
      }
    }

    next();
  } catch (error) {
    // Log chi tiết lỗi để debug
    if (error.name === 'TokenExpiredError') {
      console.warn('⚠️ Token expired:', {
        expiredAt: error.expiredAt,
        currentTime: new Date(),
        userId: req.cookies?.auth_token ? 'present' : 'missing'
      });
      return res.status(401).json({
        message: 'Token đã hết hạn. Vui lòng đăng nhập lại.',
        code: 'TOKEN_EXPIRED'
      });
    } else if (error.name === 'JsonWebTokenError') {
      console.warn('⚠️ Invalid token:', error.message);
      return res.status(401).json({
        message: 'Token không hợp lệ. Vui lòng đăng nhập lại.',
        code: 'TOKEN_INVALID'
      });
    } else {
      console.error('❌ Auth error:', error);
      return res.status(401).json({
        message: 'Lỗi xác thực. Vui lòng đăng nhập lại.',
        code: 'AUTH_ERROR'
      });
    }
  }
}

module.exports = {
  authRequired,
  createToken,
  nextUserId,
  usersByEmail
};
