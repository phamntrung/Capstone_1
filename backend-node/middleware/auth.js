const jwt = require('jsonwebtoken');

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

// Auth middleware
function authRequired(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : null;

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
