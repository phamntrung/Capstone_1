# 📖 Hướng Dẫn Chạy Chương Trình SmartExpense

## 🚀 Các Bước Chạy Chương Trình

### Bước 1: Cài Đặt Dependencies (Chỉ cần làm 1 lần)

Mở terminal/command prompt và chạy:

```bash
cd backend-node
npm install
```

### Bước 2: Cấu Hình Môi Trường

1. **Copy file cấu hình mẫu:**
   ```bash
   cd backend-node
   copy env.example .env
   ```
   
   (Trên Linux/Mac: `cp env.example .env`)

2. **Chỉnh sửa file `.env`** (nếu cần):
   - Mở file `backend-node/.env`
   - Cập nhật các thông tin sau nếu cần:
     - `DB_HOST`: Địa chỉ MySQL (mặc định: `localhost`)
     - `DB_PORT`: Port MySQL (mặc định: `3306`)
     - `DB_USER`: Tên người dùng MySQL (mặc định: `root`)
     - `DB_PASS`: Mật khẩu MySQL (để trống nếu không có)
     - `DB_NAME`: Tên database (mặc định: `smart_expense`)
     - `JWT_SECRET`: Chuỗi bí mật cho JWT (nên thay đổi)
     - `PORT`: Port cho backend (mặc định: `5000`)

### Bước 3: Khởi Động Backend Node.js

Mở terminal/command prompt và chạy:

```bash
cd backend-node
npm run dev
```

**Khi khởi động thành công, bạn sẽ thấy:**
```
🚀 SmartExpense API running on http://0.0.0.0:5000
📊 Environment: development
```

⚠️ **QUAN TRỌNG:** Đừng đóng terminal này! Backend phải chạy liên tục.

### Bước 4: Khởi Động Frontend Server

Mở một terminal/command prompt **KHÁC** và chạy:

```bash
python -m http.server 5050
```

**Khi khởi động thành công, bạn sẽ thấy:**
```
Serving HTTP on 0.0.0.0 port 5050 ...
```

### Bước 5: Truy Cập Ứng Dụng

Mở trình duyệt và truy cập:

**Trang chủ:**
```
http://localhost:5050/frontend/User/trangchu.html
```

**Trang đăng nhập:**
```
http://localhost:5050/frontend/User/login.html
```

**Trang đăng ký:**
```
http://localhost:5050/frontend/User/dangki.html
```

---

## ⚙️ Cấu Hình Chi Tiết

### Cấu Hình Database

Nếu bạn chưa có database, tạo database MySQL:

```sql
CREATE DATABASE smart_expense CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Sau đó import schema:

```bash
mysql -u root -p smart_expense < database_schema.sql
```

### Cấu Hình Backend (.env)

File `backend-node/.env` chứa các cấu hình sau:

```env
# Server Configuration
PORT=5000
HOST=0.0.0.0
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=smart_expense

# JWT Configuration
JWT_SECRET=your_super_secret_key_here_change_this_to_something_long_and_random
JWT_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=*

# Email Configuration (Tùy chọn)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=SmartExpense <your_email@gmail.com>

# Google OAuth Configuration (Tùy chọn)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Twilio Configuration (Tùy chọn - cho SMS)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_VERIFY_SERVICE_SID=your_service_sid
```

### Cấu Hình Frontend

Frontend tự động kết nối với backend tại `http://localhost:5000` (hoặc port bạn đã cấu hình trong `.env`).

Nếu bạn thay đổi port backend, cần cập nhật trong file `frontend/js/utils.js`:

```javascript
const API_BASE = 'http://localhost:5000'; // Thay đổi port nếu cần
```

---

## 🔧 Xử Lý Lỗi Thường Gặp

### Lỗi: "Cannot connect to server" hoặc "ERR_CONNECTION_REFUSED"

**Nguyên nhân:** Backend Node.js chưa được khởi động hoặc đang chạy ở port khác.

**Giải pháp:**
1. Kiểm tra backend có đang chạy không (xem terminal có dòng "🚀 SmartExpense API running on..." không)
2. Kiểm tra port 5000 có bị chiếm dụng không:
   ```bash
   # Windows
   netstat -ano | findstr :5000
   
   # Linux/Mac
   lsof -i :5000
   ```
3. Nếu port bị chiếm, đổi port trong file `.env` hoặc tắt ứng dụng đang dùng port đó

### Lỗi: "Database connection failed"

**Nguyên nhân:** Không kết nối được đến MySQL hoặc database chưa được tạo.

**Giải pháp:**
1. Kiểm tra MySQL đang chạy:
   ```bash
   # Windows
   net start MySQL
   
   # Linux/Mac
   sudo systemctl status mysql
   ```
2. Kiểm tra thông tin kết nối trong file `.env` (DB_HOST, DB_USER, DB_PASS, DB_NAME)
3. Tạo database nếu chưa có (xem phần "Cấu Hình Database" ở trên)

### Lỗi: "Module not found" hoặc "Cannot find module"

**Nguyên nhân:** Chưa cài đặt dependencies.

**Giải pháp:**
```bash
cd backend-node
npm install
```

### Lỗi: Port 5050 đã được sử dụng

**Giải pháp:** Sử dụng port khác:
```bash
python -m http.server 8080  # Thay 8080 bằng port khác
```

Sau đó truy cập: `http://localhost:8080/frontend/User/trangchu.html`

---

## 📝 Tóm Tắt Lệnh Nhanh

```bash
# 1. Cài đặt dependencies (chỉ cần làm 1 lần)
cd backend-node
npm install

# 2. Cấu hình (chỉ cần làm 1 lần)
copy env.example .env  # Windows
# hoặc
cp env.example .env    # Linux/Mac

# 3. Khởi động backend (terminal 1)
cd backend-node
npm run dev

# 4. Khởi động frontend (terminal 2)
python -m http.server 5050

# 5. Truy cập ứng dụng
# http://localhost:5050/frontend/User/trangchu.html
```

---

## 🔗 Các URL Quan Trọng

- **Trang chủ:** http://localhost:5050/frontend/User/trangchu.html
- **Đăng nhập:** http://localhost:5050/frontend/User/login.html
- **Đăng ký:** http://localhost:5050/frontend/User/dangki.html
- **Báo cáo:** http://localhost:5050/frontend/User/baocao.html
- **Backend API:** http://localhost:5000

---

## 💡 Lưu Ý

1. **Backend phải chạy trước:** Luôn khởi động backend Node.js trước khi sử dụng ứng dụng
2. **Giữ terminal mở:** Không đóng terminal khi backend/frontend đang chạy
3. **Kiểm tra port:** Đảm bảo port 5000 (backend) và 5050 (frontend) không bị chiếm dụng
4. **Database:** Đảm bảo MySQL đang chạy và database đã được tạo
5. **CORS:** Nếu gặp lỗi CORS, kiểm tra `CORS_ORIGIN` trong file `.env`

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra console trình duyệt (F12) để xem lỗi
2. Kiểm tra log trong terminal backend
3. Đảm bảo cả backend và frontend đều đang chạy
4. Kiểm tra file `.env` đã được cấu hình đúng
5. Kiểm tra database đã được tạo và kết nối thành công

