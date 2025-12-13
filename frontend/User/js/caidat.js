/**
 * Cài đặt JavaScript - Xử lý logic cho trang cài đặt
 * Quản lý cài đặt cảnh báo ngân sách
 */

(function () {
  'use strict';

  // ===== State =====
  let budgetSettings = {
    enabled: true,
    anomalyEnabled: true,
    threshold: 95,
    notifyInApp: true,
    notifyEmail: false
  };

  // ===== Init =====
  function init() {
    if (typeof checkAuth === 'function') {
      const auth = checkAuth();
      if (!auth || !auth.user) {
        window.location.href = 'login.html';
        return;
      }
    }

    loadSettings();
    attachEventListeners();
  }

  // =====================================================
  // LOAD SETTINGS  (✅ FIX CHÍNH Ở ĐÂY)
  // =====================================================
  async function loadSettings() {
    try {
      console.log('📥 [caidat.js] Load budget settings...');

      const response = await apiRequest('/api/settings/budget-alerts', {
        method: 'GET'
      });

      /**
       * ❗ BACKEND TRẢ:
       * { ok: true, settings: {...} }
       * ❌ KHÔNG CÓ response.data
       */
      if (response && response.ok && response.settings) {
        budgetSettings = {
          enabled: response.settings.enabled !== false,
          anomalyEnabled: response.settings.anomalyEnabled !== false,
          threshold: response.settings.threshold || 95,
          notifyInApp: response.settings.notifyInApp !== false,
          notifyEmail: response.settings.notifyEmail === true
        };

        console.log('✅ [caidat.js] Loaded:', budgetSettings);
      } else {
        console.log('ℹ️ [caidat.js] Use default settings');
      }
    } catch (err) {
      console.error('❌ [caidat.js] Load error:', err);
    } finally {
      updateUI();
    }
  }

  // =====================================================
  // UPDATE UI
  // =====================================================
  function updateUI() {
    const swBudget = document.getElementById('swBudget');
    if (swBudget) swBudget.checked = budgetSettings.enabled;

    const swAnomaly = document.getElementById('swAnomaly');
    if (swAnomaly) swAnomaly.checked = budgetSettings.anomalyEnabled;

    // Threshold
    const radios = document.querySelectorAll('input[name="threshold"]');
    const customInput = document.getElementById('customThresholdInput');
    const customBox = document.getElementById('customThresholdContainer');
    const customRadio = document.getElementById('thresholdCustom');

    const presets = [30, 95, 100];
    const isPreset = presets.includes(budgetSettings.threshold);

    radios.forEach(r => (r.checked = false));

    if (isPreset) {
      radios.forEach(r => {
        if (parseInt(r.value) === budgetSettings.threshold) r.checked = true;
      });
      if (customBox) customBox.style.display = 'none';
    } else {
      if (customRadio) customRadio.checked = true;
      if (customInput) customInput.value = budgetSettings.threshold;
      if (customBox) customBox.style.display = 'block';
    }

    const notifyInApp = document.getElementById('notifyInApp');
    if (notifyInApp) notifyInApp.checked = budgetSettings.notifyInApp;

    const notifyEmail = document.getElementById('notifyEmail');
    if (notifyEmail) notifyEmail.checked = budgetSettings.notifyEmail;
  }

  // =====================================================
  // EVENTS
  // =====================================================
  function attachEventListeners() {
    const swBudget = document.getElementById('swBudget');
    if (swBudget) {
      swBudget.addEventListener('change', async e => {
        budgetSettings.enabled = e.target.checked;
        await saveSettings();
      });
    }

    const swAnomaly = document.getElementById('swAnomaly');
    if (swAnomaly) {
      swAnomaly.addEventListener('change', async e => {
        budgetSettings.anomalyEnabled = e.target.checked;
        await saveSettings();
      });
    }

    const radios = document.querySelectorAll('input[name="threshold"]');
    const customInput = document.getElementById('customThresholdInput');
    const customBox = document.getElementById('customThresholdContainer');

    radios.forEach(radio => {
      radio.addEventListener('change', async e => {
        if (!e.target.checked) return;

        if (e.target.value === 'custom') {
          if (customBox) customBox.style.display = 'block';
          budgetSettings.threshold = parseInt(customInput?.value) || 95;
        } else {
          if (customBox) customBox.style.display = 'none';
          budgetSettings.threshold = parseInt(e.target.value);
        }

        await saveSettings();
      });
    });

    if (customInput) {
      customInput.addEventListener('blur', async e => {
        let v = parseInt(e.target.value);
        if (isNaN(v) || v < 1) v = 1;
        if (v > 100) v = 100;
        e.target.value = v;
        budgetSettings.threshold = v;
        await saveSettings();
      });
    }

    const notifyInApp = document.getElementById('notifyInApp');
    if (notifyInApp) {
      notifyInApp.addEventListener('change', async e => {
        budgetSettings.notifyInApp = e.target.checked;
        await saveSettings();
      });
    }

    const notifyEmail = document.getElementById('notifyEmail');
    if (notifyEmail) {
      notifyEmail.addEventListener('change', async e => {
        budgetSettings.notifyEmail = e.target.checked;
        await saveSettings();
      });
    }
  }

  // =====================================================
  // SAVE SETTINGS  (✅ FIX CHÍNH Ở ĐÂY)
  // =====================================================
  async function saveSettings() {
    try {
      console.log('💾 [caidat.js] Save:', budgetSettings);

      const response = await apiRequest('/api/settings/budget-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: budgetSettings })
      });

      /**
       * ❗ BACKEND TRẢ:
       * { ok: true, settings: {...} }
       */
      if (response && response.ok) {
        console.log('✅ [caidat.js] Saved:', response.settings);
        if (typeof showMessage === 'function') {
          showMessage('Đã lưu cài đặt thành công!', true);
        }
      } else {
        throw new Error(response?.message || 'Save failed');
      }
    } catch (err) {
      console.error('❌ [caidat.js] Save error:', err);
      if (typeof showMessage === 'function') {
        showMessage('Không thể lưu cài đặt.', false);
      }
    }
  }

  // ===== Start =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ===== Export =====
  window.budgetSettingsManager = {
    getSettings: () => ({ ...budgetSettings }),
    loadSettings,
    saveSettings
  };
})();
