const express = require("express");
const { sendSupportMail } = require("../utils/mailer");
const { query } = require("../database");

const router = express.Router();

/**
 * POST /api/support
 * body: { name, email, subject, message }
 */
router.post("/", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!email || !message) {
      return res.status(400).json({
        message: "Thiếu email hoặc nội dung",
      });
    }

    // 1️⃣ Gửi email cho admin
    await sendSupportMail({
      from: email,
      subject,
      message,
    });

    // 2️⃣ Lưu notification cho admin web
    await query(
      `INSERT INTO admin_notifications (type, title, payload, is_read)
       VALUES (?, ?, ?, false)`,
      [
        "support",
        "📩 Yêu cầu hỗ trợ mới",
        JSON.stringify({
          name: name || "Người dùng",
          email,
          subject: subject || "(Không có)",
          message: String(message),
          createdAt: new Date().toISOString(),
        }),
      ]
    );

    res.json({
      ok: true,
      message: "Gửi yêu cầu hỗ trợ thành công",
    });
  } catch (err) {
    console.error("❌ SUPPORT ERROR:", err);
    res.status(500).json({
      message: "Gửi yêu cầu thất bại",
    });
  }
});

module.exports = router;
