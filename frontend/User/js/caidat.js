/**
 * Cài đặt JavaScript - Xử lý logic cho trang cài đặt
 * Quản lý cài đặt cảnh báo ngân sách và các tùy chọn khác
 */

(function() {
  'use strict';

  // ===== Các biến toàn cục =====
  let budgetSettings = {
    enabled: true,              // Bật/tắt cảnh báo ngân sách
    anomalyEnabled: true,       // Bật/tắt cảnh báo bất thường
    threshold: 95,             // Ngưỡng cảnh báo: từ 1-100% (mặc định 95%)
                                // Khi chi tiêu >= ngưỡng này, sẽ gửi thông báo
    notifyInApp: true,         // Gửi thông báo trong ứng dụng
    notifyEmail: false          // Gửi thông báo qua email
  };

  // ===== Khởi tạo khi DOM ready =====
  function init() {
    // Kiểm tra authentication
    if (typeof checkAuth === 'function') {
      const auth = checkAuth();
      if (!auth || !auth.user) {
        console.warn('⚠️ [caidat.js] Chưa đăng nhập, chuyển về trang login');
        window.location.href = 'login.html';
        return;
      }
    }

    // Load cài đặt từ backend
    loadSettings();

    // Gắn event listeners
    attachEventListeners();
  }

  /**
   * Load cài đặt cảnh báo ngân sách từ backend
   * Cài đặt bao gồm:
   * - enabled: Bật/tắt cảnh báo
   * - threshold: Ngưỡng cảnh báo (1-100%)
   * - notifyInApp: Gửi thông báo trong app
   * - notifyEmail: Gửi thông báo qua email
   */
  async function loadSettings() {
    try {
      console.log('📥 [caidat.js] Đang tải cài đặt từ backend...');
      
      if (typeof apiRequest !== 'function') {
        console.error('❌ [caidat.js] Hàm apiRequest không tồn tại');
        return;
      }

      const response = await apiRequest('/api/settings/budget-alerts', {
        method: 'GET'
      });

      if (response && response.ok && response.data) {
        const data = response.data;
        if (data && data.ok && data.settings) {
          budgetSettings = {
            enabled: data.settings.enabled !== false,
            anomalyEnabled: data.settings.anomalyEnabled !== false,
            threshold: data.settings.threshold || 95,
            notifyInApp: data.settings.notifyInApp !== false,
            notifyEmail: data.settings.notifyEmail === true
          };
          console.log('✅ [caidat.js] Đã tải cài đặt:', budgetSettings);
        } else {
          console.log('ℹ️ [caidat.js] Chưa có cài đặt, sử dụng mặc định');
        }
      } else {
        console.log('ℹ️ [caidat.js] Chưa có cài đặt, sử dụng mặc định');
      }
    } catch (error) {
      console.error('❌ [caidat.js] Lỗi khi tải cài đặt:', error);
    } finally {
      // Cập nhật UI với cài đặt đã load
      updateUI();
    }
  }

  // ===== Cập nhật UI với cài đặt hiện tại =====
  function updateUI() {
    // Cập nhật switch Ngân sách
    const swBudget = document.getElementById('swBudget');
    if (swBudget) {
      swBudget.checked = budgetSettings.enabled;
    }

    // Cập nhật switch Bất thường
    const swAnomaly = document.getElementById('swAnomaly');
    if (swAnomaly) {
      swAnomaly.checked = budgetSettings.anomalyEnabled;
    }

    // Cập nhật radio buttons ngưỡng cảnh báo
    const thresholdRadios = document.querySelectorAll('input[name="threshold"]');
    const customThresholdInput = document.getElementById('customThresholdInput');
    const customThresholdContainer = document.getElementById('customThresholdContainer');
    const thresholdCustom = document.getElementById('thresholdCustom');
    
    // Kiểm tra xem ngưỡng có phải là một trong các giá trị mặc định không (30, 95, 100)
    const defaultThresholds = [30, 95, 100];
    const isDefaultThreshold = defaultThresholds.includes(budgetSettings.threshold);
    
    if (isDefaultThreshold) {
      // Nếu là giá trị mặc định, chọn radio button tương ứng
      thresholdRadios.forEach(radio => {
        const value = parseInt(radio.value);
        if (!isNaN(value)) {
          radio.checked = value === budgetSettings.threshold;
        } else {
          radio.checked = false;
        }
      });
      if (thresholdCustom) thresholdCustom.checked = false;
      if (customThresholdContainer) customThresholdContainer.style.display = 'none';
    } else {
      // Nếu là giá trị tùy chỉnh, chọn radio "Tùy chỉnh" và hiển thị input
      thresholdRadios.forEach(radio => {
        const value = parseInt(radio.value);
        if (!isNaN(value)) {
          radio.checked = false;
        }
      });
      if (thresholdCustom) thresholdCustom.checked = true;
      if (customThresholdInput) customThresholdInput.value = budgetSettings.threshold;
      if (customThresholdContainer) customThresholdContainer.style.display = 'block';
    }

    // Cập nhật checkboxes phương thức thông báo
    const notifyInApp = document.getElementById('notifyInApp');
    const notifyEmail = document.getElementById('notifyEmail');
    if (notifyInApp) {
      notifyInApp.checked = budgetSettings.notifyInApp;
    }
    if (notifyEmail) {
      notifyEmail.checked = budgetSettings.notifyEmail;
    }
  }

  // ===== Gắn event listeners =====
  function attachEventListeners() {
    // Switch Ngân sách
    const swBudget = document.getElementById('swBudget');
    if (swBudget) {
      swBudget.addEventListener('change', async (e) => {
        budgetSettings.enabled = e.target.checked;
        await saveSettings();
      });
    }

    // Switch Bất thường
    const swAnomaly = document.getElementById('swAnomaly');
    if (swAnomaly) {
      swAnomaly.addEventListener('change', async (e) => {
        budgetSettings.anomalyEnabled = e.target.checked;
        await saveSettings();
      });
    }

    // Radio buttons ngưỡng cảnh báo
    const thresholdRadios = document.querySelectorAll('input[name="threshold"]');
    const customThresholdInput = document.getElementById('customThresholdInput');
    const customThresholdContainer = document.getElementById('customThresholdContainer');
    const thresholdCustom = document.getElementById('thresholdCustom');
    
    thresholdRadios.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        if (e.target.checked) {
          const value = e.target.value;
          
          if (value === 'custom') {
            // Hiển thị input tùy chỉnh
            if (customThresholdContainer) {
              customThresholdContainer.style.display = 'block';
            }
            // Sử dụng giá trị hiện tại trong input hoặc giá trị mặc định
            const customValue = customThresholdInput ? parseInt(customThresholdInput.value) || 95 : 95;
            budgetSettings.threshold = customValue;
          } else {
            // Ẩn input tùy chỉnh nếu chọn giá trị mặc định
            if (customThresholdContainer) {
              customThresholdContainer.style.display = 'none';
            }
            // Lưu giá trị ngưỡng đã chọn
            const numValue = parseInt(value);
            if (!isNaN(numValue)) {
              budgetSettings.threshold = numValue;
            }
          }
          
          await saveSettings();
        }
      });
    });
    
    // Xử lý khi người dùng nhập giá trị tùy chỉnh
    if (customThresholdInput) {
      customThresholdInput.addEventListener('input', async (e) => {
        const value = parseInt(e.target.value);
        // Validate: giá trị phải từ 1-100
        if (!isNaN(value) && value >= 1 && value <= 100) {
          budgetSettings.threshold = value;
          // Đảm bảo radio "Tùy chỉnh" được chọn
          if (thresholdCustom) {
            thresholdCustom.checked = true;
            // Bỏ chọn các radio khác
            thresholdRadios.forEach(radio => {
              if (radio !== thresholdCustom && !isNaN(parseInt(radio.value))) {
                radio.checked = false;
              }
            });
          }
          await saveSettings();
        }
      });
      
      // Xử lý khi blur (rời khỏi input) để validate lại
      customThresholdInput.addEventListener('blur', (e) => {
        let value = parseInt(e.target.value);
        if (isNaN(value) || value < 1) {
          value = 1;
          e.target.value = value;
        } else if (value > 100) {
          value = 100;
          e.target.value = value;
        }
        budgetSettings.threshold = value;
        saveSettings();
      });
    }

    // Checkboxes phương thức thông báo
    const notifyInApp = document.getElementById('notifyInApp');
    const notifyEmail = document.getElementById('notifyEmail');
    if (notifyInApp) {
      notifyInApp.addEventListener('change', async (e) => {
        budgetSettings.notifyInApp = e.target.checked;
        await saveSettings();
      });
    }
    if (notifyEmail) {
      notifyEmail.addEventListener('change', async (e) => {
        budgetSettings.notifyEmail = e.target.checked;
        await saveSettings();
      });
    }
  }

  /**
   * Lưu cài đặt cảnh báo ngân sách lên backend
   * Khi người dùng thay đổi bất kỳ cài đặt nào (ngưỡng, phương thức thông báo),
   * hàm này sẽ được gọi để lưu vào database
   * Sau khi lưu, hệ thống sẽ sử dụng cài đặt này để kiểm tra và gửi cảnh báo
   */
  async function saveSettings() {
    try {
      console.log('💾 [caidat.js] Đang lưu cài đặt:', budgetSettings);

      if (typeof apiRequest !== 'function') {
        console.error('❌ [caidat.js] Hàm apiRequest không tồn tại');
        return;
      }

      const response = await apiRequest('/api/settings/budget-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          settings: budgetSettings
        })
      });

      if (response && response.ok && response.data) {
        const data = response.data;
        console.log('✅ [caidat.js] Đã lưu cài đặt thành công:', data);
        
        // Hiển thị thông báo thành công (nếu có hàm showMessage)
        if (typeof showMessage === 'function') {
          showMessage('Đã lưu cài đặt thành công!', true);
        }
      } else {
        const errorData = response?.data || {};
        console.error('❌ [caidat.js] Lỗi khi lưu cài đặt:', errorData);
        
        if (typeof showMessage === 'function') {
          showMessage(errorData.message || 'Không thể lưu cài đặt. Vui lòng thử lại.', false);
        }
      }
    } catch (error) {
      console.error('❌ [caidat.js] Lỗi khi lưu cài đặt:', error);
      
      if (typeof showMessage === 'function') {
        showMessage('Có lỗi xảy ra khi lưu cài đặt.', false);
      }
    }
  }

  // ===== Khởi chạy khi DOM ready =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export để có thể sử dụng từ nơi khác (nếu cần)
  window.budgetSettingsManager = {
    getSettings: () => ({ ...budgetSettings }),
    loadSettings: loadSettings,
    saveSettings: saveSettings
  };

})();

