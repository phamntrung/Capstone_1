/**
 * Admin Common Scripts
 * Xử lý các chức năng chung cho giao diện Admin
 */

(function() {
  'use strict';

  /**
   * Hàm đăng xuất cho Admin
   * Xóa session và redirect về trang đăng nhập
   */
  async function adminLogout() {
    // Xác nhận trước khi đăng xuất
    if (!confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      return;
    }

    try {
      console.log('🔍 [adminLogout] Bắt đầu quá trình đăng xuất...');
      
      // QUAN TRỌNG: Đánh dấu đang logout để checkExistingLogin() bỏ qua
      // Flag này sẽ được check trong login.js để tránh redirect lại admin
      localStorage.setItem('smartexpense_logging_out', 'true');
      console.log('✅ [adminLogout] Đã đánh dấu đang logout');
      
      // Xóa thông tin đăng nhập
      localStorage.removeItem('smartexpense_user');
      localStorage.removeItem('smartexpense_token');
      localStorage.removeItem('smartexpense_expense_added');
      localStorage.removeItem('smartexpense_profile_updated');
      localStorage.removeItem('smartexpense_balance_updated');
      
      // Verify localStorage đã được xóa
      const verifyUser = localStorage.getItem('smartexpense_user');
      const verifyToken = localStorage.getItem('smartexpense_token');
      if (verifyUser || verifyToken) {
        console.error('❌ [adminLogout] CRITICAL: localStorage chưa được xóa hoàn toàn!');
        // Thử xóa lại
        localStorage.removeItem('smartexpense_user');
        localStorage.removeItem('smartexpense_token');
      }
      
      console.log('✅ [adminLogout] Đã xóa thông tin phiên đăng nhập');
      
      // Tính toán đường dẫn login - luôn dùng đường dẫn tuyệt đối từ root
      const currentOrigin = window.location.origin;
      const currentPath = window.location.pathname;
      
      // Luôn dùng đường dẫn tuyệt đối từ root để tránh lỗi
      // Đường dẫn login: /frontend/User/UI_User/login.html
      // Đảm bảo đường dẫn bắt đầu bằng / để tránh relative path
      const loginPath = '/frontend/User/UI_User/login.html';
      
      // Tạo URL đầy đủ bằng cách dùng new URL() với base URL
      // Điều này đảm bảo URL được tạo đúng, không bị ảnh hưởng bởi relative path
      let fullLoginUrl;
      try {
        // Tạo URL object với base URL là currentOrigin
        const urlObj = new URL(loginPath, currentOrigin);
        fullLoginUrl = urlObj.href;
        console.log('✅ [adminLogout] URL được tạo bằng new URL():', fullLoginUrl);
      } catch (e) {
        // Fallback: nối trực tiếp nếu new URL() fail
        console.warn('⚠️ [adminLogout] new URL() failed, dùng fallback:', e);
        fullLoginUrl = currentOrigin + loginPath;
      }
      
      console.log('🔍 [adminLogout] Current path:', currentPath);
      console.log('🔍 [adminLogout] Current origin:', currentOrigin);
      console.log('🔍 [adminLogout] Login path:', loginPath);
      console.log('🔍 [adminLogout] Full login URL:', fullLoginUrl);
      
      // Verify URL trước khi redirect
      try {
        const testUrl = new URL(fullLoginUrl);
        console.log('✅ [adminLogout] URL hợp lệ:', testUrl.href);
        // Đảm bảo pathname đúng
        if (testUrl.pathname !== loginPath) {
          console.error('❌ [adminLogout] Pathname không khớp! Expected:', loginPath, 'Got:', testUrl.pathname);
          // Sửa lại URL
          fullLoginUrl = currentOrigin + loginPath;
          console.log('🔧 [adminLogout] Đã sửa URL thành:', fullLoginUrl);
        }
      } catch (e) {
        console.error('❌ [adminLogout] URL không hợp lệ:', e);
      }
      
      // Đợi một chút để đảm bảo localStorage đã được xóa hoàn toàn
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Sử dụng replace() với URL đầy đủ để đảm bảo redirect đúng và không thể quay lại
      // Dùng URL object để đảm bảo đường dẫn tuyệt đối
      console.log('🔄 [adminLogout] Đang redirect về trang đăng nhập...');
      console.log('🔄 [adminLogout] Final URL:', fullLoginUrl);
      window.location.replace(fullLoginUrl);
    } catch (error) {
      console.error('❌ [adminLogout] Lỗi khi đăng xuất:', error);
      // Fallback: dùng đường dẫn tuyệt đối đơn giản
      const currentOrigin = window.location.origin;
      const loginPath = '/frontend/User/UI_User/login.html';
      const fallbackUrl = currentOrigin + loginPath;
      console.log('🔍 [adminLogout] Error fallback - Redirecting to:', fallbackUrl);
      // Đảm bảo flag logout được set
      localStorage.setItem('smartexpense_logging_out', 'true');
      localStorage.removeItem('smartexpense_user');
      localStorage.removeItem('smartexpense_token');
      // Đợi một chút trước khi redirect
      setTimeout(() => {
        console.log('🔄 [adminLogout] Fallback redirect to:', fallbackUrl);
        window.location.replace(fallbackUrl);
      }, 200);
    }
  }

  /**
   * Khởi tạo event listener cho link đăng xuất
   * CHỈ xử lý link có data-logout="true" để tránh nhận nhầm các link khác
   */
  function initLogoutHandler() {
    console.log('🔍 [initLogoutHandler] Đang khởi tạo logout handler...');
    
    /**
     * Hàm xử lý click vào link đăng xuất
     * CHỈ trigger khi link có data-logout="true"
     */
    function handleLogoutClick(e) {
      const link = e.target.closest('a');
      
      // CHỈ xử lý nếu link có data-logout="true" - đây là cách duy nhất đáng tin cậy
      if (!link || !link.hasAttribute('data-logout') || link.getAttribute('data-logout') !== 'true') {
        return; // Không phải link đăng xuất, bỏ qua
      }
      
      console.log('✅ [initLogoutHandler] Logout link detected - data-logout="true"');
      
      // Ngăn chặn hành vi mặc định và lan truyền event
      e.preventDefault();
      e.stopPropagation();
      
      // Gọi hàm đăng xuất
      adminLogout();
      
      return false;
    }
    
    // Cách 1: Event delegation trên document - CHỈ check data-logout="true"
    document.addEventListener('click', handleLogoutClick, true); // Use capture phase để catch sớm hơn
    
    // Cách 2: Bind trực tiếp vào các link có data-logout="true" sau khi DOM ready
    function bindDirectHandlers() {
      // CHỈ tìm link có data-logout="true" - không có fallback để tránh nhận nhầm
      const logoutLinks = document.querySelectorAll('a[data-logout="true"]');
      console.log(`🔍 [initLogoutHandler] Found ${logoutLinks.length} links with data-logout="true"`);
      
      logoutLinks.forEach((link, index) => {
        console.log(`✅ [initLogoutHandler] Binding direct handler to logout link ${index + 1}`);
        
        // Thêm handler trực tiếp vào link
        link.addEventListener('click', function(e) {
          console.log('✅ [initLogoutHandler] Direct logout handler triggered');
          e.preventDefault();
          e.stopPropagation();
          adminLogout();
          return false;
        }, true); // Use capture phase
      });
    }
    
    // Bind sau khi DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindDirectHandlers);
    } else {
      bindDirectHandlers();
    }
    
    // Retry sau 500ms để đảm bảo (nếu có dynamic content được thêm vào sau)
    setTimeout(bindDirectHandlers, 500);
  }

  // Khởi tạo khi DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLogoutHandler);
  } else {
    initLogoutHandler();
  }

  // Export function để có thể gọi từ nơi khác
  window.adminLogout = adminLogout;
})();


