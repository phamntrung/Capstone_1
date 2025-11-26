# 🚀 Hướng Dẫn Chạy Chương Trình SmartExpense

## ⚡ Quick Start

### Lần Đầu Tiên (Setup)

```powershell
# 1. Cài đặt dependencies
cd backend-node
npm install

# 2. Tạo file cấu hình
copy env.example .env
```

### Chạy Ứng Dụng

**Terminal 1 - Backend:**
```powershell
cd backend-node
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
python -m http.server 5000
```

**Truy cập:** `http://localhost:5000/frontend/User/UI_User/trangchu.html`

---

## 📋 Các Bước Chi Tiết

### 1. Cài Đặt Dependencies (Chỉ 1 lần)

```powershell
cd backend-node
npm install
```

### 2. Cấu Hình (Chỉ 1 lần)

Tạo file `.env` từ mẫu:
```powershell
cd backend-node
copy env.example .env
```

Kiểm tra file `.env` (nếu cần thay đổi):
- `DB_HOST`: localhost
- `DB_USER`: root
- `DB_PASS`: (để trống nếu không có)
- `DB_NAME`: smart_expense
- `PORT`: 5000

### 3. Khởi Động Backend

```powershell
cd backend-node
npm run dev
```

✅ Thành công khi thấy: `🚀 SmartExpense API running on http://0.0.0.0:5000`

⚠️ **Lưu ý:** Giữ terminal này mở, không đóng!

### 4. Khởi Động Frontend

Mở terminal mới:
```powershell
python -m http.server 5000
```

### 5. Truy Cập Ứng Dụng

- **Trang chủ:** http://localhost:5000/frontend/User/UI_User/trangchu.html
- **Đăng nhập:** http://localhost:5000/frontend/User/UI_User/login.html
- **Đăng ký:** http://localhost:5000/frontend/User/UI_User/dangki.html

---

## 🗄️ Setup Database (Nếu chưa có)

```sql
CREATE DATABASE smart_expense CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Import schema:
```bash
mysql -u root -p smart_expense < database_schema.sql
```



---

## 📝 Tóm Tắt Lệnh

**Setup (1 lần):**
```powershell
cd backend-node
npm install
copy env.example .env
```

**Chạy (mỗi lần):**
```powershell
# Terminal 1
cd backend-node
npm run dev

# Terminal 2
python -m http.server 5000
```

**Truy cập:** http://localhost:5000/frontend/User/UI_User/trangchu.html

---

## 💡 Lưu Ý

1. ✅ Backend phải chạy trước khi mở frontend
2. ✅ Giữ cả 2 terminal mở khi sử dụng
3. ✅ Đảm bảo MySQL đang chạy
4. ✅ Kiểm tra port 5000 (backend) và 5050 (frontend) không bị chiếm

---

## 🔗 URLs Quan Trọng

- **Trang chủ:** http://localhost:5000/frontend/User/UI_User/trangchu.html
- **Đăng nhập:** http://localhost:5000/frontend/User/UI_User/login.html
- **Đăng ký:** http://localhost:5000/frontend/User/UI_User/dangki.html
- **Backend API:** http://localhost:5000
