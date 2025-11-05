-- Migration: Tạo bảng devices để quản lý thiết bị đăng nhập
-- Ngày tạo: 2025

USE smart_expense;

-- Tạo bảng devices để lưu trữ thông tin các thiết bị/phiên đăng nhập
CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT 'ID người dùng sở hữu thiết bị',

    -- Thông tin thiết bị
    device_name VARCHAR(100) NULL COMMENT 'Tên thiết bị (ví dụ: iPhone 15, MacBook Pro)',
    platform VARCHAR(50) NULL COMMENT 'Hệ điều hành (iOS, macOS, Windows, Android, Linux)',
    browser VARCHAR(50) NULL COMMENT 'Trình duyệt (Safari, Chrome, Edge, Firefox)',

    -- Thông tin mạng và vị trí
    ip_address VARCHAR(45) NULL COMMENT 'Địa chỉ IP (IPv4 hoặc IPv6)',
    city VARCHAR(100) NULL COMMENT 'Thành phố (ước tính từ IP)',
    country VARCHAR(10) NULL COMMENT 'Quốc gia (mã 2 chữ, ví dụ: VN, US)',

    -- Bảo mật
    fingerprint VARCHAR(100) NULL COMMENT 'Fingerprint duy nhất của thiết bị/trình duyệt',
    session_token VARCHAR(255) NULL COMMENT 'Token phiên đăng nhập (JWT hoặc refresh token)',

    -- Trạng thái
    is_trusted BOOLEAN DEFAULT FALSE COMMENT 'Trạng thái tin cậy: TRUE = Tin cậy, FALSE = Không tin cậy',
    is_blocked BOOLEAN DEFAULT FALSE COMMENT 'Trạng thái bị chặn: TRUE = Bị chặn, FALSE = Không bị chặn',
    is_current BOOLEAN DEFAULT FALSE COMMENT 'Thiết bị hiện tại: TRUE = Đang sử dụng, FALSE = Khác',

    -- Thời gian
    last_activity_at DATETIME NULL COMMENT 'Thời gian hoạt động gần nhất',
    expires_at DATETIME NULL COMMENT 'Thời gian hết hạn của phiên (nếu có)',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_fingerprint (fingerprint),
    INDEX idx_session_token (session_token),
    INDEX idx_last_activity (last_activity_at),
    INDEX idx_user_activity (user_id, last_activity_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Bảng quản lý thiết bị và phiên đăng nhập của người dùng';

