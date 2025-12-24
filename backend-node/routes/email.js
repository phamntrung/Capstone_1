const express = require('express');
const { authRequired } = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();

// Thử nạp module database (MySQL). Nếu không có sẽ fallback sang dữ liệu giả lập.
let db = null;
try {
  db = require('../database');
} catch (error) {
  console.warn('⚠️ Không thể nạp database module cho email routes, sẽ dùng dữ liệu in-memory nếu có.');
}

// Mock data store (dùng khi chưa có database thực)
const users = new Map();
const expenses = new Map();
const budgets = new Map();

// Cấu hình mặc định cho phạm vi tổng hợp
const DEFAULT_DAILY_RANGE = 10;
const DEFAULT_MONTH_RANGE = 6;

function respondWithEmailError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);

  if (error?.code === 'EMAIL_NOT_CONFIGURED') {
    return res.status(503).json({
      code: error.code,
      message: 'Máy chủ chưa cấu hình dịch vụ email. Vui lòng đặt EMAIL_USER và EMAIL_PASS trong backend-node/.env rồi khởi động lại.'
    });
  }

  return res.status(500).json({
    message: fallbackMessage,
    ...(process.env.NODE_ENV !== 'production' && error?.message ? { details: error.message } : {})
  });
}

// Helper function to get user expenses
function getUserExpenses(userId) {
  const userExpenses = [];
  for (const [id, expense] of expenses) {
    if (expense.userId === userId) {
      userExpenses.push({ id, ...expense });
    }
  }
  return userExpenses;
}

// Helper function to get daily expenses
function getDailyExpenses(userId, date) {
  const userExpenses = getUserExpenses(userId);
  return userExpenses.filter(expense => 
    expense.date === date && expense.type === 'expense'
  );
}

// Helper function to get monthly budget
function getMonthlyBudget(userId, year, month) {
  const budgetKey = `${userId}:${year}-${month.toString().padStart(2, '0')}`;
  return budgets.get(budgetKey)?.amount || 0;
}

// Helper function to calculate monthly spending
function getMonthlySpending(userId, year, month) {
  const userExpenses = getUserExpenses(userId);
  const monthPrefix = `${year}-${month.toString().padStart(2, '0')}`;
  
  return userExpenses
    .filter(expense => 
      expense.date.startsWith(monthPrefix) && expense.type === 'expense'
    )
    .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);
}

/**
 * Định dạng Date về YYYY-MM-DD (theo giờ máy chủ)
 */
function formatDateYMD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Tạo danh sách các ngày liên tiếp (từ hôm nay lùi về quá khứ)
 */
function buildDailySeries(range = DEFAULT_DAILY_RANGE) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const series = [];
  for (let i = 0; i < range; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    series.push(formatDateYMD(d));
  }
  return series;
}

/**
 * Tạo danh sách các tháng (định dạng YYYY-MM và nhãn MM/YYYY)
 */
