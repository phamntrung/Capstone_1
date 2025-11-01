# SmartExpense - AI-Powered Smart Expense Management System

Hệ thống quản lý chi tiêu thông minh với AI, hỗ trợ đăng ký/đăng nhập, quản lý chi tiêu, phân tích thông minh và chatbot AI.

## 📋 Mục Lục

- [Tổng Quan](#tổng-quan)
- [Tính Năng](#tính-năng)
- [Cài Đặt và Chạy](#cài-đặt-và-chạy)
- [Cấu Trúc Dự Án](#cấu-trúc-dự-án)
- [Đăng Ký và Đăng Nhập](#đăng-ký-và-đăng-nhập)
- [Các Lỗi Đã Sửa](#các-lỗi-đã-sửa)

## 📖 Tổng Quan

SmartExpense là một hệ thống quản lý chi tiêu cá nhân được trang bị AI để tự động phân loại chi tiêu, dự đoán xu hướng chi tiêu, và cung cấp các thông tin thông minh về tài chính của bạn.

### Backend

Hệ thống hỗ trợ 2 backend:
- **Backend Node.js** (Khuyến nghị): `backend-node/` - Hiện đại, nhanh, có AI
- **Backend Flask**: `backend/` - Python, đơn giản, dễ cấu hình

## 🎯 Tính Năng

### Xác Thực Người Dùng
- ✅ Đăng ký tài khoản mới
- ✅ Đăng nhập bằng email/password
- ✅ Đăng nhập bằng Google OAuth
- ✅ Quản lý session với JWT token
- ✅ Quên mật khẩu (đang phát triển)

### Quản Lý Chi Tiêu
- Tạo, sửa, xóa chi tiêu
- Phân loại chi tiêu theo danh mục
- Thiết lập và theo dõi ngân sách
- Xem báo cáo chi tiết

### AI Features
- Tự động phân loại chi tiêu
- Dự đoán xu hướng chi tiêu
- Cảnh báo ngân sách
- Chatbot AI để hỏi đáp về tài chính

## 🚀 Cài Đặt và Chạy

### Quick Start

⚠️ **QUAN TRỌNG:** Bạn PHẢI khởi động Backend Node.js TRƯỚC KHI sử dụng ứng dụng. Nếu không, bạn sẽ gặp lỗi "Lỗi kết nối đến server" khi đăng nhập.

#### Bước 1: Khởi động Backend Node.js (BẮT BUỘC)

**Mở terminal/command prompt và chạy:**

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

#### Bước 2: Khởi động Frontend

**Mở một terminal/command prompt KHÁC và chạy:**

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

#### Bước 3: Truy cập ứng dụng

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
├── frontend/           # Frontend HTML pages
│   ├── login.html        # Trang đăng nhập
│   ├── dangki.html       # Trang đăng ký
│   ├── trangchu.html     # Trang chủ/Dashboard
│   └── ...
├── chucnang/             # JavaScript modules
│   └── js/
│       ├── login.js      # Xử lý đăng nhập
│       ├── register.js   # Xử lý đăng ký
│       ├── utils.js      # Utilities và API requests
│       └── ...
├── backend-node/         # Backend Node.js
│   ├── routes/
│   │   └── auth.js       # API authentication
│   └── ...
├── backend/              # Backend Flask (Python)
│   └── app.py           # Main Flask app
└── README.md            # File này
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
4. Sau khi đăng nhập thành công, bạn sẽ được chuyển đến trang chủ

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

## 📝 Ghi Chú

- Tất cả các API request đều được xử lý thông qua hàm `apiRequest` trong `utils.js`
- Token được lưu trong localStorage với key `smartexpense_token`
- Thông tin người dùng được lưu trong localStorage với key `smartexpense_user`
- Backend API mặc định chạy tại: `http://127.0.0.1:5000` (Flask) hoặc `http://127.0.0.1:5001` (Node.js)

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

## 📞 Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra console trình duyệt (F12)
2. Kiểm tra log backend
3. Đảm bảo backend đang chạy
4. Kiểm tra file `.env` đã được cấu hình đúng

## 📄 License

MIT License
