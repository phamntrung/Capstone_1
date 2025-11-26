const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const { query } = require('../database');

/**
 * GET /api/settings/budget-alerts
 * Lấy cài đặt cảnh báo ngân sách của user hiện tại
 */
router.get('/budget-alerts', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Lấy cài đặt từ database
    const result = await query(
      'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [userId, 'budget_alert_settings']
    );

    if (result && result.length > 0) {
      try {
        const settings = JSON.parse(result[0].setting_value);
        return res.json({
          ok: true,
          settings: settings
        });
      } catch (parseError) {
        console.error('❌ [settings.js] Lỗi parse JSON:', parseError);
        // Nếu không parse được, trả về mặc định
      }
    }

    // Trả về cài đặt mặc định nếu chưa có
    const defaultSettings = {
      enabled: true,
      anomalyEnabled: true,
      threshold: 95,
      notifyInApp: true,
      notifyEmail: false
    };

    return res.json({
      ok: true,
      settings: defaultSettings
    });

  } catch (error) {
    console.error('❌ [settings.js] Lỗi khi lấy cài đặt cảnh báo ngân sách:', error);
    res.status(500).json({
      ok: false,
      message: 'Không thể lấy cài đặt cảnh báo ngân sách'
    });
  }
});

/**
 * POST /api/settings/budget-alerts
 * Lưu cài đặt cảnh báo ngân sách của user hiện tại
 */
router.post('/budget-alerts', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        ok: false,
        message: 'Dữ liệu cài đặt không hợp lệ'
      });
    }

    // Validate và chuẩn hóa dữ liệu
    // Cho phép ngưỡng từ 1-100% để người dùng có thể tùy chỉnh linh hoạt
    let threshold = parseInt(settings.threshold) || 95;
    if (threshold < 1) threshold = 1;      // Tối thiểu 1%
    if (threshold > 100) threshold = 100;   // Tối đa 100%
    
    const normalizedSettings = {
      enabled: settings.enabled !== false, // Mặc định true
      anomalyEnabled: settings.anomalyEnabled !== false, // Mặc định true
      threshold: threshold, // Ngưỡng cảnh báo từ 1-100%
      notifyInApp: settings.notifyInApp !== false, // Mặc định true
      notifyEmail: settings.notifyEmail === true // Mặc định false
    };

    const settingsJson = JSON.stringify(normalizedSettings);

    // Kiểm tra xem đã có setting chưa
    const existing = await query(
      'SELECT id FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [userId, 'budget_alert_settings']
    );

    if (existing && existing.length > 0) {
      // Cập nhật setting hiện có
      await query(
        'UPDATE user_settings SET setting_value = ?, updated_at = NOW() WHERE user_id = ? AND setting_key = ?',
        [settingsJson, userId, 'budget_alert_settings']
      );
    } else {
      // Tạo setting mới
      await query(
        'INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [userId, 'budget_alert_settings', settingsJson]
      );
    }

    console.log(`✅ [settings.js] Đã lưu cài đặt cảnh báo ngân sách cho user ${userId}:`, normalizedSettings);

    return res.json({
      ok: true,
      message: 'Đã lưu cài đặt thành công',
      settings: normalizedSettings
    });

  } catch (error) {
    console.error('❌ [settings.js] Lỗi khi lưu cài đặt cảnh báo ngân sách:', error);
    res.status(500).json({
      ok: false,
      message: 'Không thể lưu cài đặt cảnh báo ngân sách'
    });
  }
});

/**
 * POST /api/settings/test-budget-alert
 * Test endpoint để kiểm tra cảnh báo ngân sách thủ công
 * Dùng để debug khi cảnh báo không hoạt động
 */
router.post('/test-budget-alert', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { year, month, forceSend } = req.body;
    
    const budgetAlertService = require('../services/budgetAlertService');
    
    // Gọi hàm kiểm tra cảnh báo
    const result = await budgetAlertService.checkAndSendBudgetAlert(
      userId, 
      year || null, 
      month || null, 
      forceSend === true
    );
    
    return res.json({
      ok: true,
      message: 'Đã kiểm tra cảnh báo ngân sách',
      result: result
    });
  } catch (error) {
    console.error('❌ [settings.js] Lỗi khi test cảnh báo ngân sách:', error);
    res.status(500).json({
      ok: false,
      message: 'Lỗi khi kiểm tra cảnh báo: ' + error.message
    });
  }
});

/**
 * GET /api/settings/budget-status
 * Lấy trạng thái cảnh báo ngân sách hiện tại để hiển thị trên trang chủ
 * Trả về: budget, spent, percentage, threshold, và có vượt ngưỡng không
 */
router.get('/budget-status', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const budgetAlertService = require('../services/budgetAlertService');
    
    // Lấy năm và tháng hiện tại
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    // Lấy cài đặt cảnh báo
    const settings = await budgetAlertService.getUserBudgetSettings(userId);
    
    // Lấy dữ liệu ngân sách
    const budgetData = await budgetAlertService.getBudgetData(userId, year, month);
    
    // Kiểm tra xem có vượt ngưỡng không
    const isOverThreshold = budgetData.budget > 0 && 
                            budgetData.percentage >= settings.threshold;
    
    // Xác định mức độ cảnh báo
    let alertLevel = 'none'; // none, info, warning, error
    let alertMessage = '';
    
    if (budgetData.budget === 0) {
      alertLevel = 'none';
      alertMessage = '';
    } else if (budgetData.percentage >= 100) {
      alertLevel = 'error';
      alertMessage = `Bạn đã vượt quá ngân sách! Đã chi ${budgetData.percentage}% ngân sách tháng này.`;
    } else if (budgetData.percentage >= settings.threshold) {
      alertLevel = 'warning';
      alertMessage = `Cảnh báo: Bạn đã chi ${budgetData.percentage}% ngân sách (ngưỡng: ${settings.threshold}%).`;
    } else if (budgetData.percentage >= settings.threshold - 10) {
      alertLevel = 'info';
      alertMessage = `Lưu ý: Bạn đã chi ${budgetData.percentage}% ngân sách. Còn ${100 - budgetData.percentage}% trước khi đạt ngưỡng cảnh báo.`;
    }
    
    return res.json({
      ok: true,
      data: {
        budget: budgetData.budget,
        spent: budgetData.spent,
        remaining: budgetData.remaining,
        percentage: budgetData.percentage,
        threshold: settings.threshold,
        enabled: settings.enabled,
        isOverThreshold: isOverThreshold,
        alertLevel: alertLevel,
        alertMessage: alertMessage,
        month: `${month}/${year}`
      }
    });
  } catch (error) {
    console.error('❌ [settings.js] Lỗi khi lấy trạng thái ngân sách:', error);
    res.status(500).json({
      ok: false,
      message: 'Không thể lấy trạng thái ngân sách'
    });
  }
});

module.exports = router;

