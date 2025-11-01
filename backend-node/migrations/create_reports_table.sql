-- Migration: Tạo bảng reports để lưu trữ dữ liệu báo cáo
-- Ngày tạo: 2024

-- Tạo bảng reports để lưu trữ các báo cáo đã tính toán
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    report_type ENUM('daily', 'monthly', 'category', 'summary') NOT NULL,
    period VARCHAR(50) NOT NULL COMMENT 'Format: YYYY-MM-DD cho daily, YYYY-MM cho monthly',
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    budget DECIMAL(10, 2) NULL DEFAULT NULL COMMENT 'Ngân sách cho tháng (chỉ cho monthly)',
    transactions INT DEFAULT 0 COMMENT 'Số lượng giao dịch',
    category_id INT NULL DEFAULT NULL COMMENT 'ID danh mục (chỉ cho category reports)',
    category_name VARCHAR(255) NULL DEFAULT NULL COMMENT 'Tên danh mục',
    percentage DECIMAL(5, 2) NULL DEFAULT NULL COMMENT 'Phần trăm chi tiêu (chỉ cho category reports)',
    metadata JSON NULL COMMENT 'Dữ liệu bổ sung (JSON)',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes để query nhanh
    INDEX idx_user_id (user_id),
    INDEX idx_report_type (report_type),
    INDEX idx_period (period),
    INDEX idx_user_type_period (user_id, report_type, period),
    INDEX idx_created_at (created_at),
    
    -- Foreign key constraint
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Unique constraint: Mỗi user chỉ có 1 report cho mỗi type + period
    UNIQUE KEY unique_user_report (user_id, report_type, period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng lưu trữ các báo cáo đã tính toán';

-- Tạo bảng report_cache để lưu cache summary reports
CREATE TABLE IF NOT EXISTS report_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    cache_key VARCHAR(100) NOT NULL COMMENT 'Key để identify cache (ví dụ: daily_summary, monthly_summary)',
    cache_data JSON NOT NULL COMMENT 'Dữ liệu cache (JSON)',
    expires_at DATETIME NOT NULL COMMENT 'Thời gian hết hạn cache',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_cache_key (cache_key),
    INDEX idx_expires_at (expires_at),
    INDEX idx_user_key (user_id, cache_key),
    
    -- Foreign key constraint
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Unique constraint
    UNIQUE KEY unique_user_cache (user_id, cache_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng cache cho summary reports';

