const { query } = require('../database');
const emailService = require('./emailService');

class BudgetAlertService {

  // =============================
  // Lấy cấu hình cảnh báo ngân sách
  // =============================
  async getSettings(userId) {
    const defaultSettings = {
      enabled: true,
      threshold: 95,
      notifyInApp: true,
      notifyEmail: true,
      lastAlertMonth: null
    };

    const rows = await query(
      `SELECT setting_value
       FROM user_settings
       WHERE user_id = ? AND setting_key = 'budget_alert_settings'`,
      [userId]
    );

    if (!rows.length) return defaultSettings;

    return { ...defaultSettings, ...JSON.parse(rows[0].setting_value) };
  }

  // =============================
  // Lưu cấu hình cảnh báo
  // =============================
  async getBudgetData(userId, year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  // 1️⃣ LẤY NGÂN SÁCH (KHÔNG DÙNG BALANCE)
  const [b] = await query(
    `SELECT amount
     FROM budgets
     WHERE user_id = ?
       AND month = ?`,
    [userId, `${year}-${String(month).padStart(2, '0')}`]
  );

  const budget = Number(b?.amount || 0);

  // 2️⃣ CHỈ TÍNH CHI TIÊU (type = expense)
  const [e] = await query(
    `SELECT COALESCE(SUM(ABS(amount)), 0) AS total
     FROM expenses
     WHERE user_id = ?
       AND type = 'expense'
       AND date >= ?
       AND date < ?`,
    [userId, startDate, endDate]
  );

  const spent = Number(e.total || 0);

  // 3️⃣ TÍNH % CHUẨN TOÁN HỌC
  const percentage =
    budget > 0 ? Math.floor((spent / budget) * 100) : 0;

  return {
    budget,
    spent,
    remaining: budget - spent,
    percentage
  };
} 
  // =============================
  // Tạo thông báo trong hệ thống
  // =============================
  async createNotification(userId, title, message) {
    await query(
      `INSERT INTO notifications
       (user_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, 'warning', 0, NOW())`,
      [userId, title, message]
    );
  }

  // =============================
  // Kiểm tra & gửi cảnh báo ngân sách
  // =============================
  async checkAndSendBudgetAlert(userId, forceSend = false) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    const settings = await this.getSettings(userId);
    if (!settings.enabled) return;

    if (!forceSend && settings.lastAlertMonth === monthKey) return;

    const { budget, spent, percentage } =
      await this.getBudgetData(userId, year, month);

    if (budget <= 0 || percentage < settings.threshold) return;

    const [user] = await query(
      `SELECT id, email, name
       FROM users
       WHERE id = ?`,
      [userId]
    );

    const title = `⚠️ Cảnh báo ngân sách ${month}/${year}`;
    const message = `Bạn đã sử dụng ${percentage}% ngân sách tháng này`;

    if (settings.notifyInApp) {
      await this.createNotification(userId, title, message);
    }

    if (settings.notifyEmail && user?.email) {
      await emailService.sendBudgetAlert(user, {
        month: `${month}/${year}`,
        spent,
        budget,
        percentage
      });
    }

    settings.lastAlertMonth = monthKey;
    await this.saveSettings(userId, settings);
  }

  // =============================
  // ✅ LẤY DANH SÁCH USER ĐÃ BẬT CẢNH BÁO
  // =============================
  async getUsersWithBudgetAlertsEnabled() {
    const rows = await query(`
      SELECT u.id, u.email
      FROM users u
      JOIN user_settings s ON u.id = s.user_id
      WHERE s.setting_key = 'budget_alert_settings'
        AND JSON_UNQUOTE(
              JSON_EXTRACT(s.setting_value, '$.enabled')
            ) = 'true'
    `);

    return Array.isArray(rows) ? rows : [];
  }
}

module.exports = new BudgetAlertService();
  