const express = require('express');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// In-memory store
const budgetsByKey = new Map();

function budgetKey(userId, yyyymm) {
  return `${userId}:${yyyymm}`;
}

// Get budget for month
router.get('/:yyyymm', authRequired, (req, res) => {
  try {
    const { yyyymm } = req.params;
    const userId = req.user.id;
    const key = budgetKey(userId, yyyymm);
    
    const budget = budgetsByKey.get(key) || {
      userId,
      month: yyyymm,
      amount: 0
    };

    res.json(budget);
  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({ message: 'Lỗi lấy ngân sách' });
  }
});

// Set budget for month
router.put('/:yyyymm', authRequired, (req, res) => {
  try {
    const { yyyymm } = req.params;
    const { amount } = req.body;
    const userId = req.user.id;

    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ message: 'Số tiền không hợp lệ' });
    }

    const key = budgetKey(userId, yyyymm);
    const budget = {
      userId,
      month: yyyymm,
      amount: parseFloat(amount)
    };

    budgetsByKey.set(key, budget);
    res.json(budget);
  } catch (error) {
    console.error('Set budget error:', error);
    res.status(500).json({ message: 'Lỗi đặt ngân sách' });
  }
});

module.exports = router;
