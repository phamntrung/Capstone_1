# 📁 Cấu Trúc Dự Án - SmartExpense

## 🎯 Tổng Quan Dự Án

**SmartExpense** là hệ thống quản lý chi tiêu thông minh với AI, được xây dựng với kiến trúc:
- **Frontend**: HTML/CSS/JavaScript (Vanilla JS, không framework)
- **Backend**: 2 lựa chọn - Node.js (khuyến nghị) hoặc Flask (Python)
- **Database**: MySQL/MariaDB
- **AI**: Tích hợp AI để phân loại chi tiêu và chatbot

---

## 📂 Cấu Trúc Thư Mục Chi Tiết

```
AI-Powered Smart Expense Management System/
│
├── 📁 frontend/                    # Frontend HTML Pages
│   ├── login.html                  # Trang đăng nhập
│   ├── dangki.html                 # Trang đăng ký
│   ├── trangchu.html               # Dashboard chính
│   ├── hoso.html                   # Quản lý hồ sơ
│   ├── baocao.html                 # Báo cáo chi tiêu
│   ├── danhsachchitieu.html        # Danh sách chi tiêu
│   ├── loaichitieu.html            # Quản lý loại chi tiêu
│   ├── lichsuchitieu.html          # Lịch sử chi tiêu
│   ├── caidat.html                 # Cài đặt
│   ├── doimatkhau.html             # Đổi mật khẩu
│   ├── quenmatkhau.html            # Quên mật khẩu
│   ├── xacthuchailop.html          # Xác thực 2 lớp
│   ├── Canhbao&thongbao.html       # Cảnh báo & thông báo
│   ├── Canhbaodangnhapbatthuong.html
│   ├── lenlichchitieu.html         # Lên lịch chi tiêu
│   ├── quanlythietbi.html          # Quản lý thiết bị
│   └── xuatdulieu.html             # Xuất dữ liệu
│
├── 📁 chucnang/                    # JavaScript Logic
│   ├── 📁 css/
│   │   └── fonts.css               # Font styles
│   ├── 📁 images/                  # Images/assets
│   └── 📁 js/
│       ├── utils.js                # ⭐ Utilities & API base (API_BASE)
│       ├── auth.js                 # Authentication helpers
│       ├── login.js                # Login logic
│       ├── register.js             # Registration logic
│       ├── dashboard.js            # Dashboard functionality
│       ├── hoso.js                 # Profile management
│       ├── baocao.js               # Reports logic
│       ├── ai.js                   # AI integration
│       ├── dataManager.js          # Data management
│       └── encoding-fix.js        # Encoding utilities
│
├── 📁 backend-node/                # ⭐ Backend Node.js (Khuyến nghị)
│   ├── server.js                   # ⭐ Main entry point
│   ├── package.json                # Dependencies
│   ├── database.js                 # Database connection
│   ├── env.example                 # Environment template
│   │
│   ├── 📁 routes/                  # API Routes
│   │   ├── auth.js                 # Authentication APIs
│   │   ├── expenses.js             # Expense CRUD APIs
│   │   ├── categories.js           # Category APIs
│   │   ├── budgets.js              # Budget APIs
│   │   ├── reports.js              # Report APIs
│   │   ├── ai.js                   # AI APIs
│   │   ├── email.js                # Email APIs
│   │   └── utils.js                # Utility APIs
│   │
│   ├── 📁 middleware/              # Middleware
│   │   └── auth.js                 # JWT authentication middleware
│   │
│   ├── 📁 services/                # Services
│   │   ├── emailService.js         # Email sending service
│   │   └── emailScheduler.js       # Email scheduling (cron)
│   │
│   ├── 📁 ai/                      # AI Services
│   │   └── aiService.js            # AI categorization & chatbot
│   │
│   ├── 📁 data/                    # Data layer
│   │   ├── expenses.js             # Expense data operations
│   │   ├── categories.js           # Category data operations
│   │   └── budgets.js              # Budget data operations
│   │
│   ├── 📁 utils/                   # Utilities
│   │   └── password.js             # Password hashing
│   │
│   └── 📁 migrations/              # Database migrations
│       └── create_reports_table.sql
│
├── 📁 backend/                     # Backend Flask (Python) - Alternative
│   ├── app.py                      # ⭐ Main Flask application
│   ├── database.py                 # Database connection
│   ├── models.py                   # SQLAlchemy models
│   ├── requirements.txt            # Python dependencies
│   ├── create_database_auto.py     # Auto database setup
│   ├── reset_database.py           # Reset database script
│   ├── Dockerfile                  # Docker configuration
│   ├── env.example                 # Environment template
│   │
│   └── 📁 migrations/              # Alembic migrations
│       ├── alembic.ini
│       ├── env.py
│       └── versions/               # Migration files
│
├── 📄 database_schema.sql          # ⭐ SQL Schema hoàn chỉnh
├── 📄 database_complete.js         # ⭐ JavaScript Database Helper
│
├── 📄 README.md                    # Tài liệu chính
├── 📄 DATABASE_README.md           # Tài liệu database
├── 📄 PROJECT_STRUCTURE.md         # File này
│
├── 📄 .gitignore                   # Git ignore rules
│
└── 📄 Quick Start Scripts
    ├── quick_start_nodejs.bat      # Start Node.js backend
    ├── quick_start_flask.bat       # Start Flask backend
    ├── start_backend_flask.bat     # Alternative Flask start
    └── start_frontend.bat          # Start frontend server
```

