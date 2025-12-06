// ========================================
// Controller xử lý các request liên quan đến chi tiêu
// ========================================
const Expense = require("../models/expense.model");

/**
 * Thêm chi tiêu mới
 * POST /api/expense/add
 * Body: { userId, category, amount, note, date }
 */
exports.addExpense = async (req, res) => {
    // Lấy dữ liệu từ request body
    const { userId, category, amount, note, date } = req.body;

    try {
        // Tạo chi tiêu mới trong database
        const expense = await Expense.create({
            userId,
            category,
            amount,
            note,
            date: date || new Date() // Nếu không có date thì dùng ngày hiện tại
        });

        // Trả về kết quả thành công
        res.json({ 
            success: true, 
            expense 
        });

    } catch (err) {
        // Log lỗi
        console.error("Lỗi thêm chi tiêu:", err);
        
        // Trả về lỗi
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
        // Lấy tất cả chi tiêu, sắp xếp theo ngày giảm dần (mới nhất trước)
        const expenses = await Expense.findAll({ 
            order: [["date", "DESC"]] 
        });

        // Trả về danh sách
        res.json(expenses);

    } catch (err) {
        // Log lỗi
        console.error("Lỗi lấy danh sách chi tiêu:", err);
        
        // Trả về lỗi
        res.status(500).json({ 
            error: err.message || "Lỗi lấy danh sách chi tiêu" 
        });
    }
};

