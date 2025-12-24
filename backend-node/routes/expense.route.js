const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expense.controller");
const { authRequired } = require("../middleware/auth");

// ➕ Thêm thu / chi
router.post("/", authRequired, expenseController.addExpense);

// 📄 Lấy danh sách (có filter)
router.get("/", authRequired, expenseController.getExpenses);

module.exports = router;
