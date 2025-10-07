/**
 * Unified Login Manager - Externalized from login.html
 * Đã được rà soát và thống nhất logic authentication
 */

// Backend API base URL (override by setting window.SMARTEXPENSE_API)
const API_BASE = window.SMARTEXPENSE_API || 'http://127.0.0.1:5000';
// Frontend-only demo mode: set window.FRONTEND_ONLY = true to bypass backend
const FRONTEND_ONLY = window.FRONTEND_ONLY === true;

// Simple login manager
function initSimpleLogin() {
    console.log('Initializing integrated login...');
    const form = document.getElementById('loginForm');
    if (!form) {
        console.error('Login form not found');
        return;
    }
    form.addEventListener('submit', handleLogin);
}

function persistSession(user, token) {
    const userData = {
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        token: token,
        loginTime: new Date().toISOString()
    };

    localStorage.setItem('smartexpense_user', JSON.stringify(userData));
    localStorage.setItem('smartexpense_token', token);
}

async function handleLogin(event) {
    console.log('handleLogin called');
    event.preventDefault();

    const form = event.target;
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitBtn = form.querySelector('button[type="submit"]');

    console.log('Form elements found:', {
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
        // Call backend API
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            alert(data.message || 'Đăng nhập thất bại');
            return;
        }

        const user = data.user || {};
        const token = data.token;
        if (!token) {
            alert('Không nhận được token xác thực');
            return;
        }

        persistSession(user, token);

        showSuccessMessage(`Đăng nhập thành công! Chào mừng ${user.name || user.email}`);

        setTimeout(() => {
            console.log('Redirecting to dashboard...');
            try {
                window.location.href = 'trangchu.html';
            } catch (error) {
                console.error('Redirect failed:', error);
                document.body.innerHTML += `
                        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                                    background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
                                    text-align: center; z-index: 10000;">
                            <p>Đăng nhập thành công!</p>
                            <a href="trangchu.html" style="background: #0066ff; color: white; padding: 10px 20px; 
                               text-decoration: none; border-radius: 6px;">Vào trang chủ</a>
                        </div>
                    `;
            }
        }, 800);
    } catch (error) {
        console.error('Login error:', error);
        alert('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
        if (submitBtn) {
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
            console.log('User already logged in:', userData.name);
            console.log('Redirecting authenticated user to dashboard...');
            window.location.href = 'trangchu.html';
        } catch (error) {
            console.error('Invalid user data, clearing localStorage');
            localStorage.removeItem('smartexpense_user');
            localStorage.removeItem('smartexpense_token');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - Initializing integrated login...');
    checkExistingLogin();
    initSimpleLogin();
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('DOM already ready - Initializing login immediately...');
    setTimeout(() => {
        checkExistingLogin();
        initSimpleLogin();
    }, 100);
}

console.log('Externalized login script loaded');


// Google One Tap / Button callback handler (exposed globally)
window.onGoogleCredential = async function onGoogleCredential(response) {
    try {
        if (FRONTEND_ONLY) {
            try {
                const parts = (response && response.credential ? response.credential : '').split('.');
                const payload = parts[1] ? JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) : {};
                const email = payload.email || '';
                const name = payload.name || (email ? email.split('@')[0] : 'Người dùng');
                const mockUser = { email, name, role: 'user' };
                const mockToken = response && response.credential ? response.credential : 'demo-google-token';
                persistSession(mockUser, mockToken);
                showSuccessMessage(`Đăng nhập thành công! Chào mừng ${name}`);
                setTimeout(() => { window.location.href = 'trangchu.html'; }, 600);
                return;
            } catch (e) {
                console.warn('Decode Google credential failed in FRONTEND_ONLY mode:', e);
                alert('Không thể xác thực Google (frontend-only)');
                return;
            }
        }
        const res = await fetch(`${API_BASE}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response && response.credential })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            alert(data.message || 'Đăng nhập Google thất bại');
            return;
        }
        const user = data.user || {};
        const token = data.token;
        if (!token) {
            alert('Không nhận được token từ Google');
            return;
        }
        persistSession(user, token);
        showSuccessMessage(`Đăng nhập thành công! Chào mừng ${user.name || user.email}`);
        setTimeout(() => { window.location.href = 'trangchu.html'; }, 700);
    } catch (error) {
        console.error('Google login error:', error);
        alert('Không thể xác thực Google');
    }
};

