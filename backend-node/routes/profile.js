const express = require('express');
const router = express.Router();

const { authRequired } = require('../middleware/auth');

let db = null;
try {
  db = require('../database');
} catch (error) {
  // Database module optional; fallback handled below
}

// GET /api/profile - get current user's profile
router.get('/', authRequired, async (req, res) => {
  try {
    if (db && req.user?.id) {
      try {
        const fullUser = await db.getUserById(req.user.id);
        if (fullUser) {
          return res.json({
            id: fullUser.id,
            email: fullUser.email,
            name: fullUser.name,
            role: fullUser.role || 'user',
            balance: fullUser.balance || 0,
            gender: fullUser.gender || null,
            currency: fullUser.currency || 'VND',
            phone: fullUser.phone || null,
            avatar_url: fullUser.avatar_url || null,
            login_method: fullUser.login_method || 'password'
          });
        }
      } catch (error) {
        // fall through to basic user data
        console.warn('Profile GET db error:', error.message);
      }
    }

    // Fallback: return basic data from token if db not available
    return res.json({
      userId: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    });
  } catch (error) {
    console.error('Error in GET /api/profile:', error);
    res.status(500).json({ message: 'Lỗi lấy hồ sơ người dùng' });
  }
});

// PUT /api/profile - update current user's profile
router.put('/', authRequired, async (req, res) => {
  try {
    const allowedFields = [
      'name',
      'balance',
      'gender',
      'currency',
      'phone',
      'avatar_url'
    ];

    const updates = {};
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        updates[key] = req.body[key];
      }
    }

    if (db && req.user?.id) {
      try {
        const updated = await db.updateUser(req.user.id, updates);
        return res.json({
          ok: true,
          data: {
            id: updated.id,
            email: updated.email,
            name: updated.name,
            role: updated.role || 'user',
            balance: updated.balance || 0,
            gender: updated.gender || null,
            currency: updated.currency || 'VND',
            phone: updated.phone || null,
            avatar_url: updated.avatar_url || null
          }
        });
      } catch (error) {
        console.error('Profile PUT db error:', error.message);
        return res.status(500).json({ message: 'Cập nhật hồ sơ thất bại: ' + error.message });
      }
    }

    // If no DB, acknowledge without persistence to avoid breaking UI
    return res.json({
      ok: true,
      data: {
        userId: req.user.id,
        email: req.user.email,
        name: updates.name || req.user.name,
        role: req.user.role,
        balance: updates.balance || 0,
        gender: updates.gender || null,
        currency: updates.currency || 'VND',
        phone: updates.phone || null,
        avatar_url: updates.avatar_url || null
      },
      warning: 'Database not available; changes not persisted.'
    });
  } catch (error) {
    console.error('Error in PUT /api/profile:', error);
    res.status(500).json({ message: 'Lỗi cập nhật hồ sơ người dùng' });
  }
});

module.exports = router;


