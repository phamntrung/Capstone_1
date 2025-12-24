const express = require("express");
const router = express.Router();

const { query } = require("../database");
const { authRequired } = require("../middleware/auth");

/**
 * GET /api/admin/notifications
 * Lấy danh sách SUPPORT cho ADMIN
 */
router.get("/", authRequired, async (req, res) => {
  try {
    // 🔐 Chỉ ADMIN
    if (req.user.role !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "Không có quyền truy cập",
      });
    }

    const rows = await query(`
      SELECT id, type, title, payload, is_read, created_at
      FROM admin_notifications
      WHERE type = 'support'
      ORDER BY created_at DESC
      LIMIT 100
    `);

    res.json({
  ok: true,
  data: {
    items: rows.map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      payload: r.payload,          // ✅ ĐÚNG
      isRead: !!r.is_read,
      createdAt: r.created_at
    }))
  }
});

  } catch (err) {
    console.error("❌ ADMIN SUPPORT ERROR:", err);
    res.status(500).json({
      ok: false,
      message: "Lỗi lấy yêu cầu hỗ trợ",
    });
  }
});

module.exports = router;
