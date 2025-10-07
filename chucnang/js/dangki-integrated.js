/**
 * Integrated Signup Manager - Externalized from dangki.html
 * Tự động đăng nhập sau khi đăng ký thành công (giữ nguyên hành vi cũ)
 */

// Backend API base URL (override by setting window.SMARTEXPENSE_API)
const API_BASE = window.SMARTEXPENSE_API || 'http://127.0.0.1:5000';
// Frontend-only demo mode: set window.FRONTEND_ONLY = true to bypass backend
const FRONTEND_ONLY = window.FRONTEND_ONLY === true;

// Google Identity Services (GSI) will call window.onGoogleCredential defined below

function initSimpleSignup() {
  console.log('Initializing integrated signup...');

  const form = document.getElementById('signupForm');
  if (!form) {
    console.error('Signup form not found');
    return;
  }

  form.addEventListener('submit', handleSignup);

  // Google button is rendered by GSI via HTML markup. Callback handled in window.onGoogleCredential.
}

async function handleSignup(event) {
  event.preventDefault();

  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm');
  const submitBtn = document.querySelector('.submit');
  const msgDiv = document.getElementById('msg');

  if (!nameInput || !emailInput || !passwordInput || !confirmInput) {
    showMessage('Không tìm thấy input fields', false);
    return;
  }

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmInput.value;

  if (!name) { showMessage('Vui lòng nhập tên'); nameInput.focus(); return; }
  if (name.length < 2) { showMessage('Tên phải có ít nhất 2 ký tự'); nameInput.focus(); return; }
  if (!email) { showMessage('Vui lòng nhập email'); emailInput.focus(); return; }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) { showMessage('Email không hợp lệ'); emailInput.focus(); return; }
  if (!password) { showMessage('Vui lòng nhập mật khẩu'); passwordInput.focus(); return; }
  if (password.length < 6) { showMessage('Mật khẩu phải có ít nhất 6 ký tự'); passwordInput.focus(); return; }
  if (password !== confirmPassword) { showMessage('Xác nhận mật khẩu không khớp'); confirmInput.focus(); return; }

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang đăng ký...'; }

  try {
    if (FRONTEND_ONLY) {
      showMessage('✅ Đăng ký thành công! Vui lòng đăng nhập.', true);
      nameInput.value = '';
      emailInput.value = '';
      passwordInput.value = '';
      confirmInput.value = '';
      setTimeout(() => { window.location.href = 'login.html'; }, 600);
      return;
    }

    // Call backend API to register
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showMessage(data.message || 'Đăng ký thất bại. Vui lòng thử lại.');
      return;
    }

    // Đăng ký thành công: không tự đăng nhập, chuyển sang trang đăng nhập
    showMessage('✅ Đăng ký thành công! Vui lòng đăng nhập.', true);

    // Clear form
    nameInput.value = '';
    emailInput.value = '';
    passwordInput.value = '';
    confirmInput.value = '';

    setTimeout(() => { window.location.href = 'login.html'; }, 900);

  } catch (error) {
    console.error('Signup error:', error);
    showMessage('❌ Đã xảy ra lỗi. Vui lòng thử lại.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Đăng ký';
    }
  }
}

function persistSession(user, token) {
  localStorage.setItem('smartexpense_user', JSON.stringify({
    email: user.email,
    name: user.name,
    role: user.role || 'user',
    token: token,
    registeredAt: new Date().toISOString()
  }));
  if (token) localStorage.setItem('smartexpense_token', token);
}

function showMessage(text, isSuccess = false) {
  const msgDiv = document.getElementById('msg');
  if (!msgDiv) { alert(text); return; }
  msgDiv.textContent = text;
  msgDiv.style.color = isSuccess ? '#16a34a' : '#ef4444';
  msgDiv.style.fontWeight = isSuccess ? '600' : '400';
  if (isSuccess) {
    setTimeout(() => { /* keep success message until redirect */ }, 8000);
  } else {
    setTimeout(() => { msgDiv.textContent = ''; }, 5000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSimpleSignup);
} else {
  initSimpleSignup();
}

console.log('Externalized signup script loaded');


// Google One Tap / Button callback for signup/login via Google ID token
window.onGoogleCredential = async function onGoogleCredential(response) {
  try {
    if (FRONTEND_ONLY) {
      try {
        const parts = (response && response.credential ? response.credential : '').split('.');
        const payload = parts[1] ? JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) : {};
        const email = payload.email || '';
        const name = payload.name || (email ? email.split('@')[0] : 'Người dùng');
        persistSession({ email, name, role: 'user' }, response && response.credential ? response.credential : 'demo-google-token');
        showMessage('✅ Đăng nhập Google thành công!', true);
        setTimeout(() => { window.location.href = 'trangchu.html'; }, 700);
        return;
      } catch (e) {
        console.warn('Decode Google credential failed in FRONTEND_ONLY mode:', e);
        showMessage('Không thể xác thực Google (frontend-only)');
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
      showMessage(data.message || 'Đăng nhập Google thất bại. Vui lòng thử lại.');
      return;
    }
    const user = data.user || {};
    const token = data.token;
    if (!token) {
      showMessage('Không nhận được token từ Google');
      return;
    }
    persistSession(user, token);
    showMessage('✅ Đăng nhập Google thành công!', true);
    setTimeout(() => { window.location.href = 'trangchu.html'; }, 900);
  } catch (err) {
    console.error('Google sign-in error:', err);
    showMessage('❌ Đăng nhập Google thất bại. Vui lòng thử lại.');
  }
};

