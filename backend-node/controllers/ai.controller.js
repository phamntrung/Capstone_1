// ========================================
// AI CONTROLLER
// ========================================
const aiService = require("../services/ai.service");
const { createExpense } = require("../database");

exports.askAI = async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user?.id;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: "Message không được để trống" });
        }

        if (!userId) {
            return res.status(401).json({ error: "Bạn chưa đăng nhập" });
        }

        const text = message.toLowerCase().trim();

        // ========================================
        // 🔥 INTENT: Tạo chi tiêu
        // Hỗ trợ: tạo chi 50000, thêm chi tiêu 100k,
        // add expense 120000
        // ========================================
        const regex = /(tạo|thêm|add)\s+(chi|chi tiêu|expense)\s+(\d+(?:[.,]\d+)?)/;
        const match = text.match(regex);

        if (match) {
            try {
                const rawAmount = match[3].replace(/,/g, "");
                const amount = parseFloat(rawAmount);

                if (isNaN(amount) || amount <= 0) {
                    throw new Error("Số tiền không hợp lệ");
                }

                const expense = await createExpense(userId, {
                    date: new Date().toISOString().slice(0, 10),
                    amount,
                    type: "expense",
                    categoryId: null,
                    note: `Tạo từ chat: ${message}`
                });

                return res.json({
                    reply: `✨ Đã tạo chi tiêu ${amount.toLocaleString("vi-VN")}đ cho bạn.`,
                    created: {
                        id: expense.id,
                        date: expense.date,
                        amount: expense.amount,
                        type: expense.type,
                        categoryId: expense.category_id,
                        note: expense.note
                    }
                });

            } catch (err) {
                console.error("🔥 Lỗi tạo expense:", err);
                return res.json({
                    reply: `⚠ Không thể tạo chi tiêu: ${err.message}`
                });
            }
        }

        // ========================================
        // Không phải intent → hỏi AI
        // ========================================
        const reply = await aiService.ask(message);

        return res.json({ reply });

    } catch (err) {
        console.error("🔥 Lỗi askAI:", err);
        return res.status(500).json({
            error: "Lỗi xử lý yêu cầu AI: " + err.message
        });
    }
};
