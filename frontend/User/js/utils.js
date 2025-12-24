/**
 * Utilities JavaScript
 * Các hàm tiện ích chung cho toàn bộ ứng dụng
 */

// API Configuration (can be overridden by window.SMARTEXPENSE_API)
// Prefer persisted override, then window override, then default 5000
(function initApiBase() {
  // 🔒 KHÓA CỨNG BACKEND NODE.JS
  window.API_BASE = 'http://localhost:5000';
  console.log('🔒 API_BASE locked to:', window.API_BASE);
})();

function setApiBase(newBase) {
  return window.API_BASE;
  if (!newBase || typeof newBase !== 'string') return;
  try {
    localStorage.setItem('smartexpense_api_base', newBase);
  } catch (e) {
    // ignore
  }
  window.API_BASE = newBase;
  console.log('🌐 API Base switched to:', newBase);
}

async function tryDiscoverApiBase() {
  if (window.__API_BASE_DISCOVERY_IN_PROGRESS) return null;
  window.__API_BASE_DISCOVERY_IN_PROGRESS = true;
  const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));
  const candidates = unique([
    window.SMARTEXPENSE_API,
    (function () {
      try { return localStorage.getItem('smartexpense_api_base'); } catch (e) { return null; }
    })(),
    'http://127.0.0.1:8080',
    'http://localhost:8080',
    'http://127.0.0.1:5000',
    'http://localhost:5000',
    // Thử thêm các cổng phổ biến khác nếu dự án bạn dùng chúng
    'http://127.0.0.1:5001',
    'http://localhost:5001',
    'http://127.0.0.1:5002',
    'http://localhost:5002',
  ]);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);

  try {
    for (const base of candidates) {
      try {
        const resp = await fetch(`${base}/`, {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal
        });
        if (resp.ok) {
          // Basic sanity check on welcome endpoint
          let ok = true;
          try {
            const data = await resp.clone().json();
            ok = !!(data && (data.message || data.status));
          } catch (e) {
            // If not JSON but ok status, still accept
            ok = true;
          }
          if (ok) {
            // Thực hiện một lần "preflight thực" để xác thực CORS + credentials
            // Gửi POST rỗng đến /api/auth/login để buộc trình duyệt thực hiện preflight.
            try {
              const preflight = await fetch(`${base}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}), // yêu cầu sẽ thất bại 400 nhưng mục tiêu là qua preflight
                credentials: 'include',
                mode: 'cors'
              });
              // Nếu tới được đây nghĩa là preflight không bị chặn bởi CORS ở network layer
              // Ta không cần preflight thành công về mặt nghiệp vụ (có thể 400/401)
            } catch (corsErr) {
              // CORS/preflight thất bại → bỏ qua base này
              continue;
            }
            setApiBase(base);
            return base;
          }
        }
      } catch (e) {
        // try next
      }
    }
  } finally {
    clearTimeout(timeout);
    window.__API_BASE_DISCOVERY_IN_PROGRESS = false;
  }
  return null;
}

// Show message function (global)
function showMessage(message, isSuccess = false, containerId = 'message') {
  let messageDiv = document.getElementById(containerId);

  if (!messageDiv) {
    messageDiv = document.createElement('div');
    messageDiv.id = containerId;
    messageDiv.style.cssText = 'margin: 10px 0; padding: 10px; border-radius: 5px; font-size: 14px;';

    // Try to find a container to insert the message
    const container = document.querySelector('.login-container') ||
      document.querySelector('.register-container') ||
      document.querySelector('main') ||
      document.body;

    if (container) {
      const form = container.querySelector('form');
      if (form) {
        container.insertBefore(messageDiv, form);
      } else {
        container.appendChild(messageDiv);
      }
    }
  }

  messageDiv.innerHTML = `<div style="padding: 10px; margin: 10px 0; border-radius: 5px; ${isSuccess ? 'background: #d1fae5; color: #065f46;' : 'background: #fee2e2; color: #991b1b;'}">${message}</div>`;

  setTimeout(() => {
    if (messageDiv) {
      messageDiv.innerHTML = '';
    }
  }, 5000);
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
}

// Check authentication
function checkAuth() {
  const user = localStorage.getItem('smartexpense_user');
  const token = localStorage.getItem('smartexpense_token');

  // For Google OAuth: token might be in httpOnly cookie, not localStorage
  // So we only require user info, token is optional (cookie will be used)
  if (!user) {
    return null;
  }

  try {
    return {
      user: JSON.parse(user),
      token: token || null  // Token might be in cookie (Google login) or localStorage (password login)
    };
  } catch (error) {
    // Nếu dữ liệu user không hợp lệ, xóa và trả về null
    console.error('Dữ liệu người dùng không hợp lệ trong localStorage:', error);
    localStorage.removeItem('smartexpense_user');
    localStorage.removeItem('smartexpense_token');
    return null;
  }
}

// Helper function to notify dashboard of expense updates
function notifyExpenseAdded() {
  // Dispatch custom event for same-page updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('expenseAdded'));

    // Update localStorage for cross-page updates
    try {
      localStorage.setItem('smartexpense_expense_added', Date.now().toString());
      // Remove it immediately to allow next update
      setTimeout(() => {
        localStorage.removeItem('smartexpense_expense_added');
      }, 100);
    } catch (e) {
      console.warn('Không thể thông báo cập nhật chi tiêu:', e);
    }
  }
}

// Flag để tránh redirect vòng lặp
if (typeof window.__REDIRECT_TO_LOGIN_IN_PROGRESS === 'undefined') {
  window.__REDIRECT_TO_LOGIN_IN_PROGRESS = false;
}
if (typeof window.__LAST_REDIRECT_TIME === 'undefined') {
  window.__LAST_REDIRECT_TIME = 0;
}

// Make API request with authentication
async function apiRequest(endpoint, options = {}) {
  const auth = checkAuth();

  // Các endpoint công khai không cần xác thực (đăng ký, đăng nhập, Google OAuth, forgot/reset password, verify-2fa)
  const publicEndpoints = ['/api/auth/register', '/api/auth/login', '/api/auth/google', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/verify-2fa'];
  const isPublicEndpoint = publicEndpoints.some(publicPath => endpoint.includes(publicPath));

  // Note: Don't redirect immediately if !auth because:
  // - Google login uses httpOnly cookies (not in localStorage)
  // - Cookie-based auth should be tried first
  // - Only redirect if API returns 401 after trying

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'  // Include cookies (httpOnly cookies) in all requests
  };

  // For backward compatibility: if token exists in localStorage, use it in header
  // But cookie (httpOnly) is preferred for Google OAuth
  if (auth && auth.token) {
    defaultOptions.headers['Authorization'] = `Bearer ${auth.token}`;
  }

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    },
    // Ensure credentials are included even if options override them
    credentials: options.credentials !== undefined ? options.credentials : 'include'
  };

  // Simple exponential backoff settings for 429 handling
  const max429Retries = 3;
  const baseDelayMs = 400;

  // Internal helper to sleep
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  let attempt = 0;
  while (true) {
  try {
    // Log request details for debugging (especially for Google login)
    const user = auth?.user;
    const hasToken = !!(auth?.token);
    const isGoogleLogin = user?.login_method === 'google';
    console.log(`📤 API Request: ${endpoint}`, {
      method: finalOptions.method || 'GET',
      hasAuth: !!auth,
      hasToken: hasToken,
      isGoogleLogin: isGoogleLogin,
      credentials: finalOptions.credentials,
      hasAuthHeader: !!finalOptions.headers['Authorization']
    });

    const response = await fetch(`${window.API_BASE}${endpoint}`, finalOptions);

    // Check if response has content before parsing JSON
    const contentType = response.headers.get('content-type');
    let data = {};

    // Xử lý khi device bị chặn
    if (response.status === 403) {
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
          if (data.blocked) {
            // Xóa token và redirect về login
            localStorage.removeItem('auth');
            sessionStorage.removeItem('auth');
            const loginPath = window.location.pathname.includes('frontend')
              ? 'login.html'
              : '../frontend/login.html';
            alert('Thiết bị này đã bị chặn. Vui lòng liên hệ quản trị viên.');
            window.location.href = loginPath;
            return null;
          }
        } catch (e) {
          // Ignore JSON parse error
        }
      }
    }

    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Lỗi parse JSON:', parseError);
        // Try to get response text for debugging
        try {
          const text = await response.clone().text();
          console.error('Response text:', text);
        } catch (e) {
          // Ignore
        }
        return {
          ok: false,
          status: response.status,
          data: { message: 'Lỗi xử lý phản hồi từ server' }
        };
      }
    }

    // Handle "Thiếu token" error - might be cookie issue
    // Always verify session via cookie before redirecting, because:
    // - Google login uses httpOnly cookies (not in localStorage)
    // - Cookie might exist even if localStorage is empty
    // - After Google login, user data might not be in localStorage yet
    if (!response.ok && response.status === 401 && data.message === 'Thiếu token') {
      console.warn('⚠️ Token missing error - checking authentication state:', {
        hasAuth: !!auth,
        hasToken: hasToken,
        isGoogleLogin: isGoogleLogin,
        endpoint: endpoint
      });

      // Always try to verify session via cookie before redirecting
      // This handles cases where:
      // - Google login just completed and cookie exists but localStorage is empty
      // - Cookie exists but wasn't sent properly in the request
      // - Token in localStorage expired but cookie is still valid
      console.log('🔄 Verifying session via cookie before redirecting...');

      try {
        const verifyResult = await fetch(`${window.API_BASE}/api/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        });

        if (verifyResult.ok) {
          const verifyData = await verifyResult.json();
          console.log('✅ Session verified via cookie - retrying original request...');

          // Update localStorage with user data if we got it from verification
          if (verifyData && verifyData.user) {
            // Store user data (token is in cookie, not in localStorage)
            localStorage.setItem('smartexpense_user', JSON.stringify(verifyData.user));
            localStorage.removeItem('smartexpense_token');
            console.log('✅ Updated localStorage with user data from cookie session');
          }

          // Session is valid, retry the original request
          return apiRequest(endpoint, options);
        } else {
          console.warn('❌ Session verification failed - user needs to re-login');
        }
      } catch (verifyError) {
        console.error('Error verifying session:', verifyError);
      }
    }

    console.log(`📥 API Response: ${endpoint}`, {
      status: response.status,
      ok: response.ok,
      message: data.message
    });

    // Handle 429 Too Many Requests with backoff/retry
    if (response.status === 429 && attempt < max429Retries) {
      attempt++;
      // Honor Retry-After if present
      let retryAfterMs = 0;
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) {
        const parsed = parseInt(retryAfter, 10);
        if (!isNaN(parsed)) {
          // seconds
          retryAfterMs = parsed * 1000;
        } else {
          // HTTP-date
          const dateMs = Date.parse(retryAfter);
          if (!isNaN(dateMs)) {
            retryAfterMs = Math.max(0, dateMs - Date.now());
          }
        }
      }
      // Exponential backoff with jitter
      const backoffMs = retryAfterMs || Math.min(8000, baseDelayMs * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 200);
      console.warn(`⏳ 429 Too Many Requests. Retrying ${attempt}/${max429Retries} after ${backoffMs}ms for ${endpoint}`);
      await sleep(backoffMs);
      // Loop to retry
      continue;
    }

    // If API returns 401 (unauthorized), handle appropriately
    // This handles cases where:
    // - No auth in localStorage (Google login uses cookies)
    // - Cookie expired or invalid
    // - User not authenticated
    if (!response.ok && response.status === 401 && !isPublicEndpoint) {
      // Đã xử lý "Thiếu token" ở trên, đây là các trường hợp khác (Token expired, Token invalid, etc.)
      const errorCode = data.code || 'UNKNOWN';

      console.warn('⚠️ Unauthorized (401):', {
        endpoint: endpoint,
        errorCode: errorCode,
        message: data.message,
        hasAuth: !!auth,
        hasToken: hasToken
      });

      // Tránh redirect vòng lặp: chỉ redirect nếu chưa redirect gần đây (trong 3 giây)
      const now = Date.now();
      const timeSinceLastRedirect = now - window.__LAST_REDIRECT_TIME;

      // Nếu đang trong quá trình redirect hoặc vừa redirect gần đây, bỏ qua
      if (window.__REDIRECT_TO_LOGIN_IN_PROGRESS || timeSinceLastRedirect < 3000) {
        console.warn('⏭️ Đang trong quá trình redirect hoặc vừa redirect gần đây, bỏ qua');
        return {
          ok: false,
          status: 401,
          data: data
        };
      }

      // Kiểm tra xem có đang ở trang login không
      const isLoginPage = window.location.pathname.includes('login.html') ||
        window.location.href.includes('login.html');
      if (isLoginPage) {
        console.warn('⏭️ Đã ở trang login, không redirect nữa');
        return {
          ok: false,
          status: 401,
          data: data
        };
      }

      // Chỉ redirect nếu chắc chắn session đã hết hạn (TOKEN_EXPIRED, TOKEN_INVALID)
      // Không redirect nếu chỉ là "Thiếu token" (đã xử lý ở trên)
      if (errorCode === 'TOKEN_EXPIRED' || errorCode === 'TOKEN_INVALID' || errorCode === 'AUTH_ERROR') {
        console.warn('⚠️ Session expired or invalid - redirecting to login');
        window.__REDIRECT_TO_LOGIN_IN_PROGRESS = true;
        window.__LAST_REDIRECT_TIME = now;

        const loginPath = window.location.pathname.includes('frontend')
          ? 'login.html'
          : '../frontend/login.html';

        // Reset flag sau 5 giây (safety measure)
        setTimeout(() => {
          window.__REDIRECT_TO_LOGIN_IN_PROGRESS = false;
        }, 5000);

        // Hiển thị alert trước khi redirect
        alert(data.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        window.location.href = loginPath;
        return {
          ok: false,
          status: 401,
          data: data
        };
      }

      // Nếu không phải TOKEN_EXPIRED/TOKEN_INVALID, chỉ trả về error (không redirect)
      return {
        ok: false,
        status: 401,
        data: data
      };
    }

    return {
      ok: response.ok,
      status: response.status,
      data: data
    };
  } catch (error) {
    console.error('Lỗi yêu cầu API:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      origin: window.location.origin,
      protocol: window.location.protocol
    });

    // Kiểm tra loại lỗi để đưa ra thông báo phù hợp
    let errorMessage = '❌ Lỗi kết nối đến server!\n\n';

    // Check if running from file:// protocol (CORS will be blocked)
    const isFileProtocol = window.location.protocol === 'file:';
    if (isFileProtocol) {
      errorMessage += '⚠️ BẠN ĐANG MỞ FILE TRỰC TIẾP TỪ Ổ ĐĨA (file://)\n';
      errorMessage += '   Browser sẽ chặn CORS requests từ file://\n\n';
      errorMessage += '📋 CÁCH KHẮC PHỤC:\n';
      errorMessage += '1. Mở terminal/command prompt\n';
      errorMessage += '2. Di chuyển vào thư mục gốc dự án:\n';
      errorMessage += '   cd "E:\\AI-Powered Smart Expense Management System"\n';
      errorMessage += '3. Chạy HTTP server:\n';
      errorMessage += '   python -m http.server 8080\n';
      errorMessage += '   (hoặc: python3 -m http.server 8080)\n\n';
      errorMessage += '4. Mở trình duyệt và truy cập:\n';
      errorMessage += '   http://localhost:8080/frontend/login.html\n\n';
      errorMessage += '5. Đảm bảo Backend Node.js đang chạy:\n';
      errorMessage += '   cd backend-node\n';
      errorMessage += '   npm run dev\n\n';
      errorMessage += '💡 Backend (mặc định) tại: ' + window.API_BASE;
    } else if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED'))) {
      // Try auto-discover backend port then retry once
      try {
        // Ưu tiên quay về Node backend mặc định (5000) nếu đang dùng base khác
        if (window.API_BASE !== 'http://127.0.0.1:5000' && window.API_BASE !== 'http://localhost:5000') {
          try {
            localStorage.setItem('smartexpense_api_base', 'http://127.0.0.1:5000');
          } catch (e) {}
          setApiBase('http://127.0.0.1:5000');
          const retryOnDefault = await apiRequest(endpoint, options);
          if (retryOnDefault && (retryOnDefault.ok || retryOnDefault.status)) {
            return retryOnDefault;
          }
        }
        const discovered = await tryDiscoverApiBase();
        if (discovered) {
          console.log('✅ Discovered API Base:', discovered, '- retrying original request...');
          const retryResult = await apiRequest(endpoint, options);
          return retryResult;
        }
      } catch (e) {
        // ignore and fall through to guidance
      }
      errorMessage += '🔴 Backend Node.js chưa được khởi động hoặc không thể kết nối.\n\n';
      errorMessage += '📋 Cách khắc phục:\n';
      errorMessage += '1. Mở terminal/command prompt\n';
      errorMessage += '2. Di chuyển vào thư mục backend-node:\n';
      errorMessage += '   cd backend-node\n';
      errorMessage += '3. Khởi động server:\n';
      errorMessage += '   npm run dev\n\n';
      errorMessage += '5. Đợi server khởi động xong\n';
      errorMessage += '6. Quay lại trang này và thử lại\n\n';
      errorMessage += '💡 Server đang dùng: ' + window.API_BASE;
      errorMessage += '\n\n📍 Origin hiện tại: ' + window.location.origin;
    } else if (error.message && error.message.includes('NetworkError')) {
      errorMessage += '🌐 Lỗi mạng. Vui lòng:\n';
      errorMessage += '- Kiểm tra kết nối internet\n';
      errorMessage += '- Đảm bảo Backend Node.js đang chạy tại ' + window.API_BASE + '\n';
      errorMessage += '- Kiểm tra firewall/antivirus không chặn kết nối\n';
      errorMessage += '\n📍 Origin hiện tại: ' + window.location.origin;
    } else {
      errorMessage += '⚠️ Không thể kết nối đến Backend Node.js tại ' + window.API_BASE + '\n\n';
      errorMessage += 'Vui lòng:\n';
      errorMessage += '1. Kiểm tra server có đang chạy không\n';
      errorMessage += '2. Kiểm tra port 5000 có bị chiếm dụng không\n';
      errorMessage += '3. Khởi động lại server: cd backend-node && npm run dev\n';
      errorMessage += '\n📍 Origin hiện tại: ' + (window.location.origin || 'file://');
      errorMessage += '\n📍 Protocol: ' + window.location.protocol;
      errorMessage += '\n📍 API Base: ' + window.API_BASE;
    }

    return {
      ok: false,
      status: 0,
      data: {
        message: errorMessage,
        errorType: 'CONNECTION_ERROR',
        apiBase: API_BASE,
        origin: window.location.origin,
        protocol: window.location.protocol
      }
    };
  }
  // End retry loop
  }
}

