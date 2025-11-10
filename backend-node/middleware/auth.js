const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// In-memory user store (same as Flask version)
const usersByEmail = new Map();

// Helper functions
function createToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role || 'user',
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
  };
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
    return res.status(401).json({ message: 'Thiếu token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role || 'user'
    };

    // Kiểm tra thiết bị có bị chặn không
    let db = null;
    try {
      db = require('../database');
    } catch (err) {
      // Database không có, skip check
    }

    if (db && req.user.id) {
      try {
        // Kiểm tra device có bị blocked không qua session_token
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

        // Cập nhật last_activity_at cho device hiện tại
        if (device.length > 0) {
          await db.query(
            'UPDATE devices SET last_activity_at = NOW() WHERE id = ?',
            [device[0].id]
          );
        }
      } catch (err) {
        // Không fail request nếu không check được device
        console.warn('Device check error:', err.message);
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }
}

module.exports = {
  authRequired,
  createToken,
  nextUserId,
  usersByEmail
};
