/**
 * Unified Login Manager - Externalized from login.html
 * Đã được rà soát và thống nhất logic authentication
 */

// Frontend-only demo mode: set window.FRONTEND_ONLY = true to bypass backend
const FRONTEND_ONLY = window.FRONTEND_ONLY === true;

// API_BASE is defined in utils.js (loaded before this file) and exposed via window.API_BASE
// Use it directly via window.API_BASE, or access via the global constant if available
const getApiBase = () => window.API_BASE || window.SMARTEXPENSE_API || 'http://127.0.0.1:5000';

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
                userData = {
                    ...userData,
                    balance: profileResult.data.balance || userData.balance || 0,
                    gender: profileResult.data.gender || userData.gender || null,
                    currency: profileResult.data.currency || userData.currency || 'VND',
                    phone: profileResult.data.phone || userData.phone || null,
                    monthly_budget: profileResult.data.balance || userData.monthly_budget || 0
                };
                console.log('✅ Đã tải đầy đủ hồ sơ từ database:', userData);
            }
        } catch (error) {
            console.warn('Không thể tải thông tin hồ sơ từ API, sử dụng dữ liệu người dùng được cung cấp:', error);
        }
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
            showSuccessMessage(`Đăng nhập thành công! Chào mừng ${mockUser.name}`);
            setTimeout(() => { window.location.href = 'trangchu.html'; }, 500);
            return;
        }

        // Try to use apiRequest from utils.js if available, otherwise use fetch
        let result;
        if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
            // Use unified apiRequest from utils.js
            console.log('Đang sử dụng apiRequest để đăng nhập...');
            // Lấy public IP từ client để gửi lên server
            let clientIP = null;
            try {
              const ipResponse = await fetch('https://api.ipify.org?format=json');
              const ipData = await ipResponse.json();
              clientIP = ipData.ip || null;
            } catch (ipError) {
              // Fallback: thử ip-api.com
              try {
                const ipResponse = await fetch('http://ip-api.com/json/?fields=query');
                const ipData = await ipResponse.json();
                clientIP = ipData.query || null;
              } catch (e) {
                // Không lấy được IP, để server tự detect
              }
            }

            const requestData = { email, password, clientIP };
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

            // Kiểm tra nếu cần 2FA
            if (result && result.ok && result.data && result.data.requires2FA) {
                // Ẩn form login, hiển thị form 2FA
                const loginForm = document.getElementById('loginForm');
                const twoFAForm = document.getElementById('twoFAForm');
                const twoFACodeInput = document.getElementById('twoFACode');

                if (loginForm) loginForm.style.display = 'none';
                if (twoFAForm) {
                    twoFAForm.style.display = 'block';
                    if (twoFACodeInput) {
                        twoFACodeInput.focus();
                        // Chỉ cho phép nhập số
                        twoFACodeInput.addEventListener('input', (e) => {
                            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        });
                    }
                }

                // Reset button state
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Đăng nhập';
                }

                // Xử lý submit form 2FA
                let twoFAHandled = false;
                const handle2FA = async (code) => {
                    if (twoFAHandled) return;
                    twoFAHandled = true;

                    // Loại bỏ khoảng trắng và chỉ lấy số
                    const cleanCode = code.replace(/\s+/g, '').replace(/\D/g, '');

                    console.log('🔐 2FA code input:', { original: code, cleaned: cleanCode });

                    if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
                        alert('Vui lòng nhập mã 6 số hợp lệ');
                        twoFAHandled = false;
                        return;
                    }

                    const verifyBtn = twoFAForm?.querySelector('button[type="submit"]');
                    if (verifyBtn) {
                        verifyBtn.disabled = true;
                        verifyBtn.textContent = 'Đang xác thực...';
                    }

                    try {
                        console.log('🔐 Sending 2FA verify request:', { email, code: cleanCode });

                        // Gọi API verify 2FA
                        const verifyResult = await window.apiRequest('/api/auth/verify-2fa', {
                            method: 'POST',
                            body: JSON.stringify({
                                email: email,
                                code: cleanCode,
                                clientIP: clientIP
                            })
                        });

                        console.log('🔐 2FA verify response:', verifyResult);

                        if (!verifyResult || !verifyResult.ok) {
                            const errorMsg = verifyResult?.data?.message || 'Mã 2FA không đúng';
                            alert(errorMsg);
                            if (verifyBtn) {
                                verifyBtn.disabled = false;
                                verifyBtn.textContent = 'Xác thực';
                            }
                            twoFAHandled = false;
                            if (twoFACodeInput) twoFACodeInput.value = '';
                            return;
                        }

                        // Verify thành công, lưu token và redirect
                        const user = verifyResult.data.user || {};
                        const token = verifyResult.data.token;

                        if (token && user.id) {
                            await persistSession(user, token);
                            showSuccessMessage(`Đăng nhập thành công! Chào mừng ${user.name || user.email}`);
                            setTimeout(() => {
                                window.location.href = 'trangchu.html';
                            }, 500);
                        } else {
                            alert('Không nhận được token xác thực. Vui lòng thử lại.');
                            twoFAHandled = false;
                        }
                    } catch (error) {
                        console.error('2FA verify error:', error);
                        alert('Lỗi kết nối đến server');
                        twoFAHandled = false;
                        if (verifyBtn) {
                            verifyBtn.disabled = false;
                            verifyBtn.textContent = 'Xác thực';
                        }
                    }
                };

                // Event listener cho form 2FA
                if (twoFAForm) {
                    twoFAForm.onsubmit = (e) => {
                        e.preventDefault();
                        const code = twoFACodeInput?.value.trim();
                        console.log('🔐 Form 2FA submitted with code:', code);
                        handle2FA(code);
                    };
                }

                // Event listener cho nút Hủy
                const cancelBtn = document.getElementById('cancel2FA');
                if (cancelBtn) {
                    cancelBtn.onclick = () => {
                        if (loginForm) loginForm.style.display = 'block';
                        if (twoFAForm) twoFAForm.style.display = 'none';
                        if (twoFACodeInput) twoFACodeInput.value = '';
                        twoFAHandled = false;
                    };
                }

                return; // Dừng xử lý login bình thường
            }

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
            showSuccessMessage(`Đăng nhập thành công! Chào mừng ${user.name || user.email}`);

            // Điều hướng đến trang chủ sau 0.5 giây
            isRedirecting = true; // Mark that redirect is starting
            setTimeout(() => {
                console.log('Đang chuyển hướng đến trangchu.html...');
                try {
                    window.location.href = 'trangchu.html';
                } catch (redirectError) {
                    console.error('Lỗi điều hướng:', redirectError);
                    window.location.replace('trangchu.html');
                }
            }, 500);
        } else {
            // Fallback to direct fetch if apiRequest is not available
            console.log('Đang sử dụng fetch trực tiếp để đăng nhập...');
            // Lấy public IP từ client
            let clientIP = null;
            try {
              const ipResponse = await fetch('https://api.ipify.org?format=json');
              const ipData = await ipResponse.json();
              clientIP = ipData.ip || null;
            } catch (ipError) {
              try {
                const ipResponse = await fetch('http://ip-api.com/json/?fields=query');
                const ipData = await ipResponse.json();
                clientIP = ipData.query || null;
              } catch (e) {
                // Không lấy được IP
              }
            }

            const res = await fetch(`${getApiBase()}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, clientIP })
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

            showSuccessMessage(`Đăng nhập thành công! Chào mừng ${user.name || user.email}`);

            // Điều hướng đến trang chủ sau 0.5 giây
            isRedirecting = true; // Mark that redirect is starting
            setTimeout(() => {
                console.log('Đang chuyển hướng đến trangchu.html...');
                try {
                    window.location.href = 'trangchu.html';
                } catch (redirectError) {
                    console.error('Lỗi điều hướng:', redirectError);
                    window.location.replace('trangchu.html');
                }
            }, 500);
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
if (typeof window !== 'undefined') {
    const currentOrigin = window.location.origin;
    console.log('📍 Origin hiện tại cho Google OAuth:', currentOrigin);
    console.log('💡 Nếu bạn thấy lỗi "[GSI_LOGGER]: The given origin is not allowed",');
    console.log('   hãy thêm origin này vào Google Console:', currentOrigin);
    console.log('   Liên kết: https://console.cloud.google.com/apis/credentials');
}

// Ensure Google callback is available when SDK loads
// Initialize Google Sign-In when SDK is ready
if (typeof window !== 'undefined') {
    // Wait for Google SDK to load
    window.addEventListener('load', function() {
        if (typeof window.google !== 'undefined' && typeof window.google.accounts !== 'undefined') {
            console.log('Google Sign-In SDK đã được tải, callback đã sẵn sàng');
        } else {
            console.warn('⚠️ Google Sign-In SDK chưa được tải. Kiểm tra xem origin đã được ủy quyền trong Google Console chưa.');
            console.warn('   Origin hiện tại:', window.location.origin);
        }
    });
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
            return;
        }

        if (FRONTEND_ONLY) {
            try {
                const parts = credential.split('.');
                const payload = parts[1] ? JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) : {};
                const email = payload.email || '';
                const name = payload.name || (email ? email.split('@')[0] : 'Người dùng');
                const mockUser = { email, name, role: 'user' };
                const mockToken = credential;
                await persistSession(mockUser, mockToken);
                showSuccessMessage(`Đăng nhập thành công! Chào mừng ${name}`);
            setTimeout(() => {
                    console.log('Chế độ frontend-only: Đang chuyển hướng đến trangchu.html');
                    window.location.href = 'trangchu.html';
                }, 600);
                return;
            } catch (e) {
                console.warn('Giải mã thông tin xác thực Google thất bại ở chế độ FRONTEND_ONLY:', e);
                alert('Không thể xác thực Google (frontend-only)');
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
            // But we still need to load full profile for localStorage
            console.log('🍪 Token được lưu trong httpOnly cookie (không có trong response body)');

            // Load full user profile from /api/me (will use cookie automatically)
            try {
                const profileResult = await window.apiRequest('/api/me');
                if (profileResult && profileResult.ok && profileResult.data) {
                    // Merge profile data
                    const fullUser = {
                        ...user,
                        ...profileResult.data
                    };
                    await persistSession(fullUser, null); // Token is in cookie, don't store in localStorage
                } else {
                    await persistSession(user, null); // Fallback to basic user info
                }
            } catch (error) {
                console.warn('Không thể tải hồ sơ, sử dụng thông tin người dùng cơ bản:', error);
                await persistSession(user, null);
            }
            showSuccessMessage(`Đăng nhập thành công! Chào mừng ${user.name || user.email}`);

            setTimeout(() => {
                console.log('Đang chuyển hướng đến trangchu.html sau khi đăng nhập Google...');
                try {
                    window.location.href = 'trangchu.html';
                } catch (redirectError) {
                    console.error('Lỗi điều hướng:', redirectError);
                    window.location.replace('trangchu.html');
                }
            }, 700);
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
                return;
            }

            const user = data.user || {};
            // Token is now in httpOnly cookie, not in response body
            console.log('Đăng nhập Google thành công, token được lưu trong httpOnly cookie');

            // Load full user profile from /api/me (will use cookie automatically)
            try {
                const profileResult = await window.apiRequest('/api/me');
                if (profileResult && profileResult.ok && profileResult.data) {
                    // Merge profile data
                    const fullUser = {
                        ...user,
                        ...profileResult.data
                    };
                    await persistSession(fullUser, null); // Token is in cookie, don't store in localStorage
                } else {
                    await persistSession(user, null); // Fallback to basic user info
                }
            } catch (error) {
                console.warn('Không thể tải hồ sơ, sử dụng thông tin người dùng cơ bản:', error);
                await persistSession(user, null);
            }
            showSuccessMessage(`Đăng nhập thành công! Chào mừng ${user.name || user.email}`);

            setTimeout(() => {
                console.log('Đang chuyển hướng đến trangchu.html sau khi đăng nhập Google...');
                try {
                    window.location.href = 'trangchu.html';
                } catch (redirectError) {
                    console.error('Lỗi điều hướng:', redirectError);
                    window.location.replace('trangchu.html');
                }
            }, 700);
        }
    } catch (error) {
        console.error('Lỗi đăng nhập Google:', error);
        console.error('Chi tiết lỗi:', {
            message: error.message,
            stack: error.stack,
            response: response
        });
        alert('Không thể xác thực Google. Vui lòng kiểm tra console để biết thêm chi tiết.');
    } finally {
        // Release the in-progress guard after navigation starts
        setTimeout(() => { window.__GOOGLE_LOGIN_IN_PROGRESS = false; }, 2000);
    }
    };
}
