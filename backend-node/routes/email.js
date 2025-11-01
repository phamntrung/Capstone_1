const express = require('express');
const { authRequired } = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();

// Mock data store (in production, this would be a database)
const users = new Map();
const expenses = new Map();
const budgets = new Map();

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
    console.error('Error sending daily report:', error);
    res.status(500).json({ 
      message: 'Không thể gửi email báo cáo. Vui lòng kiểm tra cấu hình email hoặc thử lại sau.' 
    });
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
    console.error('Error sending budget alert:', error);
    res.status(500).json({ 
      message: 'Không thể gửi email cảnh báo. Vui lòng kiểm tra cấu hình email hoặc thử lại sau.' 
    });
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
    console.error('Error sending welcome email:', error);
    res.status(500).json({ 
      message: 'Không thể gửi email chào mừng. Vui lòng kiểm tra cấu hình email hoặc thử lại sau.' 
    });
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
    console.error('Error sending verification email:', error);
    res.status(500).json({ 
      message: 'Không thể gửi email test. Vui lòng kiểm tra cấu hình email trong file .env (EMAIL_USER, EMAIL_PASS).' 
    });
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
    console.error('Error sending test email:', error);
    res.status(500).json({ 
      message: 'Không thể gửi email test. Vui lòng kiểm tra cấu hình email.' 
    });
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
