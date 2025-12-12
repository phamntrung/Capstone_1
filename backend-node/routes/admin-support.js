const express = require("express");
const { query } = require("../database");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/admin/support
 */
router.get("/", authRequired, async (req, res) => {
  // ⚠️ Nếu muốn chặt hơn: kiểm tra role === 'admin'
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const rows = await query(`
    SELECT id, title, message, is_read, created_at
    FROM notifications
    WHERE type = 'support'
    ORDER BY created_at DESC
  `);

  res.json({
    ok: true,
    data: rows
  });
});

module.exports = router;