function buildMonthlySeries(range = DEFAULT_MONTH_RANGE) {
  const current = new Date();
  current.setDate(1);

  const series = [];
  for (let i = 0; i < range; i += 1) {
    const d = new Date(current);
    d.setMonth(current.getMonth() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    series.push({
      key: `${year}-${month}`,
      label: `${month}/${year}`
    });
  }
  return series;
}

/**
 * Đọc ngân sách cho các tháng yêu cầu từ database (nếu có)
 */
async function getBudgetsForMonths(userId, monthSeries) {
  if (!db || typeof db.query !== 'function' || !monthSeries.length) {
    return new Map();
  }

  try {
    const oldest = monthSeries[monthSeries.length - 1].key;
    const newest = monthSeries[0].key;
    const rows = await db.query(
      `SELECT month, amount FROM budgets
       WHERE user_id = ? AND month BETWEEN ? AND ?`,
      [userId, oldest, newest]
    );

    const map = new Map();
    rows.forEach(row => {
      map.set(row.month, Number(row.amount) || 0);
    });
    return map;
  } catch (error) {
    console.warn('⚠️ Không thể truy vấn ngân sách từ database:', error.message);
    return new Map();
  }
}

/**
 * Tổng hợp báo cáo (daily, monthly, category) từ database
 */
async function buildSummaryReport(userId) {
  if (!db || typeof db.query !== 'function') {
    throw new Error('Database chưa sẵn sàng để tổng hợp báo cáo');
  }

  const dailySeries = buildDailySeries();
  const monthSeries = buildMonthlySeries();
  const oldestDay = dailySeries[dailySeries.length - 1];
  const oldestMonthDate = `${monthSeries[monthSeries.length - 1].key}-01`;

  // Daily aggregates
  const dailyRows = await db.query(
    `SELECT
       DATE_FORMAT(date, '%Y-%m-%d') AS day,
       COUNT(*) AS transactions,
       SUM(ABS(amount)) AS total_amount
     FROM expenses
     WHERE user_id = ? 
       AND date >= ?
       AND (type = 'expense' OR amount < 0)
     GROUP BY day`,
    [userId, oldestDay]
  );

  const dailyMap = new Map(dailyRows.map(row => [row.day, row]));
  const daily = dailySeries.map(day => {
    const row = dailyMap.get(day);
    const amount = row ? Number(row.total_amount) || 0 : 0;
    const rounded = Math.round(amount * 100) / 100;
    return {
      date: day,
      amount: rounded,
      transactions: row ? Number(row.transactions) || 0 : 0
    };
  });

  // Monthly aggregates
  const monthlyRows = await db.query(
    `SELECT
       DATE_FORMAT(date, '%Y-%m') AS month_key,
       COUNT(*) AS transactions,
       SUM(ABS(amount)) AS total_amount
     FROM expenses
     WHERE user_id = ?
       AND date >= ?
       AND (type = 'expense' OR amount < 0)
     GROUP BY month_key`,
    [userId, oldestMonthDate]
  );

  const monthlyMap = new Map(monthlyRows.map(row => [row.month_key, row]));
  const budgetMap = await getBudgetsForMonths(userId, monthSeries);
  const monthly = monthSeries.map(({ key, label }) => {
    const row = monthlyMap.get(key);
    const amount = row ? Number(row.total_amount) || 0 : 0;
    const rounded = Math.round(amount * 100) / 100;
    return {
      month: label,
      amount: rounded,
      transactions: row ? Number(row.transactions) || 0 : 0,
      budget: budgetMap.get(key) || 0
    };
  });

  const currentMonthAmount = monthly[0]?.amount || 0;

  // Category distribution
  const categoryRows = await db.query(
    `SELECT
       COALESCE(c.id, 0) AS category_id,
       COALESCE(c.name, 'Khác') AS category_name,
       SUM(ABS(e.amount)) AS total_amount
     FROM expenses e
     LEFT JOIN categories c ON c.id = e.category_id AND c.user_id = e.user_id
     WHERE e.user_id = ?
       AND (e.type = 'expense' OR e.amount < 0)
     GROUP BY category_id, category_name
     ORDER BY total_amount DESC`,
    [userId]
  );

  const categories = categoryRows.map(row => {
    const amount = Math.round((Number(row.total_amount) || 0) * 100) / 100;
    const percentage = currentMonthAmount > 0
      ? Math.round((amount / currentMonthAmount) * 100)
      : 0;
    return {
      id: row.category_id,
      name: row.category_name,
      amount,
      percentage
    };
  });

  // Insights bổ sung cho email
  const busiestDay = daily.reduce((top, item) => {
    if (!top || item.amount > top.amount) return item;
    return top;
  }, null);
  const avgDaily = daily.length
    ? Math.round(daily.reduce((sum, item) => sum + item.amount, 0) / daily.length)
    : 0;

  return {
    daily,
    monthly,
    categories,
    insights: {
      currentMonth: monthly[0] || { month: '', amount: 0, transactions: 0, budget: 0 },
      previousMonth: monthly[1] || null,
      avgDaily,
      busiestDay,
      generatedAt: new Date().toISOString()
    }
  };
}

// POST /api/email/send-daily-report
router.post('/send-daily-report', authRequired, async (req, res) => {
  try {
    const user = req.user;
    const { date } = req.body;
    
    // Check if user has daily report enabled
    if (!user.settings?.daily_report) {
      return res.status(400).json({ 
        message: 'Báo cáo email hằng ngày chưa được bật. Vui lòng vào Hồ sơ > Cài đặt để bật tính năng này.' 
      });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    const dayExpenses = getDailyExpenses(user.id, targetDate);
    const total = dayExpenses.reduce((sum, expense) => sum + Math.abs(expense.amount), 0);
    
    // Get monthly budget for context
    const now = new Date();
    const budget = getMonthlyBudget(user.id, now.getFullYear(), now.getMonth() + 1);

    const reportData = {
      date: targetDate,
      expenses: dayExpenses,
      total: total,
      budget: budget
    };

    await emailService.sendDailyReport(user, reportData);

    res.json({ 
      success: true, 
      message: 'Báo cáo email hằng ngày đã được gửi thành công!',
      data: {
        date: targetDate,
        totalExpenses: dayExpenses.length,
        totalAmount: total
      }
    });

  } catch (error) {
    respondWithEmailError(res, error, 'Không thể gửi email báo cáo. Vui lòng kiểm tra cấu hình email hoặc thử lại sau.');
  }
});

// POST /api/email/send-summary-report
router.post('/send-summary-report', authRequired, async (req, res) => {
  try {
    const user = req.user;

    if (!user.email) {
      return res.status(400).json({
        message: 'Tài khoản của bạn chưa có email. Vui lòng cập nhật email trong hồ sơ trước khi gửi báo cáo.'
      });
    }

    if (!db || typeof db.query !== 'function') {
      return res.status(503).json({
        message: 'Máy chủ chưa kết nối database nên không thể tổng hợp báo cáo. Vui lòng thử lại sau khi cấu hình MySQL.'
      });
    }

    let summary;
    try {
      summary = await buildSummaryReport(user.id);
    } catch (buildError) {
      console.error('Failed to build summary report data:', buildError);
      return res.status(503).json({
        code: 'SUMMARY_BUILD_FAILED',
        message: 'Không thể tổng hợp dữ liệu báo cáo từ database. Vui lòng kiểm tra kết nối MySQL và thử lại.'
      });
    }
    await emailService.sendSummaryReport(user, summary);

    res.json({
      message: 'Báo cáo tổng quan đã được gửi tới hộp thư của bạn.',
      email: user.email,
      summary
    });
  } catch (error) {
    respondWithEmailError(res, error, 'Không thể gửi báo cáo tổng quan. Vui lòng thử lại sau.');
  }
});

// POST /api/email/send-budget-alert
router.post('/send-budget-alert', authRequired, async (req, res) => {
  try {
    const user = req.user;
    const { year, month } = req.body;
    
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || (new Date().getMonth() + 1);
    
    const budget = getMonthlyBudget(user.id, targetYear, targetMonth);
    const spent = getMonthlySpending(user.id, targetYear, targetMonth);
    
    if (budget === 0) {
      return res.status(400).json({ 
        message: 'Chưa có ngân sách cho tháng này' 
      });
    }

    const percentage = Math.round((spent / budget) * 100);
    
    // Only send alert if over 80% of budget
    if (percentage < 80) {
      return res.status(400).json({ 
        message: `Chỉ sử dụng ${percentage}% ngân sách, chưa cần cảnh báo` 
      });
    }

    const budgetData = {
      month: `${targetMonth}/${targetYear}`,
      spent: spent,
      budget: budget,
      percentage: percentage
    };

    await emailService.sendBudgetAlert(user, budgetData);

    res.json({ 
      success: true, 
      message: 'Cảnh báo ngân sách đã được gửi thành công!',
      data: budgetData
    });

  } catch (error) {
    respondWithEmailError(res, error, 'Không thể gửi email cảnh báo. Vui lòng kiểm tra cấu hình email hoặc thử lại sau.');
  }
});

// POST /api/email/send-welcome
router.post('/send-welcome', authRequired, async (req, res) => {
  try {
    const user = req.user;

    await emailService.sendWelcomeEmail(user);

    res.json({ 
      success: true, 
      message: 'Email chào mừng đã được gửi thành công!' 
    });

  } catch (error) {
    respondWithEmailError(res, error, 'Không thể gửi email chào mừng. Vui lòng kiểm tra cấu hình email hoặc thử lại sau.');
  }
});

// POST /api/email/send-verification-email
router.post('/send-verification-email', authRequired, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.email) {
      return res.status(400).json({ 
        message: 'Người dùng chưa có email. Vui lòng cập nhật email trong hồ sơ.' 
      });
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test Email - SmartExpense</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); margin-top: 20px; }
          .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
          .content { padding: 20px 0; }
          .success-box { background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 20px 0; color: #155724; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">📧 SmartExpense</div>
            <h1>Email Test thành công!</h1>
          </div>
          
          <div class="content">
            <p>Xin chào <strong>${user.name || 'Người dùng'}</strong>! 👋</p>
            
            <div class="success-box">
              <p><strong>✅ Email đã được gửi thành công!</strong></p>
              <p>Nếu bạn nhận được email này, có nghĩa là:</p>
              <ul>
                <li>Cấu hình email trong hệ thống đã hoạt động đúng</li>
                <li>Bạn có thể nhận báo cáo email hằng ngày</li>
                <li>Bạn có thể nhận cảnh báo ngân sách qua email</li>
              </ul>
            </div>
            
            <p>Để bật tính năng nhận email tự động:</p>
            <ol>
              <li>Vào trang <strong>Hồ sơ</strong></li>
              <li>Bật tùy chọn <strong>"Báo cáo email hằng ngày"</strong></li>
              <li>Nhấn <strong>"Lưu"</strong></li>
            </ol>
          </div>
          
          <div class="footer">
            <p>Đây là email test từ hệ thống SmartExpense.</p>
            <p>Email được gửi lúc: ${new Date().toLocaleString('vi-VN')}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Email Test thành công! - SmartExpense

Xin chào ${user.name || 'Người dùng'}!

✅ Email đã được gửi thành công!

Nếu bạn nhận được email này, có nghĩa là:
- Cấu hình email trong hệ thống đã hoạt động đúng
- Bạn có thể nhận báo cáo email hằng ngày
- Bạn có thể nhận cảnh báo ngân sách qua email

Để bật tính năng nhận email tự động:
1. Vào trang Hồ sơ
2. Bật tùy chọn "Báo cáo email hằng ngày"
3. Nhấn "Lưu"

Đây là email test từ hệ thống SmartExpense.
Email được gửi lúc: ${new Date().toLocaleString('vi-VN')}
    `;

    await emailService.sendEmail(
      user.email, 
      '✅ Email Test thành công - SmartExpense', 
      htmlContent, 
      textContent
    );

    res.json({ 
      success: true, 
      message: `Email test đã được gửi thành công đến ${user.email}!` 
    });

  } catch (error) {
    respondWithEmailError(res, error, 'Không thể gửi email test. Vui lòng kiểm tra cấu hình email trong file .env (EMAIL_USER, EMAIL_PASS).');
  }
});

// POST /api/email/test
router.post('/test', authRequired, async (req, res) => {
  try {
    const user = req.user;
    const { to, subject, message } = req.body;

    if (!to || !subject || !message) {
      return res.status(400).json({ 
        message: 'Thiếu thông tin: to, subject, message' 
      });
    }

    const htmlContent = `
      <h2>Test Email từ SmartExpense</h2>
      <p>Xin chào <strong>${user.name}</strong>!</p>
      <p>${message}</p>
      <p><em>Đây là email test từ hệ thống SmartExpense.</em></p>
    `;

    await emailService.sendEmail(to, subject, htmlContent, message);

    res.json({ 
      success: true, 
      message: 'Email test đã được gửi thành công!' 
    });

  } catch (error) {
    respondWithEmailError(res, error, 'Không thể gửi email test. Vui lòng kiểm tra cấu hình email.');
  }
});

// GET /api/email/status
router.get('/status', authRequired, (req, res) => {
  const user = req.user;
  
  res.json({
    email: user.email,
    dailyReportEnabled: user.settings?.daily_report || false,
    emailServiceConfigured: !!process.env.EMAIL_USER && !!process.env.EMAIL_PASS
  });
});

module.exports = router;
