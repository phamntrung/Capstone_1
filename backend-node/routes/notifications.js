const express = require('express');
const router = express.Router();

const { query } = require('../database');
const { authRequired } = require('../middleware/auth');

// Lấy danh sách thông báo của user hiện tại
router.get('/', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(
      parseInt(req.query.limit, 10) || 50,
      200
    );

    const rows = await query(
      `SELECT id, title, message, type, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );

    const unreadCountRows = await query(
      `SELECT COUNT(*) AS cnt
       FROM notifications
       WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );

    const unreadCount =
      unreadCountRows && unreadCountRows.length > 0
        ? unreadCountRows[0].cnt
        : 0;

    const items =
      rows?.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type || 'info',
        isRead: !!n.is_read,
        createdAt: n.created_at,
      })) || [];

    res.json({
      ok: true,
      data: {
        items,
        unreadCount,
      },
    });
  } catch (error) {
    console.error('❌ [notifications] Lỗi khi lấy thông báo:', error);
    res.status(500).json({
      ok: false,
      message: 'Lỗi khi lấy thông báo',
    });
  }
});

// Đánh dấu tất cả thông báo là đã đọc
router.post('/read-all', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );

    res.json({
      ok: true,
      data: {
        updated: result?.affectedRows || 0,
      },
    });
  } catch (error) {
    console.error('❌ [notifications] Lỗi khi đánh dấu đã đọc:', error);
    res.status(500).json({
      ok: false,
      message: 'Lỗi khi đánh dấu đã đọc',
    });
  }
});

// Xóa tất cả thông báo
router.delete('/all', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `DELETE FROM notifications
       WHERE user_id = ?`,
      [userId]
    );

    res.json({
      ok: true,
      data: {
        deleted: result?.affectedRows || 0,
      },
    });
  } catch (error) {
    console.error('❌ [notifications] Lỗi khi xóa tất cả thông báo:', error);
    res.status(500).json({
      ok: false,
      message: 'Lỗi khi xóa thông báo',
    });
  }
});

module.exports = router;


