const nodemailer = require('nodemailer');

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
      throw new Error('Email service is not configured. Please set EMAIL_USER and EMAIL_PASS in .env file.');
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

  formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  }
}

module.exports = new EmailService();
