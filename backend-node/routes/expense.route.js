// ========================================
// Routes xử lý các endpoint liên quan đến chi tiêu
// ========================================
const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expense.controller");

/**
 * Route thêm chi tiêu mới
 * POST /api/expense/add
 */
router.post("/add", expenseController.addExpense);

/**
 * Route lấy danh sách tất cả chi tiêu
 * GET /api/expense/all
 */
router.get("/all", expenseController.getExpenses);

// Export router để sử dụng trong server.js
module.exports = router;

