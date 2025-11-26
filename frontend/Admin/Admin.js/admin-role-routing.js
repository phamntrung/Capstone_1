(function (window) {
  'use strict';

  /**
   * Bộ định tuyến theo vai trò dành riêng cho khu vực Admin.
   * - Giữ logic điều hướng tách biệt để không đụng chạm file login.js gốc.
   * - Chỉ gán global functions ở mức tối thiểu để code ở nơi khác dễ dùng lại.
   */

  // Định nghĩa sẵn các đường dẫn quan trọng
  // Sử dụng đường dẫn tuyệt đối từ root để đảm bảo hoạt động đúng từ mọi context
  const DEFAULT_ROUTES = {
    userHome: '/frontend/User/UI_User/trangchu.html', // trang chủ của người dùng thường
    adminHome: '/frontend/Admin/UIAdmin/tongquan.html', // dashboard admin
  };

  /**
   * Chuẩn hóa chuỗi vai trò về dạng viết thường, bỏ khoảng trắng.
   */
  function normalizeRole(role) {
    return (role || '').toString().trim().toLowerCase();
  }

  /**
   * Cố gắng trả về URL tuyệt đối để tránh lỗi đường dẫn tương đối.
   * Hỗ trợ cả absolute path (bắt đầu bằng /) và relative path.
   */
  function resolvePath(path) {
    if (!path) return '';
    
    // Nếu đã là absolute path (bắt đầu bằng /), tạo URL từ origin
    if (path.startsWith('/')) {
      try {
        return new URL(path, window.location.origin).href;
      } catch (err) {
        console.warn('⚠️ [admin-role-routing] Không thể chuẩn hóa absolute path:', path, err);
        return path;
      }
    }
    
    // Nếu là relative path, convert dựa trên current location
    try {
      return new URL(path, window.location.href).href;
    } catch (err) {
      console.warn('⚠️ [admin-role-routing] Không thể chuẩn hóa relative path:', path, err);
      return path;
    }
  }

  /**
   * Xác định URL điều hướng dựa trên role.
   * - Admin, super admin, owner => về dashboard admin.
   * - Các vai trò khác giữ nguyên trang chủ người dùng.
   */
  function getRedirectUrlByRole(role, user) {
    console.log('🔍 [admin-role-routing] getRedirectUrlByRole được gọi với:', {
      role: role,
      roleType: typeof role,
      user: user ? { id: user.id, email: user.email, role: user.role, user_role: user.user_role } : null
    });

    // Nếu role không có, thử lấy từ user object
    if (!role && user) {
      role = user.role || user.user_role || null;
      console.log('🔍 [admin-role-routing] Lấy role từ user object:', role);
    }

    const normalizedRole = normalizeRole(role);
    console.log('🔍 [admin-role-routing] Role sau khi normalize:', normalizedRole);

    if (!normalizedRole) {
      console.log('⚠️ [admin-role-routing] Role rỗng, redirect về userHome');
      return resolvePath(DEFAULT_ROUTES.userHome);
    }

    const adminRoles = ['admin', 'super_admin', 'superadmin', 'owner', 'root'];
    console.log('🔍 [admin-role-routing] Kiểm tra role trong adminRoles:', {
      normalizedRole,
      adminRoles,
      isAdmin: adminRoles.includes(normalizedRole)
    });

    if (adminRoles.includes(normalizedRole)) {
      const adminUrl = resolvePath(DEFAULT_ROUTES.adminHome);
      console.log('✅ [admin-role-routing] Role là admin, redirect đến:', adminUrl);
      return adminUrl;
    }

    const userUrl = resolvePath(DEFAULT_ROUTES.userHome);
    console.log('ℹ️ [admin-role-routing] Role không phải admin, redirect đến:', userUrl);
    return userUrl;
  }

  /**
   * Cho phép tuỳ chỉnh đường dẫn tại runtime nếu cần (ví dụ backend trả cấu hình).
   */
  function setCustomRoutes(routes = {}) {
    if (routes.userHome) DEFAULT_ROUTES.userHome = routes.userHome;
    if (routes.adminHome) DEFAULT_ROUTES.adminHome = routes.adminHome;
  }

  // Xuất ra global ở mức tối thiểu
  window.getRedirectUrlByRole = getRedirectUrlByRole;
  window.AdminRoleRouting = {
    getRedirectUrlByRole,
    resolvePath,
    setCustomRoutes,
    DEFAULT_ROUTES,
  };
})(window);

