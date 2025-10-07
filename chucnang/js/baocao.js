/**
 * BAOCAO.JS - Xử lý chức năng báo cáo SmartExpense
 * Bao gồm: Biểu đồ, thống kê theo ngày/tháng, xuất báo cáo, lọc dữ liệu
 */

class BaoCaoManager {
  constructor() {
    this.dailyData = [];
    this.monthlyData = [];
    this.init();
  }

  init() {
    this.loadReportData();
    this.setupEventListeners();
    this.renderCharts();
    this.setupScrollToTop();
  }

  loadReportData() {
    // Dữ liệu thời gian thực dựa trên localStorage (nếu có), mặc định 0 nếu không có
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear(); // Năm hiện tại (2025)

    // Lấy danh sách giao dịch từ localStorage (nếu có)
    const transactions = this.getTransactions();

    // Tổng hợp theo ngày: 10 ngày gần nhất
    this.dailyData = this.aggregateDaily(transactions, currentDate, 10).map(d => ({
      date: d.date,
      label: `${d.date} ${this.getWeekdayVi(new Date(d.date))}`,
      amount: d.amount,
      transactions: d.transactions
    }));

    // Tổng hợp theo tháng: 6 tháng gần nhất trong năm hiện tại
    this.monthlyData = this.aggregateMonthly(transactions, currentYear, 6).map(m => ({
      month: m.month,
      amount: m.amount,
      budget: m.budget,
      transactions: m.transactions
    }));

    // Phân bổ danh mục (demo nếu không có dữ liệu), có thể cập nhật theo thực tế sau
    this.categoryData = [
      { name: 'Ăn uống', amount: Math.round((this.monthlyData[0]?.amount || 0) * 0.35), percentage: 35, color: '#ef4444' },
      { name: 'Di chuyển', amount: Math.round((this.monthlyData[0]?.amount || 0) * 0.18), percentage: 18, color: '#3b82f6' },
      { name: 'Nhà ở', amount: Math.round((this.monthlyData[0]?.amount || 0) * 0.47), percentage: 47, color: '#10b981' }
    ];
  }

  setupEventListeners() {
    // Nút xem chi tiết báo cáo
    const btnDetail = document.getElementById('btnDetail');
    if (btnDetail) {
      btnDetail.addEventListener('click', () => {
        this.showDetailedReport();
      });
    }

    // Nút xem thêm cho daily
    const dailyViewMore = document.querySelector('.daily .btn');
    if (dailyViewMore) {
      dailyViewMore.addEventListener('click', () => {
        this.loadMoreDailyData();
      });
    }

    // Nút xem thêm cho monthly
    const monthlyViewMore = document.querySelector('.month .btn');
    if (monthlyViewMore) {
      monthlyViewMore.addEventListener('click', () => {
        this.loadMoreMonthlyData();
      });
    }

    // Click vào các hàng để xem chi tiết
    this.setupRowClickHandlers();
  }

  setupRowClickHandlers() {
    // Daily rows
    document.addEventListener('click', (e) => {
      const dailyRow = e.target.closest('.daily .row');
      if (dailyRow && !e.target.closest('button')) {
        const dateText = dailyRow.querySelector('.date')?.textContent;
        if (dateText) {
          this.showDayDetail(dateText);
        }
      }

      const monthlyRow = e.target.closest('.month .row');
      if (monthlyRow && !e.target.closest('button')) {
        const monthText = monthlyRow.querySelector('div')?.textContent;
        if (monthText) {
          this.showMonthDetail(monthText);
        }
      }
    });
  }

  renderCharts() {
    this.renderDailyChart();
    this.renderMonthlyChart();
    this.updateChartVisualization();
  }

