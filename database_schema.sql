-- ============================================
-- SmartExpense - Database Schema Hoàn Chỉnh
-- ============================================
-- File này chứa toàn bộ cấu trúc database cho hệ thống quản lý chi tiêu thông minh
-- Hỗ trợ: Backend Node.js và Backend Flask (Python)
-- Database: MySQL 5.7+ / MariaDB 10.2+
-- ============================================

-- Tạo database (nếu chưa tồn tại)
CREATE DATABASE IF NOT EXISTS smart_expense 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE smart_expense;

-- ============================================
-- BẢNG 1: users - Quản lý người dùng
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT 'Tên người dùng',
    email VARCHAR(120) NOT NULL UNIQUE COMMENT 'Email đăng nhập (unique)',
    password_hash VARCHAR(255) NOT NULL COMMENT 'Mật khẩu đã hash (bcrypt)',
    role VARCHAR(20) DEFAULT 'user' COMMENT 'Vai trò: user, admin',
    
    -- Thông tin cá nhân
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Số dư tháng hiện tại',
    gender VARCHAR(20) NULL COMMENT 'Giới tính: Nam, Nữ, Khác',
    currency VARCHAR(50) NULL DEFAULT 'VND' COMMENT 'Đơn vị tiền tệ: VND, USD, EUR...',
    phone VARCHAR(20) NULL COMMENT 'Số điện thoại',
    
    -- Google OAuth
    google_id VARCHAR(255) NULL UNIQUE COMMENT 'Google User ID (sub từ JWT)',
    login_method VARCHAR(20) DEFAULT 'password' COMMENT 'Phương thức đăng nhập: password, google',
    avatar_url VARCHAR(500) NULL COMMENT 'URL ảnh đại diện từ Google',
    email_verified BOOLEAN DEFAULT FALSE COMMENT 'Trạng thái xác thực email',
    
    -- Timestamps
    last_login_at DATETIME NULL COMMENT 'Lần đăng nhập cuối',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_email (email),
    INDEX idx_google_id (google_id),
    INDEX idx_role (role),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Bảng quản lý người dùng và thông tin xác thực';

-- ============================================
-- BẢNG 2: categories - Danh mục chi tiêu
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT 'ID người dùng sở hữu danh mục',
    name VARCHAR(100) NOT NULL COMMENT 'Tên danh mục (ví dụ: Ăn uống, Mua sắm)',
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_name (name),
    UNIQUE KEY unique_user_category (user_id, name) COMMENT 'Mỗi user chỉ có 1 category với tên duy nhất'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Bảng danh mục chi tiêu của từng người dùng';

-- ============================================
-- BẢNG 3: expenses - Chi tiêu và thu nhập
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT 'ID người dùng sở hữu giao dịch',
    date DATE NOT NULL COMMENT 'Ngày giao dịch (YYYY-MM-DD)',
    amount DECIMAL(10, 2) NOT NULL COMMENT 'Số tiền (dương cho income, âm cho expense)',
    type VARCHAR(20) NOT NULL COMMENT 'Loại: expense (chi tiêu) hoặc income (thu nhập)',
    category_id INT NULL COMMENT 'ID danh mục (NULL nếu không có)',
    note TEXT NULL COMMENT 'Ghi chú của giao dịch',
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    
    -- Indexes để query nhanh
    INDEX idx_user_id (user_id),
    INDEX idx_date (date),
    INDEX idx_type (type),
    INDEX idx_category_id (category_id),
    INDEX idx_user_date (user_id, date) COMMENT 'Composite index cho query theo user và date range',
    INDEX idx_user_type_date (user_id, type, date) COMMENT 'Composite index cho filter theo type và date'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Bảng lưu trữ tất cả các giao dịch (chi tiêu và thu nhập)';

