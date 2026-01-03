const express = require('express');
const { authRequired } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

/**
 * GET /api/admin/reports
 * Query:
 *  - range: số ngày (vd: 365)
 *  - group: day | week | month
 */
router.get('/', authRequired, async (req, res) => {
  try {
    /* ================== CHẶN QUYỀN ================== */
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền admin' });
    }

    /* ================== PARAMS ================== */
    const range = Number(req.query.range || 365);
    const group = req.query.group || 'month';

    const groupFormat =
      group === 'day' ? '%Y-%m-%d' :
      group === 'week' ? '%Y-W%u' :
      '%Y-%m';

    /* ================== DOANH THU / GIAO DỊCH ================== */
    const revenueResult = await db.query(
      `
      SELECT
        DATE_FORMAT(created_at, ?) AS period,
        SUM(ABS(amount)) AS revenue,
        COUNT(*) AS tx
      FROM expenses
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY period
      ORDER BY period
      `,
      [groupFormat, range]
    );

    // mysql vs mysql2
    const revenueRows = Array.isArray(revenueResult[0])
      ? revenueResult[0]
      : revenueResult;

    /* ================== USER MỚI ================== */
    const usersResult = await db.query(
      `
      SELECT
        DATE_FORMAT(created_at, ?) AS period,
        COUNT(*) AS users
      FROM users
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY period
      `,
      [groupFormat, range]
    );

    const userRows = Array.isArray(usersResult[0])
      ? usersResult[0]
      : usersResult;

    const userMap = new Map(userRows.map(u => [u.period, u.users]));

    /* ================== SERIES (LINE / TABLE) ================== */
    const series = revenueRows.map(r => ({
      key: r.period,
      revenue: Number(r.revenue) || 0,
      tx: Number(r.tx) || 0,
      users: userMap.get(r.period) || 0,
      flaggedRate: 0 // để dành cho AI
    }));

    /* ================== PIE CHART - THEO DANH MỤC ================== */
    const categoryResult = await db.query(
      `
      SELECT
        COALESCE(c.name, 'Khác') AS name,
        SUM(ABS(e.amount)) AS value
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY name
      ORDER BY value DESC
      `,
      [range]
    );

    const categoryRows = Array.isArray(categoryResult[0])
      ? categoryResult[0]
      : categoryResult;

    const categories = categoryRows.map(c => ({
      name: c.name,
      value: Number(c.value) || 0
    }));

    /* ================== RESPONSE ================== */
    res.json({
      series,
      categories
    });

  } catch (err) {
    console.error('❌ ADMIN REPORT ERROR:', err);
    res.status(500).json({ message: 'Lỗi báo cáo admin' });
  }
});

module.exports = router;
