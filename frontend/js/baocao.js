/**
 * BAOCAO.JS - Xử lý chức năng báo cáo SmartExpense
 * Bao gồm: Biểu đồ, thống kê theo ngày/tháng, xuất báo cáo, lọc dữ liệu
 */

class BaoCaoManager {
  constructor() {
    this.dailyData = [];
    this.monthlyData = [];
    this.currentServerDate = null; // Cache ngày từ server
    this.init();
  }

  // Lấy ngày hiện tại từ server (với cache)
  async getTodayDate() {
    // Nếu đã có cache và còn mới (< 1 phút), dùng cache
    if (this.currentServerDate) {
      return this.currentServerDate;
    }
    
    // Lấy từ server
    if (typeof window !== 'undefined' && typeof window.getCurrentDateFromServer === 'function') {
      try {
        this.currentServerDate = await window.getCurrentDateFromServer();
        return this.currentServerDate;
      } catch (error) {
        console.warn('Failed to get server date:', error);
      }
    }
    
    // Fallback: dùng client date nhưng format đúng timezone VN
    const now = new Date();
    const vietnamOffset = 7 * 60; // UTC+7
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const vietnamTime = new Date(utc + (vietnamOffset * 60000));
    const year = vietnamTime.getFullYear();
    const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
    const day = String(vietnamTime.getDate()).padStart(2, '0');
    this.currentServerDate = `${year}-${month}-${day}`;
    return this.currentServerDate;
  }

  async init() {
    // Load from API first to ensure fresh data
    await this.loadReportData(true); // forceRefresh = true
    this.setupEventListeners();
    await this.renderCharts(); // Wait for async render
    this.setupScrollToTop();
    this.setupRealTimeUpdates();
  }

