const { query } = require('../database');
const emailService = require('./emailService');

class BudgetAlertService {

  async getSettings(userId) {
    const defaultSettings = {
      enabled: true,
      threshold: 95,
      notifyInApp: true,
      notifyEmail: true,
      lastAlertMonth: null
    };

    const rows = await query(
      `SELECT setting_value FROM user_settings
       WHERE user_id=? AND setting_key='budget_alert_settings'`,
      [userId]
    );

    if (!rows.length) return defaultSettings;

    return { ...defaultSettings, ...JSON.parse(rows[0].setting_value) };
  }

  async saveSettings(userId, settings) {
    await query(
      `UPDATE user_settings
       SET setting_value=?, updated_at=NOW()
       WHERE user_id=? AND setting_key='budget_alert_settings'`,
      [JSON.stringify(settings), userId]
    );
  }

  async getBudgetData(userId, year, month) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    const [b] = await query(
      `SELECT amount FROM budgets WHERE user_id=? AND month=? LIMIT 1`,
      [userId, monthKey]
    );

    const budget = b ? Number(b.amount) : 0;

    const [e] = await query(
      `SELECT COALESCE(SUM(ABS(amount)),0) total
       FROM expenses
       WHERE user_id=? AND YEAR(date)=? AND MONTH(date)=?`,
      [userId, year, month]
    );

    const spent = Number(e.total);
    const percentage = budget ? Math.ceil((spent / budget) * 100) : 0;

    return { budget, spent, percentage };
  }

  async createNotification(userId, title, message) {
    await query(
      `INSERT INTO notifications
       (user_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, 'warning', 0, NOW())`,
      [userId, title, message]
    );
  }

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
      `SELECT id,email,name FROM users WHERE id=?`,
      [userId]
    );

    const title = `⚠️ Cảnh báo ngân sách ${month}/${year}`;
    const message = `Bạn đã sử dụng ${percentage}% ngân sách tháng này`;

    if (settings.notifyInApp) {
      await this.createNotification(userId, title, message);
    }

    if (settings.notifyEmail && user.email) {
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
}

module.exports = new BudgetAlertService();
