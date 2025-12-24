// ========================================
// Controller xử lý các request liên quan đến chi tiêu / thu nhập
// ========================================

const Expense = require("../models/expense.model");
const budgetAlertService = require('../services/budgetAlertService');

/**
 * POST /api/expenses
 * Body: { type, category, amount, note, date }
 */
exports.addExpense = async (req, res) => {
  try {
    // ✅ LẤY USER TỪ TOKEN (KHÔNG LẤY TỪ BODY)
    const userId = req.user.id;

    const { type, category, amount, note, date } = req.body;

    // ✅ Validate
    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'type must be income or expense' });
    }

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ message: 'amount không hợp lệ' });
    }

    // ✅ expense = âm, income = dương
    const finalAmount =
      type === 'expense'
        ? -Math.abs(amount)
        : Math.abs(amount);

    // ✅ Tạo bản ghi
    const expense = await Expense.create({
      userId,
      category,
      amount: finalAmount,
      note,
      date: date || new Date(),
      type
    });

    // 🔥 CHỈ KIỂM TRA NGÂN SÁCH KHI LÀ CHI TIÊU
    if (type === 'expense') {
      await budgetAlertService.checkAndSendBudgetAlert(userId);
    }

    res.json({
      success: true,
      item: expense
    });

  } catch (err) {
    console.error("❌ Lỗi thêm chi tiêu:", err);
    res.status(500).json({
      message: "Lỗi thêm chi tiêu"
    });
  }
};

/**
 * GET /api/expenses
 */
const { Op } = require('sequelize');

exports.getExpenses = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;

    let where = { userId };

    // 🔥 FIX QUAN TRỌNG: phân biệt thu / chi
    if (type === 'income') {
      where.amount = { [Op.gt]: 0 };
    }

    if (type === 'expense') {
      where.amount = { [Op.lt]: 0 };
    }

    const items = await Expense.findAll({
      where,
      order: [['date', 'DESC']]
    });

    res.json({
      items,
      total: items.length
    });

  } catch (err) {
    console.error("❌ Lỗi lấy chi tiêu:", err);
    res.status(500).json({
      message: "Lỗi lấy danh sách chi tiêu"
    });
  }
};
