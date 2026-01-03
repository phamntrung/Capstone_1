============================================================
SMARTEXPENSE – AI POWERED SMART EXPENSE MANAGEMENT SYSTEM
README.TXT
============================================================

1. GIỚI THIỆU
------------------------------------------------------------
SmartExpense là hệ thống quản lý chi tiêu thông minh, hỗ trợ người dùng
theo dõi chi tiêu, ngân sách, báo cáo tài chính cá nhân

Hệ thống bao gồm:
- Backend: Node.js + Express
- Database: MySQL 
- Frontend: HTML, CSS, JavaScript

2. YÊU CẦU HỆ THỐNG
------------------------------------------------------------

2.1. Phần mềm cần cài đặt
- Node.js: phiên bản 18 trở lên
- MySQL 5.7+ 
- Trình duyệt Web: Google Chrome / Microsoft Edge / Firefox

2.2. Hệ điều hành hỗ trợ
- Windows
- macOS
- Linux

3. THƯ VIỆN SỬ DỤNG
------------------------------------------------------------
Các thư viện được khai báo trong file `package.json`, bao gồm:

- express: Web framework cho Node.js
- mysql2, sequelize: Kết nối và quản lý cơ sở dữ liệu MySQL
- dotenv: Quản lý biến môi trường
- cors, helmet, compression: Bảo mật và tối ưu server
- jsonwebtoken, bcryptjs, joi: Xác thực và bảo mật người dùng
- nodemailer: Gửi email
- node-cron: Lập lịch nhắc nhở
- openai, axios: Tích hợp AI và gọi API ngoài
- speakeasy, qrcode, twilio: Xác thực hai lớp (2FA, OTP)

(Lưu ý: Các công cụ phát triển như nodemon không được tính khi triển khai)


4. CẤU HÌNH MÔI TRƯỜNG
------------------------------------------------------------
Tạo file `.env` trong thư mục backend-node với nội dung mẫu:

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=smart_expense
PORT=5000
NODE_ENV=development

(Lưu ý: Không chia sẻ mật khẩu thật khi nộp bài)


5. CÀI ĐẶT & CHẠY CHƯƠNG TRÌNH
------------------------------------------------------------

5.1. Cài đặt Backend
- Mở terminal tại thư mục backend-node
- Chạy lệnh:
  npm install

5.2. Khởi động Backend
- Chạy lệnh:
 cd backend-node
npm run dev


5.3. Chạy Frontend
 python -m http.server 5050
sau đó truy cập:
 http://localhost:5050/frontend/User/UI_User/login.html

------------------------------------------------------------
SmartExpense Team
------------------------------------------------------------