-- ============================================
-- BẢNG 4: budgets - Ngân sách theo tháng
-- ============================================
CREATE TABLE IF NOT EXISTS budgets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT 'ID người dùng sở hữu ngân sách',
    month VARCHAR(7) NOT NULL COMMENT 'Tháng (format: YYYY-MM)',
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Số tiền ngân sách cho tháng',
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_month (month),
    
    -- Unique constraint: Mỗi user chỉ có 1 budget cho 1 tháng
    UNIQUE KEY unique_user_month (user_id, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Bảng quản lý ngân sách theo tháng của từng người dùng';

-- ============================================
-- BẢNG 5: reports - Báo cáo đã tính toán
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT 'ID người dùng',
    report_type ENUM('daily', 'monthly', 'category', 'summary') NOT NULL COMMENT 'Loại báo cáo',
    period VARCHAR(50) NOT NULL COMMENT 'Chu kỳ: YYYY-MM-DD cho daily, YYYY-MM cho monthly',
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Tổng số tiền',
    budget DECIMAL(10, 2) NULL DEFAULT NULL COMMENT 'Ngân sách cho tháng (chỉ cho monthly)',
    transactions INT DEFAULT 0 COMMENT 'Số lượng giao dịch',
    category_id INT NULL DEFAULT NULL COMMENT 'ID danh mục (chỉ cho category reports)',
    category_name VARCHAR(255) NULL DEFAULT NULL COMMENT 'Tên danh mục',
    percentage DECIMAL(5, 2) NULL DEFAULT NULL COMMENT 'Phần trăm chi tiêu (chỉ cho category reports)',
    metadata JSON NULL COMMENT 'Dữ liệu bổ sung (JSON format)',
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    
    -- Indexes để query nhanh
    INDEX idx_user_id (user_id),
    INDEX idx_report_type (report_type),
    INDEX idx_period (period),
    INDEX idx_user_type_period (user_id, report_type, period) COMMENT 'Composite index cho query reports',
    INDEX idx_created_at (created_at),
    
    -- Unique constraint: Mỗi user chỉ có 1 report cho mỗi type + period
    UNIQUE KEY unique_user_report (user_id, report_type, period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Bảng lưu trữ các báo cáo đã tính toán (cache)';

-- ============================================
-- BẢNG 6: report_cache - Cache cho summary reports
-- ============================================
CREATE TABLE IF NOT EXISTS report_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT 'ID người dùng',
    cache_key VARCHAR(100) NOT NULL COMMENT 'Key để identify cache (ví dụ: daily_summary, monthly_summary)',
    cache_data JSON NOT NULL COMMENT 'Dữ liệu cache (JSON format)',
    expires_at DATETIME NOT NULL COMMENT 'Thời gian hết hạn cache',
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_cache_key (cache_key),
    INDEX idx_expires_at (expires_at),
    INDEX idx_user_key (user_id, cache_key) COMMENT 'Composite index cho query cache',
    
    -- Unique constraint
    UNIQUE KEY unique_user_cache (user_id, cache_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Bảng cache cho summary reports (giảm tải tính toán)';

-- ============================================
-- BẢNG 7: user_settings - Cài đặt người dùng (tùy chọn)
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT 'ID người dùng',
    setting_key VARCHAR(100) NOT NULL COMMENT 'Tên setting (ví dụ: daily_report, theme)',
    setting_value TEXT NULL COMMENT 'Giá trị setting (JSON hoặc text)',
    
    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_setting_key (setting_key),
    
    -- Unique constraint: Mỗi user chỉ có 1 setting cho mỗi key
    UNIQUE KEY unique_user_setting (user_id, setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Bảng lưu trữ cài đặt cá nhân của người dùng';

-- ============================================
-- STORED PROCEDURES - Thủ tục hữu ích
-- ============================================

-- Procedure: Lấy tổng chi tiêu của user trong tháng
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS GetMonthlyExpense(
    IN p_user_id INT,
    IN p_month VARCHAR(7)  -- Format: YYYY-MM
)
BEGIN
    SELECT 
        COALESCE(SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END), 0) AS total_expense,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
        COUNT(*) AS transaction_count
    FROM expenses
    WHERE user_id = p_user_id
      AND DATE_FORMAT(date, '%Y-%m') = p_month;
END //
DELIMITER ;

-- Procedure: Lấy ngân sách và chi tiêu thực tế của user trong tháng
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS GetBudgetStatus(
    IN p_user_id INT,
    IN p_month VARCHAR(7)  -- Format: YYYY-MM
)
BEGIN
    SELECT 
        COALESCE(b.amount, 0) AS budget_amount,
        COALESCE(SUM(CASE WHEN e.type = 'expense' THEN ABS(e.amount) ELSE 0 END), 0) AS actual_expense,
        COALESCE(b.amount, 0) - COALESCE(SUM(CASE WHEN e.type = 'expense' THEN ABS(e.amount) ELSE 0 END), 0) AS remaining,
        CASE 
            WHEN COALESCE(b.amount, 0) > 0 THEN 
                (COALESCE(SUM(CASE WHEN e.type = 'expense' THEN ABS(e.amount) ELSE 0 END), 0) / COALESCE(b.amount, 1)) * 100
            ELSE 0 
        END AS percentage_used
    FROM budgets b
    LEFT JOIN expenses e ON e.user_id = p_user_id AND DATE_FORMAT(e.date, '%Y-%m') = p_month
    WHERE b.user_id = p_user_id AND b.month = p_month
    GROUP BY b.id, b.amount;
END //
DELIMITER ;

-- ============================================
-- VIEWS - Các view hữu ích
-- ============================================

-- View: Tổng hợp chi tiêu theo danh mục của user
CREATE OR REPLACE VIEW v_user_category_summary AS
SELECT 
    u.id AS user_id,
    u.name AS user_name,
    c.id AS category_id,
    c.name AS category_name,
    COUNT(e.id) AS transaction_count,
    COALESCE(SUM(CASE WHEN e.type = 'expense' THEN ABS(e.amount) ELSE 0 END), 0) AS total_expense,
    COALESCE(SUM(CASE WHEN e.type = 'income' THEN amount ELSE 0 END), 0) AS total_income
FROM users u
LEFT JOIN categories c ON c.user_id = u.id
LEFT JOIN expenses e ON e.user_id = u.id AND e.category_id = c.id
GROUP BY u.id, u.name, c.id, c.name;

-- View: Báo cáo tháng hiện tại của tất cả users
CREATE OR REPLACE VIEW v_current_month_summary AS
SELECT 
    u.id AS user_id,
    u.name AS user_name,
    DATE_FORMAT(NOW(), '%Y-%m') AS current_month,
    COALESCE(b.amount, 0) AS budget,
    COALESCE(SUM(CASE WHEN e.type = 'expense' THEN ABS(e.amount) ELSE 0 END), 0) AS total_expense,
    COALESCE(SUM(CASE WHEN e.type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
    COALESCE(b.amount, 0) - COALESCE(SUM(CASE WHEN e.type = 'expense' THEN ABS(e.amount) ELSE 0 END), 0) AS remaining
FROM users u
LEFT JOIN budgets b ON b.user_id = u.id AND b.month = DATE_FORMAT(NOW(), '%Y-%m')
LEFT JOIN expenses e ON e.user_id = u.id AND DATE_FORMAT(e.date, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
GROUP BY u.id, u.name, b.amount;

-- ============================================
-- TRIGGERS - Tự động cập nhật
-- ============================================

-- Trigger: Tự động cập nhật balance khi có expense/income mới
DELIMITER //
CREATE TRIGGER IF NOT EXISTS update_user_balance_on_expense_insert
AFTER INSERT ON expenses
FOR EACH ROW
BEGIN
    IF NEW.type = 'income' THEN
        UPDATE users SET balance = balance + NEW.amount WHERE id = NEW.user_id;
    ELSEIF NEW.type = 'expense' THEN
        UPDATE users SET balance = balance - ABS(NEW.amount) WHERE id = NEW.user_id;
    END IF;
END //
DELIMITER ;

-- Trigger: Tự động cập nhật balance khi expense/income được cập nhật
DELIMITER //
CREATE TRIGGER IF NOT EXISTS update_user_balance_on_expense_update
AFTER UPDATE ON expenses
FOR EACH ROW
BEGIN
    -- Xóa tác động của giá trị cũ
    IF OLD.type = 'income' THEN
        UPDATE users SET balance = balance - OLD.amount WHERE id = OLD.user_id;
    ELSEIF OLD.type = 'expense' THEN
        UPDATE users SET balance = balance + ABS(OLD.amount) WHERE id = OLD.user_id;
    END IF;
    
    -- Thêm tác động của giá trị mới
    IF NEW.type = 'income' THEN
        UPDATE users SET balance = balance + NEW.amount WHERE id = NEW.user_id;
    ELSEIF NEW.type = 'expense' THEN
        UPDATE users SET balance = balance - ABS(NEW.amount) WHERE id = NEW.user_id;
    END IF;
END //
DELIMITER ;

-- Trigger: Tự động cập nhật balance khi expense/income bị xóa
DELIMITER //
CREATE TRIGGER IF NOT EXISTS update_user_balance_on_expense_delete
AFTER DELETE ON expenses
FOR EACH ROW
BEGIN
    IF OLD.type = 'income' THEN
        UPDATE users SET balance = balance - OLD.amount WHERE id = OLD.user_id;
    ELSEIF OLD.type = 'expense' THEN
        UPDATE users SET balance = balance + ABS(OLD.amount) WHERE id = OLD.user_id;
    END IF;
END //
DELIMITER ;

-- ============================================
-- DỮ LIỆU MẪU (Tùy chọn - để test)
-- ============================================

-- Insert user mẫu (password: password123 - đã hash)
-- Password hash này chỉ để demo, trong thực tế phải hash bằng bcrypt
-- INSERT INTO users (name, email, password_hash, role, currency) VALUES
-- ('Admin User', 'admin@smartexpense.com', '$2b$10$rQZ8vK5xQZ8vK5xQZ8vK5uQZ8vK5xQZ8vK5xQZ8vK5xQZ8vK5xQZ8vK5x', 'admin', 'VND');

-- ============================================
-- KẾT THÚC
-- ============================================

-- Hiển thị thông tin các bảng đã tạo
SELECT '✅ Database schema đã được tạo thành công!' AS status;
SHOW TABLES;

