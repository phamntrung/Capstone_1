/**
 * Register Page JavaScript
 * Xử lý đăng ký tài khoản và Google OAuth
 */

// Load utilities first
// (utils.js should be loaded before this file)

// Validate form data
function validateForm(name, email, password, confirmPassword) {
  if (!name || !email || !password) {
    showMessage('Vui lòng điền đầy đủ thông tin', false, 'msg');
    return false;
  }
  
  // Kiểm tra định dạng email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showMessage('Email không hợp lệ', false, 'msg');
    return false;
  }
  
  if (password.length < 6) {
    showMessage('Mật khẩu phải có ít nhất 6 ký tự', false, 'msg');
    return false;
  }
  
  if (password !== confirmPassword) {
    showMessage('Mật khẩu xác nhận không khớp', false, 'msg');
    return false;
  }
  
  return true;
}

// Handle form submission
async function handleRegister(event) {
  event.preventDefault();
  
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm');
  const submitBtn = event.target.querySelector('button[type="submit"]');
  
  if (!nameInput || !emailInput || !passwordInput || !confirmInput) {
    showMessage('Không tìm thấy các trường nhập liệu', false, 'msg');
    return;
  }
  
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmInput.value;
  
  // Validation
  if (!validateForm(name, email, password, confirmPassword)) {
    return;
  }
  
  // Hiển thị trạng thái loading
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang đăng ký...';
  }
  
  try {
    const result = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: name,
        email: email,
        password: password
      })
    });
    
    // Backend Node.js trả về status 201 cho đăng ký thành công
    // result.ok sẽ là true nếu status là 2xx (bao gồm 201)
    if (result && result.ok) {
      console.log('✅ Đăng ký thành công, user đã được lưu vào database:', result.data);
      showMessage('✅ Đăng ký thành công! Đang chuyển hướng đến trang đăng nhập...', true, 'msg');
      
      // Điều hướng đến trang đăng nhập sau 1.5 giây
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
    } else {
      const errorMsg = result?.data?.message || 'Đăng ký thất bại';
      console.error('❌ Đăng ký thất bại:', errorMsg, result);
      showMessage(errorMsg, false, 'msg');
    }
  } catch (error) {
    console.error('❌ Register error:', error);
    showMessage('Đã xảy ra lỗi. Vui lòng thử lại.', false, 'msg');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Đăng ký';
    }
  }
}

// Handle Google OAuth callback
async function handleGoogleCredential(response) {
  console.log('Google credential received:', response);
  
  try {
    // Extract credential - Google can pass it as response.credential or just response (string)
    const credential = (typeof response === 'string') ? response : (response?.credential || response);
    
    if (!credential) {
      console.error('No credential found in response:', response);
      showMessage('Không nhận được thông tin xác thực từ Google. Vui lòng thử lại.', false, 'msg');
      return;
    }
    
    const result = await apiRequest('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({
        credential: credential
      })
    });
    
    if (result && result.ok) {
      const user = result.data.user || {};
      const token = result.data.token;
      
      // Token có thể ở trong cookie (httpOnly) hoặc trong response body
      // Nếu không có token trong response, có thể token đã được set trong cookie
      if (!token) {
        console.log('⚠️ Không có token trong response body, kiểm tra cookie...');
        // Token có thể đã được set trong httpOnly cookie
        // Tiếp tục với việc lưu user data
      }
      
      // Store user data (token có thể ở cookie hoặc localStorage)
      localStorage.setItem('smartexpense_user', JSON.stringify(user));
      if (token) {
        localStorage.setItem('smartexpense_token', token);
      } else {
        // Token ở cookie, không lưu trong localStorage
        localStorage.removeItem('smartexpense_token');
      }
      
      showMessage('✅ Đăng nhập Google thành công! Đang chuyển hướng...', true, 'msg');
      setTimeout(() => {
        window.location.href = 'trangchu.html';
      }, 2000);
    } else {
      console.error('Google login failed:', result);
      showMessage(result?.data?.message || 'Đăng nhập Google thất bại', false, 'msg');
    }
  } catch (error) {
    console.error('Google login error:', error);
    showMessage('Lỗi kết nối. Vui lòng thử lại.', false, 'msg');
  }
}

// Initialize page
function initRegisterPage() {
  // Add form event listener
  const registerForm = document.getElementById('signupForm');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
  
  // Make Google callback globally available
  window.onGoogleCredential = handleGoogleCredential;
  
  console.log('Register page initialized');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initRegisterPage);
