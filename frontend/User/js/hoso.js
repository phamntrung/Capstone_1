/**
 * hoso.js - Logic cho trang Hồ sơ
 * Quản lý tất cả các chức năng của trang hồ sơ: theme, i18n, profile loading/saving, chatbox, etc.
 */

// Note: saveProfile stub function is defined in hoso.html (line ~231)
// This ensures window.saveProfile exists even before this script loads

(function initProfilePage() {
  'use strict';

  try {
    console.log('🔵 [hoso.js] Script file loaded, starting IIFE...');
    console.log('🔵 [hoso.js] Document readyState:', document.readyState);
    console.log('🔵 [hoso.js] Window onload fired:', typeof window.onload);
    console.log('🔵 [hoso.js] Inside initProfilePage IIFE');
    console.log('🔵 [hoso.js] Current window.saveProfile:', typeof window.saveProfile);
    console.log('🔵 [hoso.js] Current window._saveProfileStub:', typeof window._saveProfileStub);

  // ===== Theme Initialization =====
  function initTheme() {
    const saved = localStorage.getItem('theme'); // 'light' | 'dark'
    document.documentElement.classList.toggle('dark', saved === 'dark');
  }

  // ===== i18n Translation =====
  const I18N = {
    vi: {
      "page.title": "SmartExpense — Hồ sơ",
      "nav.overview": "Trang chủ", "nav.list": "Danh sách chi tiêu",
      "nav.schedule": "Lên lịch chi tiêu", "nav.types": "Loại chi tiêu", "nav.report": "Báo cáo",
      "nav.profile": "Hồ sơ", "nav.settings": "Cài đặt", "nav.logout": "Đăng xuất",
      "invoices.title": "Hóa đơn", "invoices.date": "Ngày", "invoices.desc": "Mô tả", "invoices.credit": "Credit",
      "form.fullName": "Họ & Tên", "form.gender": "Giới tính", "form.currency": "Đơn vị tiền tệ",
      "form.monthlyBalance": "Nhập số dư (tháng)", "form.phone": "Số điện thoại",
      "gender.female": "Nữ", "gender.male": "Nam", "gender.other": "Khác",
      "toggles.exclude": "Bật loại trừ chi tiêu", "toggles.autoCategory": "Bật tự động chọn loại chi tiêu",
      "btn.save": "Lưu", "alert.saved": "Đã lưu hồ sơ thành công.",
      "chat.title": "Trợ lý thông minh", "chat.sub": "Xin chào! 👋 Rất vui khi được hỗ trợ bạn",
      "chat.open": "Mở trợ lý", "ph.chat": "Viết tin nhắn…", "send.title": "Gửi",
      "chat.greet": "Mình có thể giúp cập nhật hồ sơ, đổi ngôn ngữ/giao diện và trả lời câu hỏi của bạn.",
      "chat.ok": "Mình đã nhận được yêu cầu. Bạn muốn mình làm gì tiếp theo?"
    },
    en: {
      "page.title": "SmartExpense — Profile",
      "nav.overview": "Home", "nav.list": "Expense list",
      "nav.schedule": "Budget planner", "nav.types": "Categories", "nav.report": "Reports",
      "nav.profile": "Profile", "nav.settings": "Settings", "nav.logout": "Log out",
      "invoices.title": "Invoices", "invoices.date": "Date", "invoices.desc": "Description", "invoices.credit": "Credit",
      "form.fullName": "Full name", "form.gender": "Gender", "form.currency": "Currency",
      "form.monthlyBalance": "Monthly balance", "form.phone": "Phone number",
      "gender.female": "Female", "gender.male": "Male", "gender.other": "Other",
      "toggles.exclude": "Enable expense exclusion", "toggles.autoCategory": "Enable auto category",
      "btn.save": "Save", "alert.saved": "Profile saved successfully.",
      "chat.title": "Smart assistant", "chat.sub": "Hi! 👋 Glad to help",
      "chat.open": "Open assistant", "ph.chat": "Type a message…", "send.title": "Send",
      "chat.greet": "I can help update your profile, switch language/theme, and answer questions.",
      "chat.ok": "Got it. What would you like me to do next?"
    }
  };

  function t(key) {
    const lang = localStorage.getItem('lang') || 'vi';
    return (I18N[lang] && I18N[lang][key]) || key;
  }

  function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      const attr = el.getAttribute('data-i18n-attr');
      if (attr) {
        attr.split(',').forEach(a => el.setAttribute(a.trim(), val));
      } else if (el.tagName === 'INPUT') {
        el.placeholder = val;
      } else {
        el.textContent = val;
      }
    });
    document.title = t('page.title');
    document.documentElement.setAttribute('lang', localStorage.getItem('lang') || 'vi');

    // Translate select options with data-i18n too
    document.querySelectorAll('option[data-i18n]').forEach(op => {
      op.textContent = t(op.getAttribute('data-i18n'));
    });
  }

  // ===== Profile Functions =====
  function getCurrentUser() {
    try {
      const userData = localStorage.getItem('smartexpense_user');
      if (userData) {
        return JSON.parse(userData);
      }
    } catch (e) {
      console.error('Error getting current user:', e);
    }
    return null;
  }

  async function loadProfile() {
    try {
      // Try to load from API first (backend database)
      if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
        try {
          const token = localStorage.getItem('smartexpense_token');
          if (token) {
            const profileResult = await window.apiRequest('/api/me');
            if (profileResult && profileResult.ok && profileResult.data) {
              const profile = profileResult.data;
              populateFormFromProfile(profile);
              
              // Update localStorage user data
              const currentUser = getCurrentUser();
              if (currentUser) {
                const updatedUser = {
                  ...currentUser,
                  name: profile.name,
                  email: profile.email,
                  gender: profile.gender,
                  currency: profile.currency,
                  phone: profile.phone,
                  balance: profile.balance,
                  monthly_budget: profile.balance
                };
                localStorage.setItem('smartexpense_user', JSON.stringify(updatedUser));
                loadSettingsFromUser(currentUser);
              }

              updateAvatarInitial(profile.name || profile.email || 'Q');
              return;
            }
          }
        } catch (error) {
          console.error('Error loading profile from API:', error);
        }
      }

      // Fallback to localStorage
      const currentUser = getCurrentUser();
      if (currentUser) {
        populateFormFromUser(currentUser);
        loadSettingsFromUser(currentUser);
        updateAvatarInitial(currentUser.name || currentUser.email || 'Q');
        return;
      }

      // Fallback to legacy localStorage
      const raw = localStorage.getItem('profile');
      if (raw) {
        const p = JSON.parse(raw);
        populateFormFromProfile(p);
        loadSettingsFromProfile(p);
        updateAvatarInitial(p.name || p.email || 'Q');
      }
    } catch (e) {
      console.error('Error loading profile:', e);
    }
  }

  function populateFormFromProfile(profile) {
    const fullNameInput = document.getElementById('fullNameInput');
    const fullNameValue = document.getElementById('fullNameValue');
    const emailValue = document.getElementById('emailValue');
    const genderSelect = document.getElementById('genderSelect');
    const currencySelect = document.getElementById('currencySelect');
    const monthlyBudgetInput = document.getElementById('monthlyBudgetInput');
    const phoneInput = document.getElementById('phoneInput');

    if (profile.name) {
      if (fullNameInput) fullNameInput.value = profile.name;
      if (fullNameValue) fullNameValue.textContent = profile.name;
    }
    if (profile.email && emailValue) {
      emailValue.textContent = profile.email;
    }
    if (profile.gender && genderSelect) {
      genderSelect.value = profile.gender;
    }
    if (profile.currency && currencySelect) {
      currencySelect.value = profile.currency;
    }
   if (profile.balance !== undefined && profile.balance !== null && monthlyBudgetInput) {
  monthlyBudgetInput.value = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0
  }).format(Number(profile.balance));
} else if (profile.monthly_budget !== undefined && monthlyBudgetInput) {
  monthlyBudgetInput.value = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0
  }).format(Number(profile.monthly_budget));
}

    if (profile.phone && phoneInput) {
      phoneInput.value = profile.phone;
    }
  }

  function populateFormFromUser(user) {
    // Same logic as populateFormFromProfile - user data structure is similar
    if (!user) return;
    populateFormFromProfile(user);
  }

  function loadSettingsFromUser(user) {
    if (!user.settings) return;
    const excludeToggle = document.getElementById('excludeToggle');
    const autoCategoryToggle = document.getElementById('autoCategoryToggle');

    if (excludeToggle) excludeToggle.checked = !!user.settings.exclude_expense;
    if (autoCategoryToggle) autoCategoryToggle.checked = user.settings.auto_category !== false;
  }

  function loadSettingsFromProfile(profile) {
    const excludeToggle = document.getElementById('excludeToggle');
    const autoCategoryToggle = document.getElementById('autoCategoryToggle');

    if (excludeToggle) excludeToggle.checked = !!profile.exclude_expense;
    if (autoCategoryToggle) autoCategoryToggle.checked = profile.auto_category !== false;
  }

  function updateAvatarInitial(nameOrEmail) {
    try {
      const initial = (nameOrEmail || 'Q').trim().charAt(0).toUpperCase();
      const circle = document.querySelector('.avatar-big .circle');
      if (circle) {
        circle.textContent = initial || 'Q';
      }
    } catch (e) {
      console.warn('Failed to update avatar:', e);
    }
  }

  // ===== Save Profile Function =====
  async function saveProfile() {
    const saveBtn = document.getElementById('saveBtn');
    if (!saveBtn) {
      console.error('❌ Save button not found!');
      showToastMessage('Không tìm thấy nút Lưu!', 'error');
      return;
    }

    // Disable button and show loading
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu...';

    try {
      // Get all form elements
      const fullNameInput = document.getElementById('fullNameInput');
      const genderSelect = document.getElementById('genderSelect');
      const currencySelect = document.getElementById('currencySelect');
      const monthlyBudgetInput = document.getElementById('monthlyBudgetInput');
      const phoneInput = document.getElementById('phoneInput');
      const emailValue = document.getElementById('emailValue');
      const autoCategoryToggle = document.getElementById('autoCategoryToggle');

      // Validate required fields exist
      const missingFields = [];
      if (!fullNameInput) missingFields.push('Họ tên');
      if (!genderSelect) missingFields.push('Giới tính');
      if (!currencySelect) missingFields.push('Tiền tệ');
      if (!monthlyBudgetInput) missingFields.push('Ngân sách tháng');
      
      if (missingFields.length > 0) {
        throw new Error(`Không tìm thấy các trường: ${missingFields.join(', ')}`);
      }

      // Collect profile data
      const profile = {
        name: fullNameInput.value.trim(),
        gender: genderSelect.value,
        currency: currencySelect.value,
        balance: Number(monthlyBudgetInput.value) || 0,
        phone: phoneInput ? phoneInput.value.trim() : ''
      };

      // Validate required data
      if (!profile.name) {
        throw new Error('Vui lòng nhập Họ tên');
      }

      // Save to backend API
      if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
        console.log('📤 Sending profile data to backend:', profile);
        console.log('📤 Balance value being sent:', profile.balance, typeof profile.balance);
        
        try {
          const profileResult = await window.apiRequest('/api/profile', {
            method: 'PUT',
            body: JSON.stringify(profile)
          });

          console.log('📥 Full response from backend:', profileResult);
          console.log('📥 Response ok:', profileResult?.ok);
          console.log('📥 Response status:', profileResult?.status);
          console.log('📥 Response data:', profileResult?.data);

          if (!profileResult) {
            throw new Error('Không nhận được phản hồi từ server. Vui lòng kiểm tra backend có đang chạy không.');
          }

          if (!profileResult.ok) {
            const errorMsg = profileResult.data?.message || profileResult.data?.error || `Lỗi HTTP ${profileResult.status}`;
            console.error('❌ API error:', errorMsg, profileResult);
            throw new Error(errorMsg);
          }

          if (!profileResult.data) {
            throw new Error('Lỗi khi lưu hồ sơ: Không có dữ liệu trả về từ server');
          }

          const responseData = profileResult.data;
          console.log('📥 Parsed response data:', responseData);
          
          // Kiểm tra nếu có lỗi từ backend
          if (responseData && responseData.success === false) {
            const errorMsg = responseData.message || 'Lỗi khi lưu hồ sơ';
            console.error('❌ Backend returned error:', errorMsg);
            throw new Error(errorMsg);
          }
          
          // Kiểm tra response có success = true
          if (!responseData || (responseData.success !== true && responseData.success !== undefined)) {
            console.warn('⚠️ Response không có success=true, nhưng vẫn tiếp tục xử lý');
          }
          
          // Lấy user object từ response - đảm bảo có dữ liệu
          const savedUser = responseData.user || responseData;
          if (!savedUser) {
            throw new Error('Không nhận được dữ liệu user từ server');
          }
          
          console.log('✅ Profile saved to backend successfully');
          console.log('✅ Saved user data:', savedUser);
          console.log('✅ Saved balance:', savedUser.balance);
          
          // Kiểm tra nếu balance không có trong savedUser, dùng giá trị từ form
          if (savedUser.balance === undefined || savedUser.balance === null) {
            console.warn('⚠️ Balance không có trong response, sử dụng giá trị từ form');
            savedUser.balance = profile.balance;
          }

        // Update UI
        const fullNameValue = document.getElementById('fullNameValue');
        if (profile.name && fullNameValue) {
          fullNameValue.textContent = profile.name;
        }

        // Update localStorage - đảm bảo cập nhật balance đúng
        updateLocalStorageAfterSave(savedUser, profile, emailValue, null, autoCategoryToggle);

        // Update balance on dashboard/home page
        const finalBalance = savedUser.balance !== undefined && savedUser.balance !== null ? savedUser.balance : profile.balance;
        console.log('💰 Final balance to update:', finalBalance);
        
        // Force update dashboard balance
        updateDashboardBalance(finalBalance);
        
        // Show success toast với thông tin chi tiết
        const formatCurrencyFunc = typeof formatCurrency === 'function' ? formatCurrency : (typeof window !== 'undefined' && typeof window.formatCurrency === 'function') ? window.formatCurrency : (amount) => amount.toLocaleString('vi-VN') + ' đ';
        showToastMessage(`Đã lưu vào hồ sơ thành công! Số dư: ${formatCurrencyFunc(finalBalance)}`, 'success');
        
        console.log('✅ Profile save completed successfully');

        // Refresh profile from server to ensure persistence and sync UI/localStorage
        try {
          const meResult = await window.apiRequest('/api/me');
          if (meResult && meResult.ok && meResult.data) {
            const fresh = meResult.data;
            // Update header name/email
            const fullNameValueEl = document.getElementById('fullNameValue');
            if (fullNameValueEl && fresh.name) fullNameValueEl.textContent = fresh.name;
            const emailValueEl = document.getElementById('emailValue');
            if (emailValueEl && fresh.email) emailValueEl.textContent = fresh.email;
            // Update localStorage
            const currentUser2 = getCurrentUser();
            if (currentUser2) {
              const updatedUser2 = {
                ...currentUser2,
                name: fresh.name ?? currentUser2.name,
                email: fresh.email ?? currentUser2.email,
                gender: fresh.gender ?? currentUser2.gender,
                currency: fresh.currency ?? currentUser2.currency,
                phone: fresh.phone ?? currentUser2.phone,
                balance: fresh.balance ?? currentUser2.balance,
                monthly_budget: fresh.balance ?? currentUser2.monthly_budget
              };
              localStorage.setItem('smartexpense_user', JSON.stringify(updatedUser2));
            }
          }
        } catch (refreshErr) {
          console.warn('Could not refresh /api/me after saving profile:', refreshErr);
        }
        } catch (apiError) {
          console.error('❌ Error calling API:', apiError);
          throw apiError; // Re-throw để catch block bên ngoài xử lý
        }
      } else {
        // Fallback: save to localStorage only
        const emailText = emailValue ? emailValue.textContent.trim() : '';
        const legacyProfile = {
          name: profile.name,
          email: emailText,
          gender: profile.gender,
          currency: profile.currency,
          monthly_budget: profile.balance,
          phone: profile.phone,
          exclude_expense: excludeToggle ? excludeToggle.checked : false,
          auto_category: autoCategoryToggle ? autoCategoryToggle.checked : true
        };
        localStorage.setItem('profile', JSON.stringify(legacyProfile));
        localStorage.setItem('monthly_budget', String(profile.balance));

        const fullNameValue = document.getElementById('fullNameValue');
        if (profile.name && fullNameValue) {
          fullNameValue.textContent = profile.name;
        }

        // Update balance on dashboard/home page
        updateDashboardBalance(profile.balance);

        showToastMessage('Đã lưu thành công!', 'success');
      }
    } catch (error) {
      console.error('Error in save profile:', error);
      showToastMessage('Lưu thất bại: ' + (error.message || 'Vui lòng thử lại'), 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  }

  // Override stub with real function IMMEDIATELY after definition (for inline onclick handler)
  // This ensures it's available even if script hasn't finished loading
  console.log('🔵 About to export saveProfile function...');
  console.log('🔵 window.saveProfile before:', typeof window.saveProfile);
  console.log('🔵 window._saveProfileStub:', typeof window._saveProfileStub);
  const wasStub = window.saveProfile === window._saveProfileStub;
  console.log('🔵 wasStub:', wasStub);
  window.saveProfile = saveProfile; // Replace stub with real function
  console.log('🔵 window.saveProfile after:', typeof window.saveProfile);
  console.log('🔵 window.saveProfile === window._saveProfileStub:', window.saveProfile === window._saveProfileStub);
  if (wasStub) {
    console.log('✅ saveProfile (real function) replaced stub successfully');
  } else {
    console.log('✅ saveProfile (real function) exported to window object');
  }

  /**
   * @brief Cập nhật dữ liệu người dùng sau khi lưu hồ sơ (bao gồm số dư đã lưu)
   * @param {Object} savedUser - Đối tượng user trả về từ backend (có thể chứa balance mới)
   * @param {Object} profile - Dữ liệu hồ sơ từ form (dùng làm fallback nếu backend không trả về balance)
   * @param {HTMLElement} emailValue - Node hiển thị email hiện tại (để ghi kèm vào localStorage/DataManager)
   * @param {HTMLInputElement} excludeToggle - Công tắc loại trừ chi tiêu (cài đặt)
   * @param {HTMLInputElement} autoCategoryToggle - Công tắc tự động phân loại (cài đặt)
   * @note Ưu tiên dùng balance từ backend; nếu thiếu thì dùng balance người dùng nhập từ form.
   *       Sau khi cập nhật localStorage, giá trị này sẽ được trang chủ (dashboard) đọc và hiển thị.
   */
  function updateLocalStorageAfterSave(savedUser, profile, emailValue, excludeToggle, autoCategoryToggle) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      console.warn('⚠️ No current user found, cannot update localStorage');
      return;
    }

    // Ưu tiên balance từ savedUser (từ database), nếu không có thì dùng từ form
    const finalBalance = savedUser.balance !== undefined && savedUser.balance !== null 
      ? savedUser.balance 
      : (profile.balance !== undefined && profile.balance !== null ? profile.balance : 0);
    
    console.log('💾 Updating localStorage with balance:', finalBalance);

    const updatedUser = {
      ...currentUser,
      name: savedUser.name || profile.name,
      gender: savedUser.gender !== undefined ? savedUser.gender : profile.gender,
      currency: savedUser.currency !== undefined ? savedUser.currency : profile.currency,
      phone: savedUser.phone !== undefined ? savedUser.phone : profile.phone,
      balance: finalBalance,
      monthly_budget: finalBalance
    };

    // Save settings
    const settings = {
      exclude_expense: excludeToggle ? excludeToggle.checked : false,
      auto_category: autoCategoryToggle ? autoCategoryToggle.checked : true
    };

    const updatedUserWithSettings = {
      ...updatedUser,
      settings: settings
    };

    localStorage.setItem('smartexpense_user', JSON.stringify(updatedUserWithSettings));
    localStorage.setItem('monthly_budget', String(updatedUser.balance));

    // Legacy profile format for compatibility
    const legacyProfile = {
      name: updatedUser.name,
      email: emailValue ? emailValue.textContent.trim() : currentUser.email || '',
      gender: updatedUser.gender,
      currency: updatedUser.currency,
      phone: updatedUser.phone,
      monthly_budget: updatedUser.balance,
      ...settings
    };
    localStorage.setItem('profile', JSON.stringify(legacyProfile));

    // Save to DataManager for persistence
    if (window.dataManager) {
      const updatedUserForDataManager = {
        ...updatedUserWithSettings,
        email: emailValue ? emailValue.textContent.trim() : currentUser.email || ''
      };
      const userId = currentUser.id || currentUser.email || 'default';
      window.dataManager.updateUser(userId, updatedUserForDataManager);
    }
  }

  /**
   * @brief Phát sự kiện để trang chủ cập nhật ngay số dư hiển thị sau khi lưu
   * @param {number} balance - Số tiền đã lưu (được chuẩn hoá là number)
   * @note Gửi CustomEvent 'profileUpdated' kèm detail.balance. Trang chủ lắng nghe và
   *       đồng bộ localStorage, sau đó cập nhật phần tử #balanceAmount để hiển thị số tiền.
   */
  function updateDashboardBalance(balance) {
    console.log('🔄 Updating dashboard balance:', balance);
    
    // Dispatch custom event for same-page updates
    if (typeof window !== 'undefined') {
      // Dispatch event multiple times để đảm bảo dashboard nhận được
      window.dispatchEvent(new CustomEvent('profileUpdated', { detail: { balance } }));
      console.log('✅ Dispatched profileUpdated event');

      // Update localStorage for cross-page updates
      try {
        const timestamp = Date.now().toString();
        localStorage.setItem('smartexpense_profile_updated', timestamp);
        localStorage.setItem('smartexpense_balance_updated', String(balance));
        console.log('✅ Set localStorage flags for profile update');
        
        setTimeout(() => {
          localStorage.removeItem('smartexpense_profile_updated');
          localStorage.removeItem('smartexpense_balance_updated');
        }, 500); // Tăng thời gian để đảm bảo dashboard nhận được
      } catch (e) {
        console.warn('Failed to notify profile update:', e);
      }

      // Call reloadDashboard if available (same page)
      if (typeof window.reloadDashboard === 'function') {
        console.log('🔄 Calling reloadDashboard...');
        window.reloadDashboard();
      }
      
      // Thử gọi reloadDashboardData nếu có
      if (typeof window.reloadDashboardData === 'function') {
        console.log('🔄 Calling reloadDashboardData...');
        window.reloadDashboardData();
      }
    }
  }

  // ===== Show Toast Notification =====
  function showToastMessage(message, type = 'success') {
    // Remove any existing toast
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 10px 26px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: 'Noto Sans', Inter, system-ui, sans-serif;
      font-size: 14px;
      font-weight: 600;
      min-width: 280px;
      max-width: 400px;
      animation: slideInRight 0.3s ease-out;
      display: flex;
      align-items: center;
      gap: 12px;
    `;
    
    const icon = type === 'success' ? '✓' : '✗';
    toast.innerHTML = `
      <span style="font-size: 20px;">${icon}</span>
      <span>${message}</span>
    `;

    // Add animation style if not exists
    if (!document.getElementById('toast-animations')) {
      const style = document.createElement('style');
      style.id = 'toast-animations';
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  // ===== Chatbox Functions =====
  function initChatbox() {
    const chatToggle = document.getElementById('chatToggle');
    const chatbox = document.getElementById('chatbox');
    const chatBody = document.getElementById('chatBody');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    if (!chatToggle || !chatbox || !chatBody || !chatInput || !sendBtn) {
      return;
    }

    let greeted = false;

    function addMsg(text, who = 'bot') {
      const wrap = document.createElement('div');
      wrap.className = 'msg ' + who;
      const av = document.createElement('div');
      av.className = 'avatar-s';
      av.textContent = who === 'bot' ? '🐷' : '👤';
      const b = document.createElement('div');
      b.className = 'bubble';
      b.textContent = text;
      if (who === 'bot') {
        wrap.append(av, b);
      } else {
        wrap.append(b, av);
      }
      chatBody.appendChild(wrap);
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    function openChat() {
      chatbox.classList.add('open');
      chatbox.setAttribute('aria-hidden', 'false');
      if (!greeted) {
        addMsg(t('chat.greet'));
        greeted = true;
      }
      setTimeout(() => chatInput.focus(), 100);
    }

    function closeChat() {
      chatbox.classList.remove('open');
      chatbox.setAttribute('aria-hidden', 'true');
    }

    chatToggle.onclick = () => chatbox.classList.contains('open') ? closeChat() : openChat();

    function handleSend() {
      const txt = chatInput.value.trim();
      if (!txt) return;
      addMsg(txt, 'user');
      chatInput.value = '';
      addMsg(t('chat.ok'));
    }

    sendBtn.onclick = handleSend;
    chatInput.onkeydown = e => {
      if (e.key === 'Enter') {
        handleSend();
      }
    };
  }

  // ===== Logout Handler =====
  function initLogoutHandler() {
    document.addEventListener('click', async function (e) {
      const link = e.target && e.target.closest && e.target.closest('a[href="login.html"]');
      if (!link) return;
      e.preventDefault();
      
      // Use global logout function which handles sync properly
      if (typeof window.logout === 'function') {
        await window.logout();
      } else {
        // Fallback if logout function not available
        // Sync data before logout
        if (window.dataManager && typeof window.dataManager.syncAllDataToAPI === 'function') {
          try {
            console.log('🔄 Syncing data before logout...');
            const syncPromise = window.dataManager.syncAllDataToAPI();
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 10000));
            await Promise.race([syncPromise, timeoutPromise]);
            console.log('✅ Data sync completed before logout');
          } catch (error) {
            console.error('❌ Error syncing before logout:', error);
          }
        }
        
        try {
          localStorage.removeItem('smartexpense_user');
          localStorage.removeItem('smartexpense_token');
        } catch (_) { }
        // Tính toán đường dẫn login đúng
        const currentPath = window.location.pathname;
        let loginPath = 'login.html';
        if (currentPath.includes('/User/UI_User/')) {
          loginPath = 'login.html';
        } else if (currentPath.includes('/User/js/')) {
          loginPath = '../UI_User/login.html';
        } else if (currentPath.includes('/User/')) {
          const afterUser = currentPath.split('/User/')[1];
          const parts = afterUser.split('/').filter(p => p && !p.includes('.html'));
          loginPath = '../'.repeat(parts.length) + 'UI_User/login.html';
        } else {
          loginPath = '/frontend/User/UI_User/login.html';
        }
        console.log('🔍 [hoso.js fallback] Redirecting to:', loginPath);
        window.location.href = loginPath;
      }
    });
  }

  // ===== Initialize Everything =====
  function init() {
    // Apply theme immediately
    initTheme();

    // Initialize i18n
    translatePage();

    // Helper function to run when DOM is ready
    const runWhenReady = (fn) => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
      } else {
        fn();
      }
    };

    // Attach save button listener - SIMPLIFIED VERSION
    const attachSaveListener = () => {
      const saveBtn = document.getElementById('saveBtn');
      if (!saveBtn) {
        console.warn('⚠️ Save button not found yet, will retry...');
        return false;
      }
      
      // Check if already attached
      if (saveBtn.hasAttribute('data-listener-attached')) {
        console.log('ℹ️ Save button listener already attached');
        return true;
      }
      
      // Ensure button is enabled and clickable
      saveBtn.disabled = false;
      saveBtn.style.pointerEvents = 'auto';
      saveBtn.style.cursor = 'pointer';
      saveBtn.style.opacity = '1';
      
      // Create handler function
      const handleSave = async function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🖱️ Save button clicked!');
        
        // Prevent multiple clicks
        if (saveBtn.disabled) {
          console.log('⏸️ Save already in progress, ignoring click');
          return false;
        }
        
        try {
          await saveProfile();
        } catch (err) {
          console.error('❌ Error in saveProfile:', err);
          const errorMsg = err && err.message ? err.message : 'Vui lòng thử lại';
          showToastMessage('Lỗi khi lưu: ' + errorMsg, 'error');
        }
        return false;
      };
      
      // Attach event listener with capture phase (to catch early)
      saveBtn.addEventListener('click', handleSave, { capture: true, once: false });
      
      // Also attach as backup with normal bubbling
      saveBtn.addEventListener('click', handleSave, false);
      
      // Mark as attached
      saveBtn.setAttribute('data-listener-attached', 'true');
      console.log('✅ Save button event listener attached successfully');
      
      // Test click to verify it works
      console.log('🧪 Testing button clickability...');
      
      return true;
    };

    // Try to attach listener immediately and on DOM ready
    runWhenReady(() => {
      if (attachSaveListener()) {
        console.log('✅ Save listener attached on DOM ready');
      } else {
        console.log('⏳ Save button not ready, scheduling retry...');
        // Retry multiple times with increasing delays
        setTimeout(() => attachSaveListener(), 100);
        setTimeout(() => attachSaveListener(), 300);
        setTimeout(() => attachSaveListener(), 1000);
      }
    });
    
    // Also try immediately (in case DOM is already ready)
    if (document.readyState !== 'loading') {
      setTimeout(() => attachSaveListener(), 50);
    }

    // Load profile when DOM is ready
    runWhenReady(() => {
      loadProfile();
    });

    // Initialize other event listeners when DOM is ready
    runWhenReady(() => {
      setupEventListeners();
      // Initialize avatar functionality
      initAvatarUpload();
      // Initialize notifications
      initNotifications();
    });
  }

  // ===== Avatar Upload Functionality =====
  function initAvatarUpload() {
    const avatarInput = document.getElementById('avatarInput');
    const avatarPreview = document.getElementById('avatarPreview');
    const avatarImage = document.getElementById('avatarImage');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');
    const avatarUploadBtn = document.getElementById('avatarUploadBtn');
    const btnRemoveAvatar = document.getElementById('btnRemoveAvatar');
    
    // Load saved avatar from localStorage
    loadAvatar();
    
    // Function to trigger file input
    function triggerFileInput() {
      if (avatarInput) {
        avatarInput.click();
      }
    }
    
    // Handle file input change
    if (avatarInput) {
      avatarInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
          // Validate file type
          if (!file.type.startsWith('image/')) {
            alert('Vui lòng chọn file ảnh hợp lệ!');
            return;
          }
          
          // Validate file size (max 5MB)
          if (file.size > 5 * 1024 * 1024) {
            alert('Kích thước file không được vượt quá 5MB!');
            return;
          }
          
          // Read file as data URL
          const reader = new FileReader();
          reader.onload = function(e) {
            const imageDataUrl = e.target.result;
            
            // Save to localStorage
            saveAvatar(imageDataUrl);
            
            // Display avatar
            displayAvatar(imageDataUrl);
            
            // Show remove button
            if (btnRemoveAvatar) {
              btnRemoveAvatar.style.display = 'inline-flex';
            }
            
            // Update avatar on home page via storage event
            updateAvatarOnHomePage(imageDataUrl);
            
            console.log('✅ Avatar đã được tải lên và lưu');
          };
          reader.onerror = function() {
            alert('Lỗi khi đọc file!');
          };
          reader.readAsDataURL(file);
        }
      });
    }
    
    // Handle remove avatar
    if (btnRemoveAvatar) {
      btnRemoveAvatar.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent triggering file input
        if (confirm('Bạn có chắc chắn muốn xóa ảnh đại diện?')) {
          removeAvatar();
        }
      });
    }
    
    // Click on preview to trigger file input
    if (avatarPreview) {
      avatarPreview.addEventListener('click', function(e) {
        // Don't trigger if clicking on the upload button (it will handle it)
        if (e.target !== avatarUploadBtn && !avatarUploadBtn.contains(e.target)) {
          triggerFileInput();
        }
      });
    }
    
    // Click on upload button to trigger file input
    if (avatarUploadBtn) {
      avatarUploadBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent triggering parent click
        triggerFileInput();
      });
    }
  }
  
  function loadAvatar() {
    try {
      const userData = localStorage.getItem('smartexpense_user');
      if (userData) {
        const user = JSON.parse(userData);
        
        // Ưu tiên 1: Load avatar từ localStorage theo user ID (mỗi account có avatar riêng)
        if (user.id) {
          const userAvatar = localStorage.getItem(`smartexpense_avatar_${user.id}`);
          if (userAvatar) {
            displayAvatar(userAvatar);
            // Đồng bộ với user object
            user.avatar = userAvatar;
            localStorage.setItem('smartexpense_user', JSON.stringify(user));
            const btnRemoveAvatar = document.getElementById('btnRemoveAvatar');
            if (btnRemoveAvatar) {
              btnRemoveAvatar.style.display = 'inline-flex';
            }
            return;
          }
        }
        
        // Ưu tiên 2: Load từ user.avatar (backward compatibility)
        if (user.avatar) {
          displayAvatar(user.avatar);
          // Lưu lại theo user ID nếu có
          if (user.id) {
            localStorage.setItem(`smartexpense_avatar_${user.id}`, user.avatar);
          }
          const btnRemoveAvatar = document.getElementById('btnRemoveAvatar');
          if (btnRemoveAvatar) {
            btnRemoveAvatar.style.display = 'inline-flex';
          }
        }
      }
    } catch (error) {
      console.warn('Lỗi khi tải avatar:', error);
    }
  }
  
  function displayAvatar(imageDataUrl) {
    const avatarImage = document.getElementById('avatarImage');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');
    
    if (avatarImage && avatarPlaceholder) {
      if (imageDataUrl) {
        avatarImage.src = imageDataUrl;
        avatarImage.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
      } else {
        avatarImage.src = '';
        avatarImage.style.display = 'none';
        avatarPlaceholder.style.display = 'grid';
      }
    }
  }
  
  function saveAvatar(imageDataUrl) {
    try {
      const userData = localStorage.getItem('smartexpense_user');
      if (userData) {
        const user = JSON.parse(userData);
        user.avatar = imageDataUrl;
        localStorage.setItem('smartexpense_user', JSON.stringify(user));
        
        // Lưu avatar theo user ID để mỗi account có avatar riêng
        if (user.id) {
          localStorage.setItem(`smartexpense_avatar_${user.id}`, imageDataUrl);
          console.log(`✅ Avatar đã được lưu cho user ID: ${user.id}`);
        } else {
          console.log('✅ Avatar đã được lưu vào localStorage');
        }
      } else {
        // Create new user object if not exists
        const newUser = {
          avatar: imageDataUrl
        };
        localStorage.setItem('smartexpense_user', JSON.stringify(newUser));
      }
    } catch (error) {
      console.error('Lỗi khi lưu avatar:', error);
    }
  }
  
  function removeAvatar() {
    try {
      const userData = localStorage.getItem('smartexpense_user');
      if (userData) {
        const user = JSON.parse(userData);
        delete user.avatar;
        localStorage.setItem('smartexpense_user', JSON.stringify(user));
        
        // Xóa avatar theo user ID
        if (user.id) {
          localStorage.removeItem(`smartexpense_avatar_${user.id}`);
        }
      }
      
      // Reset display
      const avatarImage = document.getElementById('avatarImage');
      const avatarPlaceholder = document.getElementById('avatarPlaceholder');
      const btnRemoveAvatar = document.getElementById('btnRemoveAvatar');
      
      if (avatarImage) {
        avatarImage.src = '';
        avatarImage.style.display = 'none';
      }
      if (avatarPlaceholder) {
        avatarPlaceholder.style.display = 'grid';
      }
      if (btnRemoveAvatar) {
        btnRemoveAvatar.style.display = 'none';
      }
      
      // Update avatar on home page
      updateAvatarOnHomePage(null);
      
      console.log('✅ Avatar đã được xóa');
    } catch (error) {
      console.error('Lỗi khi xóa avatar:', error);
    }
  }
  
  function updateAvatarOnHomePage(imageDataUrl) {
    // Trigger custom event for same-tab updates
    const customEvent = new CustomEvent('avatarUpdated', {
      detail: { avatar: imageDataUrl }
    });
    window.dispatchEvent(customEvent);
    
    // Also use BroadcastChannel if available (for cross-tab updates)
    if (typeof BroadcastChannel !== 'undefined') {
      if (!window.avatarBroadcastChannel) {
        window.avatarBroadcastChannel = new BroadcastChannel('smartexpense_avatar_channel');
      }
      window.avatarBroadcastChannel.postMessage({
        type: 'avatarUpdated',
        avatar: imageDataUrl
      });
    }
    
    // Trigger storage event for cross-tab sync (if needed)
    try {
      localStorage.setItem('smartexpense_avatar_updated', Date.now().toString());
      setTimeout(() => {
        localStorage.removeItem('smartexpense_avatar_updated');
      }, 100);
    } catch (e) {
      console.warn('Could not trigger storage event:', e);
    }
  }

  function setupEventListeners() {
    // Test email button
    const testEmailBtn = document.getElementById('testEmailBtn');
    if (testEmailBtn) {
      testEmailBtn.addEventListener('click', testEmail);
    }

    // Chatbox
    initChatbox();

    // Logout handler
    initLogoutHandler();

    // Sync user session data
    try {
      const sessionRaw = localStorage.getItem('smartexpense_user');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        const name = session.name || '';
        const email = session.email || '';
        const nameEl = document.getElementById('fullNameValue');
        const emailEl = document.getElementById('emailValue');
        const inputName = document.getElementById('fullNameInput');
        if (name && nameEl) {
          nameEl.textContent = name;
        }
        if (email && emailEl) {
          emailEl.textContent = email;
        }
        if (name && inputName) {
          inputName.value = name;
        }
        
        // Update avatar initial
        updateAvatarInitial(name || email || 'Q');

        // Merge into profile
        const pRaw = localStorage.getItem('profile');
        const p = pRaw ? JSON.parse(pRaw) : {};
        if (name) p.name = name;
        if (email) p.email = email;
        localStorage.setItem('profile', JSON.stringify(p));
      }

      // Sync monthly_budget
      try {
        const pRaw = localStorage.getItem('profile');
        if (pRaw) {
          const p = JSON.parse(pRaw);
          if (typeof p.monthly_budget === 'number') {
            localStorage.setItem('monthly_budget', String(p.monthly_budget));
          }
        }
      } catch (_) { }
    } catch (e) {
      console.warn('Init profile failed:', e);
    }
  }

  // ===== Notifications Functions =====
  async function loadNotifications() {
    const container = document.getElementById('notificationsContainer');
    const unreadBadge = document.getElementById('unreadCountBadge');
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    const deleteAllBtn = document.getElementById('deleteAllNotificationsBtn');
    
    if (!container) return;
    
    try {
      if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
        const result = await window.apiRequest('/api/notifications?limit=50');
        if (result && result.ok && result.data) {
          const { items, unreadCount } = result.data;
          renderNotifications(items, unreadCount);
          
          // Update unread badge
          if (unreadBadge) {
            if (unreadCount > 0) {
              unreadBadge.textContent = unreadCount;
              unreadBadge.style.display = 'inline-block';
            } else {
              unreadBadge.style.display = 'none';
            }
          }
          
          // Show/hide mark all read button
          if (markAllReadBtn) {
            markAllReadBtn.style.display = unreadCount > 0 ? 'block' : 'none';
          }
          
          // Show/hide delete all button (show when there are any notifications)
          if (deleteAllBtn) {
            deleteAllBtn.style.display = items && items.length > 0 ? 'block' : 'none';
          }
        } else {
          container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Không có thông báo nào</div>';
          // Hide delete all button when no notifications
          if (deleteAllBtn) {
            deleteAllBtn.style.display = 'none';
          }
        }
      } else {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Không thể tải thông báo</div>';
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Lỗi khi tải thông báo</div>';
    }
  }
  
  function renderNotifications(notifications, unreadCount) {
    const container = document.getElementById('notificationsContainer');
    if (!container) return;
    
    if (!notifications || notifications.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Không có thông báo nào</div>';
      return;
    }
    
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    
    container.innerHTML = notifications.map(notif => {
      const isUnread = !notif.isRead;
      const icon = icons[notif.type] || 'ℹ️';
      // Parse UTC time correctly - ensure it's treated as UTC
      let dateStr = notif.createdAt;
      if (dateStr && !dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
        // If no timezone info, assume it's UTC and add Z
        dateStr = dateStr + 'Z';
      }
      const date = new Date(dateStr);
      const timeStr = date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      
      return `
        <div class="notification-item ${isUnread ? 'unread' : ''}" data-id="${notif.id}">
          <div class="notification-icon ${notif.type}">${icon}</div>
          <div class="notification-content">
            <div class="notification-title">${escapeHtml(notif.title)}</div>
            <div class="notification-message">${escapeHtml(notif.message)}</div>
            <div class="notification-time">${timeStr}</div>
          </div>
          <div class="notification-actions">
            ${isUnread ? `<button onclick="markNotificationRead(${notif.id})">Đã đọc</button>` : ''}
            <button onclick="deleteNotification(${notif.id})">Xóa</button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  async function markNotificationRead(notificationId) {
    try {
      if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
        const result = await window.apiRequest(`/api/notifications/${notificationId}/read`, {
          method: 'PATCH'
        });
        if (result && result.ok) {
          loadNotifications(); // Reload notifications
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }
  
  async function markAllNotificationsRead() {
    try {
      if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
        const result = await window.apiRequest('/api/notifications/read-all', {
          method: 'PATCH'
        });
        if (result && result.ok) {
          loadNotifications(); // Reload notifications
          showToastMessage('Đã đánh dấu tất cả thông báo đã đọc', 'success');
        }
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      showToastMessage('Lỗi khi đánh dấu thông báo', 'error');
    }
  }
  
  async function deleteNotification(notificationId) {
    if (!confirm('Bạn có chắc chắn muốn xóa thông báo này?')) {
      return;
    }
    
    try {
      if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
        const result = await window.apiRequest(`/api/notifications/${notificationId}`, {
          method: 'DELETE'
        });
        if (result && result.ok) {
          loadNotifications(); // Reload notifications
          showToastMessage('Đã xóa thông báo', 'success');
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      showToastMessage('Lỗi khi xóa thông báo', 'error');
    }
  }
  
  async function deleteAllNotifications() {
    if (!confirm('Bạn có chắc chắn muốn xóa tất cả thông báo? Hành động này không thể hoàn tác.')) {
      return;
    }
    
    try {
      if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
        const result = await window.apiRequest('/api/notifications/all', {
          method: 'DELETE'
        });
        if (result && result.ok) {
          loadNotifications(); // Reload notifications
          const deletedCount = result.data?.deleted || 0;
          showToastMessage(`Đã xóa ${deletedCount} thông báo`, 'success');
        }
      }
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      showToastMessage('Lỗi khi xóa thông báo', 'error');
    }
  }
  
  // Export functions to window for onclick handlers
  window.markNotificationRead = markNotificationRead;
  window.deleteNotification = deleteNotification;
  window.markAllNotificationsRead = markAllNotificationsRead;
  window.deleteAllNotifications = deleteAllNotifications;
  
  // Initialize notifications when DOM is ready
  function initNotifications() {
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    const deleteAllBtn = document.getElementById('deleteAllNotificationsBtn');
    
    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', markAllNotificationsRead);
    }
    
    if (deleteAllBtn) {
      deleteAllBtn.addEventListener('click', deleteAllNotifications);
    }
    
    loadNotifications();
    
    // Auto refresh notifications every 30 seconds
    setInterval(loadNotifications, 30000);
  }

  // Start initialization
  console.log('🔵 [hoso.js] Starting profile page initialization...');
  init();
  console.log('🔵 [hoso.js] Profile page initialization completed');
  console.log('🔵 [hoso.js] Final window.saveProfile:', typeof window.saveProfile);
  console.log('🔵 [hoso.js] IIFE execution completed successfully');
  } catch (error) {
    console.error('❌ [hoso.js] Error in IIFE:', error);
    console.error('❌ [hoso.js] Stack:', error.stack);
    // Report error to help debug
    window._hosoJsError = error;
  }
})();


