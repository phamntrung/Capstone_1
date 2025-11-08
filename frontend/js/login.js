/**
 * Unified Login Manager - Externalized from login.html
 * Đã được rà soát và thống nhất logic authentication
 */

// Frontend-only demo mode: set window.FRONTEND_ONLY = true to bypass backend
const FRONTEND_ONLY = window.FRONTEND_ONLY === true;

// API_BASE is defined in utils.js (loaded before this file) and exposed via window.API_BASE
// Use it directly via window.API_BASE, or access via the global constant if available
const getApiBase = () => window.API_BASE || window.SMARTEXPENSE_API || 'http://127.0.0.1:5000';

// Global flag to prevent multiple redirects
if (typeof window.__REDIRECT_IN_PROGRESS === 'undefined') {
    window.__REDIRECT_IN_PROGRESS = false;
}

// Helper function to safely redirect (prevents multiple redirects)
function safeRedirect(target) {
    // Reset flag if it was set from a previous failed redirect
    // This ensures redirect can happen even if previous redirect failed
    if (window.__REDIRECT_IN_PROGRESS) {
        console.warn('⚠️ Phát hiện redirect đang chờ, reset flag và thực hiện redirect mới');
        window.__REDIRECT_IN_PROGRESS = false;
    }
    
    window.__REDIRECT_IN_PROGRESS = true;
    console.log('🔄 Đang chuyển hướng đến:', target);
    
    // Add timeout to reset flag if redirect doesn't happen (safety measure)
    setTimeout(() => {
        if (window.__REDIRECT_IN_PROGRESS) {
            console.warn('⚠️ Redirect có thể đã thất bại, reset flag');
            window.__REDIRECT_IN_PROGRESS = false;
        }
    }, 2000);
    
    try {
        // Use location.href for more reliable redirect
        window.location.href = target;
    } catch (e) {
        console.error('Lỗi khi redirect:', e);
        try {
            window.location.replace(target);
        } catch (e2) {
            try {
                window.location.assign(target);
            } catch (e3) {
                console.error('Không thể redirect, thử lại sau 100ms');
                window.__REDIRECT_IN_PROGRESS = false;
                setTimeout(() => safeRedirect(target), 100);
            }
        }
    }
}

// Simple login manager
function initSimpleLogin() {
    console.log('Đang khởi tạo hệ thống đăng nhập...');
    const form = document.getElementById('loginForm');
    if (!form) {
        console.error('Không tìm thấy form đăng nhập');
        return;
    }
    form.addEventListener('submit', handleLogin);
}