  async loadReportData(forceRefresh = false) {
    console.log('🔄 Loading report data...');
    
    // Thử gọi API summary để lấy báo cáo và LƯU vào DB (backend sẽ tự lưu)
    // Nếu API không khả dụng, fallback sang tổng hợp từ DataManager/localStorage
    try {
      if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
        const res = await window.apiRequest('/api/reports/summary');
        if (res && res.ok && res.data) {
          // Backend đã lưu báo cáo; lấy dữ liệu trả về để hiển thị
          const daily = Array.isArray(res.data.daily) ? res.data.daily : [];
          const monthly = Array.isArray(res.data.monthly) ? res.data.monthly : [];
          const categories = Array.isArray(res.data.categories) ? res.data.categories : [];
          
          // Chuẩn hoá vào định dạng đang dùng
          this.dailyData = daily.map(d => ({
            date: d.date,
            label: d.label || d.date, // backend có thể không trả label
            amount: Number(d.amount || 0),
            transactions: Number(d.transactions || 0)
          }));
          
          this.monthlyData = monthly.map(m => ({
            month: m.month, // dạng MM/YYYY theo backend
            amount: Number(m.amount || 0),
            budget: Number(m.budget || 0),
            transactions: Number(m.transactions || 0)
          }));
          
          this.categoryData = categories.map(c => ({
            name: c.name || c.categoryName || 'Khác',
            amount: Number(c.amount || 0),
            percentage: Number(c.percentage || 0),
            color: c.color || '#3b82f6'
          }));
          
          console.log('✅ Loaded report summary from API and saved to DB by backend');
          return; // Đã có dữ liệu, không cần fallback
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to load /api/reports/summary, will fallback to local aggregation:', e);
    }
    
    // Sử dụng DataManager để lấy dữ liệu thực (fallback)
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();

    // Lấy dữ liệu từ DataManager (with API sync if forceRefresh)
    let userExpenses = [];
    let userCategories = [];

    if (window.dataManager) {
      // Load from API if forceRefresh, otherwise use cache
      if (forceRefresh && typeof window.dataManager.loadFromAPI === 'function') {
        try {
          console.log('🔄 Force refreshing data from API...');
          await window.dataManager.loadFromAPI();
        } catch (error) {
          console.warn('Failed to load from API, using cache:', error);
        }
      }
      userExpenses = await window.dataManager.getUserExpenses(forceRefresh);
      userCategories = await window.dataManager.getUserCategories(forceRefresh);
      console.log('✅ DataManager found:', { expenses: userExpenses.length, categories: userCategories.length });
    } else {
      console.warn('⚠️ DataManager not available, using fallback data');
      // Fallback: try to get data from localStorage directly
      userExpenses = this.getExpensesFromLocalStorage();
    }

    // Tổng hợp theo ngày: 30 ngày gần nhất (để hiển thị đầy đủ hơn)
    this.dailyData = this.aggregateDailyFromDataManager(userExpenses, currentDate, 30).map(d => {
      // 添加时间部分确保正确解析日期
      const dateObj = new Date(d.date + 'T00:00:00');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      const weekday = this.getWeekdayVi(dateObj);
      
      return {
        date: d.date,
        label: `${weekday}, ${day}/${month}/${year}`, // Format: "Thứ Hai, 15/01/2024"
        amount: d.amount,
        transactions: d.transactions
      };
    });

    // Tổng hợp theo tháng: 6 tháng gần nhất
    this.monthlyData = this.aggregateMonthlyFromDataManager(userExpenses, currentYear, 6).map(m => ({
      month: m.month,
      amount: m.amount,
      budget: m.budget,
      transactions: m.transactions
    }));

    // Phân bổ danh mục từ dữ liệu thực
    this.categoryData = this.aggregateCategoriesFromDataManager(userExpenses, userCategories);
    
    const daysWithData = this.dailyData.filter(d => d.amount > 0).length;
    const monthsWithData = this.monthlyData.filter(m => m.amount > 0).length;
    
    console.log('✅ Report data loaded:', { 
      daily: this.dailyData.length, 
      dailyWithData: daysWithData,
      monthly: this.monthlyData.length,
      monthlyWithData: monthsWithData,
      categories: this.categoryData.length 
    });
    
    if (daysWithData === 0 && userExpenses.length > 0) {
      console.warn('⚠️ No daily data found despite having', userExpenses.length, 'expenses. Check date format and filtering logic.');
    }
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

  async renderCharts() {
    await this.renderDailyChart();
    this.renderMonthlyChart();
    this.updateChartVisualization();
  }

  async renderDailyChart() {
    const dailyContainer = document.getElementById('daily');
    if (!dailyContainer) return;

    // Lấy ngày từ server để so sánh chính xác
    const todayDate = await this.getTodayDate();
    
    dailyContainer.innerHTML = '';
    
    // Kiểm tra xem có dữ liệu nào không
    const hasAnyData = this.dailyData.some(d => d.amount > 0);
    if (!hasAnyData) {
      // Hiển thị thông báo khi chưa có dữ liệu
      const emptyMessage = document.createElement('div');
      emptyMessage.style.cssText = 'text-align: center; padding: 40px 20px; color: #94a3b8;';
      emptyMessage.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #64748b;">Chưa có dữ liệu chi tiêu</div>
        <div style="font-size: 14px;">Bạn chưa có giao dịch nào. Hãy thêm giao dịch đầu tiên của bạn!</div>
      `;
      dailyContainer.appendChild(emptyMessage);
      return;
    }
    
    // Hiển thị TẤT CẢ các ngày (kể cả khi amount = 0) để giống giao diện 2
    // Sort by date (newest first) - mới nhất lên trên
    const sortedDays = [...this.dailyData].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Lấy maxAmount từ các ngày có dữ liệu để tính phần trăm
    const daysWithData = sortedDays.filter(d => d.amount > 0);
    const maxAmount = daysWithData.length > 0 ? Math.max(...daysWithData.map(d => d.amount), 1) : 1;

    // Hiển thị 10 ngày gần nhất (giống như trong baocao.html)
    const displayDays = sortedDays.slice(0, 10);

    displayDays.forEach((day, index) => {
      const percentage = day.amount > 0 ? Math.round((day.amount / maxAmount) * 100) : 0;
      const isToday = day.date === todayDate; // Dùng ngày từ server
      const hasData = day.amount > 0;
      
      const row = document.createElement('div');
      row.className = 'row';
      row.style.cursor = hasData ? 'pointer' : 'default';
      row.style.opacity = '0';
      row.style.transform = 'translateX(-20px)';
      row.title = hasData ? `Click để xem chi tiết ${day.label}` : `${day.label} - Chưa có chi tiêu`;
      
      if (isToday) {
        row.style.borderLeft = '3px solid #3b82f6';
        row.style.backgroundColor = '#f0f9ff';
      } else if (!hasData) {
        row.style.opacity = '0.6';
      }
      
      row.innerHTML = `
        <div class="arrow">${hasData ? '›' : ''}</div>
        <div class="date">${day.label}${isToday ? ' <span style="color: #3b82f6; font-weight: 600;">(Hôm nay)</span>' : ''}</div>
        <div class="bar">
          ${hasData ? `<i class="green" style="width:0%; transition: width 0.8s ease-in-out; background: #22c55e;"></i>` : ''}
        </div>
        <div class="amount" style="color: ${hasData ? '#1e293b' : '#94a3b8'};">${this.formatCurrency(day.amount)}</div>
      `;
      
      if (hasData) {
        // Hover effect chỉ khi có data
        row.addEventListener('mouseenter', () => {
          row.style.backgroundColor = isToday ? '#e0f2fe' : '#f8fafc';
          row.style.transform = 'translateX(5px)';
        });
        
        row.addEventListener('mouseleave', () => {
          row.style.backgroundColor = isToday ? '#f0f9ff' : '';
          row.style.transform = 'translateX(0)';
        });
        
        // Click handler chỉ khi có data
        row.addEventListener('click', () => {
          this.showDayDetail(day.label);
        });
      }
      
      dailyContainer.appendChild(row);
      
      // Animate bar growth
      setTimeout(() => {
        row.style.opacity = hasData ? '1' : '0.6';
        row.style.transform = 'translateX(0)';
        if (hasData) {
          const bar = row.querySelector('.bar i');
          if (bar) {
            bar.style.width = `${percentage}%`;
          }
        }
      }, index * 50);
    });
    // Nút "Xem thêm" đã có sẵn trong HTML, không cần tạo động nữa
  }

  async renderDailyChartFull(allDays, maxAmount) {
    const dailyContainer = document.getElementById('daily');
    if (!dailyContainer) return;

    // Lấy ngày từ server để so sánh chính xác
    const todayDate = await this.getTodayDate();
    
    dailyContainer.innerHTML = '';
    
    allDays.forEach((day, index) => {
      const percentage = day.amount > 0 ? Math.round((day.amount / maxAmount) * 100) : 0;
      const isToday = day.date === todayDate; // Dùng ngày từ server
      const hasData = day.amount > 0;
      
      const row = document.createElement('div');
      row.className = 'row';
      row.style.cursor = hasData ? 'pointer' : 'default';
      row.style.opacity = '0';
      row.style.transform = 'translateX(-20px)';
      row.title = hasData ? `Click để xem chi tiết ${day.label}` : `${day.label} - Chưa có chi tiêu`;
      
      if (isToday) {
        row.style.borderLeft = '3px solid #3b82f6';
        row.style.backgroundColor = '#f0f9ff';
      } else if (!hasData) {
        row.style.opacity = '0.6';
      }
      
      // Chỉ hiển thị thanh màu xanh khi có dữ liệu
      row.innerHTML = `
        <div class="arrow">${hasData ? '›' : ''}</div>
        <div class="date">${day.label}${isToday ? ' <span style="color: #3b82f6; font-weight: 600;">(Hôm nay)</span>' : ''}</div>
        <div class="bar">
          ${hasData ? `<i class="green" style="width:0%; transition: width 0.8s ease-in-out; background: #22c55e;"></i>` : ''}
        </div>
        <div class="amount" style="color: ${hasData ? '#1e293b' : '#94a3b8'};">${this.formatCurrency(day.amount)}</div>
        <div class="transactions" style="font-size: 12px; color: ${hasData ? '#64748b' : '#cbd5e1'}; margin-left: 10px;">
          ${hasData ? `${day.transactions} giao dịch` : '—'}
        </div>
      `;
      
      if (hasData) {
        row.addEventListener('mouseenter', () => {
          row.style.backgroundColor = isToday ? '#e0f2fe' : '#f8fafc';
          row.style.transform = 'translateX(5px)';
        });
        
        row.addEventListener('mouseleave', () => {
          row.style.backgroundColor = isToday ? '#f0f9ff' : '';
          row.style.transform = 'translateX(0)';
        });
        
        row.addEventListener('click', () => {
          this.showDayDetail(day.label);
        });
      }
      
      dailyContainer.appendChild(row);
      
      setTimeout(() => {
        row.style.opacity = hasData ? '1' : '0.6';
        row.style.transform = 'translateX(0)';
        if (hasData) {
          const bar = row.querySelector('.bar i');
          if (bar) {
            bar.style.width = `${percentage}%`;
          }
        }
      }, index * 30);
    });
  }

  renderMonthlyChart() {
    const monthlyContainer = document.getElementById('month');
    if (!monthlyContainer) return;

    monthlyContainer.innerHTML = '';
    
    // Kiểm tra xem có dữ liệu nào không
    const hasAnyData = this.monthlyData.some(m => m.amount > 0);
    if (!hasAnyData) {
      // Hiển thị thông báo khi chưa có dữ liệu
      const emptyMessage = document.createElement('div');
      emptyMessage.style.cssText = 'text-align: center; padding: 40px 20px; color: #94a3b8;';
      emptyMessage.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #64748b;">Chưa có dữ liệu theo tháng</div>
        <div style="font-size: 14px;">Bạn chưa có giao dịch nào. Hãy thêm giao dịch đầu tiên của bạn!</div>
      `;
      monthlyContainer.appendChild(emptyMessage);
      return;
    }
    
    // Hiển thị TẤT CẢ các tháng (kể cả khi amount = 0) để giống giao diện 2
    // Sort by month (newest first) - mới nhất lên trên
    const sortedMonths = [...this.monthlyData].sort((a, b) => {
      const aDate = new Date(a.month.split('/').reverse().join('-'));
      const bDate = new Date(b.month.split('/').reverse().join('-'));
      return bDate - aDate;
    });
    
    // Lấy maxAmount từ các tháng có dữ liệu để tính phần trăm
    const monthsWithData = sortedMonths.filter(m => m.amount > 0);
    const maxAmount = monthsWithData.length > 0 ? Math.max(...monthsWithData.map(m => m.amount), 1) : 1;

    // Xác định tháng trước (tháng thứ 2 trong danh sách đã sắp xếp - index 1)
    const previousMonthAmount = sortedMonths.length > 1 && sortedMonths[1].amount > 0 ? sortedMonths[1].amount : null;

    sortedMonths.forEach((month, index) => {
      const percentage = month.amount > 0 ? Math.round((month.amount / maxAmount) * 100) : 0;
      const budgetPercentage = month.budget > 0 ? Math.round((month.amount / month.budget) * 100) : 0;
      const hasData = month.amount > 0;
      
      // Tính phần trăm so với tháng trước cho các tháng sau (index 0 và index 2)
      let percentageChange = null;
      if (previousMonthAmount && previousMonthAmount > 0 && hasData && (index === 0 || index === 2)) {
        const change = ((month.amount - previousMonthAmount) / previousMonthAmount) * 100;
        percentageChange = Math.round(change);
      }
      
      const row = document.createElement('div');
      row.className = 'row';
      row.style.cursor = hasData ? 'pointer' : 'default';
      row.style.opacity = hasData ? '1' : '0.6';
      row.title = hasData ? `Click để xem chi tiết ${month.month}` : `${month.month} - Chưa có chi tiêu`;
      
      // Hiển thị phần trăm so với tháng trước nếu có
      const percentageDisplay = percentageChange !== null 
        ? `<div style="font-size: 11px; color: ${percentageChange >= 0 ? '#ef4444' : '#10b981'}; margin-top: 2px;">
            ${percentageChange >= 0 ? '+' : ''}${percentageChange}% so với tháng trước
          </div>`
        : '';
      
      row.innerHTML = `
        <div>${month.month}</div>
        <div class="mbar">
          ${hasData ? `<i style="width:${percentage}%; background: ${budgetPercentage > 100 ? '#ef4444' : '#22c55e'}"></i>` : ''}
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end;">
          <div class="mamount" style="color: ${hasData ? 'var(--text)' : '#94a3b8'};">${this.formatCurrency(month.amount)}</div>
          ${percentageDisplay}
        </div>
      `;
      
      if (hasData) {
        // Hover effect chỉ khi có data
        row.addEventListener('mouseenter', () => {
          row.style.backgroundColor = '#f8fafc';
        });
        
        row.addEventListener('mouseleave', () => {
          row.style.backgroundColor = '';
        });
        
        // Click handler chỉ khi có data
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          console.log('Monthly row clicked:', month.month);
          this.showMonthDetail(month.month);
        });
      }
      
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
    
    // Add click handler to open modal if available
    const chartPanel = document.querySelector('.chart .panel');
    if (chartPanel && !chartPanel.dataset.clickHandlerAdded) {
      chartPanel.dataset.clickHandlerAdded = 'true';
      const baoCaoManager = this; // Store reference to this
      chartPanel.addEventListener('click', (e) => {
        // Don't open modal if clicking on data points or tooltip
        if (e.target.closest('.data-point') || e.target.closest('#chartTooltip')) {
          return;
        }
        
        // Use daily data for modal (convert monthly to daily format for display)
        const dailyForModal = baoCaoManager.dailyData.map(d => ({
          label: d.label || d.date,
          date: d.date,
          amount: d.amount
        }));
        
        const maxAmount = dailyForModal.length > 0 
          ? Math.max(...dailyForModal.map(d => d.amount), 1) 
          : 1;
        
        // Call openChartModal if available (from baocao.html)
        if (typeof window.openChartModal === 'function') {
          window.openChartModal(dailyForModal, maxAmount);
        }
      });
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

  getExpensesFromLocalStorage() {
    try {
      console.log('Getting expenses from localStorage...');
      
      // Try to get data from DataManager's storage key
      const dataManagerData = localStorage.getItem('smartexpense_data');
      if (dataManagerData) {
        const data = JSON.parse(dataManagerData);
        const currentUser = this.getCurrentUser();
        console.log('DataManager data found:', data);
        console.log('Current user:', currentUser);
        
        if (currentUser && data.expenses) {
          const userExpenses = data.expenses.filter(expense => expense.userId === currentUser.id);
          console.log('User expenses from DataManager:', userExpenses.length);
          return userExpenses;
        }
      }
      
      // Fallback to old transactions key
      const transactions = localStorage.getItem('transactions');
      if (transactions) {
        const list = JSON.parse(transactions);
        console.log('Legacy transactions found:', list);
        if (Array.isArray(list)) {
          const validExpenses = list.filter(item => item && item.date && typeof item.amount === 'number');
          console.log('Valid legacy expenses:', validExpenses.length);
          return validExpenses;
        }
      }
      
      console.log('No expenses found in localStorage');
      return [];
    } catch (e) {
      console.error('Error getting expenses from localStorage:', e);
      return [];
    }
  }

  getCurrentUser() {
    try {
      const userData = localStorage.getItem('smartexpense_user');
      if (userData) {
        return JSON.parse(userData);
      }
    } catch (e) {
      console.error('Error getting current user:', e);
    }
    return null;
  }

  // Aggregate daily data from DataManager
  aggregateDailyFromDataManager(expenses, toDate, days) {
    const result = [];
    // 使用本地时间而不是UTC，避免时区问题
    const end = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
    end.setHours(0, 0, 0, 0);
    
    console.log('📊 Aggregating daily data from:', expenses.length, 'expenses');
    console.log('📅 Date range: last', days, 'days from', end.toISOString().split('T')[0]);
    
    // Debug: 显示前几个expense的格式
    if (expenses.length > 0) {
      console.log('📋 Sample expense:', {
        date: expenses[0].date,
        amount: expenses[0].amount,
        type: expenses[0].type,
        userId: expenses[0].userId
      });
    }
    
    for (let i = 0; i < days; i++) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      // 使用本地时间格式化，避免UTC时区问题
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const iso = `${year}-${month}-${dayNum}`; // Format: yyyy-mm-dd (local time)
      
      // Lấy tất cả chi tiêu trong ngày
      // Kiểm tra cả date string và các format khác
      const dayExpenses = expenses.filter(expense => {
        if (!expense || !expense.date) return false;
        
        // Normalize expense date to yyyy-mm-dd format
        let expenseDate = expense.date;
        if (typeof expenseDate === 'string') {
          // Nếu có thời gian, chỉ lấy phần ngày
          expenseDate = expenseDate.substring(0, 10);
        } else if (expenseDate && typeof expenseDate.getFullYear === 'function') {
          // Date object - 使用本地时间格式化
          const year = expenseDate.getFullYear();
          const month = String(expenseDate.getMonth() + 1).padStart(2, '0');
          const dayNum = String(expenseDate.getDate()).padStart(2, '0');
          expenseDate = `${year}-${month}-${dayNum}`;
        }
        
        // Chỉ lấy expense (không lấy income)
        // 注意：expense的amount可能是正数（绝对值），需要检查type
        const isExpense = expense.type === 'expense' || (expense.type !== 'income' && expense.amount < 0);
        const isSameDate = expenseDate === iso;
        
        // Debug: 记录匹配失败的expense
        if (isExpense && !isSameDate && i < 5) {
          // 只记录前5天，避免日志过多
        }
        
        return isSameDate && isExpense;
      });
      
      const amount = dayExpenses.reduce((sum, expense) => sum + Math.abs(expense.amount || 0), 0);
      
      if (dayExpenses.length > 0) {
        console.log(`✓ ${iso}: ${dayExpenses.length} expenses, total: ${this.formatCurrency(amount)}`);
      } else if (i < 10) {
        // 只记录前10天的空数据，帮助调试
        console.log(`○ ${iso}: 0 expenses`);
      }
      
      result.push({ 
        date: iso, 
        amount, 
        transactions: dayExpenses.length 
      });
    }
    
    // 统计有数据的日期数量
    const daysWithData = result.filter(d => d.amount > 0).length;
    console.log('📊 Daily aggregation complete:', result.length, 'days processed,', daysWithData, 'days with data');
    
    return result;
  }

  // Aggregate monthly data from DataManager
  aggregateMonthlyFromDataManager(expenses, year, monthsBack) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11 (0 = January, 11 = December)
    const result = [];
    
    // Generate all months from current month backwards
    for (let i = 0; i < monthsBack; i++) {
      // Calculate target month and year
      let targetMonth = currentMonth - i;
      let targetYear = currentYear;
      
      // Handle year rollover
      while (targetMonth < 0) {
        targetMonth += 12;
        targetYear -= 1;
      }
      
      // Format month string (MM/YYYY) and prefix (YYYY-MM)
      const monthStr = `${String(targetMonth + 1).padStart(2, '0')}/${targetYear}`;
      const monthPrefix = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
      
      // Filter expenses by month, handling different date formats
      const monthExpenses = expenses.filter(expense => {
        if (!expense || expense.type !== 'expense') return false;
        
        // Normalize expense date
        let expenseDate = expense.date;
        if (typeof expenseDate === 'string') {
          // Extract yyyy-mm from date string
          if (expenseDate.length >= 7) {
            expenseDate = expenseDate.substring(0, 7); // yyyy-mm
          } else {
            return false; // Invalid date format
          }
        } else if (expenseDate && expenseDate.getFullYear) {
          // Date object
          const expYear = expenseDate.getFullYear();
          const expMonth = String(expenseDate.getMonth() + 1).padStart(2, '0');
          expenseDate = `${expYear}-${expMonth}`;
        } else {
          return false; // Invalid date format
        }
        
        return expenseDate === monthPrefix;
      });
      
      const amount = monthExpenses.reduce((sum, expense) => sum + Math.abs(expense.amount || 0), 0);
      const budget = window.dataManager ? window.dataManager.getBudget(monthPrefix.replace('-', '')) : 8000000;
      
      result.push({ 
        month: monthStr, 
        amount, 
        budget, 
        transactions: monthExpenses.length 
      });
    }
    
    // Debug: Log all generated months
    console.log(`📅 Generated ${result.length} months:`, result.map(m => m.month).join(', '));
    
    return result;
  }

  // Aggregate categories from DataManager
  aggregateCategoriesFromDataManager(expenses, categories) {
    const categoryTotals = {};
    
    // Calculate totals by category
    expenses.forEach(expense => {
      if (expense.type === 'expense') {
        const categoryId = expense.categoryId || 0;
        const categoryName = categories.find(cat => cat.id === categoryId)?.name || 'Khác';
        
        if (!categoryTotals[categoryName]) {
          categoryTotals[categoryName] = 0;
        }
        categoryTotals[categoryName] += Math.abs(expense.amount);
      }
    });

    // Convert to array and calculate percentages
    const total = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    
    return Object.entries(categoryTotals).map(([name, amount], index) => ({
      name,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      color: colors[index % colors.length]
    })).sort((a, b) => b.amount - a.amount);
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

  // Get expenses for a specific date
  async getExpensesForDay(dateString) {
    let allExpenses = [];
    
    if (window.dataManager) {
      allExpenses = await window.dataManager.getUserExpenses(true);
    } else {
      allExpenses = this.getExpensesFromLocalStorage();
    }
    
    // Normalize date string to yyyy-mm-dd
    const targetDate = dateString.length >= 10 ? dateString.substring(0, 10) : dateString;
    
    // Filter expenses for this date
    const dayExpenses = allExpenses.filter(expense => {
      if (!expense || expense.type !== 'expense') return false;
      
      let expenseDate = expense.date;
      if (typeof expenseDate === 'string') {
        expenseDate = expenseDate.substring(0, 10);
      } else if (expenseDate && expenseDate.getFullYear) {
        const year = expenseDate.getFullYear();
        const month = String(expenseDate.getMonth() + 1).padStart(2, '0');
        const day = String(expenseDate.getDate()).padStart(2, '0');
        expenseDate = `${year}-${month}-${day}`;
      }
      
      return expenseDate === targetDate;
    });
    
    return dayExpenses.sort((a, b) => {
      // Sort by time if available, else by id
      const timeA = a.time || a.createdAt || a.id || 0;
      const timeB = b.time || b.createdAt || b.id || 0;
      return timeB - timeA; // Newest first
    });
  }

  // Get expenses for a specific month
  async getExpensesForMonth(monthLabel) {
    // monthLabel format: "MM/YYYY"
    const [month, year] = monthLabel.split('/');
    const monthPrefix = `${year}-${month.padStart(2, '0')}`;
    
    let allExpenses = [];
    
    if (window.dataManager) {
      allExpenses = await window.dataManager.getUserExpenses(true);
    } else {
      allExpenses = this.getExpensesFromLocalStorage();
    }
    
    // Filter expenses for this month
    const monthExpenses = allExpenses.filter(expense => {
      if (!expense || expense.type !== 'expense') return false;
      
      let expenseDate = expense.date;
      if (typeof expenseDate === 'string') {
        if (expenseDate.length >= 7) {
          expenseDate = expenseDate.substring(0, 7); // yyyy-mm
        }
      } else if (expenseDate && expenseDate.getFullYear) {
        const year = expenseDate.getFullYear();
        const month = String(expenseDate.getMonth() + 1).padStart(2, '0');
        expenseDate = `${year}-${month}`;
      }
      
      return expenseDate === monthPrefix;
    });
    
    return monthExpenses.sort((a, b) => {
      // Sort by date descending, then by time/id
      const dateA = typeof a.date === 'string' ? a.date : a.date?.toISOString() || '';
      const dateB = typeof b.date === 'string' ? b.date : b.date?.toISOString() || '';
      if (dateB !== dateA) return dateB.localeCompare(dateA);
      
      const timeA = a.time || a.createdAt || a.id || 0;
      const timeB = b.time || b.createdAt || b.id || 0;
      return timeB - timeA; // Newest first
    });
  }

  // Get category name
  getCategoryName(categoryId) {
    if (!categoryId && categoryId !== 0) return 'Khác';
    
    if (window.dataManager && window.dataManager.data && window.dataManager.data.categories) {
      const category = window.dataManager.data.categories.find(c => c.id === categoryId);
      return category ? category.name : 'Khác';
    }
    
    return 'Khác';
  }

  // Format date time (xử lý đúng timezone VN)
  formatDateTime(dateString) {
    if (!dateString) return '';
    
    try {
      // Nếu dateString là dạng YYYY-MM-DD (không có time), parse trực tiếp
      if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Parse date string trực tiếp (server đã trả về đúng ngày VN)
        const [year, month, day] = dateString.split('-').map(Number);
        // Format: DD/MM/YYYY (không có time vì chỉ có ngày)
        return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
      }
      
      // Nếu có time info, parse như bình thường nhưng format theo local VN timezone
      const date = new Date(dateString);
      // Sử dụng local time của client (đã được set theo timezone VN nếu client ở VN)
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      // Nếu có time info, hiển thị time
      if (dateString.includes('T') || dateString.includes(' ') && dateString.includes(':')) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      }
      
      // Chỉ có ngày
      return `${day}/${month}/${year}`;
    } catch (e) {
      // Fallback: hiển thị raw string
      return dateString;
    }
  }

  async showDayDetail(dateLabel) {
    console.log('🔍 showDayDetail called with:', dateLabel);
    const dayData = this.dailyData.find(d => d.label === dateLabel);
    if (!dayData) {
      console.error('Day data not found for label:', dateLabel);
      alert(`Không tìm thấy dữ liệu cho ngày: ${dateLabel}`);
      return;
    }

    // Show loading first
    const modal = this.createModal(`Chi tiết ngày ${dayData.date}`, `
      <div style="padding: 20px;">
        <div style="text-align: center; padding: 40px;">
          <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f4f6; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <p style="margin-top: 16px; color: #64748b;">Đang tải dữ liệu mới nhất...</p>
        </div>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `);
    document.body.appendChild(modal);

    try {
      // Lấy dữ liệu mới nhất từ API (forceRefresh = true)
      console.log('🔄 Loading fresh expenses for day:', dayData.date);
      const expenses = await this.getExpensesForDay(dayData.date);
      console.log('✅ Expenses loaded:', expenses.length);
      
      // Tính lại tổng số tiền từ dữ liệu mới nhất
      const freshAmount = expenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      const freshTransactions = expenses.length;
      
      // Cập nhật dayData với dữ liệu mới nhất
      const updatedDayData = {
        ...dayData,
        amount: freshAmount,
        transactions: freshTransactions
      };
      
      this.renderDayDetailModal(modal, updatedDayData, expenses);
    } catch (error) {
      console.error('❌ Error loading day expenses:', error);
      const modalElement = modal.querySelector('.modal');
      if (modalElement) {
        modalElement.innerHTML = `
          <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
            <h3 style="margin: 0; font-size: 18px;">Chi tiết ngày ${dayData.date}</h3>
          </div>
          <div style="padding: 20px; text-align: center; color: #ef4444;">
            <p>Lỗi khi tải dữ liệu. Vui lòng thử lại.</p>
            <p style="font-size: 12px; color: #64748b; margin-top: 8px;">${error.message || error}</p>
            <button onclick="this.closest('.modal-overlay').remove()" 
                    style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; margin-top: 10px;">
              Đóng
            </button>
          </div>
        `;
      }
    }
  }

  renderDayDetailModal(modal, dayData, expenses) {
    const transactionsHtml = expenses.length > 0 ? this.generateTransactionsTable(expenses) : 
      '<p style="text-align: center; padding: 20px; color: #64748b;">Không có giao dịch nào trong ngày này</p>';
    
    const exportDisabled = expenses.length === 0 ? 'disabled' : '';
    const exportStyle = expenses.length === 0 ? 'opacity: 0.5; cursor: not-allowed;' : '';
    const exportOnclick = expenses.length === 0 ? '' : `onclick="window.baoCaoManager.exportDayToExcel('${dayData.date}')"`;

    const modalElement = modal.querySelector('.modal');
    if (!modalElement) {
      console.error('Modal element not found');
      return;
    }
    
    modalElement.innerHTML = `
      <div style="padding: 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 18px;">Chi tiết ngày ${dayData.date}</h3>
        <button onclick="this.closest('.modal-overlay').remove()" 
                style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; padding: 0; width: 30px; height: 30px; line-height: 1;">×</button>
      </div>
      <div style="padding: 20px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
          <div style="background: #fef2f2; padding: 15px; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; color: #ef4444; font-size: 14px;">Tổng chi tiêu</h4>
            <p style="font-size: 24px; font-weight: bold; color: #ef4444; margin: 0;">
              ${this.formatCurrency(dayData.amount)}
            </p>
          </div>
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; color: #3b82f6; font-size: 14px;">Số giao dịch</h4>
            <p style="font-size: 24px; font-weight: bold; color: #3b82f6; margin: 0;">
              ${expenses.length}
            </p>
          </div>
        </div>
        
        <h4 style="margin: 0 0 12px 0; font-size: 16px;">Danh sách giao dịch</h4>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; max-height: 400px; overflow-y: auto;">
          ${transactionsHtml}
        </div>
        
        <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div></div>
          <div style="display: flex; gap: 10px;">
            <button ${exportOnclick}
                    ${exportDisabled}
                    style="padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; ${exportStyle}">
              📊 Xuất Excel
            </button>
            <button onclick="this.closest('.modal-overlay').remove()" 
                    style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">
              Đóng
            </button>
          </div>
        </div>
      </div>
    `;
  }

  generateTransactionsTable(expenses) {
    if (expenses.length === 0) return '<p style="text-align: center; padding: 20px; color: #64748b;">Không có giao dịch</p>';
    
    const tableRows = expenses.map((expense, index) => {
      const categoryName = this.getCategoryName(expense.categoryId);
      const amount = Math.abs(expense.amount || 0);
      const note = expense.note || expense.description || '';
      const time = this.formatDateTime(expense.date);
      
      return `
        <div style="display: grid; grid-template-columns: 40px 1fr 120px 140px; gap: 12px; padding: 12px; background: white; border-radius: 6px; margin-bottom: 8px; border: 1px solid #e5e7eb; align-items: center;">
          <div style="color: #64748b; font-weight: 600; text-align: center;">${index + 1}</div>
          <div>
            <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${categoryName}</div>
            ${note ? `<div style="font-size: 12px; color: #64748b;">${this.escapeHtml(note)}</div>` : ''}
          </div>
          <div style="text-align: right; font-weight: 700; color: #ef4444; font-size: 16px;">
            ${this.formatCurrency(amount)}
          </div>
          <div style="font-size: 12px; color: #64748b; text-align: right;">
            ${time}
          </div>
        </div>
      `;
    }).join('');
    
    return tableRows;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async showMonthDetail(monthLabel) {
    console.log('🔍 showMonthDetail called with:', monthLabel);
    const monthData = this.monthlyData.find(m => m.month === monthLabel);
    if (!monthData) {
      console.error('Month data not found for label:', monthLabel);
      alert(`Không tìm thấy dữ liệu cho tháng: ${monthLabel}`);
      return;
    }

    // Show loading first
    const modal = this.createModal(`Chi tiết tháng ${monthData.month}`, `
      <div style="padding: 20px;">
        <div style="text-align: center; padding: 40px;">
          <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f4f6; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <p style="margin-top: 16px; color: #64748b;">Đang tải dữ liệu mới nhất...</p>
        </div>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `);
    document.body.appendChild(modal);

    try {
      // Lấy dữ liệu mới nhất từ API (forceRefresh = true)
      console.log('🔄 Loading fresh expenses for month:', monthLabel);
      const expenses = await this.getExpensesForMonth(monthLabel);
      console.log('✅ Expenses loaded:', expenses.length);
      
      // Tính lại tổng số tiền từ dữ liệu mới nhất
      const freshAmount = expenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      const freshTransactions = expenses.length;
      
      // Lấy ngân sách mới nhất (nếu có)
      const [month, year] = monthLabel.split('/');
      const monthPrefix = `${year}-${month.padStart(2, '0')}`;
      const freshBudget = window.dataManager ? window.dataManager.getBudget(monthPrefix.replace('-', '')) : monthData.budget;
      
      // Cập nhật monthData với dữ liệu mới nhất
      const updatedMonthData = {
        ...monthData,
        amount: freshAmount,
        transactions: freshTransactions,
        budget: freshBudget
      };
      
      this.renderMonthDetailModal(modal, updatedMonthData, expenses);
    } catch (error) {
      console.error('❌ Error loading month expenses:', error);
      const modalElement = modal.querySelector('.modal');
      if (modalElement) {
        modalElement.innerHTML = `
          <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
            <h3 style="margin: 0; font-size: 18px;">Chi tiết tháng ${monthData.month}</h3>
          </div>
          <div style="padding: 20px; text-align: center; color: #ef4444;">
            <p>Lỗi khi tải dữ liệu. Vui lòng thử lại.</p>
            <p style="font-size: 12px; color: #64748b; margin-top: 8px;">${error.message || error}</p>
            <button onclick="this.closest('.modal-overlay').remove()" 
                    style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; margin-top: 10px;">
              Đóng
            </button>
          </div>
        `;
      }
    }
  }

  renderMonthDetailModal(modal, monthData, expenses) {
    const budgetUsed = monthData.budget > 0 ? Math.round((monthData.amount / monthData.budget) * 100) : 0;
    const remaining = monthData.budget - monthData.amount;
    const avgPerDay = expenses.length > 0 ? Math.round(monthData.amount / new Date(new Date().getFullYear(), parseInt(monthData.month.split('/')[0]) - 1, 0).getDate()) : 0;
    const avgPerTx = expenses.length > 0 ? Math.round(monthData.amount / expenses.length) : 0;

    const transactionsHtml = expenses.length > 0 ? this.generateTransactionsTable(expenses) : 
      '<p style="text-align: center; padding: 20px; color: #64748b;">Không có giao dịch nào trong tháng này</p>';
    
    const exportDisabled = expenses.length === 0 ? 'disabled' : '';
    const exportStyle = expenses.length === 0 ? 'opacity: 0.5; cursor: not-allowed;' : '';
    const exportOnclick = expenses.length === 0 ? '' : `onclick="window.baoCaoManager.exportMonthToExcel('${monthData.month}')"`;

    const modalElement = modal.querySelector('.modal');
    if (!modalElement) {
      console.error('Modal element not found');
      return;
    }
    
    modalElement.innerHTML = `
      <div style="padding: 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 18px;">Chi tiết tháng ${monthData.month}</h3>
        <button onclick="this.closest('.modal-overlay').remove()" 
                style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; padding: 0; width: 30px; height: 30px; line-height: 1;">×</button>
      </div>
      <div style="padding: 20px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
          <div style="text-align: center; padding: 15px; background: #fef2f2; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; color: #ef4444; font-size: 14px;">Chi tiêu</h4>
            <p style="font-size: 20px; font-weight: bold; margin: 0; color: #ef4444;">
              ${this.formatCurrency(monthData.amount)}
            </p>
          </div>
          <div style="text-align: center; padding: 15px; background: #f0f9ff; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; color: #3b82f6; font-size: 14px;">Ngân sách</h4>
            <p style="font-size: 20px; font-weight: bold; margin: 0; color: #3b82f6;">
              ${this.formatCurrency(monthData.budget)}
            </p>
          </div>
          <div style="text-align: center; padding: 15px; background: ${remaining >= 0 ? '#f0fdf4' : '#fef2f2'}; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; color: ${remaining >= 0 ? '#10b981' : '#ef4444'}; font-size: 14px;">Còn lại</h4>
            <p style="font-size: 20px; font-weight: bold; margin: 0; color: ${remaining >= 0 ? '#10b981' : '#ef4444'};">
              ${this.formatCurrency(Math.abs(remaining))}
            </p>
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 8px 0; font-size: 14px;">Tiến độ ngân sách</h4>
          <div style="background: #e5e7eb; height: 20px; border-radius: 10px; overflow: hidden;">
            <div style="width: ${Math.min(budgetUsed, 100)}%; height: 100%; background: ${budgetUsed > 100 ? '#ef4444' : '#10b981'}; transition: width 0.3s;"></div>
          </div>
          <p style="margin: 5px 0; font-size: 12px; color: #64748b;">
            Đã sử dụng ${budgetUsed}% ngân sách
          </p>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px;">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Số giao dịch</div>
            <div style="font-size: 18px; font-weight: 700; color: #1e293b;">${expenses.length}</div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px;">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Trung bình/ngày</div>
            <div style="font-size: 18px; font-weight: 700; color: #1e293b;">${this.formatCurrency(avgPerDay)}</div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px;">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Trung bình/giao dịch</div>
            <div style="font-size: 18px; font-weight: 700; color: #1e293b;">${this.formatCurrency(avgPerTx)}</div>
          </div>
        </div>
        
        <h4 style="margin: 0 0 12px 0; font-size: 16px;">Danh sách giao dịch (${expenses.length} giao dịch)</h4>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; max-height: 400px; overflow-y: auto;">
          ${transactionsHtml}
        </div>
        
        <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div></div>
          <div style="display: flex; gap: 10px;">
            <button ${exportOnclick}
                    ${exportDisabled}
                    style="padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; ${exportStyle}">
              📊 Xuất Excel
            </button>
            <button onclick="this.closest('.modal-overlay').remove()" 
                    style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">
              Đóng
            </button>
          </div>
        </div>
      </div>
    `;
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
      padding: 20px;
    `;

    const modal = document.createElement('div');
    modal.className = 'modal';
    const isDark = document.documentElement.classList.contains('dark');
    modal.style.cssText = `
      background: ${isDark ? '#0f172a' : 'white'};
      color: ${isDark ? '#e5e7eb' : '#1e293b'};
      border-radius: 12px;
      max-width: 900px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
      border: 1px solid ${isDark ? '#1f2a44' : '#e5e7eb'};
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

  async showDetailedReport() {
    // Hiển thị loading modal trước
    const loadingModal = this.createModal('Báo cáo chi tiết', `
      <div style="padding: 20px;">
        <div style="text-align: center; padding: 40px;">
          <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f4f6; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <p style="margin-top: 16px; color: #64748b;">Đang tải dữ liệu mới nhất...</p>
        </div>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `);
    document.body.appendChild(loadingModal);

    try {
      // Refresh dữ liệu mới nhất từ API trước khi hiển thị
      console.log('🔄 Refreshing data for detailed report...');
      await this.loadReportData(true); // forceRefresh = true để lấy dữ liệu mới nhất
      
      // Lấy dữ liệu mới nhất đã được refresh
      const currentMonthlyData = this.monthlyData || [];
      const currentCategoryData = this.categoryData || [];
      
      const reportContent = `
        <div style="padding: 20px;">
          <h4>Báo cáo tổng quan</h4>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
              <h5>Tháng này</h5>
              <p><strong>Tổng chi:</strong> ${this.formatCurrency(currentMonthlyData[0]?.amount || 0)}</p>
              <p><strong>Giao dịch:</strong> ${currentMonthlyData[0]?.transactions || 0}</p>
              <p><strong>Ngân sách:</strong> ${this.formatCurrency(currentMonthlyData[0]?.budget || 0)}</p>
            </div>
            
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
              <h5>Trung bình 6 tháng</h5>
              <p><strong>Chi/tháng:</strong> ${this.formatCurrency(this.calculateAverageMonthly())}</p>
              <p><strong>Giao dịch/tháng:</strong> ${this.calculateAverageTransactions()}</p>
            </div>
          </div>
          
          <h4>Phân tích theo danh mục</h4>
          <div style="margin-bottom: 20px;">
            ${currentCategoryData.length > 0 ? currentCategoryData.map(cat => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: #f8fafc; margin: 5px 0; border-radius: 6px;">
                <span>${cat.name}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="width: 100px; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${cat.percentage}%; height: 100%; background: ${cat.color};"></div>
                  </div>
                  <span style="font-weight: bold;">${this.formatCurrency(cat.amount)}</span>
                </div>
              </div>
            `).join('') : '<p style="text-align: center; color: #64748b;">Chưa có dữ liệu danh mục</p>'}
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

      // Thay thế loading modal bằng nội dung thực tế
      const modalElement = loadingModal.querySelector('.modal');
      if (modalElement) {
        modalElement.innerHTML = `
          <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
            <h3 style="margin: 0; font-size: 18px;">Báo cáo chi tiết</h3>
          </div>
          ${reportContent}
        `;
      }
      
      console.log('✅ Detailed report loaded with fresh data');
    } catch (error) {
      console.error('Error loading detailed report:', error);
      const modalElement = loadingModal.querySelector('.modal');
      if (modalElement) {
        modalElement.innerHTML = `
          <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
            <h3 style="margin: 0; font-size: 18px;">Báo cáo chi tiết</h3>
          </div>
          <div style="padding: 20px; text-align: center; color: #ef4444;">
            <p>Lỗi khi tải dữ liệu. Vui lòng thử lại.</p>
            <p style="font-size: 12px; color: #64748b; margin-top: 8px;">${error.message || error}</p>
            <button onclick="this.closest('.modal-overlay').remove()" 
                    style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; margin-top: 10px;">
              Đóng
            </button>
          </div>
        `;
      }
    }
  }

  calculateAverageMonthly() {
    const total = this.monthlyData.reduce((sum, month) => sum + month.amount, 0);
    return Math.round(total / this.monthlyData.length);
  }

  calculateAverageTransactions() {
    const total = this.monthlyData.reduce((sum, month) => sum + month.transactions, 0);
    return Math.round(total / this.monthlyData.length);
  }

  async loadMoreDailyData() {
    console.log('🔄 Loading more daily data...');
    
    // Load more days from API (increase from 30 to 90 days)
    const currentDate = new Date();
    let userExpenses = [];
    
    if (window.dataManager) {
      console.log('📡 Using DataManager to load expenses...');
      userExpenses = await window.dataManager.getUserExpenses(true);
      console.log('✅ Loaded', userExpenses.length, 'expenses from DataManager');
    } else {
      console.log('⚠️ DataManager not available, using localStorage...');
      userExpenses = this.getExpensesFromLocalStorage();
      console.log('✅ Loaded', userExpenses.length, 'expenses from localStorage');
    }
    
    if (userExpenses.length === 0) {
      console.warn('⚠️ No expenses found! Please check if data is saved correctly.');
      alert('Không tìm thấy dữ liệu chi tiêu. Vui lòng kiểm tra lại dữ liệu đã được lưu chưa.');
      return;
    }
    
    // Load 90 days instead of 30
    const allDays = this.aggregateDailyFromDataManager(userExpenses, currentDate, 90).map(d => {
      const dateObj = new Date(d.date + 'T00:00:00'); // 添加时间部分确保正确解析
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      const weekday = this.getWeekdayVi(dateObj);
      
      return {
        date: d.date,
        label: `${weekday}, ${day}/${month}/${year}`,
        amount: d.amount,
        transactions: d.transactions
      };
    });
    
    // Update daily data
    this.dailyData = allDays;
    
    // Hiển thị tất cả các ngày (không giới hạn 15 ngày)
    const todayDate = await this.getTodayDate();
    const dailyContainer = document.getElementById('daily');
    if (!dailyContainer) {
      console.error('❌ Daily container not found!');
      return;
    }
    
    dailyContainer.innerHTML = '';
    
    // Sort by date (newest first)
    const sortedDays = [...allDays].sort((a, b) => new Date(b.date) - new Date(a.date));
    const daysWithData = sortedDays.filter(d => d.amount > 0);
    const maxAmount = daysWithData.length > 0 ? Math.max(...daysWithData.map(d => d.amount), 1) : 1;
    
    console.log('📊 Rendering', sortedDays.length, 'days,', daysWithData.length, 'days with data');
    console.log('💰 Max amount:', this.formatCurrency(maxAmount));
    
    // Hiển thị tất cả các ngày
    await this.renderDailyChartFull(sortedDays, maxAmount);
    
    console.log('✅ More daily data loaded:', this.dailyData.length, 'days');
    
    // 如果所有数据都是0，显示警告
    if (daysWithData.length === 0) {
      console.warn('⚠️ All days show 0₫. This might indicate a data filtering issue.');
      alert('Không tìm thấy dữ liệu chi tiêu trong khoảng thời gian này. Vui lòng kiểm tra:\n1. Dữ liệu đã được lưu chưa?\n2. Ngày của chi tiêu có đúng không?\n3. Loại chi tiêu có đúng không?');
    }
  }

  async loadMoreMonthlyData() {
    console.log('Loading more monthly data...');
    
    // Load more months from API (increase from 6 to 12 months)
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    let userExpenses = [];
    
    if (window.dataManager) {
      userExpenses = await window.dataManager.getUserExpenses(true);
    } else {
      userExpenses = this.getExpensesFromLocalStorage();
    }
    
    // Load 12 months instead of 6
    const allMonths = this.aggregateMonthlyFromDataManager(userExpenses, currentYear, 12).map(m => ({
      month: m.month,
      amount: m.amount,
      budget: m.budget,
      transactions: m.transactions
    }));
    
    // Update monthly data
    this.monthlyData = allMonths;
    
    // Re-render chart
    this.renderMonthlyChart();
    
    console.log('More monthly data loaded:', this.monthlyData.length, 'months');
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

  setupRealTimeUpdates() {
    console.log('🔔 Setting up manual refresh for reports (auto-refresh disabled)...');
    
    // Bật refresh tự động theo sự kiện hệ thống
    window.addEventListener('profileUpdated', () => {
      console.log('📬 Reports: profileUpdated received -> refresh');
      this.refreshData();
    });
    window.addEventListener('expenseAdded', () => {
      console.log('📬 Reports: expenseAdded received -> refresh');
      // Trễ nhẹ để backend xử lý xong
      setTimeout(() => this.refreshData(), 300);
    });
    window.addEventListener('storage', (e) => {
      if (e && (e.key === 'smartexpense_profile_updated' || e.key === 'smartexpense_expense_added')) {
        console.log('📦 Reports: storage change detected -> refresh', e.key);
        this.refreshData();
      }
    });

    // Export API cho trang khác gọi
    window.reloadReportData = () => this.refreshData();

    // Nút refresh thủ công
    this.addRefreshButton();
    
    console.log('✅ Reports realtime updates enabled (events + manual refresh)');
  }

  addRefreshButton() {
    const dailySection = document.querySelector('.daily');
    if (dailySection) {
      const header = dailySection.previousElementSibling;
      if (header && header.classList.contains('head')) {
        const refreshBtn = document.createElement('button');
        refreshBtn.innerHTML = '🔄';
        refreshBtn.title = 'Làm mới dữ liệu';
        refreshBtn.style.cssText = `
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 6px 10px;
          cursor: pointer;
          font-size: 14px;
          margin-left: 10px;
        `;
        
        refreshBtn.addEventListener('click', () => {
          refreshBtn.style.transform = 'rotate(360deg)';
          refreshBtn.style.transition = 'transform 0.5s ease';
          this.refreshData();
          setTimeout(() => {
            refreshBtn.style.transform = 'rotate(0deg)';
          }, 500);
        });

        header.appendChild(refreshBtn);
      }
    }
    
    // Also add a sync status indicator
    // this.addSyncStatusIndicator(); // Hidden per user request
  }

  addSyncStatusIndicator() {
    const topSection = document.querySelector('.top');
    if (topSection) {
      const syncIndicator = document.createElement('div');
      syncIndicator.id = 'syncIndicator';
      syncIndicator.innerHTML = '🟢 Đồng bộ';
      syncIndicator.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        opacity: 0.8;
        transition: all 0.3s ease;
      `;
      
      topSection.style.position = 'relative';
      topSection.appendChild(syncIndicator);
      
      // Update sync status periodically
      setInterval(() => {
        const indicator = document.getElementById('syncIndicator');
        if (indicator) {
          const now = new Date();
          const timeStr = now.toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          indicator.innerHTML = `🟢 Đồng bộ ${timeStr}`;
        }
      }, 30000); // Update every 30 seconds
    }
  }

  async refreshData() {
    console.log('🔄 Refreshing report data from API...');
    
    // Clear server date cache để lấy ngày mới nhất
    this.currentServerDate = null;
    
    // Store previous data to detect changes
    const previousDailyData = JSON.stringify(this.dailyData);
    const previousMonthlyData = JSON.stringify(this.monthlyData);
    
    // Reload data from API (forceRefresh = true)
    await this.loadReportData(true); // Force refresh from API
    
    // Check if data actually changed
    const dailyChanged = previousDailyData !== JSON.stringify(this.dailyData);
    const monthlyChanged = previousMonthlyData !== JSON.stringify(this.monthlyData);
    
    if (dailyChanged || monthlyChanged) {
      console.log('✅ Data changed, re-rendering charts...');
      await this.renderCharts(); // Wait for async render
    } else {
      console.log('ℹ️ No data changes detected, but re-rendering to update date labels...');
      // Re-render anyway để cập nhật "Hôm nay" label nếu cần
      await this.renderCharts();
    }
  }

  // Export day expenses to Excel
  async exportDayToExcel(dateString) {
    try {
      const expenses = await this.getExpensesForDay(dateString);
      
      if (expenses.length === 0) {
        alert('Không có dữ liệu để xuất!');
        return;
      }

      // Check if SheetJS is available
      if (typeof XLSX === 'undefined') {
        // Fallback to CSV
        this.exportDayToCSV(dateString, expenses);
        return;
      }

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Prepare data
      const wsData = [
        ['STT', 'Danh mục', 'Mô tả', 'Số tiền (đ)', 'Ngày giờ']
      ];
      
      expenses.forEach((expense, index) => {
        const categoryName = this.getCategoryName(expense.categoryId);
        const amount = Math.abs(expense.amount || 0);
        const note = expense.note || expense.description || '';
        const time = this.formatDateTime(expense.date);
        
        wsData.push([
          index + 1,
          categoryName,
          note,
          amount,
          time
        ]);
      });
      
      // Add summary row
      const total = expenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      wsData.push([]);
      wsData.push(['Tổng cộng', '', '', total, '']);
      
      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 6 },  // STT
        { wch: 20 }, // Danh mục
        { wch: 40 }, // Mô tả
        { wch: 15 }, // Số tiền
        { wch: 20 }  // Ngày giờ
      ];
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Chi tiết ngày');
      
      // Generate filename
      const filename = `ChiTieu_Ngay_${dateString.replace(/-/g, '')}.xlsx`;
      
      // Write file
      XLSX.writeFile(wb, filename);
      
      alert(`Đã xuất ${expenses.length} giao dịch ra file Excel!`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Lỗi khi xuất file Excel. Đang thử xuất CSV...');
      // Fallback to CSV
      const expenses = await this.getExpensesForDay(dateString);
      this.exportDayToCSV(dateString, expenses);
    }
  }

  // Export month expenses to Excel
  async exportMonthToExcel(monthLabel) {
    try {
      const expenses = await this.getExpensesForMonth(monthLabel);
      
      if (expenses.length === 0) {
        alert('Không có dữ liệu để xuất!');
        return;
      }

      // Check if SheetJS is available
      if (typeof XLSX === 'undefined') {
        // Fallback to CSV
        this.exportMonthToCSV(monthLabel, expenses);
        return;
      }

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Prepare data
      const wsData = [
        ['STT', 'Ngày', 'Danh mục', 'Mô tả', 'Số tiền (đ)', 'Giờ']
      ];
      
      expenses.forEach((expense, index) => {
        const categoryName = this.getCategoryName(expense.categoryId);
        const amount = Math.abs(expense.amount || 0);
        const note = expense.note || expense.description || '';
        
        // Format date
        let dateStr = '';
        let timeStr = '';
        if (expense.date) {
          try {
            const date = new Date(expense.date);
            dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
            timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
          } catch (e) {
            dateStr = expense.date.substring(0, 10);
          }
        }
        
        wsData.push([
          index + 1,
          dateStr,
          categoryName,
          note,
          amount,
          timeStr
        ]);
      });
      
      // Add summary row
      const total = expenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      const monthData = this.monthlyData.find(m => m.month === monthLabel);
      wsData.push([]);
      wsData.push(['Tổng cộng', '', '', '', total, '']);
      if (monthData) {
        wsData.push(['Ngân sách', '', '', '', monthData.budget, '']);
        wsData.push(['Còn lại', '', '', '', monthData.budget - total, '']);
      }
      
      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 6 },  // STT
        { wch: 12 }, // Ngày
        { wch: 20 }, // Danh mục
        { wch: 40 }, // Mô tả
        { wch: 15 }, // Số tiền
        { wch: 8 }   // Giờ
      ];
      
      // Add worksheet to workbook
      const sheetName = `Thang_${monthLabel.replace(/\//g, '_')}`.substring(0, 31); // Excel sheet name limit
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      
      // Generate filename
      const filename = `ChiTieu_Thang_${monthLabel.replace(/\//g, '_')}.xlsx`;
      
      // Write file
      XLSX.writeFile(wb, filename);
      
      alert(`Đã xuất ${expenses.length} giao dịch ra file Excel!`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Lỗi khi xuất file Excel. Đang thử xuất CSV...');
      // Fallback to CSV
      const expenses = await this.getExpensesForMonth(monthLabel);
      this.exportMonthToCSV(monthLabel, expenses);
    }
  }

  // Export day to CSV (fallback)
  exportDayToCSV(dateString, expenses) {
    const csvRows = [
      ['STT', 'Danh mục', 'Mô tả', 'Số tiền (đ)', 'Ngày giờ'],
      ...expenses.map((expense, index) => {
        const categoryName = this.getCategoryName(expense.categoryId);
        const amount = Math.abs(expense.amount || 0);
        const note = expense.note || expense.description || '';
        const time = this.formatDateTime(expense.date);
        return [index + 1, categoryName, note, amount, time];
      }),
      [],
      ['Tổng cộng', '', '', expenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0), '']
    ];
    
    const csvContent = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const filename = `ChiTieu_Ngay_${dateString.replace(/-/g, '')}.csv`;
    
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Export month to CSV (fallback)
  exportMonthToCSV(monthLabel, expenses) {
    const csvRows = [
      ['STT', 'Ngày', 'Danh mục', 'Mô tả', 'Số tiền (đ)', 'Giờ'],
      ...expenses.map((expense, index) => {
        const categoryName = this.getCategoryName(expense.categoryId);
        const amount = Math.abs(expense.amount || 0);
        const note = expense.note || expense.description || '';
        let dateStr = '';
        let timeStr = '';
        if (expense.date) {
          try {
            const date = new Date(expense.date);
            dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
            timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
          } catch (e) {
            dateStr = expense.date.substring(0, 10);
          }
        }
        return [index + 1, dateStr, categoryName, note, amount, timeStr];
      }),
      [],
      ['Tổng cộng', '', '', '', expenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0), '']
    ];
    
    const monthData = this.monthlyData.find(m => m.month === monthLabel);
    if (monthData) {
      csvRows.push(['Ngân sách', '', '', '', monthData.budget, '']);
      csvRows.push(['Còn lại', '', '', '', monthData.budget - monthData.amount, '']);
    }
    
    const csvContent = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const filename = `ChiTieu_Thang_${monthLabel.replace(/\//g, '_')}.csv`;
    
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

    // Trang chủ
    csv += 'Trang chủ\n';
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