---

## 🔧 Các File Quan Trọng

### ⭐ Backend Entry Points

#### 1. **`backend-node/server.js`** (Node.js - Khuyến nghị)
- Main server file
- Port: `5001` (default)
- Chạy: `npm start` hoặc `npm run dev`
- Features: AI, Email, JWT auth, CORS

#### 2. **`backend/app.py`** (Flask - Alternative)
- Main Flask application
- Port: `5000` (default)
- Chạy: `python app.py`
- Features: SQLAlchemy, Flask-Migrate, CORS

### ⭐ Frontend Entry Points

#### 1. **`chucnang/js/utils.js`**
- ⚠️ **QUAN TRỌNG**: Chứa `API_BASE = 'http://127.0.0.1:5001'`
- Utilities functions
- API request helpers
- Error handling

#### 2. **Frontend Pages**
- Entry point: `frontend/login.html`
- Serve với: `python -m http.server 8080`
- Truy cập: `http://localhost:8080/frontend/login.html`

### ⭐ Database Files

#### 1. **`database_schema.sql`**
- SQL schema hoàn chỉnh
- Tất cả tables, indexes, triggers, procedures, views
- Chạy: `mysql -u root -p < database_schema.sql`

#### 2. **`database_complete.js`**
- JavaScript database helper
- CRUD functions cho tất cả bảng
- Connection pool management
- Transaction support

---

## 🔄 Luồng Hoạt Động

### 1. Authentication Flow

```
User → frontend/login.html
     → chucnang/js/login.js
     → API: POST /api/auth/login (backend-node)
     → Verify credentials
     → Return JWT token
     → Store token in localStorage
     → Redirect to trangchu.html
```

### 2. Expense Flow

```
User → frontend/trangchu.html
     → chucnang/js/dashboard.js
     → API: GET /api/expenses (backend-node)
     → Query MySQL database
     → Return expenses
     → Display on dashboard
```

### 3. AI Flow

```
User input → frontend/baocao.html
           → chucnang/js/ai.js
           → API: POST /api/ai/categorize (backend-node)
           → AI Service (aiService.js)
           → Return category prediction
```

---

## 📦 Dependencies

### Backend Node.js (`backend-node/package.json`)

**Production:**
- `express` - Web framework
- `mysql2` - MySQL driver
- `jsonwebtoken` - JWT authentication
- `bcryptjs` - Password hashing
- `cors` - CORS support
- `helmet` - Security
- `nodemailer` - Email sending
- `node-cron` - Scheduled tasks
- `google-auth-library` - Google OAuth

**Development:**
- `nodemon` - Auto-restart on changes

### Backend Flask (`backend/requirements.txt`)

- `Flask` - Web framework
- `Flask-CORS` - CORS support
- `PyJWT` - JWT authentication
- `PyMySQL` - MySQL driver
- `SQLAlchemy` - ORM
- `Flask-SQLAlchemy` - Flask SQLAlchemy integration
- `Flask-Migrate` - Database migrations
- `scikit-learn` - ML for AI categorization
- `pandas` - Data processing

---

