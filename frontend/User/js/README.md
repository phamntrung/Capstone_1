# Frontend JavaScript Files - SmartExpense

Thư mục `frontend/js` chứa tất cả các file JavaScript cho ứng dụng SmartExpense frontend.

## Danh sách các file và chức năng:

### 1. **utils.js** - Utilities (Tiện ích chung)
- **Chức năng**: File tiện ích chung, được sử dụng bởi tất cả các trang
- **Nội dung chính**:
  - Cấu hình API base URL (`http://127.0.0.1:5000` - Flask backend)
  - Hàm `apiRequest()` - Gửi request đến backend API
  - Hàm `checkAuth()` - Kiểm tra authentication
  - Hàm `showMessage()` - Hiển thị thông báo
  - Xử lý CORS và error handling
- **Được load bởi**: Tất cả các trang HTML

### 2. **auth.js** - Authentication (Xác thực)
- **Chức năng**: Xử lý đăng nhập và Google OAuth
- **Nội dung chính**:
  - Validate form đăng nhập
  - Xử lý submit form đăng nhập
  - Xử lý Google OAuth callback
  - Kiểm tra trạng thái đăng nhập
- **Được sử dụng bởi**: `login.html`

### 3. **login.js** - Login Logic
- **Chức năng**: Logic riêng cho trang đăng nhập
- **Nội dung chính**:
  - Xử lý form đăng nhập
  - Google OAuth integration
  - Redirect sau khi đăng nhập thành công
- **Được sử dụng bởi**: `login.html`

### 4. **register.js** - Registration (Đăng ký)
- **Chức năng**: Xử lý đăng ký tài khoản mới
- **Nội dung chính**:
  - Validate form đăng ký
  - Gửi request đăng ký đến backend
  - Xử lý response và redirect
- **Được sử dụng bởi**: `dangki.html`

### 5. **dashboard.js** - Dashboard (Trang chủ)
- **Chức năng**: Xử lý trang chủ và hiển thị dữ liệu tổng quan
- **Nội dung chính**:
  - Load dữ liệu user
  - Hiển thị số dư, chi tiêu, thu nhập
  - Hiển thị biểu đồ và thống kê
  - Quản lý giao dịch (thêm, sửa, xóa)
- **Được sử dụng bởi**: `trangchu.html`

### 6. **baocao.js** - Reports (Báo cáo)
- **Chức năng**: Xử lý chức năng báo cáo và thống kê
- **Nội dung chính**:
  - Class `BaoCaoManager` - Quản lý báo cáo
  - Load dữ liệu báo cáo từ API
  - Vẽ biểu đồ (Chart.js)
  - Thống kê theo ngày/tháng
  - Xuất báo cáo
  - Lọc dữ liệu
- **Được sử dụng bởi**: `baocao.html`

### 7. **hoso.js** - Profile (Hồ sơ)
- **Chức năng**: Quản lý trang hồ sơ người dùng
- **Nội dung chính**:
  - Load và lưu thông tin profile
  - Quản lý theme (light/dark)
  - Quản lý ngôn ngữ (i18n)
  - Chatbox với AI assistant
  - Cập nhật thông tin cá nhân
- **Được sử dụng bởi**: `hoso.html`

### 8. **dataManager.js** - Data Manager (Quản lý dữ liệu)
- **Chức năng**: Quản lý dữ liệu người dùng và đồng bộ với backend
- **Nội dung chính**:
  - Class `DataManager` - Quản lý dữ liệu
  - Load dữ liệu từ API (ưu tiên)
  - Lưu dữ liệu vào localStorage (backup)
  - Đồng bộ dữ liệu giữa các thiết bị
  - Queue để sync khi offline
- **Được sử dụng bởi**: Tất cả các trang cần quản lý dữ liệu

### 9. **ai.js** - AI Assistant (Trợ lý AI)
- **Chức năng**: Xử lý tích hợp AI chat và tạo giao dịch
- **Nội dung chính**:
  - Hàm `chat()` - Gửi tin nhắn đến AI
  - Lưu lịch sử chat vào localStorage
  - Tạo giao dịch từ AI response
  - API helper functions
- **Được sử dụng bởi**: Các trang có chatbox AI (hoso.html, trangchu.html)

### 10. **encoding-fix.js** - Encoding Fix (Sửa lỗi encoding)
- **Chức năng**: Xử lý các vấn đề về encoding ký tự
- **Nội dung chính**:
  - Fix encoding cho tiếng Việt
  - Xử lý UTF-8 characters
- **Được sử dụng bởi**: Tất cả các trang (nếu cần)

## Thứ tự load các file:

1. **utils.js** - Phải load đầu tiên (chứa các hàm tiện ích chung)
2. **encoding-fix.js** - Load sớm (nếu cần fix encoding)
3. **auth.js** - Cho trang login
4. **login.js** - Cho trang login
5. **register.js** - Cho trang đăng ký
6. **dataManager.js** - Cho các trang cần quản lý dữ liệu
7. **dashboard.js** - Cho trang chủ
8. **baocao.js** - Cho trang báo cáo
9. **hoso.js** - Cho trang hồ sơ
10. **ai.js** - Cho các trang có AI chat

## Cấu hình API:

- **API Base URL**: `http://127.0.0.1:5000` (Flask backend)
- **Backend**: Flask (Python) - port 5000
- **Authentication**: JWT tokens (lưu trong localStorage hoặc httpOnly cookie)

## Lưu ý:

- Tất cả các file đều phụ thuộc vào `utils.js` để sử dụng hàm `apiRequest()`
- `dataManager.js` quản lý đồng bộ dữ liệu giữa frontend và backend
- Các file được viết bằng vanilla JavaScript (không dùng framework)
- Hỗ trợ ES6+ features (async/await, classes, arrow functions)

