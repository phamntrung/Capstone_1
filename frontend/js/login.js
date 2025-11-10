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
    // Note: This will be loaded on the next page (trangchu.html), so we don't delay redirect
    // The data loading will happen in parallel with page navigation for better performance
    if (typeof window !== 'undefined' && window.dataManager && typeof window.dataManager.loadFromAPI === 'function') {
        console.log('🔄 Dữ liệu sẽ được tải trên trang chủ để không làm chậm redirect...');
        // Don't delay redirect - let the next page load the data
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
            console.log('🔄 Đang thực hiện redirect (frontend-only)...');
            safeRedirect('trangchu.html');
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

            // Kiểm tra xem có cần 2FA không
            if (result.data.requires2FA) {
                console.log('🔐 User đã bật 2FA, cần nhập mã 2FA');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Đăng nhập';
                }
                // Hiển thị modal nhập mã 2FA
                show2FAModal(result.data.email);
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
            // Redirect immediately for better performance
            safeRedirect('trangchu.html');
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

            // Kiểm tra xem có cần 2FA không
            if (data.requires2FA) {
                console.log('🔐 User đã bật 2FA, cần nhập mã 2FA');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Đăng nhập';
                }
                // Hiển thị modal nhập mã 2FA
                show2FAModal(data.email);
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
            // Redirect immediately for better performance
            safeRedirect('trangchu.html');
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

// Check if already logged in - với verify từ server để tránh vòng lặp
async function checkExistingLogin() {
    // Tránh check nhiều lần cùng lúc
    if (window.__CHECKING_EXISTING_LOGIN) {
        console.log('⏭️ Đang kiểm tra login, bỏ qua request mới');
        return;
    }

    window.__CHECKING_EXISTING_LOGIN = true;

    try {
        const token = localStorage.getItem('smartexpense_token');
        const user = localStorage.getItem('smartexpense_user');

        // Nếu không có cả token và user, không làm gì
        if (!token && !user) {
            window.__CHECKING_EXISTING_LOGIN = false;
            return;
        }

        // Kiểm tra xem có đang ở trang login không
        const isLoginPage = window.location.pathname.includes('login.html') ||
            window.location.href.includes('login.html');
        if (!isLoginPage) {
            console.log('⏭️ Không ở trang login, bỏ qua check');
            window.__CHECKING_EXISTING_LOGIN = false;
            return;
        }

        // Verify với server trước khi redirect (tránh vòng lặp)
        if (typeof window.apiRequest === 'function') {
            try {
                console.log('🔍 Đang verify session với server...');
                const verifyResult = await window.apiRequest('/api/me', {
                    method: 'GET'
                });

                if (verifyResult && verifyResult.ok && verifyResult.data && verifyResult.data.user) {
                    // Session hợp lệ, có thể redirect
                    const userData = verifyResult.data.user;
                    console.log('✅ Session hợp lệ, người dùng đã đăng nhập:', userData.name || userData.email);

                    // Cập nhật localStorage với dữ liệu từ server
                    localStorage.setItem('smartexpense_user', JSON.stringify(userData));

                    // Kiểm tra lại xem có đang redirect không
                    if (window.__REDIRECT_IN_PROGRESS) {
                        console.log('⏭️ Đang trong quá trình redirect, bỏ qua');
                        window.__CHECKING_EXISTING_LOGIN = false;
                        return;
                    }

                    console.log('🔄 Đang chuyển hướng người dùng đã xác thực đến trang chủ...');
                    safeRedirect('trangchu.html');
                } else {
                    // Session không hợp lệ, xóa localStorage
                    console.warn('⚠️ Session không hợp lệ, xóa localStorage');
                    localStorage.removeItem('smartexpense_user');
                    localStorage.removeItem('smartexpense_token');
                }
            } catch (error) {
                console.error('❌ Lỗi khi verify session:', error);
                // Nếu lỗi kết nối, không redirect (tránh vòng lặp)
                // Chỉ redirect nếu chắc chắn session hợp lệ
            }
        } else {
            // Fallback: chỉ redirect nếu có cả token và user (không verify)
            // Nhưng chỉ khi apiRequest chưa được load
            if (token && user) {
                try {
                    const userData = JSON.parse(user);
                    console.log('⚠️ apiRequest chưa sẵn sàng, sử dụng fallback check');
                    console.log('🔄 Đang chuyển hướng người dùng đã xác thực đến trang chủ...');
                    safeRedirect('trangchu.html');
                } catch (error) {
                    console.error('Dữ liệu người dùng không hợp lệ, đang xóa localStorage');
                    localStorage.removeItem('smartexpense_user');
                    localStorage.removeItem('smartexpense_token');
                }
            }
        }
    } finally {
        // Reset flag sau 2 giây
        setTimeout(() => {
            window.__CHECKING_EXISTING_LOGIN = false;
        }, 2000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM đã tải xong - Đang khởi tạo hệ thống đăng nhập...');
    // Delay check để đảm bảo apiRequest đã được load
    setTimeout(() => {
        checkExistingLogin();
    }, 500);
    initSimpleLogin();
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('DOM đã sẵn sàng - Đang khởi tạo đăng nhập ngay lập tức...');
    // Delay check để đảm bảo apiRequest đã được load
    setTimeout(() => {
        checkExistingLogin();
        initSimpleLogin();
    }, 500);
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
                        <a href="debug-google-oauth.html" target="_blank" style="color:#0066ff;font-weight:700;text-decoration:none;">🔍 Debug Google OAuth - Kiểm tra Origin chi tiết</a><br>
                        <a href="check-origin.html" target="_blank" style="color:#0066ff;font-weight:700;text-decoration:none;margin-top:4px;display:inline-block;">📋 Hướng dẫn thêm Origin vào Google Console</a>
                    </div>
                `;
                warningDiv.classList.add('show');
            } else {
                // DOM not ready yet, wait for it and try again
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', function () {
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
        console.warn = function (...args) {
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
        window.addEventListener('error', function (e) {
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
        console.log = function (...args) {
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
        window.fetch = function (...args) {
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
        const initGoogleSDK = function () {
            if (loadHandlerAdded) return;
            loadHandlerAdded = true;

            // Check after a delay to see if Google SDK loaded successfully
            let checkTimeout = null;
            checkTimeout = setTimeout(function () {
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
                    console.log('🔄 Đang thực hiện redirect (frontend-only Google)...');
                    safeRedirect('trangchu.html');
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
                const token = result.data.token; // Backend-node trả về token trong body

                console.log('✅ Cuộc gọi API đăng nhập Google thành công!');
                console.log('   Dữ liệu người dùng nhận được:', user);
                console.log('   - ID người dùng:', user.id);
                console.log('   - Tên:', user.name);
                console.log('   - Email:', user.email);
                console.log('   - Phương thức đăng nhập:', user.login_method);
                console.log('   - Google ID:', user.google_id);
                console.log('   - Token received:', !!token);

                // Backend-node set cookie VÀ trả về token trong body
                // Lưu token vào localStorage để backward compatibility
                // Cookie sẽ được dùng tự động bởi browser
                await persistSession(user, token); // Lưu cả user và token
                console.log('✅ Đã lưu thông tin người dùng và token vào localStorage');

                // Load full user profile from /api/me (will use cookie automatically)
                // Don't wait - redirect immediately and let the next page load full profile
                // This improves perceived performance
                console.log('🔄 Hồ sơ đầy đủ sẽ được tải trên trang chủ để không làm chậm redirect...');

                // Show success message (don't let errors here block redirect)
                try {
                    showSuccessMessage(`Đăng nhập thành công! Chào mừng ${user.name || user.email}`);
                } catch (msgError) {
                    console.warn('Không thể hiển thị thông báo thành công:', msgError);
                }

                // Reset flag before redirect
                window.__GOOGLE_LOGIN_IN_PROGRESS = false;

                // Redirect immediately after loading full profile
                console.log('🔄 Chuẩn bị chuyển hướng đến trangchu.html (apiRequest mode)...');
                console.log('   Flag __GOOGLE_LOGIN_IN_PROGRESS đã được reset');

                // Redirect immediately for better performance
                console.log('🔄 Đang thực hiện redirect Google login...');
                safeRedirect('trangchu.html');
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
                // Don't wait - redirect immediately and let the next page load full profile
                // This improves perceived performance
                console.log('🔄 Hồ sơ đầy đủ sẽ được tải trên trang chủ để không làm chậm redirect...');

                // Show success message (don't let errors here block redirect)
                try {
                    showSuccessMessage(`Đăng nhập thành công! Chào mừng ${user.name || user.email}`);
                } catch (msgError) {
                    console.warn('Không thể hiển thị thông báo thành công:', msgError);
                }

                // Reset flag before redirect
                window.__GOOGLE_LOGIN_IN_PROGRESS = false;

                // Redirect immediately after loading full profile
                console.log('🔄 Chuẩn bị chuyển hướng đến trangchu.html (fallback fetch mode)...');
                console.log('   Flag __GOOGLE_LOGIN_IN_PROGRESS đã được reset');

                // Redirect immediately for better performance
                console.log('🔄 Đang thực hiện redirect Google login (fallback)...');
                safeRedirect('trangchu.html');
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

    // Show 2FA modal để nhập mã 2FA
    function show2FAModal(email) {
        // Tạo modal overlay
        const overlay = document.createElement('div');
        overlay.id = '2fa-modal-overlay';
        overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    `;

        // Tạo modal content
        const modal = document.createElement('div');
        modal.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 28px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        animation: slideUp 0.3s ease;
    `;

        modal.innerHTML = `
        <h2 style="margin: 0 0 12px; font-size: 22px; color: #111827;">Xác thực hai lớp</h2>
        <p style="margin: 0 0 20px; color: #64748b; font-size: 14px;">
            Tài khoản của bạn đã bật xác thực hai lớp. Vui lòng nhập mã 6 số từ ứng dụng Authenticator.
        </p>
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #111827;">
                Mã xác thực (6 số)
            </label>
            <input
                type="text"
                id="2fa-code-input"
                placeholder="000000"
                maxlength="6"
                pattern="[0-9]{6}"
                style="
                    width: 100%;
                    height: 44px;
                    padding: 0 14px;
                    border: 1px solid #cfd8e3;
                    border-radius: 10px;
                    font-size: 18px;
                    text-align: center;
                    letter-spacing: 8px;
                    font-weight: 600;
                    box-sizing: border-box;
                "
                autocomplete="one-time-code"
            />
            <p id="2fa-error-message" style="margin: 8px 0 0; color: #ef4444; font-size: 13px; display: none;"></p>
        </div>
        <div style="display: flex; gap: 10px;">
            <button
                id="2fa-cancel-btn"
                style="
                    flex: 1;
                    height: 44px;
                    border: 1px solid #cfd8e3;
                    background: white;
                    color: #111827;
                    border-radius: 10px;
                    font-weight: 600;
                    cursor: pointer;
                "
            >
                Hủy
            </button>
            <button
                id="2fa-verify-btn"
                style="
                    flex: 1;
                    height: 44px;
                    border: 0;
                    background: #0066ff;
                    color: white;
                    border-radius: 10px;
                    font-weight: 600;
                    cursor: pointer;
                    opacity: 0.6;
                "
                disabled
            >
                Xác thực
            </button>
        </div>
    `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Focus vào input
        const codeInput = document.getElementById('2fa-code-input');
        const verifyBtn = document.getElementById('2fa-verify-btn');
        const cancelBtn = document.getElementById('2fa-cancel-btn');
        const errorMessage = document.getElementById('2fa-error-message');

        codeInput.focus();

        // Chỉ cho phép nhập số
        codeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
            errorMessage.style.display = 'none';

            // Enable verify button khi đủ 6 số
            if (e.target.value.length === 6) {
                verifyBtn.disabled = false;
                verifyBtn.style.opacity = '1';
            } else {
                verifyBtn.disabled = true;
                verifyBtn.style.opacity = '0.6';
            }
        });

        // Enter key để verify
        codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && codeInput.value.length === 6) {
                verify2FACode(email, codeInput.value, verifyBtn, errorMessage, overlay);
            }
        });

        // Verify button click
        verifyBtn.addEventListener('click', () => {
            if (codeInput.value.length === 6) {
                verify2FACode(email, codeInput.value, verifyBtn, errorMessage, overlay);
            }
        });

        // Cancel button click
        cancelBtn.addEventListener('click', () => {
            overlay.remove();
        });

        // Click outside để đóng
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    // Verify 2FA code
    async function verify2FACode(email, code, verifyBtn, errorMessage, overlay) {
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Đang xác thực...';
        errorMessage.style.display = 'none';

        try {
            const result = await window.apiRequest('/api/auth/verify-2fa', {
                method: 'POST',
                body: JSON.stringify({ email, code })
            });

            if (result && result.ok && result.data && result.data.token) {
                console.log('✅ 2FA verify thành công');

                // Lưu token và user
                const user = result.data.user || {};
                const token = result.data.token;

                await persistSession(user, token);
                console.log('✅ Đã lưu session sau khi verify 2FA');

                // Đóng modal
                overlay.remove();

                // Hiển thị thông báo thành công
                showSuccessMessage(`Đăng nhập thành công! Chào mừng ${user.name || user.email}`);

                // Redirect đến trang chủ
                setTimeout(() => {
                    safeRedirect('trangchu.html');
                }, 500);
            } else {
                // Lỗi verify
                const errorMsg = result.data?.message || 'Mã xác thực không đúng. Vui lòng thử lại.';
                errorMessage.textContent = errorMsg;
                errorMessage.style.display = 'block';
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Xác thực';

                // Clear input và focus lại
                document.getElementById('2fa-code-input').value = '';
                document.getElementById('2fa-code-input').focus();
            }
        } catch (error) {
            console.error('Lỗi verify 2FA:', error);
            errorMessage.textContent = 'Đã xảy ra lỗi. Vui lòng thử lại.';
            errorMessage.style.display = 'block';
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Xác thực';
        }
    }
}