  renderDailyChart() {
    const dailyContainer = document.getElementById('daily');
    if (!dailyContainer) return;

    dailyContainer.innerHTML = '';
    const maxAmount = Math.max(...this.dailyData.map(d => d.amount), 1);

    this.dailyData.forEach(day => {
      const percentage = Math.round((day.amount / maxAmount) * 100);
      
      const row = document.createElement('div');
      row.className = 'row';
      row.style.cursor = 'pointer';
      row.title = `Click để xem chi tiết ${day.label}`;
      
      row.innerHTML = `
        <div class="arrow">›</div>
        <div class="date">${day.label}</div>
        <div class="bar">
          <i class="${day.amount > 0 ? 'green' : ''}" style="width:${percentage}%"></i>
        </div>
        <div class="amount">${this.formatCurrency(day.amount)}</div>
      `;
      
      // Hover effect
      row.addEventListener('mouseenter', () => {
        row.style.backgroundColor = '#f8fafc';
      });
      
      row.addEventListener('mouseleave', () => {
        row.style.backgroundColor = '';
      });
      
      dailyContainer.appendChild(row);
    });
  }

  renderMonthlyChart() {
    const monthlyContainer = document.getElementById('month');
    if (!monthlyContainer) return;

    monthlyContainer.innerHTML = '';
    const maxAmount = Math.max(...this.monthlyData.map(m => m.amount), 1);

    this.monthlyData.forEach(month => {
      const percentage = Math.round((month.amount / maxAmount) * 100);
      const budgetPercentage = Math.round((month.amount / month.budget) * 100);
      
      const row = document.createElement('div');
      row.className = 'row';
      row.style.cursor = 'pointer';
      row.title = `Click để xem chi tiết ${month.month}`;
      
      row.innerHTML = `
        <div>${month.month}</div>
        <div class="mbar">
          <i style="width:${percentage}%; background: ${budgetPercentage > 100 ? '#ef4444' : '#22c55e'}"></i>
        </div>
        <div class="mamount">${this.formatCurrency(month.amount)}</div>
      `;
      
      // Hover effect
      row.addEventListener('mouseenter', () => {
        row.style.backgroundColor = '#f8fafc';
      });
      
      row.addEventListener('mouseleave', () => {
        row.style.backgroundColor = '';
      });
      
      monthlyContainer.appendChild(row);
    });
  }

  updateChartVisualization() {
    // Update the SVG chart with real data
    const svg = document.querySelector('.chart svg');
    if (!svg) return;

    // Create path based on monthly data
    const monthsForChart = [...this.monthlyData].reverse();
    const points = monthsForChart.map((month, index) => {
      const x = 40 + (index * (540 / (this.monthlyData.length - 1)));
      const y = 220 - ((month.amount / 10000000) * 180); // Scale to fit chart
      return `${x},${y}`;
    });

    const pathData = `M${points.join(' L')} L580,220 L40,220 Z`;
    const path = svg.querySelector('path');
    if (path) {
      path.setAttribute('d', pathData);
    }
  }

  // ===== Helpers: Lấy dữ liệu và tổng hợp thời gian thực =====
  getTransactions() {
    try {
      const raw = localStorage.getItem('transactions');
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list.filter(item => item && item.date && typeof item.amount === 'number');
    } catch (e) {
      return [];
    }
  }

