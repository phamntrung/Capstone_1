// ========================================
// Controller xử lý các request liên quan đến chi tiêu
// ========================================
const Expense = require("../models/expense.model");
const budgetAlertService = require('../services/budgetAlertService');

/**
 * Thêm chi tiêu mới
 * POST /api/expense/add
 * Body: { userId, category, amount, note, date }
 */
exports.addExpense = async (req, res) => {
  const { userId, category, amount, note, date } = req.body;

  try {
    // 1️⃣ Tạo chi tiêu
    const expense = await Expense.create({
      userId,
      category,
      amount,
      note,
      date: date || new Date()
    });

    // 2️⃣ KIỂM TRA & GỬI CẢNH BÁO NGÂN SÁCH (🔥 DÒNG QUAN TRỌNG)
    await budgetAlertService.checkAndSendBudgetAlert(userId);

    // 3️⃣ Trả kết quả
    res.json({
      success: true,
      expense
    });

  } catch (err) {
    console.error("Lỗi thêm chi tiêu:", err);
    res.status(500).json({
      error: err.message || "Lỗi thêm chi tiêu"
    });
  }
};

/**
 * Lấy danh sách tất cả chi tiêu
 * GET /api/expense/all
 */
exports.getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.findAll({
      order: [["date", "DESC"]]
    });
    res.json(expenses);
  } catch (err) {
    console.error("Lỗi lấy danh sách chi tiêu:", err);
    res.status(500).json({
      error: err.message || "Lỗi lấy danh sách chi tiêu"
    });
  }
};
