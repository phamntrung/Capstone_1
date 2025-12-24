# Hướng Dẫn Đăng Nhập Hệ Thống SmartExpense

## 📋 Thông Tin Đăng Nhập Mặc Định

Hệ thống đã được cấu hình với tài khoản admin mặc định:

### Tài khoản Admin:
- **Email:** `admin@smartexpense.com`
- **Mật khẩu:** `Admin@123`
- **Vai trò:** Admin

## 🔧 Các Bước Đăng Nhập

### 1. Đảm bảo Database đã được setup

Chạy file `database_schema.sql` để tạo database và tài khoản admin:

```sql
mysql -u root -p < database_schema.sql
```

Hoặc mở MySQL và chạy:
```sql
SOURCE database_schema.sql;
```

### 2. Đảm bảo Backend đang chạy

Vào thư mục `backend-node` và chạy:
```bash
npm install
npm run dev
```

Backend sẽ chạy tại: `http://localhost:5000`

### 3. Đăng nhập qua giao diện

1. Mở file `frontend/User/login.html` trong trình duyệt
2. Nhập thông tin:
   - **Email:** `admin@smartexpense.com`
   - **Mật khẩu:** `Admin@123`
3. Click nút "Đăng nhập"

## 🔍 Kiểm Tra Nếu Không Đăng Nhập Được

### Kiểm tra Database có user admin không:

```sql
USE smart_expense;
SELECT id, email, name, role FROM users WHERE email = 'admin@smartexpense.com';
```

Nếu không có kết quả, chạy lại script seed:

```sql
INSERT INTO users (name, email, password_hash, role, currency, created_at, updated_at)
SELECT 'System Admin', 'admin@smartexpense.com', '$2a$10$cDRuwa.98Wxzw0J4qEFqueR5qwVKjvYcu4VPSP2/dONpxHPlm9Zu.', 'admin', 'VND', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@smartexpense.com');
```

### Kiểm tra Backend có kết nối Database không:

Xem log của backend khi khởi động, phải thấy:
```
✅ Database pool created: localhost:3306/smart_expense
```

### Kiểm tra CORS và API:

Mở Developer Tools (F12) > Network tab, xem request login có trả về lỗi gì không.

## 📝 Tạo Tài Khoản User Mới

Nếu muốn tạo tài khoản user thông thường:

1. Vào trang đăng ký (nếu có)
2. Hoặc đăng nhập bằng Google (nếu đã cấu hình OAuth)
3. Hoặc tạo trực tiếp trong database:

```sql
-- Tạo user mới (mật khẩu: password123)
-- Cần hash mật khẩu bằng bcrypt trước
INSERT INTO users (name, email, password_hash, role, currency)
VALUES ('User Name', 'user@example.com', '$2a$10$...', 'user', 'VND');
```

## ⚠️ Lưu Ý

- Mật khẩu được hash bằng bcrypt, không thể xem được mật khẩu gốc
- Email phải là unique trong database
- Backend phải có file `.env` với cấu hình database đúng
- Đảm bảo MySQL/MariaDB đang chạy

## 🆘 Nếu Vẫn Không Được

1. Kiểm tra log backend để xem lỗi cụ thể
2. Kiểm tra kết nối database
3. Kiểm tra file `.env` trong `backend-node/`
4. Thử đăng nhập bằng Google nếu đã cấu hình OAuth