async function persistSession(user, token) {
    // Store user data
    // Token: If provided (password login), store in localStorage for backward compatibility
    // If null (Google login), token is in httpOnly cookie and should NOT be stored in localStorage
    let userData = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        loginTime: new Date().toISOString()
    };

    // Merge any additional user data provided
    if (user.balance !== undefined) userData.balance = user.balance;
    if (user.gender !== undefined) userData.gender = user.gender;
    if (user.currency !== undefined) userData.currency = user.currency || 'VND';
    if (user.phone !== undefined) userData.phone = user.phone;
    if (user.avatar_url !== undefined) userData.avatar_url = user.avatar_url;
    if (user.login_method !== undefined) userData.login_method = user.login_method;
    if (user.monthly_budget !== undefined) userData.monthly_budget = user.monthly_budget;
    else if (userData.balance !== undefined) userData.monthly_budget = userData.balance;

    // Load full profile from API if token is in cookie (Google login) or if not all data is present
    if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
        try {
            // If token provided (password login), temporarily store for this request
            // Otherwise, cookie will be used automatically
            if (token) {
                localStorage.setItem('smartexpense_token', token);
            }
            
            const profileResult = await window.apiRequest('/api/me');
            if (profileResult && profileResult.ok && profileResult.data) {
                // Merge profile data from API
                // Balance = 0 là giá trị hợp lệ cho account mới, không dùng || để tránh bỏ qua giá trị 0
                const apiBalance = profileResult.data.balance !== undefined && profileResult.data.balance !== null
                    ? profileResult.data.balance
                    : (userData.balance !== undefined ? userData.balance : 0);
                
                userData = {
                    ...userData,
                    balance: apiBalance,
                    gender: profileResult.data.gender !== undefined ? profileResult.data.gender : (userData.gender || null),
                    currency: profileResult.data.currency || userData.currency || 'VND',
                    phone: profileResult.data.phone !== undefined ? profileResult.data.phone : (userData.phone || null),
                    monthly_budget: apiBalance // monthly_budget = balance
                };
                console.log('✅ Đã tải đầy đủ hồ sơ từ database:', userData);
            }
        } catch (error) {
            console.warn('Không thể tải thông tin hồ sơ từ API, sử dụng dữ liệu người dùng được cung cấp:', error);
        }
    }

    // Restore avatar from separate key if exists (avatar persists across logout)
    try {
      const savedAvatar = localStorage.getItem('smartexpense_avatar');
      if (savedAvatar) {
        userData.avatar = savedAvatar;
        console.log('✅ Đã khôi phục avatar sau khi đăng nhập');
      }
    } catch (e) {
      console.warn('Lỗi khi khôi phục avatar:', e);
    }
    
    // Store user data in localStorage
    localStorage.setItem('smartexpense_user', JSON.stringify(userData));
    
    // Only store token in localStorage if provided (password login)
    // Google login tokens are in httpOnly cookie and should NOT be in localStorage
    if (token) {
        localStorage.setItem('smartexpense_token', token);
    } else {
        // Remove token from localStorage if it exists (for Google login users)
        localStorage.removeItem('smartexpense_token');
        console.log('✅ Token được lưu trong httpOnly cookie, không lưu trong localStorage');
    }
    
    // Load data from API after login (ensure data is fresh from server)
    if (typeof window !== 'undefined' && window.dataManager && typeof window.dataManager.loadFromAPI === 'function') {
        console.log('🔄 Đang tải TẤT CẢ dữ liệu người dùng từ API sau khi đăng nhập...');
        // Give it a small delay to ensure API is ready
        setTimeout(async () => {
            try {
                // Force refresh from API - this will load expenses, categories, budgets, and profile
                await window.dataManager.loadFromAPI(true);
                
                // Process any sync queue from previous session (retry any failed syncs)
                if (typeof window.dataManager.processSyncQueue === 'function') {
                    await window.dataManager.processSyncQueue();
                }
                
                // Verify profile data is loaded
                const userStr = localStorage.getItem('smartexpense_user');
                if (userStr) {
                    const userData = JSON.parse(userStr);
                    console.log('✅ Dữ liệu người dùng đã được tải từ API sau khi đăng nhập:', {
                        expenses: window.dataManager?.data?.expenses?.length || 0,
                        categories: window.dataManager?.data?.categories?.length || 0,
                        budgets: Object.keys(window.dataManager?.data?.budgets || {}).length || 0,
                        profile: {
                            balance: userData.balance,
                            gender: userData.gender,
                            currency: userData.currency,
                            phone: userData.phone
                        }
                    });
                }
            } catch (error) {
                console.warn('Không thể tải dữ liệu từ API sau khi đăng nhập:', error);
                // Mark that we need to sync later
                if (window.dataManager && typeof window.dataManager.markNeedsSync === 'function') {
                    window.dataManager.markNeedsSync();
                }
            }
        }, 500);
    }
}

