const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.init();
  }

  init() {
    // Check if email is configured
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const emailPort = process.env.EMAIL_PORT || 587;

    if (!emailUser || !emailPass) {
      console.log('⚠️ Email service not configured. Set EMAIL_USER and EMAIL_PASS in .env to enable email features.');
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: emailPort === 465, // true for 465, false for other ports
        auth: {
          user: emailUser,
          pass: emailPass
        }
      });

      this.isConfigured = true;
      console.log('✅ Email service configured successfully');
    } catch (error) {
      console.error('❌ Failed to configure email service:', error.message);
      this.isConfigured = false;
    }
  }

  async sendEmail(to, subject, htmlContent, textContent) {
    if (!this.isConfigured || !this.transporter) {
      const error = new Error('Dịch vụ email chưa được cấu hình. Hãy thiết lập EMAIL_USER và EMAIL_PASS trong file .env của backend-node.');
      error.code = 'EMAIL_NOT_CONFIGURED';
      throw error;
    }

    const emailFrom = process.env.EMAIL_FROM || `SmartExpense <${process.env.EMAIL_USER}>`;

    try {
      const info = await this.transporter.sendMail({
        from: emailFrom,
        to: to,
        subject: subject,
        text: textContent || htmlContent.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
        html: htmlContent
      });

      console.log(`✅ Email sent successfully to ${to}: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error.message);
      if (!error.code) {
        error.code = 'EMAIL_SEND_FAILED';
      }
      throw error;
    }
  }

  async sendDailyReport(user, reportData) {
    const { date, expenses, total, budget } = reportData;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Báo cáo chi tiêu ngày ${date} - SmartExpense</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); margin-top: 20px; }
          .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
          .content { padding: 20px 0; }
          .summary-box { background-color: #f0f7ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; }
          .expense-item { padding: 10px; border-bottom: 1px solid #eee; }
          .expense-item:last-child { border-bottom: none; }
          .amount { font-weight: bold; color: #dc2626; }
          .total { font-size: 20px; font-weight: bold; color: #2563eb; margin-top: 20px; padding-top: 20px; border-top: 2px solid #2563eb; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">💰 SmartExpense</div>
            <h1>Báo cáo chi tiêu ngày ${date}</h1>
          </div>
          
          <div class="content">
            <p>Xin chào <strong>${user.name || user.email}</strong>! 👋</p>
            
            <div class="summary-box">
              <h2>📊 Tóm tắt</h2>
              <p><strong>Số giao dịch:</strong> ${expenses.length}</p>
              <p><strong>Tổng chi tiêu:</strong> <span class="amount">${this.formatCurrency(total)}</span></p>
              ${budget > 0 ? `<p><strong>Ngân sách tháng:</strong> ${this.formatCurrency(budget)}</p>` : ''}
            </div>

            ${expenses.length > 0 ? `
              <h3>📝 Chi tiết giao dịch:</h3>
              ${expenses.map(expense => `
                <div class="expense-item">
                  <strong>${expense.description || expense.category || 'Không có mô tả'}</strong>
                  <span class="amount" style="float: right;">${this.formatCurrency(Math.abs(expense.amount))}</span>
                  <br><small>${expense.category || ''} • ${expense.date || date}</small>
                </div>
              `).join('')}
            ` : '<p>Không có giao dịch nào trong ngày này.</p>'}

            <div class="total">
              Tổng cộng: ${this.formatCurrency(total)}
            </div>
          </div>
          
          <div class="footer">
            <p>Đây là email tự động từ hệ thống SmartExpense.</p>
            <p>Email được gửi lúc: ${new Date().toLocaleString('vi-VN')}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Báo cáo chi tiêu ngày ${date} - SmartExpense

Xin chào ${user.name || user.email}!

📊 Tóm tắt:
- Số giao dịch: ${expenses.length}
- Tổng chi tiêu: ${this.formatCurrency(total)}
${budget > 0 ? `- Ngân sách tháng: ${this.formatCurrency(budget)}` : ''}

${expenses.length > 0 ? `
📝 Chi tiết giao dịch:
${expenses.map(expense => `- ${expense.description || expense.category || 'Không có mô tả'}: ${this.formatCurrency(Math.abs(expense.amount))}`).join('\n')}
` : 'Không có giao dịch nào trong ngày này.'}

Tổng cộng: ${this.formatCurrency(total)}

Đây là email tự động từ hệ thống SmartExpense.
Email được gửi lúc: ${new Date().toLocaleString('vi-VN')}
    `;

    return await this.sendEmail(
      user.email,
      `📊 Báo cáo chi tiêu ngày ${date} - SmartExpense`,
      htmlContent,
      textContent
    );
  }

  async sendBudgetAlert(user, budgetData) {
    const { month, spent, budget, percentage } = budgetData;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cảnh báo ngân sách tháng ${month} - SmartExpense</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); margin-top: 20px; }
          .header { text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #dc2626; }
          .content { padding: 20px 0; }
          .alert-box { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
          .percentage { font-size: 32px; font-weight: bold; color: #dc2626; text-align: center; margin: 20px 0; }
          .progress-bar { background-color: #e5e7eb; border-radius: 10px; height: 30px; margin: 20px 0; overflow: hidden; }
          .progress-fill { background-color: #dc2626; height: 100%; transition: width 0.3s ease; }
          .stats { display: flex; justify-content: space-between; margin: 20px 0; }
          .stat-item { text-align: center; flex: 1; }
          .stat-label { font-size: 14px; color: #666; }
          .stat-value { font-size: 20px; font-weight: bold; color: #333; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">⚠️ SmartExpense</div>
            <h1>Cảnh báo ngân sách</h1>
          </div>
          
          <div class="content">
            <p>Xin chào <strong>${user.name || user.email}</strong>! 👋</p>
            
            <div class="alert-box">
              <h2>⚠️ Bạn đã sử dụng ${percentage}% ngân sách!</h2>
              <p>Tháng ${month} của bạn đang gần hết ngân sách. Hãy kiểm tra lại chi tiêu của bạn.</p>
            </div>

            <div class="percentage">${percentage}%</div>

            <div class="progress-bar">
              <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%"></div>
            </div>

            <div class="stats">
              <div class="stat-item">
                <div class="stat-label">Đã chi tiêu</div>
                <div class="stat-value" style="color: #dc2626;">${this.formatCurrency(spent)}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Ngân sách</div>
                <div class="stat-value" style="color: #2563eb;">${this.formatCurrency(budget)}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Còn lại</div>
                <div class="stat-value" style="color: ${budget - spent > 0 ? '#16a34a' : '#dc2626'};">${this.formatCurrency(budget - spent)}</div>
              </div>
            </div>

            <p style="margin-top: 30px; padding: 15px; background-color: #f0f7ff; border-radius: 5px;">
              <strong>💡 Lời khuyên:</strong> Hãy xem lại các khoản chi tiêu của bạn và điều chỉnh nếu cần thiết để không vượt quá ngân sách.
            </p>
          </div>
          
          <div class="footer">
            <p>Đây là email tự động từ hệ thống SmartExpense.</p>
            <p>Email được gửi lúc: ${new Date().toLocaleString('vi-VN')}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Cảnh báo ngân sách tháng ${month} - SmartExpense

Xin chào ${user.name || user.email}!

⚠️ Bạn đã sử dụng ${percentage}% ngân sách!
Tháng ${month} của bạn đang gần hết ngân sách. Hãy kiểm tra lại chi tiêu của bạn.

Đã chi tiêu: ${this.formatCurrency(spent)}
Ngân sách: ${this.formatCurrency(budget)}
Còn lại: ${this.formatCurrency(budget - spent)}

💡 Lời khuyên: Hãy xem lại các khoản chi tiêu của bạn và điều chỉnh nếu cần thiết để không vượt quá ngân sách.

Đây là email tự động từ hệ thống SmartExpense.
Email được gửi lúc: ${new Date().toLocaleString('vi-VN')}
    `;

    return await this.sendEmail(
      user.email,
      `⚠️ Cảnh báo ngân sách tháng ${month} - SmartExpense`,
      htmlContent,
      textContent
    );
  }

  async sendWelcomeEmail(user) {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Chào mừng đến với SmartExpense!</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); margin-top: 20px; }
          .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
          .content { padding: 20px 0; }
          .welcome-box { background-color: #f0f7ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">💰 SmartExpense</div>
            <h1>Chào mừng đến với SmartExpense!</h1>
          </div>
          
          <div class="content">
            <p>Xin chào <strong>${user.name || user.email}</strong>! 👋</p>
            
            <div class="welcome-box">
              <h2>🎉 Cảm ơn bạn đã đăng ký!</h2>
              <p>Chúng tôi rất vui được chào đón bạn đến với SmartExpense - hệ thống quản lý chi tiêu thông minh được hỗ trợ bởi AI.</p>
            </div>

            <h3>🚀 Bắt đầu sử dụng:</h3>
            <ol>
              <li><strong>Thêm giao dịch:</strong> Ghi lại các khoản chi tiêu và thu nhập của bạn</li>
              <li><strong>Thiết lập ngân sách:</strong> Đặt ngân sách hàng tháng để kiểm soát chi tiêu</li>
              <li><strong>Xem báo cáo:</strong> Theo dõi chi tiêu của bạn qua các biểu đồ và thống kê</li>
              <li><strong>Sử dụng AI:</strong> Nhận phân tích và lời khuyên từ AI về chi tiêu của bạn</li>
            </ol>

            <p style="margin-top: 30px;">
              Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với chúng tôi!
            </p>
          </div>
          
          <div class="footer">
            <p>Chúc bạn có trải nghiệm tuyệt vời với SmartExpense!</p>
            <p>Email được gửi lúc: ${new Date().toLocaleString('vi-VN')}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Chào mừng đến với SmartExpense!

Xin chào ${user.name || user.email}!

🎉 Cảm ơn bạn đã đăng ký!
Chúng tôi rất vui được chào đón bạn đến với SmartExpense - hệ thống quản lý chi tiêu thông minh được hỗ trợ bởi AI.

🚀 Bắt đầu sử dụng:
1. Thêm giao dịch: Ghi lại các khoản chi tiêu và thu nhập của bạn
2. Thiết lập ngân sách: Đặt ngân sách hàng tháng để kiểm soát chi tiêu
3. Xem báo cáo: Theo dõi chi tiêu của bạn qua các biểu đồ và thống kê
4. Sử dụng AI: Nhận phân tích và lời khuyên từ AI về chi tiêu của bạn

Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với chúng tôi!

Chúc bạn có trải nghiệm tuyệt vời với SmartExpense!
Email được gửi lúc: ${new Date().toLocaleString('vi-VN')}
    `;

    return await this.sendEmail(
      user.email,
      '🎉 Chào mừng đến với SmartExpense!',
      htmlContent,
      textContent
    );
  }

  async sendWeeklySummary(user, weeklyData) {
    const { week, totalSpent, transactions, topCategories } = weeklyData;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tóm tắt tuần ${week} - SmartExpense</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); margin-top: 20px; }
          .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
          .content { padding: 20px 0; }
          .summary-box { background-color: #f0f7ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; }
          .stats { display: flex; justify-content: space-around; margin: 20px 0; }
          .stat-item { text-align: center; }
          .stat-label { font-size: 14px; color: #666; }
          .stat-value { font-size: 24px; font-weight: bold; color: #2563eb; }
          .category-item { padding: 10px; border-bottom: 1px solid #eee; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">📈 SmartExpense</div>
            <h1>Tóm tắt tuần</h1>
          </div>
          
          <div class="content">
            <p>Xin chào <strong>${user.name || user.email}</strong>! 👋</p>
            
            <div class="summary-box">
              <h2>📊 Tuần ${week}</h2>
              
              <div class="stats">
                <div class="stat-item">
                  <div class="stat-label">Tổng chi tiêu</div>
                  <div class="stat-value">${this.formatCurrency(totalSpent)}</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">Giao dịch</div>
                  <div class="stat-value">${transactions}</div>
                </div>
              </div>
            </div>

            ${topCategories && topCategories.length > 0 ? `
              <h3>🏆 Danh mục chi tiêu nhiều nhất:</h3>
              ${topCategories.map((cat, index) => `
                <div class="category-item">
                  <strong>${index + 1}. ${cat.name || cat.category}</strong>
                  <span style="float: right; color: #dc2626; font-weight: bold;">${this.formatCurrency(cat.amount || cat.total)}</span>
                </div>
              `).join('')}
            ` : ''}
          </div>
          
          <div class="footer">
            <p>Đây là email tự động từ hệ thống SmartExpense.</p>
            <p>Email được gửi lúc: ${new Date().toLocaleString('vi-VN')}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Tóm tắt tuần ${week} - SmartExpense

Xin chào ${user.name || user.email}!

📊 Tuần ${week}

Tổng chi tiêu: ${this.formatCurrency(totalSpent)}
Số giao dịch: ${transactions}

${topCategories && topCategories.length > 0 ? `
🏆 Danh mục chi tiêu nhiều nhất:
${topCategories.map((cat, index) => `${index + 1}. ${cat.name || cat.category}: ${this.formatCurrency(cat.amount || cat.total)}`).join('\n')}
` : ''}

Đây là email tự động từ hệ thống SmartExpense.
Email được gửi lúc: ${new Date().toLocaleString('vi-VN')}
    `;

    return await this.sendEmail(
      user.email,
      `📈 Tóm tắt tuần ${week} - SmartExpense`,
      htmlContent,
      textContent
    );
  }

  /**
   * Gửi báo cáo tổng quan (daily + monthly + category)
   */
  async sendSummaryReport(user, summary) {
    if (!summary || typeof summary !== 'object') {
      throw new Error('Thiếu dữ liệu báo cáo tổng quan');
    }

    const daily = Array.isArray(summary.daily) ? summary.daily.slice(0, 5) : [];
    const monthly = Array.isArray(summary.monthly) ? summary.monthly.slice(0, 6) : [];
    const categories = Array.isArray(summary.categories) ? summary.categories.slice(0, 4) : [];
    const insights = summary.insights || {};

    const currentMonth = insights.currentMonth || monthly[0] || { month: '', amount: 0, transactions: 0, budget: 0 };
    const previousMonth = insights.previousMonth || monthly[1] || null;
    const avgDaily = insights.avgDaily || 0;
    const busiestDay = insights.busiestDay || (daily.length ? daily.reduce((top, item) => (item.amount > (top?.amount || 0) ? item : top), daily[0]) : null);
    const generatedAt = insights.generatedAt
      ? new Date(insights.generatedAt).toLocaleString('vi-VN')
      : new Date().toLocaleString('vi-VN');

    const momChange = previousMonth && previousMonth.amount > 0
      ? Math.round(((currentMonth.amount - previousMonth.amount) / previousMonth.amount) * 100)
      : null;

    const budgetUsage = currentMonth.budget > 0
      ? Math.min(999, Math.round((currentMonth.amount / currentMonth.budget) * 100))
      : null;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Báo cáo tổng quan - SmartExpense</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fb; margin: 0; padding: 0; color: #0f172a; }
          .container { max-width: 640px; margin: 0 auto; padding: 24px; }
          .card { background: #ffffff; border-radius: 16px; padding: 20px; margin-bottom: 16px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); }
          .header { text-align: center; padding: 24px; border-bottom: 1px solid #e2e8f0; }
          .logo { font-size: 24px; font-weight: 700; color: #2563eb; }
          .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
          .metric { background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 16px; }
          .metric-label { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7; }
          .metric-value { font-size: 22px; font-weight: 700; margin: 6px 0; }
          .metric-sub { font-size: 13px; opacity: 0.8; }
          .section-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; color: #020617; }
          .list { list-style: none; padding: 0; margin: 0; }
          .list-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          .list-item:last-child { border-bottom: none; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          th { background: #f1f5f9; font-weight: 600; color: #475569; }
          .progress { background: #e2e8f0; border-radius: 999px; height: 8px; overflow: hidden; margin-top: 8px; }
          .progress-fill { height: 100%; background: #22d3ee; }
          .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card header">
            <div class="logo">SmartExpense</div>
            <h1 style="margin: 12px 0 4px 0;">Báo cáo tổng quan</h1>
            <p style="margin: 0; color: #475569; font-size: 14px;">Được tạo lúc ${generatedAt}</p>
          </div>

          <div class="card" style="margin-top: 16px;">
            <p>Xin chào <strong>${user.name || user.email}</strong> 👋</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              Đây là bản tóm tắt nhanh về tình hình chi tiêu của bạn. Những số liệu bên dưới được tính dựa trên 10 ngày gần nhất và 6 tháng gần nhất trong hệ thống SmartExpense.
            </p>
          </div>

          <div class="metrics">
            <div class="metric">
              <div class="metric-label">Tháng hiện tại</div>
              <div class="metric-value">${this.formatCurrency(currentMonth.amount || 0)}</div>
              <div class="metric-sub">${currentMonth.transactions || 0} giao dịch • ${currentMonth.month || 'N/A'}</div>
              ${budgetUsage !== null ? `
                <div class="progress" style="margin-top: 12px;">
                  <div class="progress-fill" style="width: ${Math.min(budgetUsage, 100)}%;"></div>
                </div>
                <div class="metric-sub" style="margin-top: 4px;">${budgetUsage}% ngân sách (${this.formatCurrency(currentMonth.budget || 0)})</div>
              ` : '<div class="metric-sub" style="margin-top: 12px;">Chưa thiết lập ngân sách</div>'}
            </div>
            <div class="metric">
              <div class="metric-label">Trung bình mỗi ngày</div>
              <div class="metric-value">${this.formatCurrency(avgDaily || 0)}</div>
              <div class="metric-sub">${daily.length} ngày gần nhất</div>
              ${busiestDay ? `<div class="metric-sub" style="margin-top: 8px;">Ngày cao nhất: ${busiestDay.date} (${this.formatCurrency(busiestDay.amount)})</div>` : ''}
            </div>
            <div class="metric">
              <div class="metric-label">So với tháng trước</div>
              <div class="metric-value">${momChange !== null ? `${momChange > 0 ? '+' : ''}${momChange}%` : 'N/A'}</div>
              <div class="metric-sub">${previousMonth ? `Tháng trước: ${this.formatCurrency(previousMonth.amount)}` : 'Chưa đủ dữ liệu'}</div>
            </div>
          </div>

          <div class="card">
            <div class="section-title">Top danh mục chi tiêu</div>
            ${categories.length ? `
              <ul class="list">
                ${categories.map((cat, index) => `
                  <li class="list-item">
                    <span>${index + 1}. ${cat.name}</span>
                    <span>${this.formatCurrency(cat.amount)} (${cat.percentage || 0}%)</span>
                  </li>
                `).join('')}
              </ul>
            ` : '<p style="font-size: 14px; color: #94a3b8;">Chưa có dữ liệu danh mục.</p>'}
          </div>

          <div class="card">
            <div class="section-title">5 ngày gần nhất</div>
            ${daily.length ? `
              <table>
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Giao dịch</th>
                    <th>Tổng chi</th>
                  </tr>
                </thead>
                <tbody>
                  ${daily.map(day => `
                    <tr>
                      <td>${day.date}</td>
                      <td>${day.transactions}</td>
                      <td>${this.formatCurrency(day.amount)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p style="font-size: 14px; color: #94a3b8;">Không có giao dịch nào trong 10 ngày gần đây.</p>'}
          </div>

          <div class="card">
            <div class="section-title">Xu hướng 6 tháng</div>
            ${monthly.length ? `
              <table>
                <thead>
                  <tr>
                    <th>Tháng</th>
                    <th>Giao dịch</th>
                    <th>Tổng chi</th>
                  </tr>
                </thead>
                <tbody>
                  ${monthly.map(month => `
                    <tr>
                      <td>${month.month}</td>
                      <td>${month.transactions}</td>
                      <td>${this.formatCurrency(month.amount)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p style="font-size: 14px; color: #94a3b8;">Chưa có dữ liệu để vẽ xu hướng.</p>'}
          </div>

          <div class="footer">
            <p>Email được gửi tự động từ SmartExpense.</p>
            <p>Nếu bạn không muốn nhận email này nữa, hãy tắt tùy chọn trong phần Cài đặt.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
BÁO CÁO TỔNG QUAN - SMARTEXPENSE

Xin chào ${user.name || user.email}!

Tháng hiện tại (${currentMonth.month || 'N/A'}):
- Tổng chi: ${this.formatCurrency(currentMonth.amount || 0)}
- Giao dịch: ${currentMonth.transactions || 0}
${budgetUsage !== null ? `- Ngân sách: ${this.formatCurrency(currentMonth.budget || 0)} (${budgetUsage}%)` : '- Chưa thiết lập ngân sách'}

So với tháng trước: ${momChange !== null ? `${momChange > 0 ? '+' : ''}${momChange}%` : 'Chưa đủ dữ liệu'}

Chi trung bình 10 ngày gần nhất: ${this.formatCurrency(avgDaily || 0)}
${busiestDay ? `Ngày cao nhất: ${busiestDay.date} (${this.formatCurrency(busiestDay.amount)})` : ''}

Top danh mục:
${categories.length ? categories.map((cat, index) => `${index + 1}. ${cat.name}: ${this.formatCurrency(cat.amount)} (${cat.percentage || 0}%)`).join('\n') : 'Chưa có dữ liệu danh mục'}

5 ngày gần nhất:
${daily.length ? daily.map(day => `${day.date} - ${day.transactions} giao dịch - ${this.formatCurrency(day.amount)}`).join('\n') : 'Không có giao dịch'}

Xu hướng 6 tháng:
${monthly.length ? monthly.map(month => `${month.month}: ${month.transactions} giao dịch - ${this.formatCurrency(month.amount)}`).join('\n') : 'Chưa có dữ liệu'}

Email được tạo lúc: ${generatedAt}
    `;

    return await this.sendEmail(
      user.email,
      '📊 Báo cáo tổng quan chi tiêu - SmartExpense',
      htmlContent,
      textContent
    );
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  }
}

module.exports = new EmailService();