// Logout function - Sync data before logout
async function logout() {
  // Show loading indicator if possible
  let loadingModal = null;
  try {
    // Create a simple loading overlay
    loadingModal = document.createElement('div');
    loadingModal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.7); z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 18px; flex-direction: column; gap: 20px;
    `;
    loadingModal.innerHTML = `
      <div style="width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.3);
                   border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <div>Đang lưu dữ liệu trước khi đăng xuất...</div>
      <div style="font-size: 14px; opacity: 0.8;">Vui lòng đợi, không tắt trình duyệt</div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(loadingModal);
  } catch (e) {
    console.warn('Không thể hiển thị modal tải:', e);
  }

  // Sync all data to API before logout - với retry mechanism
  let syncSuccess = false;
  let syncAttempts = 0;
  const maxSyncAttempts = 3;

  if (window.dataManager && typeof window.dataManager.syncAllDataToAPI === 'function') {
    while (syncAttempts < maxSyncAttempts && !syncSuccess) {
      try {
        syncAttempts++;
        console.log(`🔄 Đang đồng bộ TẤT CẢ dữ liệu trước khi đăng xuất... (Lần thử: ${syncAttempts}/${maxSyncAttempts})`);

        // Update loading message
        if (loadingModal) {
          const messageDiv = loadingModal.querySelector('div:nth-child(2)');
          if (messageDiv) {
            messageDiv.textContent = `Đang lưu dữ liệu... (Lần thử: ${syncAttempts}/${maxSyncAttempts})`;
          }
        }

        // Give it more time (max 15 seconds per attempt) to ensure all data is synced
        const syncPromise = window.dataManager.syncAllDataToAPI();
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 15000));
        const result = await Promise.race([syncPromise, timeoutPromise]);

        if (result === 'timeout') {
          console.warn(`⚠️ Đồng bộ hết thời gian chờ (lần thử ${syncAttempts}/${maxSyncAttempts})`);
          if (syncAttempts < maxSyncAttempts) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } else if (result === true) {
          syncSuccess = true;
          console.log('✅ Tất cả dữ liệu đã được đồng bộ thành công trước khi đăng xuất');
        } else {
          console.warn(`⚠️ Đồng bộ không thành công (lần thử ${syncAttempts}/${maxSyncAttempts})`);
          if (syncAttempts < maxSyncAttempts) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (error) {
        console.error(`❌ Lỗi đồng bộ trước khi đăng xuất (lần thử ${syncAttempts}/${maxSyncAttempts}):`, error);
        if (syncAttempts < maxSyncAttempts) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!syncSuccess) {
      console.warn('⚠️ Không thể đồng bộ một số dữ liệu, nhưng sẽ tiếp tục đăng xuất. Dữ liệu sẽ được đồng bộ khi đăng nhập lại.');
      // Mark that data needs sync for next login
      if (window.dataManager && typeof window.dataManager.markNeedsSync === 'function') {
        window.dataManager.markNeedsSync();
      }
    }
  } else {
    console.warn('⚠️ DataManager không khả dụng, không thể đồng bộ dữ liệu trước khi đăng xuất');
  }

  // Final save to localStorage (backup)
  try {
    if (window.dataManager && typeof window.dataManager.saveData === 'function') {
      window.dataManager.saveData();
      console.log('💾 Đã lưu dữ liệu vào localStorage làm backup');
    }
  } catch (e) {
    console.warn('Lỗi khi lưu backup vào localStorage:', e);
  }

  // Remove loading modal
  if (loadingModal && loadingModal.parentNode) {
    loadingModal.remove();
  }

  // Clear session (only after sync is done)
  try {
    // QUAN TRỌNG: Đánh dấu đang logout để checkExistingLogin() bỏ qua
    localStorage.setItem('smartexpense_logging_out', 'true');
    console.log('✅ [logout] Đã đánh dấu đang logout');
    
    // Save avatar before clearing user data (avatar should persist across logout)
    // Lưu avatar theo user ID để mỗi account có avatar riêng
    const userData = localStorage.getItem('smartexpense_user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.avatar && user.id) {
          // Save avatar to user-specific key so it persists across logout
          localStorage.setItem(`smartexpense_avatar_${user.id}`, user.avatar);
          console.log(`✅ Đã lưu avatar cho user ID: ${user.id} trước khi đăng xuất`);
        }
      } catch (e) {
        console.warn('Lỗi khi lưu avatar:', e);
      }
    }

    // Keep smartexpense_data for backup (will be synced on next login)
    // Only clear authentication tokens and flags
    localStorage.removeItem('smartexpense_user');
    localStorage.removeItem('smartexpense_token');
    // Clear any other related flags
    localStorage.removeItem('smartexpense_expense_added');
    localStorage.removeItem('smartexpense_profile_updated');
    localStorage.removeItem('smartexpense_balance_updated');
    
    // Verify localStorage đã được xóa
    const verifyUser = localStorage.getItem('smartexpense_user');
    const verifyToken = localStorage.getItem('smartexpense_token');
    if (verifyUser || verifyToken) {
      console.error('❌ [logout] CRITICAL: localStorage chưa được xóa hoàn toàn!');
      // Thử xóa lại
      localStorage.removeItem('smartexpense_user');
      localStorage.removeItem('smartexpense_token');
    }
    
    console.log('✅ Đã xóa thông tin phiên đăng nhập');
  } catch (e) {
    console.warn('Lỗi khi xóa localStorage:', e);
  }

  // Đợi một chút để đảm bảo localStorage đã được xóa hoàn toàn
  await new Promise(resolve => setTimeout(resolve, 200));

  // Redirect to login - dùng đường dẫn tuyệt đối để tránh lỗi
  // Login page luôn ở: /frontend/User/UI_User/login.html
  const loginPath = '/frontend/User/UI_User/login.html';
  
  console.log('🔍 [logout] Current path:', window.location.pathname);
  console.log('🔍 [logout] Redirecting to:', loginPath);
  window.location.href = loginPath;
}

