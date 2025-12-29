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

-- =========================
-- USERS
-- =========================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  balance DECIMAL(14,2) DEFAULT 0,
  gender VARCHAR(20),
  currency VARCHAR(50) DEFAULT 'VND',
  phone VARCHAR(20),
  google_id VARCHAR(255) UNIQUE,
  login_method VARCHAR(20) DEFAULT 'password',
  avatar_url VARCHAR(500),
  email_verified BOOLEAN DEFAULT FALSE,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB;

-- =========================
-- ADMINS (ISA users)
-- =========================
CREATE TABLE admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNIQUE,
  role_name VARCHAR(50) DEFAULT 'Admin',
  note VARCHAR(255),
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  CONSTRAINT fk_admin_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================
-- CATEGORIES
-- =========================
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#3b82f6',
  note TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  CONSTRAINT fk_category_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================
-- EXPENSES
-- =========================
CREATE TABLE expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  type VARCHAR(20) NOT NULL,
  category_id INT,
  note TEXT,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  CONSTRAINT fk_expense_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_expense_category
    FOREIGN KEY (category_id)
    REFERENCES categories(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- =========================
-- BUDGETS
-- =========================
CREATE TABLE budgets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  month VARCHAR(7) NOT NULL,
  amount DECIMAL(10,2) DEFAULT 0,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  CONSTRAINT fk_budget_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================
-- REPORTS
-- =========================
CREATE TABLE reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  report_type ENUM('daily','monthly','category','summary') NOT NULL,
  period VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) DEFAULT 0,
  budget DECIMAL(10,2),
  transactions INT DEFAULT 0,
  category_id INT,
  metadata JSON,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  CONSTRAINT fk_report_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_report_category
    FOREIGN KEY (category_id)
    REFERENCES categories(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- =========================
-- REPORT CACHE
-- =========================
CREATE TABLE report_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  cache_key VARCHAR(100) NOT NULL,
  cache_data JSON NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  CONSTRAINT fk_cache_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================
-- USER SETTINGS
-- =========================
CREATE TABLE user_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  CONSTRAINT fk_setting_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================
-- NOTIFICATIONS (USER)
-- =========================
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT NOW(),
  CONSTRAINT fk_notification_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================
-- DEVICES
-- =========================
CREATE TABLE devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  device_name VARCHAR(100),
  platform VARCHAR(50),
  browser VARCHAR(50),
  ip_address VARCHAR(45),
  city VARCHAR(100),
  country VARCHAR(10),
  fingerprint VARCHAR(100),
  session_token VARCHAR(255),
  is_trusted BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,
  is_current BOOLEAN DEFAULT FALSE,
  last_activity_at DATETIME,
  expires_at DATETIME,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  CONSTRAINT fk_device_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================
-- SUPPORT TICKETS
-- =========================
CREATE TABLE support_tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'new',
  created_at DATETIME DEFAULT NOW(),
  CONSTRAINT fk_ticket_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- =========================
-- ADMIN NOTIFICATIONS
-- =========================
CREATE TABLE admin_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NULL,
  support_ticket_id INT NULL,
  type VARCHAR(50),
  title VARCHAR(255),
  payload JSON,
  is_read BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT NOW(),
  CONSTRAINT fk_admin_notif_admin
    FOREIGN KEY (admin_id)
    REFERENCES admins(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_admin_notif_ticket
    FOREIGN KEY (support_ticket_id)
    REFERENCES support_tickets(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================
-- USER INCOME SETTINGS
-- =========================
CREATE TABLE user_income_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNIQUE,
  monthly_salary DECIMAL(12,2) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  CONSTRAINT fk_income_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
