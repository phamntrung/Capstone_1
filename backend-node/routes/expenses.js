const express = require('express');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Import database module
let db = null;
try {
  db = require('../database');
} catch (error) {
  console.log('⚠️ Database module not available for expenses');
}

// List expenses with filters
router.get('/', authRequired, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: 'Database not available' });
    }

    const userId = req.user.id;
    const filters = {};

    // Apply filters
    const { date_from, date_to, categoryId, type } = req.query;
    if (date_from) filters.date_from = date_from;
    if (date_to) filters.date_to = date_to;
    if (categoryId) filters.categoryId = parseInt(categoryId);
    if (type) filters.type = type;

    const expenses = await db.getExpensesByUserId(userId, filters);
    
    // Convert snake_case to camelCase for frontend
    const formattedExpenses = expenses.map(e => ({
      id: e.id,
      userId: e.user_id,
      date: e.date,
      amount: e.amount,
      type: e.type,
      categoryId: e.category_id,
      categoryName: e.category_name,
      note: e.note,
      created_at: e.created_at,
      updated_at: e.updated_at
    }));

    res.json({ items: formattedExpenses });
  } catch (error) {
    console.error('List expenses error:', error);
    res.status(500).json({ message: 'Lỗi lấy danh sách chi tiêu' });
  }
});

// Định dạng ngày theo múi giờ Việt Nam để tránh lệch ngày khi lấy dữ liệu từ DB
const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VIETNAM_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

// Chuẩn hoá ngày về dạng YYYY-MM-DD (múi giờ Việt Nam)
function toVietnamDateString(value) {
  if (!value && value !== 0) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{8}$/.test(trimmed)) {
      return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
    }

    const replaced = trimmed.includes(' ') ? trimmed.replace(' ', 'T') : trimmed;
    const parsedFromString = new Date(replaced);
    if (!Number.isNaN(parsedFromString.getTime())) {
      return vietnamDateFormatter.format(parsedFromString);
    }

    if (trimmed.length >= 10) {
      return trimmed.slice(0, 10);
    }
    return '';
  }

  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      return vietnamDateFormatter.format(value);
    }
    return '';
  }

  if (typeof value === 'number') {
    const parsedFromNumber = new Date(value);
    if (!Number.isNaN(parsedFromNumber.getTime())) {
      return vietnamDateFormatter.format(parsedFromNumber);
    }
  }

  return '';
}

