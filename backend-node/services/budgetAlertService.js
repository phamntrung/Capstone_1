/**
 * Budget Alert Service
 * Service để kiểm tra ngân sách và gửi thông báo (in-app và email) dựa trên cài đặt của người dùng
 */

const { query } = require('../database');
const emailService = require('./emailService');

class BudgetAlertService {
  /**
   * Lấy cài đặt cảnh báo ngân sách của user
   * @param {number} userId - ID của user
   * @returns {Promise<Object>} Cài đặt cảnh báo ngân sách
   */
  async getUserBudgetSettings(userId) {
    try {
      const result = await query(
        'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?',
        [userId, 'budget_alert_settings']
      );

      const defaultSettings = {
        enabled: true,
        anomalyEnabled: true,
        threshold: 95,
        notifyInApp: true,
        notifyEmail: false
      };

      if (result && result.length > 0) {
        try {
          const parsedSettings = JSON.parse(result[0].setting_value);
          if (parsedSettings && typeof parsedSettings === 'object') {
            return {
              ...defaultSettings,
              ...parsedSettings
            };
          }
        } catch (parseError) {
          console.error('❌ [budgetAlertService] Lỗi parse JSON:', parseError);
        }
      }

      // Trả về cài đặt mặc định
      return defaultSettings;
    } catch (error) {
      console.error('❌ [budgetAlertService] Lỗi khi lấy cài đặt:', error);
      // Trả về mặc định nếu có lỗi
      return {
        enabled: true,
        anomalyEnabled: true,
        threshold: 95,
        notifyInApp: true,
        notifyEmail: false
      };
    }
  }

  /**
   * Lấy ngân sách và chi tiêu của user trong tháng
   * @param {number} userId - ID của user
   * @param {number} year - Năm
   * @param {number} month - Tháng (1-12)
   * @returns {Promise<Object>} Thông tin ngân sách và chi tiêu
   */
  async getBudgetData(userId, year, month) {
    try {
      // Format tháng thành 2 dạng phổ biến (YYYY-MM và YYYYMM) để tương thích dữ liệu cũ/mới
      const monthDash = `${year}-${String(month).padStart(2, '0')}`; // đúng cấu trúc trong bảng budgets
      const monthCompact = `${year}${String(month).padStart(2, '0')}`; // phòng trường hợp dữ liệu cũ không có dấu "-"

      // Lấy ngân sách (ưu tiên định dạng YYYY-MM, fallback sang YYYYMM nếu có)
      const budgetResult = await query(
        `SELECT amount 
         FROM budgets 
         WHERE user_id = ? 
           AND (month = ? OR month = ?) 
         ORDER BY month LIKE '%-%' DESC 
         LIMIT 1`,
        [userId, monthDash, monthCompact]
      );

      const budget = budgetResult && budgetResult.length > 0 ? parseFloat(budgetResult[0].amount) : 0;

      // Lấy tổng chi tiêu trong tháng
      const expenseResult = await query(
        `SELECT COALESCE(SUM(
            CASE 
              WHEN type = 'expense' OR amount < 0 THEN ABS(amount) 
              ELSE 0 
            END
          ), 0) AS total
         FROM expenses 
         WHERE user_id = ? 
           AND YEAR(date) = ? 
           AND MONTH(date) = ?`,
        [userId, year, month]
      );

      const spent = expenseResult && expenseResult.length > 0
        ? parseFloat(expenseResult[0].total)
        : 0;

      const percentage = budget > 0 ? Math.round((spent / budget) * 100) : 0;

      return {
        budget,
        spent,
        percentage,
        remaining: budget - spent
      };
    } catch (error) {
      console.error('❌ [budgetAlertService] Lỗi khi lấy dữ liệu ngân sách:', error);
      return {
        budget: 0,
        spent: 0,
        percentage: 0,
        remaining: 0
      };
    }
  }

  /**
   * Tạo thông báo in-app
   * @param {number} userId - ID của user
   * @param {string} title - Tiêu đề thông báo
   * @param {string} message - Nội dung thông báo
   * @param {string} type - Loại thông báo (info, warning, error)
   */
  async createInAppNotification(userId, title, message, type = 'warning') {
    try {
      await query(
        `INSERT INTO notifications (user_id, title, message, type, is_read, created_at) 
         VALUES (?, ?, ?, ?, FALSE, NOW())`,
        [userId, title, message, type]
      );
      console.log(`✅ [budgetAlertService] Đã tạo thông báo in-app cho user ${userId}`);
    } catch (error) {
      console.error('❌ [budgetAlertService] Lỗi khi tạo thông báo in-app:', error);
    }
  }