  aggregateDaily(transactions, toDate, days) {
    const result = [];
    const end = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
    for (let i = 0; i < days; i++) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const dayTx = transactions.filter(t => t.date === iso && t.amount < 0);
      const amount = dayTx.reduce((s, t) => s + Math.abs(t.amount), 0);
      result.push({ date: iso, amount, transactions: dayTx.length });
    }
    return result;
  }

  aggregateMonthly(transactions, year, monthsBack) {
    const now = new Date();
    const currentMonthIndex = now.getFullYear() === year ? now.getMonth() : 11; // 0-11
    const out = [];
    for (let i = 0; i < monthsBack; i++) {
      let mIndex = currentMonthIndex - i;
      let y = year;
      if (mIndex < 0) {
        y = year - 1;
        mIndex = 12 + mIndex;
      }
      const monthStr = (mIndex + 1).toString().padStart(2, '0') + '/' + y;
      const monthPrefix = `${y}-${(mIndex + 1).toString().padStart(2, '0')}`;
      const mTx = transactions.filter(t => t.date.startsWith(monthPrefix) && t.amount < 0);
      const amount = mTx.reduce((s, t) => s + Math.abs(t.amount), 0);
      const budget = 8000000; // Ngân sách mặc định, có thể lấy từ cài đặt
      out.push({ month: monthStr, amount, budget, transactions: mTx.length });
    }
    return out;
  }

  getWeekdayVi(dateObj) {
    const day = dateObj.getDay();
    switch (day) {
      case 0: return 'Chủ Nhật';
      case 1: return 'Thứ Hai';
      case 2: return 'Thứ Ba';
      case 3: return 'Thứ Tư';
      case 4: return 'Thứ Năm';
      case 5: return 'Thứ Sáu';
      case 6: return 'Thứ Bảy';
      default: return '';
    }
  }

  showDayDetail(dateLabel) {
    const dayData = this.dailyData.find(d => d.label === dateLabel);
    if (!dayData) return;

    const modal = this.createModal(`Chi tiết ngày ${dayData.date}`, `
      <div style="padding: 20px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
          <div>
            <h4>Tổng chi tiêu</h4>
            <p style="font-size: 24px; font-weight: bold; color: #ef4444;">
              ${this.formatCurrency(dayData.amount)}
            </p>
          </div>
          <div>
            <h4>Số giao dịch</h4>
            <p style="font-size: 24px; font-weight: bold; color: #3b82f6;">
              ${dayData.transactions}
            </p>
          </div>
        </div>
        
        <h4>Giao dịch chi tiết</h4>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
          ${dayData.amount > 0 ? this.generateMockTransactions(dayData) : 'Không có giao dịch nào'}
        </div>
        
        <div style="margin-top: 20px; text-align: right;">
          <button onclick="this.closest('.modal-overlay').remove()" 
                  style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">
            Đóng
          </button>
        </div>
      </div>
    `);

    document.body.appendChild(modal);
  }

  showMonthDetail(monthLabel) {
    const monthData = this.monthlyData.find(m => m.month === monthLabel);
    if (!monthData) return;

    const budgetUsed = Math.round((monthData.amount / monthData.budget) * 100);
    const remaining = monthData.budget - monthData.amount;

    const modal = this.createModal(`Chi tiết tháng ${monthData.month}`, `
      <div style="padding: 20px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
          <div style="text-align: center; padding: 15px; background: #fef2f2; border-radius: 8px;">
            <h4 style="margin: 0; color: #ef4444;">Chi tiêu</h4>
            <p style="font-size: 20px; font-weight: bold; margin: 5px 0; color: #ef4444;">
              ${this.formatCurrency(monthData.amount)}
            </p>
          </div>
          <div style="text-align: center; padding: 15px; background: #f0f9ff; border-radius: 8px;">
            <h4 style="margin: 0; color: #3b82f6;">Ngân sách</h4>
            <p style="font-size: 20px; font-weight: bold; margin: 5px 0; color: #3b82f6;">
              ${this.formatCurrency(monthData.budget)}
            </p>
          </div>
          <div style="text-align: center; padding: 15px; background: ${remaining >= 0 ? '#f0fdf4' : '#fef2f2'}; border-radius: 8px;">
            <h4 style="margin: 0; color: ${remaining >= 0 ? '#10b981' : '#ef4444'};">Còn lại</h4>
            <p style="font-size: 20px; font-weight: bold; margin: 5px 0; color: ${remaining >= 0 ? '#10b981' : '#ef4444'};">
              ${this.formatCurrency(Math.abs(remaining))}
            </p>
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h4>Tiến độ ngân sách</h4>
          <div style="background: #e5e7eb; height: 20px; border-radius: 10px; overflow: hidden;">
            <div style="width: ${Math.min(budgetUsed, 100)}%; height: 100%; background: ${budgetUsed > 100 ? '#ef4444' : '#10b981'}; transition: width 0.3s;"></div>
          </div>
          <p style="margin: 5px 0; font-size: 14px; color: #64748b;">
            Đã sử dụng ${budgetUsed}% ngân sách
          </p>
        </div>
        
        <h4>Thống kê</h4>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
          <p><strong>Số giao dịch:</strong> ${monthData.transactions}</p>
          <p><strong>Trung bình/ngày:</strong> ${this.formatCurrency(Math.round(monthData.amount / 30))}</p>
          <p><strong>Trung bình/giao dịch:</strong> ${this.formatCurrency(Math.round(monthData.amount / monthData.transactions))}</p>
        </div>
        
        <div style="margin-top: 20px; text-align: right;">
          <button onclick="this.closest('.modal-overlay').remove()" 
                  style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">
            Đóng
          </button>
        </div>
      </div>
    `);

    document.body.appendChild(modal);
  }

  generateMockTransactions(dayData) {
    const transactions = [
      'Cà phê sáng - 25,000đ',
      'Ăn trưa - 45,000đ',
      'Xăng xe - 200,000đ',
      'Mua sắm - 150,000đ',
      'Ăn tối - 80,000đ'
    ];

    return transactions.slice(0, dayData.transactions).map(t => 
      `<p style="margin: 5px 0; padding: 8px; background: white; border-radius: 4px;">${t}</p>`
    ).join('');
  }

  createModal(title, content) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    `;

    modal.innerHTML = `
      <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
        <h3 style="margin: 0; font-size: 18px;">${title}</h3>
      </div>
      ${content}
    `;

    overlay.appendChild(modal);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    return overlay;
  }

  showDetailedReport() {
    const reportContent = `
      <div style="padding: 20px;">
        <h4>Báo cáo tổng quan</h4>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
            <h5>Tháng này</h5>
            <p><strong>Tổng chi:</strong> ${this.formatCurrency(this.monthlyData[0]?.amount || 0)}</p>
            <p><strong>Giao dịch:</strong> ${this.monthlyData[0]?.transactions || 0}</p>
            <p><strong>Ngân sách:</strong> ${this.formatCurrency(this.monthlyData[0]?.budget || 0)}</p>
          </div>
          
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
            <h5>Trung bình 6 tháng</h5>
            <p><strong>Chi/tháng:</strong> ${this.formatCurrency(this.calculateAverageMonthly())}</p>
            <p><strong>Giao dịch/tháng:</strong> ${this.calculateAverageTransactions()}</p>
          </div>
        </div>
        
        <h4>Phân tích theo danh mục</h4>
        <div style="margin-bottom: 20px;">
          ${this.categoryData.map(cat => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: #f8fafc; margin: 5px 0; border-radius: 6px;">
              <span>${cat.name}</span>
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 100px; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                  <div style="width: ${cat.percentage}%; height: 100%; background: ${cat.color};"></div>
                </div>
                <span style="font-weight: bold;">${this.formatCurrency(cat.amount)}</span>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button onclick="window.print()" 
                  style="padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer;">
            In báo cáo
          </button>
          <button onclick="window.baoCaoManager && window.baoCaoManager.exportReport()" 
                  style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">
            Xuất Excel
          </button>
          <button onclick="this.closest('.modal-overlay').remove()" 
                  style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer;">
            Đóng
          </button>
        </div>
      </div>
    `;

    const modal = this.createModal('Báo cáo chi tiết', reportContent);
    document.body.appendChild(modal);
  }

  calculateAverageMonthly() {
    const total = this.monthlyData.reduce((sum, month) => sum + month.amount, 0);
    return Math.round(total / this.monthlyData.length);
  }

  calculateAverageTransactions() {
    const total = this.monthlyData.reduce((sum, month) => sum + month.transactions, 0);
    return Math.round(total / this.monthlyData.length);
  }

  loadMoreDailyData() {
    // Simulate loading more daily data
    const additionalDays = [
      { date: '2024-09-22', label: '2024-09-22 Chủ Nhật', amount: 0, transactions: 0 },
      { date: '2024-09-21', label: '2024-09-21 Thứ Bảy', amount: 150000, transactions: 1 },
      { date: '2024-09-20', label: '2024-09-20 Thứ Sáu', amount: 320000, transactions: 3 }
    ];

    this.dailyData.push(...additionalDays);
    this.renderDailyChart();
  }

  loadMoreMonthlyData() {
    // Simulate loading more monthly data
    const additionalMonths = [
      { month: '04/2024', amount: 6800000, budget: 8000000, transactions: 39 },
      { month: '03/2024', amount: 7500000, budget: 8000000, transactions: 44 },
      { month: '02/2024', amount: 5200000, budget: 8000000, transactions: 31 }
    ];

    this.monthlyData.push(...additionalMonths);
    this.renderMonthlyChart();
  }

  setupScrollToTop() {
    const fabBtn = document.querySelector('.fab');
    if (fabBtn) {
      fabBtn.addEventListener('click', () => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  }

  exportReport() {
    // Xuất CSV (tương thích Excel) với BOM để hiển thị tiếng Việt chính xác
    const csvContent = this.generateCSVReport();
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const filename = `SmartExpense_Report_${new Date().toISOString().split('T')[0]}.csv`;

    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      // IE/Edge legacy
      window.navigator.msSaveOrOpenBlob(blob, filename);
      return;
    }

    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  generateCSVReport() {
    const now = new Date();
    const fmtVND = (n) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
    const safe = (v) => (v == null ? '' : String(v).replace(/\n/g, ' '));

    const currentMonth = this.monthlyData[0] || { amount: 0, budget: 0, transactions: 0, month: '' };
    const avgMonthly = this.calculateAverageMonthly ? this.calculateAverageMonthly() : 0;
    const avgTx = this.calculateAverageTransactions ? this.calculateAverageTransactions() : 0;

    let csv = '';
    // Gợi ý phân tách cho Excel
    csv += 'sep=,\n';
    // Tiêu đề + ngày giờ xuất
    csv += 'Báo cáo SmartExpense\n';
    csv += `Ngày xuất,${now.toLocaleString('vi-VN')}\n`;
    csv += `Khoảng thời gian,10 ngày gần nhất & 6 tháng gần nhất\n`;
    csv += '\n';

    // Tổng quan
    csv += 'Tổng quan\n';
    csv += `Tháng hiện tại,${safe(currentMonth.month)}\n`;
    csv += `Tổng chi tháng hiện tại,${fmtVND(currentMonth.amount || 0)}\n`;
    csv += `Giao dịch tháng hiện tại,${currentMonth.transactions || 0}\n`;
    csv += `Ngân sách tháng hiện tại,${fmtVND(currentMonth.budget || 0)}\n`;
    csv += `Trung bình chi 6 tháng,${fmtVND(avgMonthly || 0)}\n`;
    csv += `Trung bình giao dịch/tháng,${avgTx || 0}\n`;
    csv += '\n';

    // Daily section
    csv += 'Chi tiêu theo ngày\n';
    csv += 'Ngày,Label,Số giao dịch,Tổng chi (đ)\n';
    this.dailyData.forEach(day => {
      csv += `${safe(day.date)},${safe(day.label)},${day.transactions || 0},${fmtVND(day.amount || 0)}\n`;
    });
    csv += '\n';

    // Monthly section
    csv += 'Chi tiêu theo tháng\n';
    csv += 'Tháng,Số giao dịch,Tổng chi (đ),Ngân sách (đ),% Ngân sách\n';
    this.monthlyData.forEach(month => {
      const used = month.budget ? Math.round((month.amount / month.budget) * 100) : 0;
      csv += `${safe(month.month)},${month.transactions || 0},${fmtVND(month.amount || 0)},${fmtVND(month.budget || 0)},${used}%\n`;
    });
    csv += '\n';

    // Category section (nếu có)
    if (Array.isArray(this.categoryData) && this.categoryData.length) {
      csv += 'Phân tích theo danh mục\n';
      csv += 'Danh mục,Tỷ lệ,Tổng chi (đ)\n';
      this.categoryData.forEach(cat => {
        csv += `${safe(cat.name)},${cat.percentage || 0}%,${fmtVND(cat.amount || 0)}\n`;
      });
      csv += '\n';
    }

    return csv;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.baoCaoManager = new BaoCaoManager();
});

// Export for global use
window.BaoCaoManager = BaoCaoManager;
