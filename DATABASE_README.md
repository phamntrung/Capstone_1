# 📊 Database Documentation - SmartExpense

## Tổng Quan

Dự án có 2 file database chính để kết nối và làm việc với MySQL:

1. **`database_schema.sql`** - SQL schema hoàn chỉnh
2. **`database_complete.js`** - JavaScript helper functions

## Quick Start

### 1. Tạo Database

```bash
# Chạy file SQL để tạo database và tất cả các bảng
mysql -u root -p < database_schema.sql
```

### 2. Cấu hình `.env`

Thêm vào `backend-node/.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=your_password
DB_NAME=smart_expense
```

### 3. Sử dụng trong Code

```javascript
const db = require('./database_complete.js');

// Kiểm tra kết nối
await db.testConnection();

// Lấy user
const user = await db.getUserByEmail('user@example.com');

// Tạo expense
const expense = await db.createExpense({
  user_id: 1,
  date: '2024-01-15',
  amount: -50000,
  type: 'expense',
  category_id: 1
});
```

## Cấu Trúc Database

### Các Bảng Chính

- **users** - Thông tin người dùng
- **categories** - Danh mục chi tiêu
- **expenses** - Chi tiêu và thu nhập
- **budgets** - Ngân sách theo tháng
- **reports** - Báo cáo đã tính toán
- **report_cache** - Cache cho reports
- **user_settings** - Cài đặt người dùng

### Tính Năng Đặc Biệt

✅ **Triggers tự động**: Cập nhật balance khi có expense/income  
✅ **Stored Procedures**: Query nhanh cho monthly summary  
✅ **Views**: Báo cáo tổng hợp  
✅ **Indexes**: Tối ưu performance  

## Chi Tiết File

### database_schema.sql

File này chứa:
- CREATE DATABASE statement
- CREATE TABLE cho tất cả các bảng
- FOREIGN KEY constraints
- INDEXES để tối ưu query
- STORED PROCEDURES (GetMonthlyExpense, GetBudgetStatus)
- VIEWS (v_user_category_summary, v_current_month_summary)
- TRIGGERS (auto-update balance)

### database_complete.js

File này export các functions:

**Connection:**
- `getPool()` - Lấy connection pool
- `testConnection()` - Kiểm tra kết nối
- `checkDatabaseExists()` - Kiểm tra database
- `checkTableExists(tableName)` - Kiểm tra table

**Users:**
- `getUserByEmail(email)`
- `getUserById(id)`
- `getUserByGoogleId(googleId)`
- `createUser(userData)`
- `updateUser(userId, updates)`

**Categories:**
- `getCategoriesByUserId(userId)`
- `getCategoryById(categoryId, userId)`
- `createCategory(userId, name)`
- `updateCategory(categoryId, userId, name)`
- `deleteCategory(categoryId, userId)`

**Expenses:**
- `getExpensesByUserId(userId, filters)`
- `getExpenseById(expenseId, userId)`
- `createExpense(expenseData)`
- `updateExpense(expenseId, userId, updates)`
- `deleteExpense(expenseId, userId)`
- `getMonthlySummary(userId, month)`

**Budgets:**
- `getBudgetByMonth(userId, month)`
- `upsertBudget(userId, month, amount)`
- `getBudgetStatus(userId, month)`

**Reports:**
- `getReport(userId, reportType, period)`
- `saveReport(reportData)`
- `getReportCache(userId, cacheKey)`
- `saveReportCache(userId, cacheKey, cacheData, expiresInMinutes)`

**Settings:**
- `getUserSetting(userId, settingKey)`
- `getUserSettings(userId)`
- `saveUserSetting(userId, settingKey, settingValue)`

**Utilities:**
- `query(sql, params)` - Thực thi query tùy ý
- `transaction(callback)` - Thực thi transaction
- `getDatabaseInfo()` - Lấy thông tin database

## Ví Dụ Sử Dụng

### Tạo User Mới

```javascript
const user = await db.createUser({
  name: 'Nguyễn Văn A',
  email: 'user@example.com',
  password_hash: '$2b$10$hashed_password',
  currency: 'VND'
});
```

### Tạo Expense với Category

```javascript
// Tạo category trước
const category = await db.createCategory(1, 'Ăn uống');

// Tạo expense
const expense = await db.createExpense({
  user_id: 1,
  date: '2024-01-15',
  amount: -50000,
  type: 'expense',
  category_id: category.id,
  note: 'Ăn trưa'
});
```

### Lấy Báo Cáo Tháng

```javascript
const summary = await db.getMonthlySummary(1, '2024-01');
// Kết quả: { total_expense, total_income, transaction_count }
```

### Sử Dụng Transaction

```javascript
await db.transaction(async (connection) => {
  // Tạo expense
  await connection.query(
    'INSERT INTO expenses ...',
    [...]
  );
  
  // Cập nhật budget
  await connection.query(
    'UPDATE budgets ...',
    [...]
  );
  
  // Nếu có lỗi, tự động rollback
});
```

## Lưu Ý

1. **Timezone**: Database sử dụng UTC, ứng dụng tự convert sang timezone địa phương
2. **Balance**: Tự động cập nhật bởi triggers, không cần update thủ công
3. **Cascade Delete**: Khi xóa user, tất cả dữ liệu liên quan tự động xóa
4. **Connection Pool**: Sử dụng connection pool để tối ưu performance

## Xử Lý Lỗi

Tất cả functions đều throw error nếu có lỗi. Nên wrap trong try-catch:

```javascript
try {
  const user = await db.getUserByEmail('user@example.com');
} catch (error) {
  console.error('Database error:', error.message);
}
```

## Kiểm Tra Database

```javascript
// Kiểm tra kết nối
const isConnected = await db.testConnection();

// Lấy thông tin database
const info = await db.getDatabaseInfo();
console.log(info);
// {
//   database: 'smart_expense',
//   tables: ['users', 'categories', 'expenses', ...],
//   connectionPool: 'Active'
// }
```