// Cache for server date to avoid too many requests
let serverDateCache = {
  date: null,
  timestamp: null,
  cacheTime: 0,
  cacheDuration: 60000 // Cache for 1 minute
};

// Get current date from server (with caching)
async function getCurrentDateFromServer(useCache = true) {
  const now = Date.now();
  
  // Check cache first
  if (useCache && serverDateCache.date && serverDateCache.cacheTime) {
    const cacheAge = now - serverDateCache.cacheTime;
    if (cacheAge < serverDateCache.cacheDuration) {
      // Kiểm tra xem ngày có thay đổi không bằng cách so sánh với client date
      const clientDate = getClientDateVietnam();
      if (serverDateCache.date === clientDate) {
        // Ngày vẫn giống nhau, dùng cache
        console.log('📅 Đang sử dụng ngày server đã cache:', serverDateCache.date);
        return serverDateCache.date;
      } else {
        // Ngày đã thay đổi, clear cache và lấy lại từ server
        console.log('📅 Ngày đã thay đổi, clear cache và lấy lại từ server');
        serverDateCache.date = null;
        serverDateCache.cacheTime = 0;
      }
    } else {
      // Cache đã hết hạn
      console.log('📅 Cache đã hết hạn, lấy lại từ server');
      serverDateCache.date = null;
      serverDateCache.cacheTime = 0;
    }
  }

  // Get from server
  try {
    const auth = checkAuth();
    if (!auth || typeof window.apiRequest !== 'function') {
      // Fallback to client date if not authenticated (dùng timezone VN)
      console.warn('⚠️ Chưa xác thực, đang sử dụng ngày từ client');
      return getClientDateVietnam();
    }

    const result = await window.apiRequest('/api/utils/current-date', {
      method: 'GET'
    });

    if (result && result.ok && result.data && result.data.date) {
      serverDateCache.date = result.data.date;
      serverDateCache.timestamp = result.data.timestamp;
      serverDateCache.cacheTime = Date.now();
      console.log('✅ Đã lấy ngày từ server:', serverDateCache.date);
      return serverDateCache.date;
    }
  } catch (error) {
    console.error('Lỗi khi lấy ngày từ server:', error);
  }

  // Fallback to client date (dùng timezone VN)
  console.warn('⚠️ Không thể lấy ngày từ server, đang sử dụng ngày từ client');
  return getClientDateVietnam();
}

// Helper function: Lấy ngày từ client theo timezone Việt Nam
function getClientDateVietnam() {
  const now = new Date();
  const vietnamOffset = 7 * 60; // UTC+7 tính bằng phút
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const vietnamTime = new Date(utc + (vietnamOffset * 60000));
  const year = vietnamTime.getFullYear();
  const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
  const day = String(vietnamTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Clear server date cache (useful when date changes)
function clearServerDateCache() {
  serverDateCache.date = null;
  serverDateCache.timestamp = null;
  serverDateCache.cacheTime = 0;
  console.log('🗑️ Đã clear cache ngày server');
}

// Make functions globally available
window.showMessage = showMessage;
window.formatCurrency = formatCurrency;
window.checkAuth = checkAuth;
window.apiRequest = apiRequest;
window.logout = logout;
window.getCurrentDateFromServer = getCurrentDateFromServer;
window.clearServerDateCache = clearServerDateCache;