// Tạo đối tượng Date (UTC) từ chuỗi ngày YYYY-MM-DD
function createUTCDateFromVietnamString(dateString) {
  if (!dateString) return null;
  const parts = dateString.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

// Lấy ngày hiện tại theo múi giờ Việt Nam
function getCurrentDateVietnam() {
  return toVietnamDateString(new Date());
}

// Create expense
router.post('/', authRequired, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: 'Database not available' });
    }

    let { date, amount, type, categoryId, categoryName, note } = req.body;

    // Nếu không có ngày từ client, lấy ngày hiện tại từ server
    if (!date || !date.trim()) {
      date = getCurrentDateVietnam();
    } else {
      date = date.trim();
    }

    if (typeof amount !== 'number') {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    const expense = await db.createExpense(req.user.id, {
      date: date,
      amount: parseFloat(amount),
      type: type || 'expense',
      categoryId: categoryId ? parseInt(categoryId) : null,
      categoryName: categoryName || null,
      note: note ? note.trim() : null
    });

    // Convert snake_case to camelCase for frontend
    const formatted = {
      id: expense.id,
      userId: expense.user_id,
      date: expense.date,
      amount: expense.amount,
      type: expense.type,
      categoryId: expense.category_id,
      categoryName: expense.category_name,
      note: expense.note
    };

    // Kiểm tra và gửi cảnh báo ngân sách (chạy bất đồng bộ, không chặn response)
    try {
      const budgetAlertService = require('../services/budgetAlertService');
      const expenseDate = new Date(date);
      const year = expenseDate.getFullYear();
      const month = expenseDate.getMonth() + 1;
      
      // Chạy kiểm tra ngân sách bất đồng bộ (không đợi kết quả)
      budgetAlertService.checkAndSendBudgetAlert(req.user.id, year, month)
        .catch(err => {
          console.error('❌ [expenses.js] Lỗi khi kiểm tra cảnh báo ngân sách:', err);
        });
    } catch (error) {
      // Không làm ảnh hưởng đến response nếu có lỗi
      console.error('❌ [expenses.js] Lỗi khi import budgetAlertService:', error);
    }

    res.status(201).json(formatted);
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

    // Tính khoảng ngày theo múi giờ Việt Nam để không bị chậm 1 ngày
    const todayStr = toVietnamDateString(new Date());
    const today = createUTCDateFromVietnamString(todayStr);
    const startDate = today ? new Date(today) : new Date();
    startDate.setUTCDate(startDate.getUTCDate() - period);
    const startDateStr = toVietnamDateString(startDate) || toVietnamDateString(new Date(todayStr));

    // Get expenses from database
    const expenses = await db.query(
      `SELECT *, DATE_FORMAT(date, '%Y-%m-%d') AS date_vn
       FROM expenses
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
          const normalizedDate = toVietnamDateString(e.date_vn || e.date);
          if (!normalizedDate) continue;
          const date = createUTCDateFromVietnamString(normalizedDate) || new Date(e.date);
          const weekStart = new Date(date);
          weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay()); // Chủ nhật đầu tuần
          const weekKey = toVietnamDateString(weekStart);

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
          const dayKey = toVietnamDateString(e.date_vn || e.date);
          if (!dayKey) continue;
          if (!dayStats[dayKey]) {
            dayStats[dayKey] = { date: dayKey, amount: 0, count: 0 };
          }
          dayStats[dayKey].amount += Math.abs(parseFloat(e.amount));
          dayStats[dayKey].count += 1;
        }
      }

      // Fill missing days with 0
      const result = [];
      const loopDate = createUTCDateFromVietnamString(startDateStr) || new Date(startDate);
      const endDate = createUTCDateFromVietnamString(todayStr) || new Date(today);
      while (loopDate.getTime() <= endDate.getTime()) {
        const dayKey = toVietnamDateString(loopDate);
        if (dayStats[dayKey]) {
          result.push(dayStats[dayKey]);
        } else {
          result.push({ date: dayKey, amount: 0, count: 0 });
        }
        loopDate.setUTCDate(loopDate.getUTCDate() + 1);
      }

      return res.json({ items: result, groupBy: 'day' });
    }
  } catch (error) {
    console.error('Expenses stats error:', error);
    res.status(500).json({ message: 'Lỗi lấy thống kê chi tiêu' });
  }
});

// Get single expense
router.get('/:id', authRequired, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: 'Database not available' });
    }

    const expenseId = parseInt(req.params.id);
    const expense = await db.getExpenseById(expenseId, req.user.id);

    if (!expense) {
      return res.status(404).json({ message: 'Không tìm thấy' });
    }

    // Convert snake_case to camelCase for frontend
    const formatted = {
      id: expense.id,
      userId: expense.user_id,
      date: expense.date,
      amount: expense.amount,
      type: expense.type,
      categoryId: expense.category_id,
      categoryName: expense.category_name,
      note: expense.note
    };

    res.json(formatted);
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ message: 'Lỗi lấy chi tiêu' });
  }
});

// Update expense
router.put('/:id', authRequired, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: 'Database not available' });
    }

    const expenseId = parseInt(req.params.id);

    if (Number.isNaN(expenseId)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const { date, amount, type, categoryId, note } = req.body;
    const updates = {};

    if (date !== undefined) {
      updates.date = String(date).trim();
    }

    if (amount !== undefined) {
      const parsedAmount = parseFloat(amount);
      if (Number.isNaN(parsedAmount)) {
        return res.status(400).json({ message: 'Số tiền không hợp lệ' });
      }
      updates.amount = parsedAmount;
    }

    if (type !== undefined) {
      updates.type = type;
    }

    if (categoryId !== undefined) {
      updates.categoryId = categoryId ? parseInt(categoryId) : null;
      if (updates.categoryId !== null && Number.isNaN(updates.categoryId)) {
        return res.status(400).json({ message: 'Hạng mục không hợp lệ' });
      }
    }

    if (note !== undefined) {
      updates.note = note;
    }

    const updatedExpense = await db.updateExpense(expenseId, req.user.id, updates);

    if (!updatedExpense) {
      return res.status(404).json({ message: 'Không tìm thấy' });
    }

    const formatted = {
      id: updatedExpense.id,
      userId: updatedExpense.user_id,
      date: updatedExpense.date,
      amount: updatedExpense.amount,
      type: updatedExpense.type,
      categoryId: updatedExpense.category_id,
      categoryName: updatedExpense.category_name,
      note: updatedExpense.note
    };

    res.json(formatted);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ message: 'Lỗi cập nhật chi tiêu' });
  }
});

// Delete expense
router.delete('/:id', authRequired, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: 'Database not available' });
    }

    const userId = req.user.id;
    if (!userId) {
      console.error('❌ Missing user_id when deleting expense!');
      return res.status(401).json({ message: 'Không xác định được người dùng' });
    }

    const expenseId = parseInt(req.params.id);
    console.log(`🗑️ DELETE /api/expenses/${expenseId} - User ID: ${userId}`);

    if (Number.isNaN(expenseId)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    // Verify expense belongs to user before deleting
    const expense = await db.getExpenseById(expenseId, userId);
    if (!expense) {
      return res.status(404).json({ message: 'Không tìm thấy' });
    }

    const deleted = await db.deleteExpense(expenseId, userId);
    if (!deleted) {
      return res.status(404).json({ message: 'Không tìm thấy' });
    }

    console.log(`✅ Expense ${expenseId} deleted for user ${userId}`);
    res.json({ deleted: expenseId });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ message: 'Lỗi xóa chi tiêu' });
  }
});

module.exports = router;