async function handleLogin(event) {
    console.log('Hàm handleLogin được gọi');
    event.preventDefault();

    const form = event.target;
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitBtn = form.querySelector('button[type="submit"]');
    let isRedirecting = false; // Flag to track if redirect is in progress

    console.log('Các phần tử form được tìm thấy:', {
        form: !!form,
        emailInput: !!emailInput,
        passwordInput: !!passwordInput,
        submitBtn: !!submitBtn
    });

    if (!emailInput || !passwordInput) {
        alert('Không tìm thấy input fields');
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Basic validation
    if (!email) {
        alert('Vui lòng nhập email');
        emailInput.focus();
        return;
    }

    if (!password) {
        alert('Vui lòng nhập mật khẩu');
        passwordInput.focus();
        return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Email không hợp lệ');
        emailInput.focus();
        return;
    }

    // Show loading
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang đăng nhập...';
    }

    try {
        if (FRONTEND_ONLY) {
            const mockUser = { email, name: email.split('@')[0], role: 'user' };
            const mockToken = 'demo-token';
            persistSession(mockUser, mockToken);
            console.log('✅ Đã lưu session (frontend-only), chuẩn bị redirect...');
            showSuccessMessage(`Đăng nhập thành công! Chào mừng ${mockUser.name}`);
            // Redirect immediately without delay
            setTimeout(() => {
                console.log('🔄 Đang thực hiện redirect (frontend-only)...');
                safeRedirect('trangchu.html');
            }, 50);
            return;
        }
        
        // Try to use apiRequest from utils.js if available, otherwise use fetch
        let result;
        if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
            // Use unified apiRequest from utils.js
            console.log('Đang sử dụng apiRequest để đăng nhập...');
            const requestData = { email, password };
            console.log('📤 Request data:', { 
                email: requestData.email, 
                passwordLength: requestData.password ? requestData.password.length : 0,
                fullData: requestData 
            });
            result = await window.apiRequest('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify(requestData)
            });
            
            console.log('Phản hồi API đăng nhập:', result);
            
            if (!result || !result.ok) {
                const errorMsg = result?.data?.message || 'Đăng nhập thất bại';
                console.error('Đăng nhập thất bại:', errorMsg, result);
                
                // Reset button state
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Đăng nhập';
                }
                
                // Show user-friendly error message
                // If it's a connection error, show detailed instructions
                if (result?.data?.errorType === 'CONNECTION_ERROR') {
                    // Replace \n with actual line breaks for alert
                    const formattedMsg = errorMsg.replace(/\n/g, '\n');
                    alert(formattedMsg);
                } else {
                    alert(errorMsg);
                }
                return;
            }
            
            // Ensure result.data exists
            if (!result.data) {
                console.error('Không có dữ liệu trong phản hồi:', result);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Đăng nhập';
                }
                alert('Phản hồi từ server không hợp lệ. Vui lòng thử lại.');
                return;
            }
            
            const user = result.data.user || {};
            const token = result.data.token;
            
            console.log('Dữ liệu phản hồi đăng nhập:', { user, hasToken: !!token, fullData: result.data });
            
            if (!token) {
                console.error('Không có token trong phản hồi:', result.data);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Đăng nhập';
                }
                alert('Không nhận được token xác thực. Vui lòng thử lại.');
                return;
            }
            
            if (!user || !user.id) {
                console.error('Dữ liệu người dùng không hợp lệ:', user);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Đăng nhập';
                }
                alert('Thông tin người dùng không hợp lệ. Vui lòng thử lại.');
                return;
            }
            
            console.log('Đăng nhập thành công, user từ database:', user.email);
            await persistSession(user, token);
            console.log('✅ Đã lưu session, chuẩn bị redirect...');
            showSuccessMessage(`Đăng nhập thành công! Chào mừng ${user.name || user.email}`);
            
            // Redirect immediately without delay
            isRedirecting = true; // Mark that redirect is starting
            console.log('🔄 Bắt đầu redirect đến trangchu.html...');
            // Use immediate redirect instead of setTimeout for more reliability
            setTimeout(() => {
                console.log('🔄 Đang thực hiện redirect...');
                safeRedirect('trangchu.html');
            }, 50);
        } else {
            // Fallback to direct fetch if apiRequest is not available
            console.log('Đang sử dụng fetch trực tiếp để đăng nhập...');
            const res = await fetch(`${getApiBase()}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json().catch((err) => {
                console.error('Không thể phân tích JSON phản hồi:', err);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Đăng nhập';
                }
                return { message: 'Lỗi xử lý phản hồi từ server' };
            });

            console.log('Phản hồi đăng nhập:', { status: res.status, ok: res.ok, hasData: !!data, data });

            if (!res.ok) {
                const errorMsg = data.message || `Đăng nhập thất bại (${res.status})`;
                console.error('Đăng nhập thất bại:', errorMsg);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Đăng nhập';
                }
                alert(errorMsg);
                return;
            }

            // Ensure data exists
            if (!data) {
                console.error('Không có dữ liệu trong phản hồi');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Đăng nhập';
                }
                alert('Phản hồi từ server không hợp lệ. Vui lòng thử lại.');
                return;
            }

            const user = data.user || {};
            const token = data.token;
            
            console.log('Dữ liệu phản hồi đăng nhập:', { user, hasToken: !!token, fullData: data });
            
            if (!token) {
                console.error('Không có token trong phản hồi:', data);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Đăng nhập';
                }
                alert('Không nhận được token xác thực. Vui lòng thử lại.');
                return;
            }
            
            if (!user || !user.id) {
                console.error('Dữ liệu người dùng không hợp lệ:', user);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Đăng nhập';
                }
                alert('Thông tin người dùng không hợp lệ. Vui lòng thử lại.');
                return;
            }

            console.log('Đăng nhập thành công, user từ database:', user.email);
            await persistSession(user, token);
            console.log('✅ Đã lưu session, chuẩn bị redirect...');
            showSuccessMessage(`Đăng nhập thành công! Chào mừng ${user.name || user.email}`);

            // Redirect immediately without delay
            isRedirecting = true; // Mark that redirect is starting
            console.log('🔄 Bắt đầu redirect đến trangchu.html...');
            // Use immediate redirect instead of setTimeout for more reliability
            setTimeout(() => {
                console.log('🔄 Đang thực hiện redirect...');
                safeRedirect('trangchu.html');
            }, 50);
        }
    } catch (error) {
        console.error('Lỗi đăng nhập:', error);
        alert('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
        // Only reset button if not redirecting (to avoid race condition)
        if (submitBtn && !isRedirecting) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Đăng nhập';
        }
    }
}

// Show success message
function showSuccessMessage(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        font-family: Arial, sans-serif;
        font-size: 14px;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(notification);
    setTimeout(() => notification.parentElement && notification.remove(), 3000);
}

// Check if already logged in
function checkExistingLogin() {
    const token = localStorage.getItem('smartexpense_token');
    const user = localStorage.getItem('smartexpense_user');

    if (token && user) {
        try {
            const userData = JSON.parse(user);
            console.log('Người dùng đã đăng nhập:', userData.name);
            console.log('Đang chuyển hướng người dùng đã xác thực đến trang chủ...');
            window.location.href = 'trangchu.html';
        } catch (error) {
            console.error('Dữ liệu người dùng không hợp lệ, đang xóa localStorage');
            localStorage.removeItem('smartexpense_user');
            localStorage.removeItem('smartexpense_token');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM đã tải xong - Đang khởi tạo hệ thống đăng nhập...');
    checkExistingLogin();
    initSimpleLogin();
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('DOM đã sẵn sàng - Đang khởi tạo đăng nhập ngay lập tức...');
    setTimeout(() => {
        checkExistingLogin();
        initSimpleLogin();
    }, 100);
}

console.log('Script đăng nhập đã được tải');

// Debug: Log current origin for Google OAuth troubleshooting
// Chỉ khởi tạo một lần để tránh đăng ký event listener nhiều lần
if (typeof window !== 'undefined') {
    // Flag để tránh khởi tạo nhiều lần
    if (typeof window.__GOOGLE_ERROR_HANDLERS_INIT === 'undefined') {
        window.__GOOGLE_ERROR_HANDLERS_INIT = false;
    }
    
    // Chỉ khởi tạo một lần
    if (!window.__GOOGLE_ERROR_HANDLERS_INIT) {
        window.__GOOGLE_ERROR_HANDLERS_INIT = true;
        
        const currentOrigin = window.location.origin;
        console.log('📍 Origin hiện tại cho Google OAuth:', currentOrigin);
        console.log('💡 Nếu bạn thấy lỗi "[GSI_LOGGER]: The given origin is not allowed",');
        console.log('   hãy thêm origin này vào Google Console:', currentOrigin);
        console.log('   Liên kết: https://console.cloud.google.com/apis/credentials');
        
        // Intercept console errors to detect GSI_LOGGER origin errors
        const originalError = console.error;
        const originalWarn = console.warn;
        
        // Suppress COOP warning (Cross-Origin-Opener-Policy) - this is a harmless warning
        // Google Sign-In still works despite this warning
        const suppressCOOPWarning = (...args) => {
            const message = args.join(' ');
            // Check for COOP postMessage warning
            if (message.includes('Cross-Origin-Opener-Policy') && 
                message.includes('postMessage')) {
                // Suppress this specific warning as it doesn't affect functionality
                // Google Sign-In still works correctly despite this warning
                return;
            }
            // Call original function for other errors
            return originalWarn.apply(console, args);
        };
        
        // Track if we've already shown the warning
        let originWarningShown = false;
        
        // Function to show origin warning in UI (defined early so it can be called from anywhere)
        function showOriginWarning() {
            const currentOrigin = window.location.origin;
            
            // Try to show in UI if DOM is ready
            const warningDiv = document.getElementById('oauthWarning');
            const warningContent = document.getElementById('oauthWarningContent');
            
            if (warningDiv && warningContent) {
                const allOrigins = [
                    currentOrigin,
                    'http://localhost:5000',
                    'http://127.0.0.1:5000',
                    'http://localhost:8080',
                    'http://127.0.0.1:8080'
                ].filter((origin, index, self) => self.indexOf(origin) === index);
                
                warningContent.innerHTML = `
                    <div style="margin-bottom:8px;"><strong>⚠️ Lỗi cấu hình Google OAuth:</strong></div>
                    <div style="margin-bottom:8px;">Origin hiện tại chưa được phép trong Google Console:</div>
                    <code style="background:#fff;padding:4px 8px;border-radius:4px;display:block;margin:4px 0;word-break:break-all;">${currentOrigin}</code>
                    <div style="margin-top:12px;"><strong>📋 Giải pháp:</strong></div>
                    <ol style="margin:8px 0;padding-left:20px;font-size:13px;">
                        <li>Vào <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color:#0066ff;font-weight:700;">Google Console → Credentials</a></li>
                        <li>Tìm Client ID: <code style="background:#fff;padding:2px 4px;border-radius:2px;font-size:11px;">60974853277-a0jg39ps7b4too995e58rvmehte0e16a.apps.googleusercontent.com</code></li>
                        <li>Click vào Client ID → Thêm vào "Authorized JavaScript origins":</li>
                        <li style="margin-top:4px;"><code style="background:#fff;padding:2px 4px;border-radius:2px;font-size:11px;">${currentOrigin}</code></li>
                        <li>Lưu và đợi 5-10 phút để Google cập nhật</li>
                        <li>Refresh trang (Ctrl + Shift + R)</li>
                    </ol>
                    <div style="margin-top:8px;">
                        <a href="../check-origin.html" target="_blank" style="color:#0066ff;font-weight:700;text-decoration:none;">🔍 Xem hướng dẫn chi tiết và copy tất cả origins</a>
                    </div>
                `;
                warningDiv.classList.add('show');
            } else {
                // DOM not ready yet, wait for it and try again
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', function() {
                        setTimeout(showOriginWarning, 100);
                    });
                } else {
                    // DOM ready but elements not found, try again after a short delay
                    setTimeout(showOriginWarning, 500);
                }
            }
        }
        
        // Expose function globally so it can be called from anywhere
        window.showOriginWarning = showOriginWarning;
        
            function checkForOriginError(...args) {
            const message = args.join(' ');
            
            // Check for GSI_LOGGER origin errors (multiple patterns)
            // Pattern 1: [GSI_LOGGER]: The given origin is not allowed for the given client ID.
            // Pattern 2: credential_button_library errors
            // Pattern 3: Any message containing "origin is not allowed" or "not allowed for the given client ID"
            if ((message.includes('GSI_LOGGER') && (message.includes('origin is not allowed') || message.includes('not allowed for the given client ID'))) ||
                (message.includes('credential_button_library') && (message.includes('origin is not allowed') || message.includes('not allowed for the given client ID'))) ||
                (message.includes('The given origin is not allowed')) ||
                (message.includes('not allowed for the given client ID'))) {
                if (!originWarningShown) {
                    originWarningShown = true;
                    showOriginWarning();
                }
            }
            
            // Check for 403 errors from accounts.google.com
            if (message.includes('403') && message.includes('accounts.google.com')) {
                if (!originWarningShown) {
                    originWarningShown = true;
                    showOriginWarning();
                }
            }
            
            // Call original function
            return originalError.apply(console, args);
        }
        
        function checkForOriginWarn(...args) {
            const message = args.join(' ');
            
            // Check for GSI_LOGGER origin errors in warnings too (multiple patterns)
            if ((message.includes('GSI_LOGGER') && (message.includes('origin is not allowed') || message.includes('not allowed for the given client ID'))) ||
                (message.includes('credential_button_library') && (message.includes('origin is not allowed') || message.includes('not allowed for the given client ID'))) ||
                (message.includes('The given origin is not allowed')) ||
                (message.includes('not allowed for the given client ID'))) {
                if (!originWarningShown) {
                    originWarningShown = true;
                    showOriginWarning();
                }
            }
            
            // Call original function
            return originalWarn.apply(console, args);
        }
        
        // Override console.error and console.warn
        console.error = checkForOriginError;
        // Suppress COOP warning first, then check for origin errors
        console.warn = function(...args) {
            const message = args.join(' ');
            // Suppress COOP postMessage warning (harmless warning)
            if (message.includes('Cross-Origin-Opener-Policy') && 
                message.includes('postMessage')) {
                // This warning doesn't affect Google Sign-In functionality
                // Google Sign-In still works correctly despite this warning
                return;
            }
            // Check for origin errors
            return checkForOriginWarn.apply(console, args);
        };
    
        // Chỉ đăng ký event listener một lần - gộp hai listener thành một
        window.addEventListener('error', function(e) {
            const errorMessage = e.message || '';
            const errorSource = e.filename || e.target?.src || '';
            
            // Check for 403 errors from Google accounts
            if (errorMessage.includes('403') || 
                errorSource.includes('accounts.google.com') ||
                (errorMessage.includes('client') && errorMessage.includes('403'))) {
                if (!originWarningShown) {
                    originWarningShown = true;
                    showOriginWarning();
                }
            }
            
            // Check for failed script loads
            if (e.target && e.target.tagName === 'SCRIPT' && e.target.src) {
                const src = e.target.src;
                if (src.includes('accounts.google.com') || src.includes('gsi/client') || src.includes('credential_button_library')) {
                    if (e.message && e.message.includes('403')) {
                        if (!originWarningShown) {
                            originWarningShown = true;
                            showOriginWarning();
                        }
                    }
                }
            }
        }, true);
        
        // Also intercept console.log to catch GSI_LOGGER messages
        const originalLog = console.log;
        console.log = function(...args) {
            const message = args.join(' ');
            // Check for GSI_LOGGER origin errors in console.log (multiple patterns)
            if ((message.includes('GSI_LOGGER') && message.includes('origin is not allowed')) ||
                (message.includes('GSI_LOGGER') && message.includes('not allowed for the given client ID')) ||
                (message.includes('credential_button_library') && message.includes('origin is not allowed')) ||
                (message.includes('The given origin is not allowed'))) {
                if (!originWarningShown) {
                    originWarningShown = true;
                    showOriginWarning();
                }
            }
            // Call original function
            return originalLog.apply(console, args);
        };
        
        // Monitor network requests for 403 errors from Google
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            return originalFetch.apply(this, args).catch(error => {
                // Check if it's a 403 error from Google
                if (args[0] && typeof args[0] === 'string' && 
                    (args[0].includes('accounts.google.com') || args[0].includes('gsi/client'))) {
                    if (!originWarningShown) {
                        originWarningShown = true;
                        showOriginWarning();
                    }
                }
                throw error;
            });
        };
    } // End of __GOOGLE_ERROR_HANDLERS_INIT check
}

// Ensure Google callback is available when SDK loads
// Initialize Google Sign-In when SDK is ready - chỉ khởi tạo một lần
if (typeof window !== 'undefined') {
    // Flag để tránh khởi tạo nhiều lần
    if (typeof window.__GOOGLE_SDK_INIT === 'undefined') {
        window.__GOOGLE_SDK_INIT = false;
    }
    
    // Chỉ khởi tạo một lần
    if (!window.__GOOGLE_SDK_INIT) {
        window.__GOOGLE_SDK_INIT = true;
        
        // Chỉ đăng ký event listener một lần
        let loadHandlerAdded = false;
        const initGoogleSDK = function() {
            if (loadHandlerAdded) return;
            loadHandlerAdded = true;
            
            // Check after a delay to see if Google SDK loaded successfully
            let checkTimeout = null;
            checkTimeout = setTimeout(function() {
                if (typeof window.google === 'undefined' || typeof window.google.accounts === 'undefined') {
                    console.warn('⚠️ Google Sign-In SDK chưa được tải. Kiểm tra xem origin đã được ủy quyền trong Google Console chưa.');
                    console.warn('   Origin hiện tại:', window.location.origin);
                    
                    // Chỉ hiển thị cảnh báo nếu chưa có cảnh báo nào
                    if (typeof window.showOriginWarning === 'function') {
                        window.showOriginWarning();
                    }
                } else {
                    console.log('✅ Google Sign-In SDK đã được tải, callback đã sẵn sàng');
                }
                checkTimeout = null;
            }, 2000); // Giảm thời gian chờ xuống 2 giây
        };
        
        // Đăng ký event listener một lần
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            // DOM đã sẵn sàng, chạy ngay
            initGoogleSDK();
        } else {
            // Đợi DOM load
            window.addEventListener('load', initGoogleSDK, { once: true });
        }
    }
}


// Google One Tap / Button callback handler (exposed globally)
// Must be defined before Google SDK loads
if (typeof window.onGoogleCredential === 'undefined') {
    window.onGoogleCredential = async function onGoogleCredential(response) {
    console.log('Đã nhận callback credential từ Google:', response);
    // Prevent double handling from duplicate callbacks/popups
    if (typeof window.__GOOGLE_LOGIN_IN_PROGRESS === 'undefined') {
        window.__GOOGLE_LOGIN_IN_PROGRESS = false;
    }
    if (window.__GOOGLE_LOGIN_IN_PROGRESS) {
        console.log('Bỏ qua callback Google trùng lặp');
        return;
    }
    window.__GOOGLE_LOGIN_IN_PROGRESS = true;
    
    try {
        // Extract credential - Google can pass it as response.credential or just response (string)
        const credential = (typeof response === 'string') ? response : (response?.credential || response);
        
        if (!credential) {
            console.error('Không tìm thấy thông tin xác thực trong phản hồi:', response);
            alert('Không nhận được thông tin xác thực từ Google. Vui lòng thử lại.');
            window.__GOOGLE_LOGIN_IN_PROGRESS = false;
            return;
        }
        
        if (FRONTEND_ONLY) {
            try {
                console.log('🔧 Chế độ FRONTEND_ONLY: Xử lý đăng nhập Google...');
                const parts = credential.split('.');
                const payload = parts[1] ? JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) : {};
                const email = payload.email || '';
                const name = payload.name || (email ? email.split('@')[0] : 'Người dùng');
                const mockUser = { email, name, role: 'user' };
                const mockToken = credential;
                
                console.log('💾 Đang lưu session...');
                await persistSession(mockUser, mockToken);
                console.log('✅ Đã lưu session thành công');
                
                try {
                    showSuccessMessage(`Đăng nhập thành công! Chào mừng ${name}`);
                } catch (msgError) {
                    console.warn('Không thể hiển thị thông báo thành công:', msgError);
                }
                
                console.log('🔄 Chuẩn bị chuyển hướng đến trangchu.html (frontend-only)...');
                console.log('   Current location:', window.location.href);
                console.log('   Target: trangchu.html');
                
                // Reset flag before redirect
                window.__GOOGLE_LOGIN_IN_PROGRESS = false;
                
                // Redirect immediately without delay
                setTimeout(() => {
                    console.log('🔄 Đang thực hiện redirect (frontend-only Google)...');
                    safeRedirect('trangchu.html');
                }, 50);
                return; // Return after setting up redirect
            } catch (e) {
                console.error('❌ Giải mã thông tin xác thực Google thất bại ở chế độ FRONTEND_ONLY:', e);
                alert('Không thể xác thực Google (frontend-only)');
                window.__GOOGLE_LOGIN_IN_PROGRESS = false;
                return;
            }
        }
        
        // Try to use apiRequest from utils.js if available, otherwise use fetch
        if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
            // Use unified apiRequest from utils.js
            console.log('📤 Đang gửi thông tin xác thực Google đến backend API...');
            console.log('   URL API:', `${getApiBase()}/api/auth/google`);
            console.log('   Độ dài credential:', credential.length);
            
            const result = await window.apiRequest('/api/auth/google', {
                method: 'POST',
                body: JSON.stringify({ credential: credential })
            });
            
            console.log('📥 Đã nhận phản hồi từ backend:', result);
            
            if (!result || !result.ok) {
                const errorMsg = result?.data?.message || 'Đăng nhập Google thất bại';
                console.error('❌ Đăng nhập Google thất bại:', errorMsg);
                console.error('   Chi tiết lỗi:', result);
                alert(errorMsg);
                window.__GOOGLE_LOGIN_IN_PROGRESS = false;
                return;
            }
            
            const user = result.data.user || {};
            console.log('✅ Cuộc gọi API đăng nhập Google thành công!');
            console.log('   Dữ liệu người dùng nhận được:', user);
            console.log('   - ID người dùng:', user.id);
            console.log('   - Tên:', user.name);
            console.log('   - Email:', user.email);
            console.log('   - Phương thức đăng nhập:', user.login_method);
            console.log('   - Google ID:', user.google_id);
            
            // Token is now in httpOnly cookie, not in response body
            console.log('🍪 Token được lưu trong httpOnly cookie (không có trong response body)');
            
            // Save user data immediately (don't wait for /api/me)
            // This ensures we have user data even if /api/me fails
            await persistSession(user, null); // Token is in cookie, don't store in localStorage
            console.log('✅ Đã lưu thông tin người dùng cơ bản vào localStorage');
            
            // Load full user profile from /api/me (will use cookie automatically)
            // Wait a bit for cookie to be set properly in browser
            // Wait for it to complete before redirect (like the old code)
            try {
                // Small delay to ensure cookie is set in browser
                await new Promise(resolve => setTimeout(resolve, 200));
                console.log('🔄 Đang tải hồ sơ đầy đủ từ /api/me...');
                const profileResult = await window.apiRequest('/api/me');
                if (profileResult && profileResult.ok && profileResult.data) {
                    // Merge profile data
                    const fullUser = {
                        ...user,
                        ...profileResult.data
                    };
                    // Update localStorage with full profile
                    await persistSession(fullUser, null);
                    console.log('✅ Đã tải và cập nhật hồ sơ đầy đủ từ /api/me');
                } else {
                    console.log('⚠️ Không thể tải hồ sơ đầy đủ, sử dụng thông tin cơ bản');
                }
            } catch (error) {
                console.warn('Không thể tải hồ sơ đầy đủ, sử dụng thông tin người dùng cơ bản:', error);
                // This is OK - we already have user data from login response
            }
            
            // Show success message (don't let errors here block redirect)
            try {
                showSuccessMessage(`Đăng nhập thành công! Chào mừng ${user.name || user.email}`);
            } catch (msgError) {
                console.warn('Không thể hiển thị thông báo thành công:', msgError);
            }
            
            // Reset flag before redirect
            window.__GOOGLE_LOGIN_IN_PROGRESS = false;
            
            // Redirect after loading full profile (like the old code)
            console.log('🔄 Chuẩn bị chuyển hướng đến trangchu.html (apiRequest mode)...');
            console.log('   Flag __GOOGLE_LOGIN_IN_PROGRESS đã được reset');
            
            // Redirect after a short delay to ensure everything is saved
            setTimeout(() => {
                console.log('🔄 Đang thực hiện redirect Google login...');
                safeRedirect('trangchu.html');
            }, 300);
        } else {
            // Fallback to direct fetch if apiRequest is not available
            console.log('Đang gửi thông tin xác thực Google đến backend:', `${getApiBase()}/api/auth/google`);
            const res = await fetch(`${getApiBase()}/api/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: credential })
            });
            
            const data = await res.json().catch((err) => {
                console.error('Không thể phân tích JSON phản hồi:', err);
                return { message: 'Lỗi xử lý phản hồi từ server' };
            });
            
            console.log('Phản hồi backend:', { status: res.status, ok: res.ok, data });
            
            if (!res.ok) {
                const errorMsg = data.message || `Đăng nhập Google thất bại (${res.status})`;
                console.error('Đăng nhập Google thất bại:', errorMsg);
                alert(errorMsg);
                window.__GOOGLE_LOGIN_IN_PROGRESS = false;
                return;
            }
            
            const user = data.user || {};
            // Token is now in httpOnly cookie, not in response body
            console.log('Đăng nhập Google thành công, token được lưu trong httpOnly cookie');
            
            // Save user data immediately (don't wait for /api/me)
            // This ensures we have user data even if /api/me fails
            await persistSession(user, null); // Token is in cookie, don't store in localStorage
            console.log('✅ Đã lưu thông tin người dùng cơ bản vào localStorage');
            
            // Load full user profile from /api/me (will use cookie automatically)
            // Wait a bit for cookie to be set properly in browser
            // Wait for it to complete before redirect (like the old code)
            try {
                if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
                    // Small delay to ensure cookie is set in browser
                    await new Promise(resolve => setTimeout(resolve, 200));
                    console.log('🔄 Đang tải hồ sơ đầy đủ từ /api/me...');
                    const profileResult = await window.apiRequest('/api/me');
                    if (profileResult && profileResult.ok && profileResult.data) {
                        // Merge profile data
                        const fullUser = {
                            ...user,
                            ...profileResult.data
                        };
                        // Update localStorage with full profile
                        await persistSession(fullUser, null);
                        console.log('✅ Đã tải và cập nhật hồ sơ đầy đủ từ /api/me');
                    } else {
                        console.log('⚠️ Không thể tải hồ sơ đầy đủ, sử dụng thông tin cơ bản');
                    }
                } else {
                    console.log('⚠️ apiRequest không khả dụng, sử dụng thông tin cơ bản');
                }
            } catch (error) {
                console.warn('Không thể tải hồ sơ đầy đủ, sử dụng thông tin người dùng cơ bản:', error);
                // This is OK - we already have user data from login response
            }
            
            // Show success message (don't let errors here block redirect)
            try {
                showSuccessMessage(`Đăng nhập thành công! Chào mừng ${user.name || user.email}`);
            } catch (msgError) {
                console.warn('Không thể hiển thị thông báo thành công:', msgError);
            }
            
            // Reset flag before redirect
            window.__GOOGLE_LOGIN_IN_PROGRESS = false;
            
            // Redirect after loading full profile (like the old code)
            console.log('🔄 Chuẩn bị chuyển hướng đến trangchu.html (fallback fetch mode)...');
            console.log('   Flag __GOOGLE_LOGIN_IN_PROGRESS đã được reset');
            
            // Redirect after a short delay to ensure everything is saved
            setTimeout(() => {
                console.log('🔄 Đang thực hiện redirect Google login (fallback)...');
                safeRedirect('trangchu.html');
            }, 300);
        }
    } catch (error) {
        console.error('Lỗi đăng nhập Google:', error);
        console.error('Chi tiết lỗi:', {
            message: error.message,
            stack: error.stack,
            response: response
        });
        alert('Không thể xác thực Google. Vui lòng kiểm tra console để biết thêm chi tiết.');
        window.__GOOGLE_LOGIN_IN_PROGRESS = false;
    } finally {
        // Release the in-progress guard after navigation starts (if not already reset)
        // Only reset if redirect hasn't happened (no navigation after 3 seconds)
        setTimeout(() => { 
            if (window.__GOOGLE_LOGIN_IN_PROGRESS) {
                console.log('⚠️ Reset Google login flag sau timeout');
                window.__GOOGLE_LOGIN_IN_PROGRESS = false;
            }
        }, 3000);
    }
    };
}