  /**
   * Kiểm tra xem đã gửi cảnh báo cho user trong tháng này chưa
   * Tránh gửi thông báo trùng lặp nhiều lần trong cùng một tháng
   * @param {number} userId - ID của user
   * @param {number} year - Năm
   * @param {number} month - Tháng
   * @returns {Promise<boolean>} true nếu đã gửi cảnh báo trong tháng này
   */
  async hasAlertBeenSentThisMonth(userId, year, month) {
    try {
      // Tìm thông báo cảnh báo ngân sách đã gửi trong tháng này
      const monthStr = `${month}/${year}`;
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const result = await query(
        `SELECT id FROM notifications 
         WHERE user_id = ? 
         AND (title LIKE ? OR title LIKE ?)
         AND DATE(created_at) >= DATE(?)
         AND DATE(created_at) < DATE_ADD(DATE(?), INTERVAL 1 MONTH)
         LIMIT 1`,
        [userId, `%ngân sách tháng ${monthStr}%`, `%Cảnh báo ngân sách%`, startDate, startDate]
      );
      return result && result.length > 0;
    } catch (error) {
      console.error('❌ [budgetAlertService] Lỗi khi kiểm tra thông báo đã gửi:', error);
      return false; // Nếu có lỗi, cho phép gửi để đảm bảo không bỏ sót
    }
  }

  /**
   * Kiểm tra và gửi cảnh báo ngân sách
   * Logic: Khi phần trăm chi tiêu >= ngưỡng cảnh báo đã cài đặt, hệ thống sẽ gửi thông báo
   * Ví dụ: Nếu ngưỡng = 95%, khi chi tiêu >= 95% ngân sách thì sẽ gửi cảnh báo
   * 
   * @param {number} userId - ID của user
   * @param {number} year - Năm (optional, mặc định là năm hiện tại)
   * @param {number} month - Tháng (optional, mặc định là tháng hiện tại)
   * @param {boolean} forceSend - Bỏ qua kiểm tra trùng lặp (dùng cho test)
   */
  async checkAndSendBudgetAlert(userId, year = null, month = null, forceSend = false) {
    try {
      console.log(`🔍 [budgetAlertService] Bắt đầu kiểm tra cảnh báo cho user ${userId}...`);
      
      // Bước 1: Lấy cài đặt cảnh báo của user (bao gồm ngưỡng, notifyInApp, notifyEmail)
      const settings = await this.getUserBudgetSettings(userId);
      console.log(`📋 [budgetAlertService] Cài đặt user ${userId}:`, JSON.stringify(settings));

      // Bước 2: Kiểm tra xem cảnh báo có được bật không
      if (!settings.enabled) {
        console.log(`ℹ️ [budgetAlertService] Cảnh báo ngân sách đã tắt cho user ${userId}`);
        return { sent: false, reason: 'disabled' };
      }

      // Bước 3: Xác định năm/tháng cần kiểm tra
      const now = new Date();
      const targetYear = year || now.getFullYear();
      const targetMonth = month || (now.getMonth() + 1);
      console.log(`📅 [budgetAlertService] Kiểm tra cho tháng ${targetMonth}/${targetYear}`);

      // Bước 4: Lấy dữ liệu ngân sách và chi tiêu của user trong tháng
      const budgetData = await this.getBudgetData(userId, targetYear, targetMonth);
      console.log(`💰 [budgetAlertService] Dữ liệu ngân sách user ${userId}:`, {
        budget: budgetData.budget,
        spent: budgetData.spent,
        percentage: budgetData.percentage,
        threshold: settings.threshold
      });

      // Kiểm tra xem có ngân sách không
      if (budgetData.budget <= 0) {
        console.log(`ℹ️ [budgetAlertService] User ${userId} chưa có ngân sách cho tháng ${targetMonth}/${targetYear}`);
        return { sent: false, reason: 'no_budget' };
      }

      // Bước 5: Kiểm tra xem phần trăm chi tiêu có >= ngưỡng cảnh báo không
      // Ví dụ: Nếu ngưỡng = 95%, thì khi percentage >= 95 sẽ gửi cảnh báo
      if (budgetData.percentage < settings.threshold) {
        console.log(`ℹ️ [budgetAlertService] User ${userId} chưa đạt ngưỡng cảnh báo (${budgetData.percentage}% < ${settings.threshold}%)`);
        return { sent: false, reason: 'below_threshold', percentage: budgetData.percentage, threshold: settings.threshold };
      }

      // Bước 5.5: Kiểm tra xem đã gửi cảnh báo trong tháng này chưa (tránh spam)
      if (!forceSend) {
        const alreadySent = await this.hasAlertBeenSentThisMonth(userId, targetYear, targetMonth);
        if (alreadySent) {
          console.log(`ℹ️ [budgetAlertService] Đã gửi cảnh báo cho user ${userId} trong tháng ${targetMonth}/${targetYear} rồi, bỏ qua để tránh spam`);
          return { sent: false, reason: 'already_sent' };
        }
      }

      // Bước 6: Lấy thông tin user để gửi email (nếu cần)
      const userResult = await query(
        'SELECT id, email, name FROM users WHERE id = ?',
        [userId]
      );

      if (!userResult || userResult.length === 0) {
        console.error(`❌ [budgetAlertService] Không tìm thấy user ${userId}`);
        return;
      }

      const user = userResult[0];

      // Bước 7: Tạo nội dung thông báo dựa trên mức độ vượt ngưỡng
      const monthStr = `${targetMonth}/${targetYear}`;
      let title, message, notificationType;

      if (budgetData.percentage >= 100) {
        // Trường hợp vượt quá 100% ngân sách - cảnh báo lỗi
        title = `⚠️ Vượt quá ngân sách tháng ${monthStr}`;
        message = `Bạn đã vượt quá ngân sách tháng ${monthStr}. Đã chi tiêu: ${budgetData.spent.toLocaleString('vi-VN')}đ / Ngân sách: ${budgetData.budget.toLocaleString('vi-VN')}đ (${budgetData.percentage}%)`;
        notificationType = 'error';
      } else if (budgetData.percentage >= settings.threshold) {
        // Trường hợp đạt hoặc vượt ngưỡng cảnh báo (nhưng chưa vượt 100%)
        // Ví dụ: Ngưỡng = 95%, chi tiêu = 96% -> Gửi cảnh báo warning
        title = `⚠️ Cảnh báo ngân sách tháng ${monthStr}`;
        message = `Bạn đã sử dụng ${budgetData.percentage}% ngân sách tháng ${monthStr}. Đã chi tiêu: ${budgetData.spent.toLocaleString('vi-VN')}đ / Ngân sách: ${budgetData.budget.toLocaleString('vi-VN')}đ`;
        notificationType = 'warning';
      } else {
        // Không cần cảnh báo (không nên xảy ra vì đã check ở trên, nhưng để an toàn)
        return;
      }

      // Bước 8: Gửi thông báo in-app nếu user đã bật tùy chọn này
      let inAppSent = false;
      if (settings.notifyInApp) {
        await this.createInAppNotification(userId, title, message, notificationType);
        inAppSent = true;
        console.log(`✅ [budgetAlertService] Đã gửi thông báo in-app cho user ${userId} (${budgetData.percentage}% >= ${settings.threshold}%)`);
      } else {
        console.log(`ℹ️ [budgetAlertService] User ${userId} đã tắt thông báo in-app`);
      }

      // Bước 9: Gửi email nếu user đã bật tùy chọn này và có email
      let emailSent = false;
      if (settings.notifyEmail && user.email) {
        try {
          const emailBudgetData = {
            month: monthStr,
            spent: budgetData.spent,
            budget: budgetData.budget,
            percentage: budgetData.percentage
          };
          await emailService.sendBudgetAlert(user, emailBudgetData);
          emailSent = true;
          console.log(`✅ [budgetAlertService] Đã gửi email cảnh báo cho user ${userId} (${budgetData.percentage}% >= ${settings.threshold}%)`);
        } catch (emailError) {
          console.error(`❌ [budgetAlertService] Lỗi khi gửi email cảnh báo:`, emailError);
        }
      } else {
        if (!settings.notifyEmail) {
          console.log(`ℹ️ [budgetAlertService] User ${userId} đã tắt thông báo email`);
        } else if (!user.email) {
          console.log(`ℹ️ [budgetAlertService] User ${userId} chưa có email`);
        }
      }

      const result = {
        sent: inAppSent || emailSent,
        inAppSent,
        emailSent,
        percentage: budgetData.percentage,
        threshold: settings.threshold,
        budget: budgetData.budget,
        spent: budgetData.spent
      };

      console.log(`✅ [budgetAlertService] Đã xử lý cảnh báo ngân sách cho user ${userId}:`, result);
      return result;
    } catch (error) {
      console.error(`❌ [budgetAlertService] Lỗi khi kiểm tra cảnh báo ngân sách:`, error);
      console.error(`❌ [budgetAlertService] Stack trace:`, error.stack);
      return { sent: false, reason: 'error', error: error.message };
    }
  }

