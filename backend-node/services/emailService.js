const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.init();
  }

  init() {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const emailPort = Number(process.env.EMAIL_PORT) || 587;

    if (!emailUser || !emailPass) {
      console.log('⚠️ Email service not configured');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: emailPort === 465,
      auth: { user: emailUser, pass: emailPass }
    });

    this.isConfigured = true;
    console.log('✅ Email service ready');
  }

  async sendEmail(to, subject, html, text) {
    if (!this.isConfigured) {
      throw new Error('EMAIL_NOT_CONFIGURED');
    }

    const info = await this.transporter.sendMail({
      from: `SmartExpense <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text
    });

    console.log('📧 Email sent:', to);
    return info;
  }

  async sendBudgetAlert(user, data) {
    const { month, spent, budget, percentage } = data;

    const html = `
      <h2>⚠️ Cảnh báo ngân sách</h2>
      <p>Bạn đã sử dụng <b>${percentage}%</b> ngân sách tháng ${month}</p>
      <ul>
        <li>Đã chi: ${spent.toLocaleString()} VND</li>
        <li>Ngân sách: ${budget.toLocaleString()} VND</li>
        <li>Còn lại: ${(budget - spent).toLocaleString()} VND</li>
      </ul>
    `;

    const text = `
Cảnh báo ngân sách tháng ${month}
Đã chi: ${spent}
Ngân sách: ${budget}
Còn lại: ${budget - spent}
    `;

    return this.sendEmail(
      user.email,
      `⚠️ Cảnh báo ngân sách tháng ${month}`,
      html,
      text
    );
  }
}

module.exports = new EmailService();
