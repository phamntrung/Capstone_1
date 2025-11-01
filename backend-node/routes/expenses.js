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
