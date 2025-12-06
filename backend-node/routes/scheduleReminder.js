const { query } = require("../database");
const moment = require("moment");

async function sendScheduleNotifications() {
    const today = moment().format("YYYY-MM-DD");
    const weekday = moment().day();      
    const day = moment().date();         

    const schedules = await query(
        "SELECT * FROM schedules WHERE enabled = 1"
    );

    for (const s of schedules) {
        let shouldNotify = false;

        if (s.type === "daily") shouldNotify = true;
        if (s.type === "weekly" && weekday === 1) shouldNotify = true;
        if (s.type === "monthly" && day === 1) shouldNotify = true;

        if (!shouldNotify) continue;

        // Tạo thông báo
        await query(`
            INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
            VALUES (?, ?, ?, 'schedule', FALSE, NOW())
        `, [
            s.user_id,
            "Nhắc lịch chi tiêu",
            `Đến hạn: ${s.name} - ${s.amount}đ`
        ]);

        console.log("🔔 Đã tạo thông báo cho user", s.user_id);
    }
}

module.exports = { sendScheduleNotifications };
