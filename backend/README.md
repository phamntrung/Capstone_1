## SmartExpense Python Backend (Flask + MySQL)

### 1) Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows PowerShell
pip install -r requirements.txt
copy .env.example .env   # tạo .env và chỉnh thông số DB, CORS, SECRET
```

### 2) Cấu hình .env
```
FLASK_ENV=development
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=smartexpense
JWT_SECRET=change_this_to_a_long_random_secret
CORS_ORIGIN=http://localhost:5500
```

### 3) Chạy server
```bash
python app.py
```
API: http://127.0.0.1:5000

### 4) Endpoints
- POST /api/auth/register → body: { name, email, password }
- POST /api/auth/login → body: { email, password }
- GET /api/me → header: Authorization: Bearer <token>

### 5) Gọi từ Frontend
Sử dụng fetch tới các endpoint trên; giữ nguyên FE hiện tại, chỉ thay chỗ đăng ký/đăng nhập để gọi API.