## 🌐 API Endpoints (Node.js Backend)

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/google` - Google OAuth
- `GET /api/auth/me` - Lấy thông tin user hiện tại
- `POST /api/auth/logout` - Đăng xuất

### Expenses (`/api/expenses`)
- `GET /api/expenses` - Lấy danh sách
- `POST /api/expenses` - Tạo mới
- `PUT /api/expenses/:id` - Cập nhật
- `DELETE /api/expenses/:id` - Xóa

### Categories (`/api/categories`)
- `GET /api/categories` - Lấy danh sách
- `POST /api/categories` - Tạo mới
- `PUT /api/categories/:id` - Cập nhật
- `DELETE /api/categories/:id` - Xóa

### Budgets (`/api/budgets`)
- `GET /api/budgets` - Lấy ngân sách
- `POST /api/budgets` - Tạo/cập nhật ngân sách

### Reports (`/api/reports`)
- `GET /api/reports/daily` - Báo cáo ngày
- `GET /api/reports/monthly` - Báo cáo tháng
- `GET /api/reports/category` - Báo cáo theo category

### AI (`/api/ai`)
- `POST /api/ai/categorize` - Phân loại chi tiêu
- `POST /api/ai/chat` - Chatbot AI

---

## 🗄️ Database Schema

### Tables

1. **`users`** - Thông tin người dùng
   - `id`, `name`, `email`, `password_hash`
   - `balance` (tự động cập nhật bởi triggers)
   - `gender`, `currency`, `phone`
   - `google_id`, `login_method`, `avatar_url`

2. **`categories`** - Danh mục chi tiêu
   - `id`, `user_id`, `name`

3. **`expenses`** - Chi tiêu và thu nhập
   - `id`, `user_id`, `date`, `amount`
   - `type` ('expense' | 'income')
   - `category_id`, `note`

4. **`budgets`** - Ngân sách theo tháng
   - `id`, `user_id`, `month`, `amount`

5. **`reports`** - Báo cáo đã tính toán
   - `id`, `user_id`, `report_type`, `period`
   - `amount`, `budget`, `transactions`, `metadata`

6. **`report_cache`** - Cache cho reports
   - `id`, `user_id`, `cache_key`, `cache_data`, `expires_at`

7. **`user_settings`** - Cài đặt người dùng
   - `id`, `user_id`, `setting_key`, `setting_value`

### Special Features

- ✅ **Triggers**: Tự động cập nhật `balance` khi có expense/income
- ✅ **Stored Procedures**: `GetMonthlyExpense`, `GetBudgetStatus`
- ✅ **Views**: `v_user_category_summary`, `v_current_month_summary`
- ✅ **Indexes**: Tối ưu cho queries thường dùng
- ✅ **Cascade Delete**: Xóa user → tự động xóa tất cả dữ liệu liên quan

---

## 🚀 Quick Start Commands

### Backend Node.js
```bash
cd backend-node
npm install              # Lần đầu
npm run dev             # Development (với nodemon)
npm start               # Production
```

### Backend Flask
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### Frontend
```bash
python -m http.server 8080
```

### Database
```bash
mysql -u root -p < database_schema.sql
```

---

## 📝 Environment Variables

### Backend Node.js (`.env` trong `backend-node/`)
```env
PORT=5001
HOST=0.0.0.0
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=your_password
DB_NAME=smart_expense

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Email (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### Backend Flask (`.env` trong `backend/`)
```env
FLASK_APP=app.py
FLASK_ENV=development
SECRET_KEY=your_secret_key

# Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=smart_expense

# CORS
CORS_ORIGIN=*
```

---

## 🎯 Kiến Trúc Tổng Quan

```
┌─────────────────────────────────────────────────────────────┐
│                      USER BROWSER                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Frontend (HTML/CSS/JS)                              │  │
│  │  - login.html, trangchu.html, baocao.html            │  │
│  │  - chucnang/js/*.js                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │ HTTP/REST API
                          │ JWT Authentication
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API Server                              │
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │  Node.js (Port 5001)│    │  Flask (Port 5000)  │        │
│  │  - Express.js       │    │  - Flask            │        │
│  │  - Routes           │    │  - SQLAlchemy       │        │
│  │  - Middleware       │    │  - Migrations       │        │
│  │  - AI Service       │    │                     │        │
│  └─────────────────────┘    └─────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                          │ MySQL Connection
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    MySQL Database                           │
│  - users, categories, expenses, budgets                     │
│  - reports, report_cache, user_settings                     │
│  - Triggers, Procedures, Views, Indexes                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Các Tính Năng Chính

### ✅ Đã Hoàn Thành
- [x] Authentication (Email/Password + Google OAuth)
- [x] Expense Management (CRUD)
- [x] Category Management
- [x] Budget Management
- [x] Reports (Daily, Monthly, Category)
- [x] AI Categorization
- [x] Database Schema hoàn chỉnh
- [x] JWT Security
- [x] Email Notifications

### 🚧 Đang Phát Triển
- [ ] Forgot Password Flow
- [ ] 2FA Authentication
- [ ] Rate Limiting
- [ ] Unit Tests
- [ ] Better UX Loading States

---

## 📞 Troubleshooting

### Backend không kết nối được
1. Kiểm tra backend đang chạy: `http://127.0.0.1:5001`
2. Kiểm tra `API_BASE` trong `chucnang/js/utils.js`
3. Kiểm tra CORS settings
4. Kiểm tra `.env` file

### Database connection error
1. Kiểm tra MySQL đang chạy
2. Kiểm tra credentials trong `.env`
3. Chạy `database_schema.sql` để tạo database

### Frontend không load
1. Kiểm tra server đang chạy: `python -m http.server 8080`
2. Kiểm tra URL: `http://localhost:8080/frontend/login.html`
3. Kiểm tra console browser (F12) để xem errors

---

## 📄 License

MIT License

