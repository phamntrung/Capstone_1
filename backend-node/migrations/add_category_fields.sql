-- Migration: Bổ sung các trường color, note, is_active vào bảng categories
-- Ngày tạo: 2025

USE smart_expense;

-- Thêm cột color (màu sắc)
ALTER TABLE categories
ADD COLUMN color VARCHAR(7) DEFAULT '#3b82f6' COMMENT 'Màu sắc (hex, ví dụ: #3b82f6)';

-- Thêm cột note (ghi chú)
ALTER TABLE categories
ADD COLUMN note TEXT NULL COMMENT 'Ghi chú cho danh mục';

-- Thêm cột is_active (trạng thái)
ALTER TABLE categories
ADD COLUMN is_active BOOLEAN DEFAULT TRUE COMMENT 'Trạng thái: TRUE = BẬT, FALSE = TẮT';

-- Cập nhật các category hiện có (nếu có) với giá trị mặc định
-- Lưu ý: Nếu bị lỗi Safe Update Mode, có thể bỏ qua vì các cột đã có DEFAULT value
UPDATE categories
SET color = '#3b82f6', is_active = TRUE
WHERE (color IS NULL OR is_active IS NULL) AND id > 0;

