-- Migration: Tạo bảng admins và seed tài khoản quản trị mặc định
-- Ngày tạo: 2025

USE smart_expense;

-- ================================================
-- 1. Tạo bảng admins (tham chiếu bảng users)
-- ================================================
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE COMMENT 'Khóa ngoại trỏ về bảng users',
    role_name VARCHAR(50) NOT NULL DEFAULT 'Admin' COMMENT 'Tên vai trò hiển thị',
    note VARCHAR(255) NULL COMMENT 'Ghi chú bổ sung cho admin',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_role_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Bảng lưu danh sách tài khoản quản trị (tham chiếu tới bảng users)';

-- ================================================
-- 2. Seed admin mặc định (email: admin@smartexpense.com)
--    Mật khẩu: Admin@123 (đã được hash bằng bcrypt)
-- ================================================
INSERT INTO users (name, email, password_hash, role, currency, created_at, updated_at)
SELECT 'System Admin', 'admin@smartexpense.com', '$2a$10$cDRuwa.98Wxzw0J4qEFqueR5qwVKjvYcu4VPSP2/dONpxHPlm9Zu.', 'admin', 'VND', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@smartexpense.com');

INSERT INTO admins (user_id, role_name, note, created_at, updated_at)
SELECT u.id, 'Admin', 'Admin mặc định của hệ thống', NOW(), NOW()
FROM users u
WHERE u.email = 'admin@smartexpense.com'
ON DUPLICATE KEY UPDATE
    role_name = VALUES(role_name),
    note = VALUES(note),
    updated_at = NOW();

-- ================================================
-- 3. Thông báo trạng thái
-- ================================================
SELECT '✅ Đã tạo bảng admins và tài khoản admin mặc định (nếu chưa tồn tại)' AS status;

