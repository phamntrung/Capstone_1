const express = require('express');
const { authRequired } = require('../middleware/auth');
const { query } = require('../database');

const router = express.Router();

function normalizeMonth(input) {
  if (!input) {
    return null;
  }

  const raw = String(input).trim();
  let year = null;
  let month = null;

  if (/^\d{4}-\d{2}$/.test(raw)) {
    const parts = raw.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else if (/^\d{6}$/.test(raw)) {
    year = parseInt(raw.slice(0, 4), 10);
    month = parseInt(raw.slice(4), 10);
  } else {
    return null;
  }

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  const monthDash = `${year}-${String(month).padStart(2, '0')}`;
  const monthCompact = `${year}${String(month).padStart(2, '0')}`;

  return {
    year,
    month,
    monthDash,
    monthCompact
  };
}

// Get budget for month
router.get('/:yyyymm', authRequired, async (req, res) => {
  try {
    const monthInfo = normalizeMonth(req.params.yyyymm);
    if (!monthInfo) {
      return res.status(400).json({
        ok: false,
        message: 'Tháng không hợp lệ. Vui lòng dùng định dạng YYYY-MM hoặc YYYYMM.'
      });
    }

    const userId = req.user.id;
    const result = await query(
      `SELECT month, amount 
       FROM budgets 
       WHERE user_id = ? 
         AND (month = ? OR month = ?)
       ORDER BY month LIKE '%-%' DESC 
       LIMIT 1`,
      [userId, monthInfo.monthDash, monthInfo.monthCompact]
    );

    const amount = result && result.length > 0 ? parseFloat(result[0].amount) : 0;
    const responseMonth = result && result.length > 0 ? result[0].month : monthInfo.monthDash;

    return res.json({
      ok: true,
      data: {
        userId,
        month: responseMonth,
        amount
      }
    });
  } catch (error) {
    console.error('Get budget error:', error);
    return res.status(500).json({
      ok: false,
      message: 'Lỗi lấy ngân sách'
    });
  }
});

// Set budget for month
router.put('/:yyyymm', authRequired, async (req, res) => {
  try {
    const monthInfo = normalizeMonth(req.params.yyyymm);
    if (!monthInfo) {
      return res.status(400).json({
        ok: false,
        message: 'Tháng không hợp lệ. Vui lòng dùng định dạng YYYY-MM hoặc YYYYMM.'
      });
    }

    const { amount } = req.body;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({
        ok: false,
        message: 'Số tiền không hợp lệ'
      });
    }

    const userId = req.user.id;
    const normalizedAmount = Math.round(parsedAmount * 100) / 100;

    await query(
      `INSERT INTO budgets (user_id, month, amount, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE amount = VALUES(amount), updated_at = NOW()`,
      [userId, monthInfo.monthDash, normalizedAmount]
    );

    return res.json({
      ok: true,
      data: {
        userId,
        month: monthInfo.monthDash,
        amount: normalizedAmount
      }
    });
  } catch (error) {
    console.error('Set budget error:', error);
    return res.status(500).json({
      ok: false,
      message: 'Lỗi đặt ngân sách'
    });
  }
});

module.exports = router;
