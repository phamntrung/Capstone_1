const cron = require('node-cron');
const emailService = require('./emailService');
const budgetAlertService = require('./budgetAlertService');

class EmailScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('📧 Email scheduler is already running');
      return;
    }

    console.log('📧 Starting email scheduler...');

    // Daily report job - runs every day at 8:00 AM
    const dailyReportJob = cron.schedule('0 8 * * *', async () => {
      console.log('📊 Running daily report job...');
      await this.sendDailyReports();
    }, {
      scheduled: false,
      timezone: 'Asia/Ho_Chi_Minh'
    });

    // Budget alert job - runs every day at 9:00 AM
    const budgetAlertJob = cron.schedule('*/1 * * * *', async () => {
      console.log('⚠️ Running budget alert job...');
      await this.sendBudgetAlerts();
    }, {
      scheduled: false,
      timezone: 'Asia/Ho_Chi_Minh'
    });

    // Weekly summary job - runs every Monday at 8:30 AM
    const weeklySummaryJob = cron.schedule('30 8 * * 1', async () => {
      console.log('📈 Running weekly summary job...');
      await this.sendWeeklySummaries();
    }, {
      scheduled: false,
      timezone: 'Asia/Ho_Chi_Minh'
    });

    this.jobs.set('dailyReport', dailyReportJob);
    this.jobs.set('budgetAlert', budgetAlertJob);
    this.jobs.set('weeklySummary', weeklySummaryJob);

    // Start all jobs
    dailyReportJob.start();
    budgetAlertJob.start();
    weeklySummaryJob.start();

    this.isRunning = true;
    console.log('✅ Email scheduler started successfully');
    console.log('📅 Daily reports: 8:00 AM (Asia/Ho_Chi_Minh)');
    console.log('⚠️ Budget alerts: 9:00 AM (Asia/Ho_Chi_Minh)');
    console.log('📈 Weekly summaries: Monday 8:30 AM (Asia/Ho_Chi_Minh)');
  }

  stop() {
    if (!this.isRunning) {
      console.log('📧 Email scheduler is not running');
      return;
    }

    console.log('📧 Stopping email scheduler...');
    
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`⏹️ Stopped ${name} job`);
    }

    this.jobs.clear();
    this.isRunning = false;
    console.log('✅ Email scheduler stopped');
  }

  async sendDailyReports() {
    try {
      // In a real application, you would fetch users from database
      // For now, we'll use a mock approach
      const users = this.getUsersWithDailyReportEnabled();
      
      if (users.length === 0) {
        console.log('📊 No users with daily report enabled');
        return;
      }

      console.log(`📊 Sending daily reports to ${users.length} users...`);

      for (const user of users) {
        try {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const dateStr = yesterday.toISOString().split('T')[0];

          // Get user's expenses for yesterday
          const reportData = this.generateDailyReportData(user.id, dateStr);
          
          await emailService.sendDailyReport(user, reportData);
          console.log(`✅ Daily report sent to ${user.email}`);
          
          // Add delay between emails to avoid rate limiting
          await this.delay(1000);
        } catch (error) {
          console.error(`❌ Failed to send daily report to ${user.email}:`, error.message);
        }
      }

      console.log('📊 Daily reports job completed');
    } catch (error) {
      console.error('❌ Daily reports job failed:', error);
    }
  }

  async sendBudgetAlerts() {
    try {
      const users = await budgetAlertService.getUsersWithBudgetAlertsEnabled();
      
      if (users.length === 0) {
        console.log('⚠️ No users with budget alerts enabled');
        return;
      }

      console.log(`⚠️ Checking budget alerts for ${users.length} users...`);

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      for (const user of users) {
        try {
          // Sử dụng budgetAlertService để kiểm tra và gửi cảnh báo
          await budgetAlertService.checkAndSendBudgetAlert(user.id, year, month);
          
          // Add delay between checks
          await this.delay(1000);
        } catch (error) {
          console.error(`❌ Failed to check budget alert for ${user.email}:`, error.message);
        }
      }

      console.log('⚠️ Budget alerts job completed');
    } catch (error) {
      console.error('❌ Budget alerts job failed:', error);
    }
  }

  async sendWeeklySummaries() {
    try {
      const users = this.getUsersWithWeeklySummaryEnabled();
      
      if (users.length === 0) {
        console.log('📈 No users with weekly summary enabled');
        return;
      }

      console.log(`📈 Sending weekly summaries to ${users.length} users...`);

      for (const user of users) {
        try {
          const weeklyData = this.generateWeeklySummaryData(user.id);
          
          await emailService.sendWeeklySummary(user, weeklyData);
          console.log(`✅ Weekly summary sent to ${user.email}`);
          
          // Add delay between emails
          await this.delay(1000);
        } catch (error) {
          console.error(`❌ Failed to send weekly summary to ${user.email}:`, error.message);
        }
      }

      console.log('📈 Weekly summaries job completed');
    } catch (error) {
      console.error('❌ Weekly summaries job failed:', error);
    }
  }

  // Mock data methods (in production, these would query the database)
  getUsersWithDailyReportEnabled() {
    // This would normally query the database
    // For demo purposes, return empty array
    return [];
  }

  getUsersWithBudgetAlertsEnabled() {
    // ⚠️ HÀM CŨ: ban đầu chỉ trả về mảng rỗng (mock) nên scheduler không có user nào để kiểm tra
    // ĐỂ GIỮ NGUYÊN CẤU TRÚC: giữ lại hàm cùng tên nhưng triển khai lại, gọi sang budgetAlertService
    // Mục tiêu: lấy đúng danh sách user đã bật cảnh báo ngân sách trong bảng user_settings
    return budgetAlertService
      .getUsersWithBudgetAlertsEnabled()
      .then((users) => {
        // Đảm bảo luôn trả về mảng (kể cả khi null/undefined)
        return Array.isArray(users) ? users : [];
      })
      .catch((error) => {
        console.error('❌ [emailScheduler] Lỗi khi lấy danh sách user bật cảnh báo ngân sách:', error);
        // Nếu có lỗi, trả về mảng rỗng để tránh làm crash scheduler
        return [];
      });
  }

  getUsersWithWeeklySummaryEnabled() {
    // This would normally query the database
    // For demo purposes, return empty array
    return [];
  }

  generateDailyReportData(userId, date) {
    // This would normally query the database for user's expenses
    // For demo purposes, return mock data
    return {
      date: date,
      expenses: [],
      total: 0,
      budget: 0
    };
  }

  generateBudgetAlertData(userId, year, month) {
    // This would normally query the database for user's budget and spending
    // For demo purposes, return null (no alert needed)
    return null;
  }

  generateWeeklySummaryData(userId) {
    // This would normally query the database for user's weekly data
    // For demo purposes, return mock data
    return {
      week: '2024-01-01 to 2024-01-07',
      totalSpent: 0,
      transactions: 0,
      topCategories: []
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Manual trigger methods for testing
  async triggerDailyReports() {
    console.log('🔧 Manually triggering daily reports...');
    await this.sendDailyReports();
  }

  async triggerBudgetAlerts() {
    console.log('🔧 Manually triggering budget alerts...');
    await this.sendBudgetAlerts();
  }

  async triggerWeeklySummaries() {
    console.log('🔧 Manually triggering weekly summaries...');
    await this.sendWeeklySummaries();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      jobs: Array.from(this.jobs.keys()),
      nextRuns: this.getNextRunTimes()
    };
  }

  getNextRunTimes() {
    const nextRuns = {};
    for (const [name, job] of this.jobs) {
      if (job.running) {
        nextRuns[name] = 'Running';
      } else {
        nextRuns[name] = 'Scheduled';
      }
    }
    return nextRuns;
  }
}

module.exports = new EmailScheduler();
