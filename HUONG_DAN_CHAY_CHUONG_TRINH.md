# 📖 Hướng Dẫn Chạy Chương Trình SmartExpense

## 🚀 Các Bước Chạy Chương Trình

### ⚡ Quick Start (Lần Đầu Tiên)

**Chỉ cần làm 1 lần khi mới clone project:**

```bash
# 1. Cài đặt dependencies
cd backend-node
npm install

# 2. Tạo file cấu hình
copy env.example .env

# 3. Kiểm tra và chỉnh sửa file .env nếu cần (xem chi tiết bên dưới)
```

---

### 📋 Hướng Dẫn Chi Tiết

#### Bước 1: Cài Đặt Dependencies (Chỉ cần làm 1 lần)

Mở **PowerShell** hoặc **Command Prompt** và chạy:

```powershell
cd backend-node
npm install
```

⏱️ **Thời gian:** Khoảng 1-2 phút tùy vào tốc độ mạng.

#### Bước 2: Cấu Hình Môi Trường (Chỉ cần làm 1 lần)

1. **Tạo file cấu hình từ mẫu:**
   ```powershell
   cd backend-node
   copy env.example .env
   ```

2. **Kiểm tra file `.env` đã được tạo:**
   - Mở thư mục `backend-node`
   - Kiểm tra có file `.env` (có thể ẩn, cần bật hiển thị file ẩn)

3. **Chỉnh sửa file `.env`** (nếu cần thay đổi):
   - Mở file `backend-node/.env` bằng Notepad hoặc VS Code
   - Các thông tin quan trọng cần kiểm tra:
     - `DB_HOST`: Địa chỉ MySQL (mặc định: `localhost`)
     - `DB_PORT`: Port MySQL (mặc định: `3306`)
     - `DB_USER`: Tên người dùng MySQL (mặc định: `root`)
     - `DB_PASS`: Mật khẩu MySQL (để trống nếu không có mật khẩu)
     - `DB_NAME`: Tên database (mặc định: `smart_expense`)
     - `JWT_SECRET`: Chuỗi bí mật cho JWT (có thể giữ nguyên hoặc thay đổi)
     - `PORT`: Port cho backend (mặc định: `5000`)

💡 **Lưu ý:** Nếu bạn chưa thay đổi gì, có thể bỏ qua bước này và dùng cấu hình mặc định.

#### Bước 3: Khởi Động Backend Server

1. **Mở PowerShell hoặc Command Prompt mới**

2. **Chạy lệnh:**
   ```powershell
   cd backend-node
   npm run dev
   ```

3. **Kiểm tra khởi động thành công:**
   Bạn sẽ thấy thông báo tương tự:
   ```
   🚀 SmartExpense API running on http://0.0.0.0:5000
   📊 Environment: development
   ✅ Database pool created: localhost:3306/smart_expense
   ```

⚠️ **QUAN TRỌNG:** 
- **Đừng đóng cửa sổ terminal này!** Backend phải chạy liên tục.
- Nếu thấy lỗi kết nối database, kiểm tra MySQL đã chạy chưa (xem phần "Xử Lý Lỗi" bên dưới).

#### Bước 4: Khởi Động Frontend Server

1. **Mở PowerShell hoặc Command Prompt MỚI** (giữ nguyên terminal backend đang chạy)

2. **Chạy lệnh:**
   ```powershell
   python -m http.server 5000
   ```

   💡 **Nếu không có Python:** Cài đặt Python từ [python.org](https://www.python.org/downloads/) hoặc dùng:
   ```powershell
   py -m http.server 5000

3. **Kiểm tra khởi động thành công:**
   Bạn sẽ thấy:
   ```
   Serving HTTP on 127.0.0.1 port 5000 ...
   ```

#### Bước 5: Truy Cập Ứng Dụng

Mở trình duyệt web (Chrome, Edge, Firefox...) và truy cập:

**🔗 Trang chủ:**
```
http://localhost:5050/frontend/User/trangchu.html
```

**🔗 Trang đăng nhập:**
```
http://localhost:5050/frontend/User/login.html
```

**🔗 Trang đăng ký:**
```
http://localhost:5050/frontend/User/dangki.html
```

✅ **Hoàn thành!** Bây giờ bạn có thể sử dụng ứng dụng SmartExpense.

---

### 🔄 Chạy Lại Ứng Dụng (Các Lần Sau)

Sau lần đầu tiên, bạn chỉ cần:

1. **Khởi động Backend** (Terminal 1):
   ```powershell
   cd backend-node
   npm run dev
   ```

2. **Khởi động Frontend** (Terminal 2):
   ```powershell
   python -m http.server 5000
   ```

3. **Truy cập:** `http://localhost:5000/frontend/User/trangchu.html`

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
python -m http.server 8080 --bind 127.0.0.1  # Thay 8080 bằng port khác
```

Sau đó truy cập: `http://localhost:8080/frontend/User/trangchu.html`

### Lỗi: Google OAuth không hoạt động (403 error)

**Nguyên nhân:** Server chạy trên IPv6 thay vì IPv4, dẫn đến origin không khớp với Google Console.

**Giải pháp:** Luôn dùng `--bind 127.0.0.1` khi chạy Python HTTP server:
```bash
python -m http.server 5050 --bind 127.0.0.1
```

Đảm bảo đã thêm các URI sau vào Google OAuth Console:
- `http://127.0.0.1:5050`
- `http://localhost:5050`

---

## 📝 Tóm Tắt Lệnh Nhanh

### Lần Đầu Tiên (Setup)

```powershell
# 1. Cài đặt dependencies
cd backend-node
npm install

# 2. Tạo file cấu hình
copy env.example .env
```

### Chạy Ứng Dụng (Mỗi Lần Sử Dụng)

**Terminal 1 - Backend:**
```powershell
cd backend-node
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
python -m http.server 5050 --bind 127.0.0.1
```

**Truy cập:** `http://localhost:5050/frontend/User/trangchu.html`

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

