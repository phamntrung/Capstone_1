/**
 * Utilities JavaScript
 * Các hàm tiện ích chung cho toàn bộ ứng dụng
 */

// API Configuration (can be overridden by window.SMARTEXPENSE_API)
// Flask backend runs on port 5000
const API_BASE = window.SMARTEXPENSE_API || 'http://127.0.0.1:5000';
window.API_BASE = API_BASE; // Make it globally accessible

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

// Make API request with authentication
async function apiRequest(endpoint, options = {}) {
  const auth = checkAuth();
  
  // Các endpoint công khai không cần xác thực (đăng ký, đăng nhập, Google OAuth)
  const publicEndpoints = ['/api/auth/register', '/api/auth/login', '/api/auth/google'];
  const isPublicEndpoint = publicEndpoints.some(publicPath => endpoint.includes(publicPath));
  
  // Chỉ yêu cầu auth cho các endpoint được bảo vệ (không phải auth endpoints)
  if (!auth && endpoint.includes('/api/') && !isPublicEndpoint) {
    // Lấy đường dẫn chính xác đến login.html dựa trên vị trí hiện tại
    const loginPath = window.location.pathname.includes('frontend') 
      ? 'login.html' 
      : '../frontend/login.html';
    window.location.href = loginPath;
    return null;
  }
  
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
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, finalOptions);
    
    // Check if response has content before parsing JSON
    const contentType = response.headers.get('content-type');
    let data = {};
    
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
      errorMessage += '5. Đảm bảo Backend Flask đang chạy:\n';
      errorMessage += '   cd backend\n';
      errorMessage += '   venv\\Scripts\\activate\n';
      errorMessage += '   python app.py\n\n';
      errorMessage += '💡 Backend sẽ chạy tại: http://127.0.0.1:5000';
    } else if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED'))) {
      errorMessage += '🔴 Backend Flask chưa được khởi động hoặc không thể kết nối.\n\n';
      errorMessage += '📋 Cách khắc phục:\n';
      errorMessage += '1. Mở terminal/command prompt\n';
      errorMessage += '2. Di chuyển vào thư mục backend:\n';
      errorMessage += '   cd backend\n';
      errorMessage += '3. Kích hoạt virtual environment:\n';
      errorMessage += '   venv\\Scripts\\activate\n';
      errorMessage += '4. Khởi động server:\n';
      errorMessage += '   python app.py\n\n';
      errorMessage += '5. Đợi server khởi động xong\n';
      errorMessage += '6. Quay lại trang này và thử lại\n\n';
      errorMessage += '💡 Server sẽ chạy tại: http://127.0.0.1:5000';
      errorMessage += '\n\n📍 Origin hiện tại: ' + window.location.origin;
    } else if (error.message && error.message.includes('NetworkError')) {
      errorMessage += '🌐 Lỗi mạng. Vui lòng:\n';
      errorMessage += '- Kiểm tra kết nối internet\n';
      errorMessage += '- Đảm bảo Backend Flask đang chạy tại http://127.0.0.1:5000\n';
      errorMessage += '- Kiểm tra firewall/antivirus không chặn kết nối\n';
      errorMessage += '\n📍 Origin hiện tại: ' + window.location.origin;
    } else {
      errorMessage += '⚠️ Không thể kết nối đến Backend Flask tại ' + API_BASE + '\n\n';
      errorMessage += 'Vui lòng:\n';
      errorMessage += '1. Kiểm tra server có đang chạy không\n';
      errorMessage += '2. Kiểm tra port 5000 có bị chiếm dụng không\n';
      errorMessage += '3. Khởi động lại server: cd backend && venv\\Scripts\\activate && python app.py\n';
      errorMessage += '\n📍 Origin hiện tại: ' + (window.location.origin || 'file://');
      errorMessage += '\n📍 Protocol: ' + window.location.protocol;
      errorMessage += '\n📍 API Base: ' + API_BASE;
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
    // Keep smartexpense_data for backup (will be synced on next login)
    // Only clear authentication tokens and flags
    localStorage.removeItem('smartexpense_user');
    localStorage.removeItem('smartexpense_token');
    // Clear any other related flags
    localStorage.removeItem('smartexpense_expense_added');
    localStorage.removeItem('smartexpense_profile_updated');
    localStorage.removeItem('smartexpense_balance_updated');
    console.log('✅ Đã xóa thông tin phiên đăng nhập');
  } catch (e) {
    console.warn('Lỗi khi xóa localStorage:', e);
  }
  
  // Redirect to login
  window.location.href = 'login.html';
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
  // Check cache first
  if (useCache && serverDateCache.date && serverDateCache.timestamp) {
    const now = Date.now();
    const cacheAge = now - serverDateCache.cacheTime;
    if (cacheAge < serverDateCache.cacheDuration) {
      console.log('📅 Đang sử dụng ngày server đã cache:', serverDateCache.date);
      return serverDateCache.date;
    }
  }
  
  // Get from server
  try {
    const auth = checkAuth();
    if (!auth || typeof window.apiRequest !== 'function') {
      // Fallback to client date if not authenticated
      console.warn('⚠️ Chưa xác thực, đang sử dụng ngày từ client');
      return new Date().toISOString().split('T')[0];
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
  
  // Fallback to client date
  console.warn('⚠️ Không thể lấy ngày từ server, đang sử dụng ngày từ client');
  return new Date().toISOString().split('T')[0];
}

// Make functions globally available
window.showMessage = showMessage;
window.formatCurrency = formatCurrency;
window.checkAuth = checkAuth;
window.apiRequest = apiRequest;
window.logout = logout;
window.getCurrentDateFromServer = getCurrentDateFromServer;
