/**
 * TRANGCHU.JS - Xử lý các chức năng trang chủ SmartExpense
 * Bao gồm: KPI dashboard, biểu đồ, chatbot, tìm kiếm, quản lý giao dịch
 */

// ===== AUTHENTICATION GUARD & LOGOUT =====
function checkAuthentication() {
  const token = localStorage.getItem('smartexpense_token');
  const user = localStorage.getItem('smartexpense_user');

  if (!token || !user) {
    console.log('No authentication found, redirecting to login...');
    window.location.href = 'login.html';
    return false;
  }

  try {
    const userData = JSON.parse(user);
    // Update user info in header if element exists
    const userNameEl = document.querySelector('.user-name');
    if (userNameEl) {
      userNameEl.textContent = userData.name;
    }
    return true;
  } catch (error) {
    console.error('Invalid user data, clearing and redirecting...');
    localStorage.removeItem('smartexpense_user');
    localStorage.removeItem('smartexpense_token');
    window.location.href = 'login.html';
    return false;
  }
}

function logout() {
  localStorage.removeItem('smartexpense_user');
  localStorage.removeItem('smartexpense_token');
  console.log('User logged out successfully');
  window.location.href = 'login.html';
}

// Expose logout to global for menu anchor onclick
window.logout = logout;

class TrangChuManager {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadDashboardData();
    if (!window.__INLINE_CHAT) {
      this.initChatbot();
    }
    this.setupSearch();
    this.setupQuickExpense();
    this.updateOwnerTitle();
  }

  // ===== DASHBOARD & KPI =====
  loadDashboardData() {
    const { balance, monthlyExpense, monthlyIncome, expenseGrowthPct, incomeGrowthPct } = this.computeFinanceSnapshot();
    const { targetAmount, currentAmount, progressPct } = this.computeSavingGoal();

    this.updateKPICards({
      balance,
      monthlyExpense,
      monthlyIncome,
      savingsGoal: targetAmount,
      savingsProgress: progressPct,
      expenseGrowth: expenseGrowthPct,
      incomeGrowth: incomeGrowthPct
    });

    this.updateChart();
    this.renderCategorySummary();
    this.loadRecentTransactions();
    this.updateTodayAndMonthSummary();
  }

  updateKPICards(data) {
    // Cập nhật số dư
    const balanceEl = document.querySelector('.kpi .card:nth-child(1) .val');
    if (balanceEl) {
      balanceEl.textContent = this.formatCurrency(data.balance);
    }

    // Cập nhật chi tiêu tháng này
    const expenseEl = document.querySelector('.kpi .card:nth-child(2) .val');
    if (expenseEl) {
      expenseEl.textContent = this.formatCurrency(data.monthlyExpense);
    }

    // Cập nhật thu nhập tháng này
    const incomeEl = document.querySelector('.kpi .card:nth-child(3) .val');
    if (incomeEl) {
      incomeEl.textContent = this.formatCurrency(data.monthlyIncome);
    }

    // Cập nhật tiến độ tiết kiệm
    const goalCard = document.querySelector('.kpi .card:nth-child(4)');
    if (goalCard) {
      const goalVal = goalCard.querySelector('.val');
      const sub = goalCard.querySelector('.sub');
      const bar = goalCard.querySelector('div[style*="height:8px"] div, .kpi .card:nth-child(4) div div');
      if (goalVal) goalVal.textContent = this.formatCurrency(data.savingsGoal || 0);
      if (sub) sub.textContent = `${Math.round(data.savingsProgress || 0)}% hoàn thành`;
      if (bar) bar.style.width = `${Math.max(0, Math.min(100, data.savingsProgress || 0))}%`;
    }

    // % thay đổi so với tháng trước
    const expenseSub = document.querySelector('.kpi .card:nth-child(2) .sub');
    if (expenseSub && typeof data.expenseGrowth === 'number') {
      const cls = data.expenseGrowth >= 0 ? 'down' : 'up';
      const pct = Math.abs(Math.round(data.expenseGrowth));
      expenseSub.innerHTML = `<span class="${cls}">${data.expenseGrowth >= 0 ? '+' : '-'}${pct}%</span> so với tháng trước`;
    }
    const incomeSub = document.querySelector('.kpi .card:nth-child(3) .sub');
    if (incomeSub && typeof data.incomeGrowth === 'number') {
      const cls = data.incomeGrowth >= 0 ? 'up' : 'down';
      const pct = Math.abs(Math.round(data.incomeGrowth));
      incomeSub.innerHTML = `<span class="${cls}">${data.incomeGrowth >= 0 ? '+' : '-'}${pct}%</span> so với tháng trước`;
    }
  }

  updateChart() {
    const bars = document.querySelectorAll('.bars .bar');
    if (!bars || bars.length === 0) return;
    const periodDays = 30; // mặc định 30 ngày
    const bucketCount = bars.length;
    const expenses = this.getAllTransactions().filter(t => t.type === 'expense');
    const buckets = this.aggregateIntoBuckets(expenses, periodDays, bucketCount);
    const maxVal = Math.max(1, ...buckets);
    buckets.forEach((val, idx) => {
      const pct = Math.round((val / maxVal) * 100);
      bars[idx].style.height = `${Math.max(6, pct)}%`;
    });
  }

  loadRecentTransactions() {
    const list = this.getAllTransactions()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 10);
    this.renderTransactionTable(list);
  }

  renderTransactionTable(transactions) {
    const tbody = document.querySelector('.table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    transactions.forEach(transaction => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${transaction.category || ''}</td>
        <td>${transaction.description || ''}<div style="color:#94a3b8;font-size:12px">${transaction.date || ''}</div></td>
        <td style="color: ${transaction.type === 'income' || transaction.amount > 0 ? '#10b981' : '#ef4444'}">${this.formatCurrency(Math.abs(transaction.amount || 0))}</td>
      `;
      tbody.appendChild(row);
    });
  }

  // ===== TÌM KIẾM & LỌC =====
  setupSearch() {
    const searchInput = document.querySelector('.search input');
    const filterInput = document.querySelector('.table .right input');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleGlobalSearch(e.target.value);
      });
    }

    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        this.filterTransactions(e.target.value);
      });
    }
  }

  handleGlobalSearch(query) {
    console.log('Tìm kiếm toàn cục:', query);
    // Implement global search logic
  }

  filterTransactions(query) {
    const rows = document.querySelectorAll('.table tbody tr');
    const searchTerm = query.toLowerCase();

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
  }

  // ===== QUẢN LÝ CHI TIÊU NHANH =====
  setupQuickExpense() {
    const quickExpenseInput = document.querySelector('.panel .row:last-child input');
    const addButton = document.querySelector('.panel .row:last-child button');

    if (addButton) {
      addButton.addEventListener('click', () => {
        this.addQuickExpense(quickExpenseInput.value);
      });
    }

    if (quickExpenseInput) {
      quickExpenseInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.addQuickExpense(e.target.value);
        }
      });
    }
  }

  addQuickExpense(input) {
    if (!input.trim()) return;

    // Parse input: "Cà phê 10000"
    const parts = input.trim().split(' ');
    const amount = parseInt(parts[parts.length - 1]);
    const description = parts.slice(0, -1).join(' ');

    if (isNaN(amount) || !description) {
      alert('Vui lòng nhập đúng định dạng: [mô tả] [số tiền]');
      return;
    }

    // Thêm giao dịch mới
    const tx = {
      category: 'Chi tiêu khác',
      description,
      amount: -amount,
      type: 'expense',
      date: new Date().toISOString().split('T')[0]
    };
    this.persistTransaction(tx);
    this.addNewTransaction(tx);

    // Clear input
    const quickExpenseInput = document.querySelector('.panel .row:last-child input');
    if (quickExpenseInput) {
      quickExpenseInput.value = '';
    }

    // Cập nhật số liệu
    this.updateDailyExpense(amount);
    this.refreshAfterDataChange();
  }

  addNewTransaction(transaction) {
    const tbody = document.querySelector('.table tbody');
    if (!tbody) return;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${transaction.category || ''}</td>
      <td>${transaction.description || ''}<div style="color:#94a3b8;font-size:12px">${transaction.date || ''}</div></td>
      <td style="color: ${transaction.type === 'income' || transaction.amount > 0 ? '#10b981' : '#ef4444'}">${this.formatCurrency(Math.abs(transaction.amount || 0))}</td>
    `;
    tbody.insertBefore(row, tbody.firstChild);
  }

  updateDailyExpense(amount) {
    const dailyExpenseInput = document.querySelector('.panel .row:nth-child(2) input');
    if (dailyExpenseInput) {
      const currentAmount = this.parseCurrency(dailyExpenseInput.value);
      const newAmount = currentAmount + amount;
      dailyExpenseInput.value = this.formatCurrency(newAmount);
    }
  }

  updateTodayAndMonthSummary() {
    const monthlyExpense = this.computeMonthlyTotal('expense');
    const todayExpense = this.computeTodayTotal('expense');
    const remainBudget = this.computeRemainingBudget(monthlyExpense);
    const monthRow = document.querySelector('.panel .row:nth-child(2) input');
    const todayRow = document.querySelector('.panel .row:nth-child(3) input');
    const remainRow = document.querySelector('.panel .row:nth-child(4) input');
    if (monthRow) monthRow.value = this.formatCurrency(monthlyExpense) + 'đ';
    if (todayRow) todayRow.value = this.formatCurrency(todayExpense) + 'đ';
    if (remainRow) remainRow.value = this.formatCurrency(Math.max(0, remainBudget)) + 'đ';
  }

  // ===== HIỂN THỊ TÊN CHỦ SỔ =====
  updateOwnerTitle() {
    try {
      const raw = localStorage.getItem('smartexpense_user');
      if (!raw) return;
      const user = JSON.parse(raw);
      const displayName = user && (user.name || (user.email ? user.email.split('@')[0] : 'bạn'));
      const titleEl = document.querySelector('.panel .title');
      if (titleEl && displayName) {
        titleEl.textContent = `🟠 Sổ chi tiêu của ${displayName} …`;
      }
    } catch (_) {
      // ignore parsing errors
    }
  }

  // ===== CHATBOT =====
  initChatbot() {
    // Bỏ qua nếu chat inline đã xử lý trong HTML
    if (window.__INLINE_CHAT) return;
    const chatToggle = document.getElementById('chatToggle');
    const chatbox = document.getElementById('chatbox');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    if (!chatToggle || !chatbox) return;

    let greeted = false;

    // Toggle chatbox
    chatToggle.addEventListener('click', () => {
      const isOpen = chatbox.classList.contains('open');
      if (isOpen) {
        this.closeChatbox();
      } else {
        this.openChatbox();
        if (!greeted) {
          this.botSay('Xin chào! Tôi là trợ lý SmartExpense. Tôi có thể giúp bạn:' +
            '\n• Thêm chi tiêu nhanh' +
            '\n• Xem báo cáo tài chính' +
            '\n• Đặt mục tiêu tiết kiệm' +
            '\n• Tư vấn quản lý chi tiêu');
          greeted = true;
        }
      }
    });

    // Send message
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.handleChatSend());
    }

    if (chatInput) {
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleChatSend();
        }
      });
    }
  }

  openChatbox() {
    const chatbox = document.getElementById('chatbox');
    const chatInput = document.getElementById('chatInput');
    
    chatbox.classList.add('open');
    chatbox.setAttribute('aria-hidden', 'false');
    setTimeout(() => chatInput?.focus(), 100);
  }

  closeChatbox() {
    const chatbox = document.getElementById('chatbox');
    chatbox.classList.remove('open');
    chatbox.setAttribute('aria-hidden', 'true');
  }

  handleChatSend() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message) return;

    this.addChatMessage(message, 'user');
    chatInput.value = '';

    // Process message
    this.processChatMessage(message);
  }

  processChatMessage(message) {
    const lowerMsg = message.toLowerCase();

    // Thêm chi tiêu
    if (lowerMsg.includes('thêm') || lowerMsg.includes('chi tiêu')) {
      this.botSay('Bạn có thể thêm chi tiêu bằng cách nhập: [mô tả] [số tiền]' +
        '\nVí dụ: "Cà phê 25000" hoặc sử dụng ô nhập nhanh bên phải.');
    }
    // Xem báo cáo
    else if (lowerMsg.includes('báo cáo') || lowerMsg.includes('thống kê')) {
      this.botSay('Tôi thấy bạn đã chi ' + this.formatCurrency(8320000) + ' trong tháng này. ' +
        'Bạn có muốn xem báo cáo chi tiết không?');
    }
    // Tiết kiệm
    else if (lowerMsg.includes('tiết kiệm') || lowerMsg.includes('mục tiêu')) {
      this.botSay('Mục tiêu tiết kiệm hiện tại của bạn là ' + this.formatCurrency(50000000) + 
        ' và đã hoàn thành 28%. Bạn cần tiết kiệm thêm ' + 
        this.formatCurrency(36000000) + ' để đạt mục tiêu.');
    }
    // Mặc định
    else {
      this.botSay('Tôi hiểu bạn muốn: "' + message + '". ' +
        'Bạn có thể hỏi tôi về chi tiêu, báo cáo, hoặc mục tiêu tiết kiệm.');
    }
  }

  addChatMessage(text, sender = 'bot') {
    const chatBody = document.getElementById('chatBody');
    if (!chatBody) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `msg ${sender}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar-s';
    avatar.textContent = sender === 'bot' ? '🐷' : '👤';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerText = text;

    if (sender === 'bot') {
      messageDiv.append(avatar, bubble);
    } else {
      messageDiv.append(bubble, avatar);
    }

    chatBody.appendChild(messageDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  botSay(text, delay = 500) {
    // Hiển thị typing indicator
    const typingDiv = this.addTypingIndicator();
    
    setTimeout(() => {
      typingDiv.remove();
      this.addChatMessage(text, 'bot');
    }, delay);
  }

  addTypingIndicator() {
    const chatBody = document.getElementById('chatBody');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'msg bot';
    typingDiv.innerHTML = `
      <div class="avatar-s">🐷</div>
      <div class="bubble">
        <span class="typing">
          <span></span><span></span><span></span>
        </span>
      </div>
    `;
    chatBody.appendChild(typingDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
    return typingDiv;
  }

  // ===== UTILITY FUNCTIONS =====
  formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount);
  }

  parseCurrency(currencyString) {
    return parseInt(currencyString.replace(/[^\d]/g, '')) || 0;
  }

  getMonthlyBudget() {
    // Ưu tiên profile.monthly_budget nếu có
    try {
      const pRaw = localStorage.getItem('profile');
      if (pRaw) {
        const p = JSON.parse(pRaw);
        if (typeof p.monthly_budget === 'number') return p.monthly_budget;
      }
    } catch (_) {}
    const raw = localStorage.getItem('monthly_budget');
    return raw ? Number(raw) : 0;
  }

  computeRemainingBudget(currentMonthExpense, returnBudgetIfNoBudget = false) {
    const budget = this.getMonthlyBudget();
    if (!budget) return returnBudgetIfNoBudget ? this.computeBalance() : 0;
    const remaining = budget - (Number(currentMonthExpense || this.computeMonthlyTotal('expense')));
    return remaining;
  }

  setupEventListeners() {
    // Nút thêm giao dịch
    const addTransactionBtn = document.querySelector('.table .add');
    if (addTransactionBtn) {
      addTransactionBtn.addEventListener('click', () => {
        this.showAddTransactionModal();
      });
    }

    // Dropdown biểu đồ
    const chartSelect = document.querySelector('.chart select');
    if (chartSelect) {
      chartSelect.addEventListener('change', (e) => {
        this.updateChartPeriod(e.target.value);
      });
    }
  }

  showAddTransactionModal() {
    // Mô phỏng modal thêm giao dịch
    const description = prompt('Nhập mô tả giao dịch:');
    const amount = prompt('Nhập số tiền:');
    
    if (description && amount) {
      this.addNewTransaction({
        category: 'Khác',
        description: description,
        amount: -parseInt(amount),
        date: new Date().toISOString().split('T')[0]
      });
    }
  }

  updateChartPeriod(period) {
    console.log('Cập nhật biểu đồ cho kỳ:', period);
    // Cập nhật lại biểu đồ dựa trên kỳ
    this.updateChart();
  }

  // ===== DỮ LIỆU: Lấy và tổng hợp giao dịch =====
  getStoredTransactions() {
    try {
      const raw = localStorage.getItem('transactions');
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list.filter(item => item && item.date && typeof item.amount === 'number');
    } catch (e) {
      return [];
    }
  }

  getAllTransactions() {
    return this.getStoredTransactions();
  }

  persistTransaction(tx) {
    const list = this.getStoredTransactions();
    list.push(tx);
    localStorage.setItem('transactions', JSON.stringify(list));
  }

  computeBalance() {
    const list = this.getStoredTransactions();
    return list.reduce((sum, t) => sum + (t.amount || 0), 0);
  }

  computeMonthlyTotal(type) {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const list = this.getStoredTransactions();
    return list.filter(t => (t.date || '').startsWith(ym) && (type ? t.type === type : true))
      .reduce((sum, t) => sum + Math.abs(t.amount || 0) * (t.type === 'expense' ? 1 : 1), 0);
  }

  computeTodayTotal(type) {
    const today = new Date().toISOString().split('T')[0];
    const list = this.getStoredTransactions();
    return list.filter(t => t.date === today && (type ? t.type === type : true))
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  }

  monthTotals(year, month) {
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    const list = this.getStoredTransactions();
    let expense = 0, income = 0;
    list.forEach(t => {
      if (!(t.date || '').startsWith(ym)) return;
      if (t.type === 'expense' || t.amount < 0) expense += Math.abs(t.amount || 0);
      else income += Math.abs(t.amount || 0);
    });
    return { expense, income };
  }

  computeFinanceSnapshot() {
    const now = new Date();
    const { expense: expNow, income: incNow } = this.monthTotals(now.getFullYear(), now.getMonth() + 1);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const { expense: expPrev, income: incPrev } = this.monthTotals(prev.getFullYear(), prev.getMonth() + 1);
    const growth = (nowVal, prevVal) => {
      if (!prevVal) return nowVal ? 100 : 0;
      return ((nowVal - prevVal) / prevVal) * 100;
    };
    return {
      balance: this.computeRemainingBudget(this.monthTotals(now.getFullYear(), now.getMonth() + 1).expense, true),
      monthlyExpense: expNow,
      monthlyIncome: incNow,
      expenseGrowthPct: growth(expNow, expPrev),
      incomeGrowthPct: growth(incNow, incPrev)
    };
  }

  computeSavingGoal() {
    try {
      const raw = localStorage.getItem('goals');
      const goals = raw ? JSON.parse(raw) : [];
      const g = Array.isArray(goals) && goals.length ? goals[0] : { target_amount: 0, current_amount: 0 };
      const targetAmount = Number(g.target_amount || 0);
      const currentAmount = Number(g.current_amount || 0);
      const progressPct = targetAmount > 0 ? Math.min(100, (currentAmount / targetAmount) * 100) : 0;
      return { targetAmount, currentAmount, progressPct };
    } catch (e) {
      return { targetAmount: 0, currentAmount: 0, progressPct: 0 };
    }
  }

  renderCategorySummary() {
    const list = this.getStoredTransactions();
    const byCat = {};
    list.forEach(t => {
      const type = t.type || (t.amount < 0 ? 'expense' : 'income');
      if (type !== 'expense') return;
      const cat = t.category || 'Khác';
      byCat[cat] = (byCat[cat] || 0) + Math.abs(t.amount || 0);
    });
    const ul = document.querySelector('.cat ul');
    if (!ul) return;
    ul.innerHTML = '';
    Object.entries(byCat).sort((a,b)=>b[1]-a[1]).forEach(([name, total]) => {
      const li = document.createElement('li');
      li.innerHTML = `<div class="l">${name}</div><div class="r">${this.formatCurrency(total)}</div>`;
      ul.appendChild(li);
    });
  }

  refreshAfterDataChange() {
    const { balance, monthlyExpense, monthlyIncome, expenseGrowthPct, incomeGrowthPct } = this.computeFinanceSnapshot();
    const { targetAmount, progressPct } = this.computeSavingGoal();
    this.updateKPICards({
      balance,
      monthlyExpense,
      monthlyIncome,
      savingsGoal: targetAmount,
      savingsProgress: progressPct,
      expenseGrowth: expenseGrowthPct,
      incomeGrowth: incomeGrowthPct
    });
    this.updateChart();
    this.renderCategorySummary();
    this.loadRecentTransactions();
    this.updateTodayAndMonthSummary();
  }

  aggregateIntoBuckets(transactions, periodDays, bucketCount) {
    // Trả về mảng độ dài bucketCount, mỗi phần tử là tổng chi của khoảng đó
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Khoảng thời gian tính từ (today - periodDays + 1) -> today
    const periodStart = new Date(start);
    periodStart.setDate(start.getDate() - (periodDays - 1));

    const bucketTotals = new Array(bucketCount).fill(0);
    const bucketSize = periodDays / bucketCount; // có thể không nguyên

    transactions.forEach(tx => {
      // Kỳ vọng định dạng yyyy-mm-dd
      if (!/\d{4}-\d{2}-\d{2}/.test(tx.date)) return;
      const d = new Date(tx.date + 'T00:00:00');
      if (d < periodStart || d > start) return; // ngoài kỳ

      // Tính index bucket: 0..bucketCount-1 từ trái->phải theo thời gian
      const daysFromStart = Math.floor((d - periodStart) / (24 * 3600 * 1000));
      let idx = Math.floor(daysFromStart / bucketSize);
      if (idx < 0) idx = 0;
      if (idx >= bucketCount) idx = bucketCount - 1;
      bucketTotals[idx] += Math.abs(tx.amount);
    });

    return bucketTotals;
  }
}

// Khởi tạo khi DOM loaded (sau khi qua auth guard)
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuthentication()) return;
  new TrangChuManager();
});

// Export cho sử dụng global
window.TrangChuManager = TrangChuManager;
