/**
 * Authentication JavaScript
 * Xử lý đăng nhập và Google OAuth
 */

// Load utilities first
// (utils.js should be loaded before this file)

// Validate login form
function validateLoginForm(email, password) {
  if (!email || !password) {
    showMessage('Vui lòng điền đầy đủ thông tin');
    return false;
  }
  return true;
}

// Handle login form submission
async function handleLogin(event) {
  event.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  
  if (!validateLoginForm(email, password)) {
    return;
  }
  
  const result = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: email,
      password: password
    })
  });
  
  if (result && result.ok) {
    // Store user data and token
    localStorage.setItem('smartexpense_user', JSON.stringify(result.data.user));
    localStorage.setItem('smartexpense_token', result.data.token);
    
    showMessage('✅ Đăng nhập thành công! Đang chuyển hướng đến trang chủ...', true);
    setTimeout(() => {
      window.location.href = 'trangchu.html';
    }, 2000);
  } else {
    showMessage(result?.data?.message || 'Đăng nhập thất bại');
  }
}

// Handle Google OAuth callback
async function handleGoogleCredentialLogin(response) {
  console.log('Google credential received:', response);
  
  try {
    const result = await apiRequest('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({
        credential: response.credential
      })
    });
    
    if (result && result.ok) {
      const user = result.data.user || {};
      // Token is now in httpOnly cookie, not in response body
      console.log('Google login successful, token is in httpOnly cookie');
      
      // Load full user profile from /api/me (will use cookie automatically)
      try {
        const profileResult = await apiRequest('/api/me');
        if (profileResult && profileResult.ok && profileResult.data) {
          // Merge profile data
          const fullUser = {
            ...user,
            ...profileResult.data
          };
          // Store user data (token is in cookie, don't store in localStorage)
          localStorage.setItem('smartexpense_user', JSON.stringify(fullUser));
          localStorage.removeItem('smartexpense_token'); // Ensure no token in localStorage
          console.log('✅ User data stored, token is in httpOnly cookie');
        } else {
          // Fallback to basic user info
          localStorage.setItem('smartexpense_user', JSON.stringify(user));
          localStorage.removeItem('smartexpense_token');
        }
      } catch (error) {
        console.warn('Could not load profile, using basic user info:', error);
        localStorage.setItem('smartexpense_user', JSON.stringify(user));
        localStorage.removeItem('smartexpense_token');
      }
      
      showMessage('✅ Đăng nhập Google thành công! Đang chuyển hướng...', true);
      setTimeout(() => {
        window.location.href = 'trangchu.html';
      }, 1000);
    } else {
      console.error('Google login failed:', result);
      showMessage(result?.data?.message || 'Đăng nhập Google thất bại');
    }
  } catch (error) {
    console.error('Google login error:', error);
    showMessage('Lỗi kết nối. Vui lòng thử lại.');
  }
}

// Check if user is already logged in
function checkAuthStatus() {
  const user = localStorage.getItem('smartexpense_user');
  if (user) {
    showMessage('Bạn đã đăng nhập. Đang chuyển hướng...', true);
    setTimeout(() => {
      window.location.href = 'trangchu.html';
    }, 2000);
  }
}

// Initialize login page
function initLoginPage() {
  // Add form event listener
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Make Google callback globally available
  window.onGoogleCredentialLogin = handleGoogleCredentialLogin;
  
  // Check auth status
  checkAuthStatus();
  
  console.log('Login page initialized');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initLoginPage);
