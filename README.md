# SmartExpense - AI-Powered Smart Expense Management System

Hệ thống quản lý chi tiêu thông minh với AI, hỗ trợ đăng ký/đăng nhập, quản lý chi tiêu, phân tích thông minh và chatbot AI.

## 📋 Mục Lục

- [Tổng Quan](#tổng-quan)
- [Tính Năng](#tính-năng)
- [Cài Đặt và Chạy](#cài-đặt-và-chạy)
- [Cấu Trúc Dự Án](#cấu-trúc-dự-án)
- [Đăng Ký và Đăng Nhập](#đăng-ký-và-đăng-nhập)
- [Database](#database)
- [Các Lỗi Đã Sửa](#các-lỗi-đã-sửa)
- [Cải Tiến Tương Lai](#cải-tiến-tương-lai)
- [Hỗ Trợ](#hỗ-trợ)

## 📖 Tổng Quan

SmartExpense là một hệ thống quản lý chi tiêu cá nhân được trang bị AI để tự động phân loại chi tiêu, dự đoán xu hướng chi tiêu, và cung cấp các thông tin thông minh về tài chính của bạn.

### Công Nghệ Sử Dụng

**Frontend:**
- HTML5, CSS3, JavaScript (ES6+)
- Vanilla JavaScript (không sử dụng framework)
- Responsive design

**Backend:**
- **Node.js** (Khuyến nghị): Express.js, JWT authentication, MySQL2
- **Flask** (Tùy chọn): Python, SQLAlchemy

**Database:**
- MySQL/MariaDB với triggers, stored procedures, views

**AI & Services:**
- AI tự động phân loại chi tiêu
- Email notifications với Nodemailer
- Google OAuth 2.0 authentication

### Backend

Hệ thống hỗ trợ 2 backend:
- **Backend Node.js** (Khuyến nghị): `backend-node/` - Hiện đại, nhanh, có AI, hỗ trợ đầy đủ tính năng
- **Backend Flask**: `backend/` - Python, đơn giản, dễ cấu hình (tùy chọn)

## 🎯 Tính Năng

### Xác Thực Người Dùng
- ✅ Đăng ký tài khoản mới
- ✅ Đăng nhập bằng email/password
- ✅ Đăng nhập bằng Google OAuth
- ✅ Quản lý session với JWT token
- ✅ Quên mật khẩu (đang phát triển)

### Quản Lý Chi Tiêu
- ✅ Tạo, sửa, xóa chi tiêu và thu nhập
- ✅ Phân loại chi tiêu theo danh mục tùy chỉnh
- ✅ Thiết lập và theo dõi ngân sách theo tháng
- ✅ Xem báo cáo chi tiết (theo ngày, tháng, danh mục)
- ✅ Lịch sử chi tiêu đầy đủ
- ✅ Xuất dữ liệu

### AI Features
- ✅ Tự động phân loại chi tiêu thông minh
- ✅ Dự đoán xu hướng chi tiêu
- ✅ Cảnh báo ngân sách tự động
- ✅ Chatbot AI để hỏi đáp về tài chính
- ✅ Phân tích và đề xuất tài chính

## 🚀 Cài Đặt và Chạy

### Yêu Cầu Hệ Thống

- **Node.js**: v14.0.0 trở lên (khuyến nghị v18+)
- **MySQL/MariaDB**: 5.7+ hoặc MariaDB 10.2+
- **Python**: 3.7+ (nếu sử dụng Backend Flask)
- **npm**: v6.0.0 trở lên
- **Trình duyệt**: Chrome, Firefox, Edge, Safari (phiên bản mới nhất)

### Cài Đặt Dependencies

**Backend Node.js:**
```bash
cd backend-node
npm install
```

**Backend Flask (Tùy chọn):**
```bash
cd backend
pip install -r requirements.txt
```

### 🎯 Cách Chạy (Nhanh Nhất)

#### ⚡ Cách 1: Chạy Tự Động (Khuyến nghị - Windows PowerShell)

**Chạy cả Backend và Frontend tự động:**

```powershell
.\start.ps1
```

Script này sẽ:
- ✅ Tự động fix lỗi pyvenv.cfg (nếu có)
- ✅ Khởi động Backend Node.js trong terminal mới
- ✅ Khởi động Frontend HTTP server trong terminal mới
- ✅ Tự động mở trình duyệt tại http://localhost:8080/frontend/login.html

**Hoặc chạy riêng từng phần:**

```powershell
# Chạy Backend Flask (nếu dùng Flask thay vì Node.js)
.\run-flask.ps1

# Chạy Frontend
.\run-frontend.ps1
```

#### 📝 Cách 2: Chạy Thủ Công

⚠️ **QUAN TRỌNG:** Bạn PHẢI khởi động Backend Node.js TRƯỚC KHI sử dụng ứng dụng. Nếu không, bạn sẽ gặp lỗi "Lỗi kết nối đến server" khi đăng nhập.

**Bước 1: Khởi động Backend Node.js (BẮT BUỘC)**

Mở terminal/command prompt và chạy:

```bash
cd backend-node
npm install          # Chỉ cần chạy lần đầu để cài đặt dependencies
npm run dev          # Khởi động server với nodemon (tự động restart khi code thay đổi)
```

**Hoặc nếu không có nodemon:**

```bash
cd backend-node
npm start            # Khởi động server thông thường
```

**Khi server khởi động thành công, bạn sẽ thấy:**
```
🚀 SmartExpense API running on http://0.0.0.0:5001
📊 Environment: development
```

**⚠️ ĐỪNG đóng terminal này!** Server phải chạy liên tục để ứng dụng hoạt động.

**Bước 2: Khởi động Frontend**

Mở một terminal/command prompt KHÁC và chạy:

```bash
# Di chuyển vào thư mục frontend (hoặc thư mục gốc của project)
cd frontend
python -m http.server 8080
```

**Hoặc nếu bạn đang ở thư mục gốc:**

```bash
python -m http.server 8080
```

**Khi server khởi động thành công, bạn sẽ thấy:**
```
Serving HTTP on 0.0.0.0 port 8080 ...
```

**Bước 3: Truy cập ứng dụng**

- **Frontend:** http://localhost:8080/frontend/login.html (hoặc http://127.0.0.1:8080/frontend/login.html)
- **Backend API:** http://127.0.0.1:5001 (để kiểm tra server có đang chạy)

### 🔧 Xử Lý Lỗi Kết Nối

**Nếu bạn gặp lỗi "Lỗi kết nối đến server" hoặc "ERR_CONNECTION_REFUSED":**

1. ✅ **Kiểm tra Backend Node.js có đang chạy không:**
   - Mở terminal và kiểm tra có thấy dòng "🚀 SmartExpense API running on..." không
   - Nếu không, khởi động lại: `cd backend-node && npm run dev`

2. ✅ **Kiểm tra port 5001 có bị chiếm dụng không:**
   ```bash
   # Windows
   netstat -ano | findstr :5001
   
   # Mac/Linux
   lsof -i :5001
   ```
   - Nếu port đã bị chiếm dụng, bạn có thể đổi port trong file `backend-node/.env` hoặc `backend-node/server.js`

3. ✅ **Kiểm tra firewall/antivirus:**
   - Đảm bảo firewall không chặn port 5001
   - Tạm thời tắt antivirus để thử (nếu có)

4. ✅ **Kiểm tra URL trong code:**
   - Mở `chucnang/js/utils.js`
   - Kiểm tra `API_BASE` có đúng là `http://127.0.0.1:5001` không

5. ✅ **Thử truy cập trực tiếp Backend API:**
   - Mở trình duyệt và truy cập: http://127.0.0.1:5001
   - Nếu thấy JSON response với thông tin về API, nghĩa là server đang chạy tốt

## 📁 Cấu Trúc Dự Án

```
├── frontend/                    # Frontend HTML pages
│   ├── login.html                  # Trang đăng nhập
│   ├── dangki.html                 # Trang đăng ký
│   ├── trangchu.html               # Trang chủ/Dashboard
│   ├── baocao.html                 # Trang báo cáo
│   ├── danhsachchitieu.html        # Danh sách chi tiêu
│   ├── loaichitieu.html            # Quản lý loại chi tiêu
│   ├── hoso.html                   # Hồ sơ người dùng
│   ├── caidat.html                 # Cài đặt
│   ├── js/                         # JavaScript modules
│   │   ├── login.js                # Xử lý đăng nhập
│   │   ├── register.js             # Xử lý đăng ký
│   │   ├── utils.js                # Utilities và API requests
│   │   ├── dashboard.js            # Dashboard logic
│   │   ├── baocao.js               # Báo cáo logic
│   │   ├── dataManager.js          # Quản lý dữ liệu
│   │   └── ai.js                   # AI features
│   └── css/                        # Stylesheets
│
├── backend-node/                  # Backend Node.js (Khuyến nghị)
│   ├── routes/                     # API routes
│   │   ├── auth.js                 # Authentication endpoints
│   │   ├── expenses.js             # Expenses endpoints
│   │   ├── categories.js           # Categories endpoints
│   │   ├── budgets.js              # Budgets endpoints
│   │   ├── reports.js              # Reports endpoints
│   │   ├── ai.js                   # AI endpoints
│   │   └── email.js                # Email endpoints
│   ├── middleware/                 # Middleware
│   │   └── auth.js                 # Authentication middleware
│   ├── data/                       # Data access layer
│   ├── services/                  # Business logic services
│   │   ├── emailService.js         # Email service
│   │   └── emailScheduler.js       # Email scheduler
│   ├── ai/                         # AI services
│   │   └── aiService.js            # AI service
│   ├── utils/                      # Utilities
│   │   └── password.js             # Password hashing
│   ├── database.js                 # Database connection
│   ├── server.js                   # Main server file
│   └── package.json                # Dependencies
│
├── backend/                        # Backend Flask (Python) - Tùy chọn
│   ├── app.py                      # Main Flask app
│   ├── models.py                   # Database models
│   └── ...
│
├── database_schema.sql             # Database schema hoàn chỉnh (DUY NHẤT)
└── README.md                       # File này
```

## 🔐 Đăng Ký và Đăng Nhập

### Đăng Ký Tài Khoản Mới

1. Truy cập: `frontend/dangki.html`
2. Điền thông tin:
   - **Tên**: Tên hiển thị
   - **Email**: Email hợp lệ
   - **Mật khẩu**: Tối thiểu 6 ký tự
   - **Xác nhận mật khẩu**: Phải khớp với mật khẩu
3. Click "Đăng ký" hoặc sử dụng Google OAuth

### Đăng Nhập

1. Truy cập: `frontend/login.html`
2. Nhập email và mật khẩu
3. Click "Đăng nhập" hoặc sử dụng Google OAuth

### 🔐 Cấu Hình Google OAuth

Để sử dụng đăng nhập Google, bạn cần cấu hình Google OAuth trong Google Cloud Console.

#### Bước 1: Lấy Client ID từ Google Console

1. Truy cập: https://console.cloud.google.com/apis/credentials
2. Chọn project của bạn (hoặc tạo project mới)
3. Click "Create Credentials" → "OAuth client ID"
4. Chọn "Web application"
5. Copy **Client ID** (dạng: `xxxxx.apps.googleusercontent.com`)

#### Bước 2: Thêm Authorized JavaScript Origins

⚠️ **QUAN TRỌNG:** Đây là bước quan trọng nhất để tránh lỗi "The given origin is not allowed".

1. Trong Google Console, click vào Client ID vừa tạo
2. Scroll xuống phần **"Authorized JavaScript origins"**
3. Click **"+ Add URI"** và thêm các origins sau:

```
http://localhost:8080
http://127.0.0.1:8080
http://localhost:3000
http://127.0.0.1:3000
```

**Lưu ý:** 
- Thêm **CHÍNH XÁC** origin bạn đang sử dụng (bao gồm protocol `http://` hoặc `https://`, host, và port nếu có)
- Không thêm đường dẫn sau `/` (ví dụ: `http://localhost:8080/frontend` là SAI)
- Chỉ thêm origin gốc: `http://localhost:8080` là ĐÚNG

#### Bước 3: Thêm Authorized Redirect URIs

1. Trong cùng màn hình, scroll xuống phần **"Authorized redirect URIs"**
2. Thêm:
```
http://localhost:8080
http://127.0.0.1:8080
```

#### Bước 4: Cập nhật Client ID trong code

**Backend Node.js:**
1. Mở `backend-node/.env`
2. Thêm hoặc cập nhật:
```env
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

**Backend Flask (nếu dùng):**
1. Mở `backend/.env`
2. Thêm hoặc cập nhật:
```env
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

**Frontend:**
1. Mở `frontend/login.html`
2. Tìm dòng:
```javascript
const GOOGLE_CLIENT_ID = '60974853277-a0jg39ps7b4too995e58rvmehte0e16a.apps.googleusercontent.com';
```
3. Thay thế bằng Client ID của bạn

#### Bước 5: Kiểm tra Origin hiện tại

Nếu bạn gặp lỗi **"[GSI_LOGGER]: The given origin is not allowed"**:

1. Mở file `check-origin.html` trong trình duyệt (từ thư mục gốc project)
2. Copy origin hiển thị trên trang
3. Thêm origin đó vào Google Console → Authorized JavaScript origins
4. Click "Save" và đợi 5-10 phút để Google cập nhật
5. Refresh trang (Ctrl + Shift + R) và thử lại

#### 🔧 Xử Lý Lỗi Google OAuth

**Lỗi: "[GSI_LOGGER]: The given origin is not allowed for the given client ID"**

✅ **Giải pháp:**
1. Kiểm tra origin hiện tại: Mở `check-origin.html` hoặc xem console browser (F12)
2. Đảm bảo origin đã được thêm vào Google Console → Authorized JavaScript origins
3. Đảm bảo origin KHÔNG có đường dẫn sau `/` (ví dụ: `http://localhost:8080` đúng, `http://localhost:8080/frontend` sai)
4. Đợi 5-10 phút sau khi save trong Google Console
5. Xóa cache browser (Ctrl + Shift + R) và thử lại

**Lỗi: "Failed to load resource: 403"**

✅ **Giải pháp:**
- Đây thường là hậu quả của lỗi origin không được phép
- Làm theo các bước trên để thêm origin vào Google Console

**Lỗi: Google Sign-In button không hiển thị**

✅ **Giải pháp:**
1. Kiểm tra console browser (F12) xem có lỗi gì không
2. Đảm bảo Google SDK đã load: Kiểm tra `window.google` trong console
3. Kiểm tra Client ID có đúng không
4. Kiểm tra origin đã được thêm vào Google Console chưa

**Lưu ý quan trọng:**
- Google OAuth **KHÔNG hoạt động** với protocol `file://` (mở file trực tiếp)
- Bạn **PHẢI** chạy qua HTTP server (ví dụ: `python -m http.server 8080`)
- Sau khi thêm origin trong Google Console, phải đợi **5-10 phút** để Google cập nhật
- Sau khi đăng nhập thành công, bạn sẽ được chuyển đến trang chủ

### API Endpoints

#### Đăng Ký
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Tên người dùng",
  "email": "email@example.com",
  "password": "password123"
}
```

#### Đăng Nhập
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "email@example.com",
  "password": "password123"
}
```

#### Đăng Nhập Google
```http
POST /api/auth/google
Content-Type: application/json

{
  "credential": "google_id_token"
}
```

## 🐛 Các Lỗi Đã Sửa

### Lỗi 1: API Request Yêu Cầu Auth Cho Endpoint Công Khai

**Vấn đề:** Hàm `apiRequest` trong `chucnang/js/utils.js` yêu cầu xác thực cho TẤT CẢ các endpoint có `/api/`, bao gồm cả các endpoint công khai như `/api/auth/register` và `/api/auth/login`. Điều này khiến người dùng không thể đăng ký hoặc đăng nhập.

**Giải pháp:** Thêm logic để nhận biết các endpoint công khai không cần xác thực:
- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/google`

**File đã sửa:** `chucnang/js/utils.js`

```javascript
// Các endpoint công khai không cần xác thực
const publicEndpoints = ['/api/auth/register', '/api/auth/login', '/api/auth/google'];
const isPublicEndpoint = publicEndpoints.some(publicPath => endpoint.includes(publicPath));

// Chỉ yêu cầu auth cho các endpoint được bảo vệ
if (!auth && endpoint.includes('/api/') && !isPublicEndpoint) {
    // Redirect to login
}
```

### Lỗi 2: Thiếu Error Handling Trong checkAuth

**Vấn đề:** Hàm `checkAuth` có thể throw lỗi nếu dữ liệu trong localStorage không hợp lệ (JSON parse error).

**Giải pháp:** Thêm try-catch để xử lý lỗi và tự động dọn dẹp dữ liệu không hợp lệ.

**File đã sửa:** `chucnang/js/utils.js`

### Lỗi 3: Thiếu Validation Email Trong Form Đăng Ký

**Vấn đề:** Form đăng ký không kiểm tra định dạng email trước khi gửi lên server.

**Giải pháp:** Thêm validation email bằng regex.

**File đã sửa:** `chucnang/js/register.js`

### Lỗi 4: Thiếu Error Handling Trong handleRegister

**Vấn đề:** Hàm `handleRegister` không có try-catch, nếu có lỗi xảy ra sẽ không hiển thị thông báo cho người dùng.

**Giải pháp:** Thêm try-catch-finally để xử lý lỗi và reset trạng thái button.

**File đã sửa:** `chucnang/js/register.js`

### Lỗi 5: Thiếu Loading State

**Vấn đề:** Khi người dùng click đăng ký, không có phản hồi trực quan (loading state).

**Giải pháp:** Thêm loading state với text "Đang đăng ký..." và disable button.

**File đã sửa:** `chucnang/js/register.js`

### Lỗi 6: Login.js Không Sử Dụng Unified API Request

**Vấn đề:** `chucnang/js/login.js` sử dụng trực tiếp `fetch` API thay vì sử dụng hàm `apiRequest` từ `utils.js`, gây ra không nhất quán trong cách xử lý API requests và có thể dẫn đến lỗi xác thực.

**Giải pháp:** 
- Cập nhật `login.js` để sử dụng `apiRequest` từ `utils.js` nếu có sẵn
- Thêm fallback về `fetch` nếu `apiRequest` chưa được load
- Đảm bảo `login.html` load `utils.js` trước `login.js`

**File đã sửa:** 
- `chucnang/js/login.js` - Cập nhật logic để sử dụng `apiRequest`
- `frontend/login.html` - Thêm script tag cho `utils.js`

### Lỗi 7: Google OAuth Callback Không Xử Lý Đúng Format

**Vấn đề:** Google OAuth callback có thể trả về credential dưới nhiều format khác nhau (string hoặc object), và `register.js` không xử lý đúng các trường hợp này.

**Giải pháp:** Cập nhật `handleGoogleCredential` trong `register.js` để tự động nhận diện và xử lý cả hai format (string hoặc object).

**File đã sửa:** `chucnang/js/register.js`

### Lỗi 8: persistSession Lưu Token Trong User Data

**Vấn đề:** Hàm `persistSession` trong `login.js` lưu token vào cả `userData` và `smartexpense_token`, gây dư thừa và có thể dẫn đến vấn đề bảo mật.

**Giải pháp:** Loại bỏ token khỏi `userData`, chỉ lưu token riêng trong `smartexpense_token`.

**File đã sửa:** `chucnang/js/login.js`

### Lỗi 9: Lỗi Kết Nối Server - ERR_CONNECTION_REFUSED

**Vấn đề:** Khi người dùng cố gắng đăng nhập hoặc đăng ký, họ gặp lỗi "Lỗi kết nối. Không thể kết nối đến server" hoặc "ERR_CONNECTION_REFUSED". Lỗi này xảy ra khi Backend Node.js chưa được khởi động hoặc không thể kết nối.

**Nguyên nhân:**
- Backend Node.js server chưa được khởi động
- Port 5001 bị chiếm dụng hoặc bị chặn bởi firewall
- URL API không đúng hoặc server đang chạy ở port khác

**Giải pháp:**
1. **Cải thiện thông báo lỗi:** Cập nhật `chucnang/js/utils.js` để hiển thị thông báo lỗi chi tiết và hướng dẫn cách khắc phục khi gặp lỗi kết nối.
2. **Cải thiện xử lý lỗi trong login:** Cập nhật `chucnang/js/login.js` để hiển thị thông báo lỗi thân thiện với người dùng.
3. **Thêm hướng dẫn chi tiết:** Cập nhật README.md với phần "Xử Lý Lỗi Kết Nối" để người dùng biết cách khắc phục.

**File đã sửa:**
- `chucnang/js/utils.js` - Cải thiện error handling trong hàm `apiRequest`
- `chucnang/js/login.js` - Cải thiện hiển thị thông báo lỗi
- `README.md` - Thêm phần "Xử Lý Lỗi Kết Nối" và cải thiện hướng dẫn Quick Start

**Các thay đổi chính:**
```javascript
// Trước: Thông báo lỗi đơn giản
errorMessage += 'Không thể kết nối đến server. Vui lòng đảm bảo Backend Node.js đang chạy tại http://127.0.0.1:5001';

// Sau: Thông báo lỗi chi tiết với hướng dẫn từng bước
errorMessage += '🔴 Backend Node.js chưa được khởi động hoặc không thể kết nối.\n\n';
errorMessage += '📋 Cách khắc phục:\n';
errorMessage += '1. Mở terminal/command prompt\n';
errorMessage += '2. Di chuyển vào thư mục backend-node:\n';
errorMessage += '   cd backend-node\n';
errorMessage += '3. Khởi động server:\n';
errorMessage += '   npm run dev\n';
```

### Lỗi 10: Báo Cáo Không Hiển Thị Dữ Liệu Sau Khi Click "Xem Thêm"

**Vấn đề:** Khi người dùng click vào nút "Xem thêm" ở báo cáo, tất cả các ngày đều hiển thị 0₫ mặc dù đã có dữ liệu chi tiêu được nhập vào tháng 10 và 11.

**Nguyên nhân:**
1. **Vấn đề về thời gian:** Hàm `aggregateDailyFromDataManager` sử dụng `toISOString()` để định dạng ngày, điều này có thể gây ra vấn đề về múi giờ (timezone). Khi so sánh ngày, nếu một ngày được lưu ở múi giờ UTC và một ngày được lưu ở múi giờ địa phương, việc so sánh sẽ không chính xác.
2. **Định dạng ngày không nhất quán:** Khi parse ngày từ chuỗi `yyyy-mm-dd`, việc sử dụng `new Date(d.date)` mà không có thời gian có thể gây ra vấn đề về múi giờ.
3. **Lọc dữ liệu không đúng:** Logic lọc expense có thể không chính xác nếu `amount` là số dương và `type` không được set đúng.

**Giải pháp:**
1. **Sửa xử lý thời gian:** Sử dụng thời gian địa phương thay vì UTC để định dạng và so sánh ngày, tránh vấn đề về múi giờ.
2. **Cải thiện parse ngày:** Khi parse ngày từ chuỗi, thêm phần thời gian `T00:00:00` để đảm bảo parse chính xác.
3. **Cải thiện logic lọc:** Kiểm tra `type === 'expense'` trước, sau đó mới kiểm tra `amount < 0`.
4. **Thêm debug logs:** Thêm các console.log để giúp debug và theo dõi quá trình xử lý dữ liệu.
5. **Thêm cảnh báo:** Nếu không tìm thấy dữ liệu, hiển thị cảnh báo cho người dùng với hướng dẫn kiểm tra.

**File đã sửa:** `chucnang/js/baocao.js`
- Sửa hàm `aggregateDailyFromDataManager`: Sử dụng thời gian địa phương thay vì UTC
- Sửa hàm `loadMoreDailyData`: Cải thiện xử lý và thêm debug logs
- Sửa hàm `loadReportData`: Cải thiện xử lý và thêm debug logs

**Các thay đổi chính:**
```javascript
// Trước: Sử dụng UTC
const iso = d.toISOString().split('T')[0];

// Sau: Sử dụng thời gian địa phương
const year = d.getFullYear();
const month = String(d.getMonth() + 1).padStart(2, '0');
const dayNum = String(d.getDate()).padStart(2, '0');
const iso = `${year}-${month}-${dayNum}`;

// Parse ngày với thời gian
const dateObj = new Date(d.date + 'T00:00:00');
```

## 📝 Ghi Chú Quan Trọng

### API & Authentication
- Tất cả các API request đều được xử lý thông qua hàm `apiRequest` trong `chucnang/js/utils.js`
- Token được lưu trong localStorage với key `smartexpense_token`
- Thông tin người dùng được lưu trong localStorage với key `smartexpense_user`
- Backend API mặc định chạy tại: `http://127.0.0.1:5001` (Node.js) hoặc `http://127.0.0.1:5000` (Flask)

### Database
- **File database duy nhất**: `database_schema.sql` - Chứa toàn bộ schema, không cần file migration riêng
- Database name mặc định: `smart_expense`
- Tất cả các bảng sử dụng UTF8MB4 encoding để hỗ trợ emoji và ký tự đặc biệt

### Security
- Mật khẩu được hash bằng bcryptjs
- JWT tokens có thời gian hết hạn
- API endpoints được bảo vệ bằng authentication middleware
- CORS được cấu hình cho phép requests từ frontend

## 🔄 Lịch Sử Thay Đổi

### 2024 - Đổi Tên Thư Mục Frontend
- Đổi tên thư mục `luucodecap1` thành `frontend` để dễ hiểu và nhất quán hơn
- Cập nhật tất cả các tham chiếu trong code, documentation và scripts
- Giữ nguyên cấu trúc thư mục và không ảnh hưởng đến chức năng

## 🔄 Cải Tiến Tương Lai

- [ ] Thêm chức năng quên mật khẩu
- [ ] Thêm xác thực 2 yếu tố (2FA)
- [ ] Cải thiện validation phía client
- [ ] Thêm rate limiting cho API
- [ ] Cải thiện UX với loading states tốt hơn
- [ ] Thêm unit tests cho authentication flow

## 🗄️ Database

### Cấu Trúc Database

Dự án sử dụng MySQL/MariaDB để lưu trữ dữ liệu. File database chính:

**`database_schema.sql`** - File SQL schema hoàn chỉnh và duy nhất chứa:
   - Tất cả các bảng: `users`, `categories`, `expenses`, `budgets`, `reports`, `report_cache`, `user_settings`, `notifications`
   - Stored procedures: `GetMonthlyExpense`, `GetBudgetStatus`
   - Views: `v_user_category_summary`, `v_current_month_summary`
   - Triggers: Tự động cập nhật balance khi có expense/income
   - Indexes tối ưu cho performance

**`backend-node/database.js`** - File helper Node.js để kết nối database

### Thiết Lập Database

#### Bước 1: Tạo Database và Tables

**Cách 1: Sử dụng file SQL (Khuyến nghị)**
```bash
# Kết nối MySQL
mysql -u root -p

# Chạy file SQL
mysql -u root -p < database_schema.sql
```

**Cách 2: Sử dụng Flask Migrate (Backend Flask)**
```bash
cd backend
flask db upgrade
```

#### Bước 2: Cấu hình `.env`

**Cho Backend Node.js** (`backend-node/.env`):
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=your_password
DB_NAME=smart_expense
```

**Cho Backend Flask** (`backend/.env`):
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=smart_expense
```

#### Bước 3: Kiểm tra kết nối

**Backend Node.js:**
```bash
cd backend-node
npm start
# Kiểm tra log xem có kết nối database thành công không
```

**Backend Flask:**
```bash
cd backend
python app.py
# Kiểm tra log xem có kết nối database thành công không
```

### Cấu Trúc Các Bảng

#### 1. `users` - Người dùng
- `id`: Primary key
- `name`: Tên người dùng
- `email`: Email (unique)
- `password_hash`: Mật khẩu đã hash
- `balance`: Số dư hiện tại (tự động cập nhật bởi triggers)
- `gender`, `currency`, `phone`: Thông tin cá nhân
- `google_id`, `login_method`, `avatar_url`: Google OAuth fields

#### 2. `categories` - Danh mục chi tiêu
- `id`: Primary key
- `user_id`: Foreign key → `users.id`
- `name`: Tên danh mục (unique per user)

#### 3. `expenses` - Chi tiêu và thu nhập
- `id`: Primary key
- `user_id`: Foreign key → `users.id`
- `date`: Ngày giao dịch
- `amount`: Số tiền (dương cho income, âm cho expense)
- `type`: 'expense' hoặc 'income'
- `category_id`: Foreign key → `categories.id`
- `note`: Ghi chú

#### 4. `budgets` - Ngân sách theo tháng
- `id`: Primary key
- `user_id`: Foreign key → `users.id`
- `month`: Tháng (format: YYYY-MM)
- `amount`: Số tiền ngân sách

#### 5. `reports` - Báo cáo đã tính toán
- `id`: Primary key
- `user_id`: Foreign key → `users.id`
- `report_type`: 'daily', 'monthly', 'category', 'summary'
- `period`: Chu kỳ báo cáo
- `amount`, `budget`, `transactions`: Dữ liệu báo cáo
- `metadata`: JSON data bổ sung

#### 6. `report_cache` - Cache cho reports
- `id`: Primary key
- `user_id`: Foreign key → `users.id`
- `cache_key`: Key để identify cache
- `cache_data`: Dữ liệu cache (JSON)
- `expires_at`: Thời gian hết hạn

#### 7. `user_settings` - Cài đặt người dùng
- `id`: Primary key
- `user_id`: Foreign key → `users.id`
- `setting_key`: Tên setting
- `setting_value`: Giá trị setting

#### 8. `notifications` - Thông báo cho người dùng
- `id`: Primary key
- `user_id`: Foreign key → `users.id`
- `title`: Tiêu đề thông báo
- `message`: Nội dung thông báo
- `type`: Loại thông báo (info, warning, error, success)
- `is_read`: Trạng thái đã đọc (TRUE/FALSE)
- `created_at`: Thời gian tạo thông báo

### Sử Dụng Database (Node.js)

Backend Node.js sử dụng `backend-node/database.js` để kết nối database. Các operations được thực hiện thông qua các routes trong `backend-node/routes/`.

### Tính Năng Đặc Biệt

1. **Auto-update Balance**: Triggers tự động cập nhật `balance` trong `users` khi có expense/income mới
2. **Stored Procedures**: `GetMonthlyExpense`, `GetBudgetStatus` để query nhanh
3. **Views**: `v_user_category_summary`, `v_current_month_summary` cho báo cáo
4. **Indexes**: Tối ưu cho các query thường dùng (user_id + date, user_id + type, etc.)
5. **Cascade Delete**: Khi xóa user, tất cả dữ liệu liên quan tự động xóa
6. **Notifications System**: Hệ thống thông báo cho người dùng (vượt ngân sách, tóm tắt hàng ngày, báo cáo...)

## 📞 Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra console trình duyệt (F12)
2. Kiểm tra log backend
3. Đảm bảo backend đang chạy
4. Kiểm tra file `.env` đã được cấu hình đúng
5. Kiểm tra database đã được tạo và kết nối thành công
6. Kiểm tra các bảng đã được tạo: `SHOW TABLES;` trong MySQL

## 📄 License

MIT License
