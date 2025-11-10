const express = require('express');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// In-memory stores (same as Flask version)
const expenses = [];
const categoriesById = new Map();

function nextExpenseId() {
  return expenses.length > 0 ? Math.max(...expenses.map(e => e.id)) + 1 : 1;
}

function getExpenseOwned(expenseId, userId) {
  return expenses.find(e => e.id === expenseId && e.userId === userId);
}

// List expenses with filters
router.get('/', authRequired, (req, res) => {
  try {
    const userId = req.user.id;
    let filteredExpenses = expenses.filter(e => e.userId === userId);

    // Apply filters
    const { date_from, date_to, categoryId } = req.query;

    if (date_from) {
      filteredExpenses = filteredExpenses.filter(e => e.date >= date_from);
    }

    if (date_to) {
      filteredExpenses = filteredExpenses.filter(e => e.date <= date_to);
    }

    if (categoryId) {
      const catId = parseInt(categoryId);
      if (!isNaN(catId)) {
        filteredExpenses = filteredExpenses.filter(e => e.categoryId === catId);
      }
    }

    res.json({ items: filteredExpenses });
  } catch (error) {
    console.error('List expenses error:', error);
    res.status(500).json({ message: 'Lỗi lấy danh sách chi tiêu' });
  }
});

// Helper function to get current date in Vietnam timezone
function getCurrentDateVietnam() {
  const now = new Date();
  // Convert to Vietnam timezone (UTC+7)
  const vietnamOffset = 7 * 60; // 7 hours in minutes
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const vietnamTime = new Date(utc + (vietnamOffset * 60000));

  // Format as YYYY-MM-DD
  const year = vietnamTime.getFullYear();
  const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
  const day = String(vietnamTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Create expense
router.post('/', authRequired, (req, res) => {
  try {
    let { date, amount, type, categoryId, note } = req.body;

    // Nếu không có ngày từ client, lấy ngày hiện tại từ server
    if (!date || !date.trim()) {
      date = getCurrentDateVietnam();
    } else {
      date = date.trim();
    }

    if (typeof amount !== 'number') {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    const expense = {
      id: nextExpenseId(),
      userId: req.user.id,
      date: date,
      amount: parseFloat(amount),
      type: type || 'expense',
      categoryId: categoryId ? parseInt(categoryId) : null,
      note: note ? note.trim() : ''
    };

    expenses.push(expense);
    res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ message: 'Lỗi tạo chi tiêu' });
  }
});

// Get expenses stats for charts (MUST be before /:id route to avoid conflict)
router.get('/stats', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const period = parseInt(req.query.period) || 10; // 10, 30, 60, 90 days
    const groupBy = req.query.groupBy || 'day'; // day, week, category

    // Import database module
    let db = null;
    try {
      db = require('../database');
    } catch (err) {
      console.warn('Database not available for stats:', err.message);
      // Database not available, return empty stats
      return res.json({ items: [], groupBy });
    }

    // Calculate start date
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - period);
    const startDateStr = startDate.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    // Get expenses from database
    const expenses = await db.query(
      `SELECT * FROM expenses
       WHERE user_id = ? AND date >= ? AND date <= ?
       ORDER BY date ASC`,
      [userId, startDateStr, todayStr]
    );

    if (groupBy === 'category') {
      // Group by category
      const catStats = {};
      for (const e of expenses) {
        if (e.type === 'expense' || e.amount < 0) {
          const cid = e.category_id || 0;
          let catName = 'Khác';

          if (e.category_id) {
            try {
              const category = await db.query('SELECT name FROM categories WHERE id = ?', [e.category_id]);
              if (category && category.length > 0) {
                catName = category[0].name;
              }
            } catch (err) {
              console.warn('Failed to get category name:', err.message);
            }
          }

          if (!catStats[cid]) {
            catStats[cid] = { id: cid, name: catName, amount: 0, count: 0 };
          }
          catStats[cid].amount += Math.abs(parseFloat(e.amount));
          catStats[cid].count += 1;
        }
      }

      const result = Object.values(catStats);
      return res.json({ items: result, groupBy: 'category' });
    } else if (groupBy === 'week') {
      // Group by week
      const weekStats = {};
      for (const e of expenses) {
        if (e.type === 'expense' || e.amount < 0) {
          const date = new Date(e.date);
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
          const weekKey = weekStart.toISOString().split('T')[0];

          if (!weekStats[weekKey]) {
            weekStats[weekKey] = { date: weekKey, amount: 0, count: 0 };
          }
          weekStats[weekKey].amount += Math.abs(parseFloat(e.amount));
          weekStats[weekKey].count += 1;
        }
      }

      const result = Object.values(weekStats).sort((a, b) => a.date.localeCompare(b.date));
      return res.json({ items: result, groupBy: 'week' });
    } else {
      // Group by day (default)
      const dayStats = {};
      for (const e of expenses) {
        if (e.type === 'expense' || e.amount < 0) {
          const dayKey = e.date instanceof Date ? e.date.toISOString().split('T')[0] : e.date;
          if (!dayStats[dayKey]) {
            dayStats[dayKey] = { date: dayKey, amount: 0, count: 0 };
          }
          dayStats[dayKey].amount += Math.abs(parseFloat(e.amount));
          dayStats[dayKey].count += 1;
        }
      }

      // Fill missing days with 0
      const result = [];
      const current = new Date(startDate);
      while (current <= today) {
        const dayKey = current.toISOString().split('T')[0];
        if (dayStats[dayKey]) {
          result.push(dayStats[dayKey]);
        } else {
          result.push({ date: dayKey, amount: 0, count: 0 });
        }
        current.setDate(current.getDate() + 1);
      }

      return res.json({ items: result, groupBy: 'day' });
    }
  } catch (error) {
    console.error('Expenses stats error:', error);
    res.status(500).json({ message: 'Lỗi lấy thống kê chi tiêu' });
  }
});

// Get single expense
router.get('/:id', authRequired, (req, res) => {
  try {
    const expenseId = parseInt(req.params.id);
    const expense = getExpenseOwned(expenseId, req.user.id);

    if (!expense) {
      return res.status(404).json({ message: 'Không tìm thấy' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ message: 'Lỗi lấy chi tiêu' });
  }
});

// Update expense
router.put('/:id', authRequired, (req, res) => {
  try {
    const expenseId = parseInt(req.params.id);
    const expense = getExpenseOwned(expenseId, req.user.id);

    if (!expense) {
      return res.status(404).json({ message: 'Không tìm thấy' });
    }

    const { date, amount, type, categoryId, note } = req.body;

    if (date !== undefined) expense.date = date;
    if (amount !== undefined) expense.amount = parseFloat(amount);
    if (type !== undefined) expense.type = type;
    if (categoryId !== undefined) {
      expense.categoryId = categoryId ? parseInt(categoryId) : null;
    }
    if (note !== undefined) expense.note = note;

    res.json(expense);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ message: 'Lỗi cập nhật chi tiêu' });
  }
});

// Delete expense
router.delete('/:id', authRequired, (req, res) => {
  try {
    const expenseId = parseInt(req.params.id);
    const expenseIndex = expenses.findIndex(e => e.id === expenseId && e.userId === req.user.id);

    if (expenseIndex === -1) {
      return res.status(404).json({ message: 'Không tìm thấy' });
    }

    const deletedExpense = expenses.splice(expenseIndex, 1)[0];
    res.json({ deleted: deletedExpense });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ message: 'Lỗi xóa chi tiêu' });
  }
});

module.exports = router;