  /**
   * Lấy danh sách user có cảnh báo ngân sách được bật
   * @returns {Promise<Array>} Danh sách user
   */
  async getUsersWithBudgetAlertsEnabled() {
    try {
      const result = await query(
        `SELECT u.id, u.email, u.name 
         FROM users u
         INNER JOIN user_settings us ON u.id = us.user_id
         WHERE us.setting_key = 'budget_alert_settings'`
      );

      if (!result || result.length === 0) {
        return [];
      }

      // Lọc các user có enabled = true
      const enabledUsers = [];
      for (const user of result) {
        try {
          const settingsResult = await query(
            'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?',
            [user.id, 'budget_alert_settings']
          );
          
          if (settingsResult && settingsResult.length > 0) {
            const settings = JSON.parse(settingsResult[0].setting_value);
            if (settings.enabled === true) {
              enabledUsers.push(user);
            }
          }
        } catch (parseError) {
          // Bỏ qua user này nếu không parse được
          console.warn(`⚠️ [budgetAlertService] Không thể parse settings cho user ${user.id}`);
        }
      }

      return enabledUsers;
    } catch (error) {
      console.error('❌ [budgetAlertService] Lỗi khi lấy danh sách user:', error);
      return [];
    }
  }
}

module.exports = new BudgetAlertService();

