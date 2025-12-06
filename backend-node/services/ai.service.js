// ========================================
// AI SERVICE - Gọi OpenRouter
// ========================================
const axios = require("axios");

exports.ask = async (message) => {
    try {
        const API_KEY = process.env.OPENROUTER_API_KEY;

        if (!API_KEY) {
            throw new Error("Thiếu OPENROUTER_API_KEY trong .env");
        }

        console.log(">>> Gửi tới OpenRouter:", message);

        const res = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "openai/gpt-4o-mini",
                messages: [
                    { role: "user", content: message }
                ]
            },
            {
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "HTTP-Referer": "http://localhost:5000",
                    "X-Title": "SmartExpenseAI",
                    "X-Referer": "http://localhost:5000"
                },
                timeout: 20000
            }
        );

        const reply =
            res.data?.choices?.[0]?.message?.content ||
            "Xin lỗi, mình chưa nhận được phản hồi.";

        return reply;

    } catch (err) {
        console.error("🔥 Lỗi OpenRouter:", err.response?.data || err.message);

        if (err.response) {
            const msg = err.response.data?.error?.message || err.response.data?.message;
            throw new Error(`Lỗi OpenRouter: ${msg}`);
        }

        throw new Error("Không thể kết nối đến AI. Vui lòng thử lại.");
    }
};
