/**
 * Dashboard JavaScript
 * Xử lý trang chủ và hiển thị dữ liệu
 */

// Load utilities first
// (utils.js should be loaded before this file)

// Load user data
async function loadUserData() {
  const auth = checkAuth();
  if (!auth) {
    // Không redirect ở đây, để apiRequest() xử lý redirect
    // Tránh redirect vòng lặp
    return;
  }

  let user = auth.user;

  // Load đầy đủ thông tin user từ API nếu có
  if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
    try {
      const meResult = await window.apiRequest('/api/me');
      if (meResult && meResult.ok && meResult.data) {
        const profile = meResult.data;
        // Cập nhật user data với thông tin từ API
        // Balance = 0 là giá trị hợp lệ cho account mới, không dùng || để tránh bỏ qua giá trị 0
        const apiBalance = profile.balance !== undefined && profile.balance !== null
          ? profile.balance
          : (user.balance !== undefined && user.balance !== null ? user.balance : 0);

        user = {
          ...user,
          balance: apiBalance,
          gender: profile.gender !== undefined ? profile.gender : (user.gender || null),
          currency: profile.currency || user.currency || 'VND',
          phone: profile.phone !== undefined ? profile.phone : (user.phone || null),
          avatar_url: profile.avatar_url || user.avatar_url || null,
          monthly_budget: apiBalance // monthly_budget = balance
        };
        // Cập nhật localStorage
        localStorage.setItem('smartexpense_user', JSON.stringify(user));
      }
    } catch (error) {
      console.warn('Không thể tải thông tin user từ API:', error);
    }
  }

  const userNameElement = document.getElementById('userName');
  const welcomeTitleElement = document.getElementById('welcomeTitle');

  if (userNameElement) {
    userNameElement.textContent = user.name || 'Người dùng';
  }

  if (welcomeTitleElement) {
    welcomeTitleElement.textContent = `Chào mừng, ${user.name || 'Người dùng'}!`;
  }
}

// formatCurrency is now available from utils.js

// Global state
let allExpenses = [];
let allCategories = [];
let currentFilter = 'all'; // Time filter: 'all', 'today', 'week', 'month'
let currentSearchQuery = '';
let currentPage = 1; // Current page for pagination
const itemsPerPage = 10; // Number of items per page

// Debounce để tránh reload nhiều lần cùng lúc
let reloadDebounceTimer = null;
let isReloading = false; // Flag để tránh reload đồng thời

// Cache ngày hiện tại từ server để tránh gọi API nhiều lần
let cachedTodayDate = null;
let cachedTodayTimestamp = 0;
const CACHE_DURATION = 60000; // Cache 1 phút

/**
 * Lấy ngày hôm nay theo timezone Việt Nam (UTC+7)
 * Ưu tiên lấy từ server, fallback về client date với timezone VN
 * @returns {Promise<string>} Ngày dạng YYYY-MM-DD
 */
async function getTodayDateVietnam() {
  const now = Date.now();
  
  // Nếu cache còn hiệu lực, dùng cache
  if (cachedTodayDate && (now - cachedTodayTimestamp) < CACHE_DURATION) {
    return cachedTodayDate;
  }
  
  // Thử lấy từ server trước
  if (typeof window !== 'undefined' && typeof window.getCurrentDateFromServer === 'function') {
    try {
      const serverDate = await window.getCurrentDateFromServer();
      if (serverDate) {
        cachedTodayDate = serverDate;
        cachedTodayTimestamp = now;
        console.log('✅ Đã lấy ngày từ server:', serverDate);
        return serverDate;
      }
    } catch (error) {
      console.warn('⚠️ Không thể lấy ngày từ server, dùng client date:', error);
    }
  }
  
  // Fallback: tính toán ngày theo timezone Việt Nam (UTC+7)
  const vietnamOffset = 7 * 60; // 7 giờ tính bằng phút
  const utc = new Date().getTime() + (new Date().getTimezoneOffset() * 60000);
  const vietnamTime = new Date(utc + (vietnamOffset * 60000));
  const year = vietnamTime.getFullYear();
  const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
  const day = String(vietnamTime.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  
  cachedTodayDate = todayStr;
  cachedTodayTimestamp = now;
  console.log('📅 Đã tính ngày theo timezone VN:', todayStr);
  return todayStr;
}

/**
 * Lấy tháng hiện tại theo timezone Việt Nam
 * @returns {Promise<string>} Tháng dạng YYYY-MM
 */
async function getCurrentMonthVietnam() {
  const todayStr = await getTodayDateVietnam();
  return todayStr.substring(0, 7); // YYYY-MM
}

// Update summary statistics
async function updateSummaryStats(data) {
  // Load user balance from API (always fetch from database, not localStorage)
  let userBalance = 0;
  try {
    const meResult = await apiRequest('/api/me');
    if (meResult && meResult.ok && meResult.data) {
      const apiBalance = meResult.data.balance !== undefined && meResult.data.balance !== null
        ? meResult.data.balance
        : null;

      // Nếu API trả về balance (kể cả 0), sử dụng giá trị từ API
      // Balance = 0 là giá trị hợp lệ cho account mới, không cần fallback
      if (apiBalance !== null) {
        userBalance = apiBalance;
        console.log('✅ Got balance from API:', userBalance);
      } else {
        // Chỉ fallback khi API không trả về balance (null/undefined)
        // Điều này chỉ xảy ra khi có lỗi hoặc field không tồn tại
        console.warn('⚠️ API balance is null/undefined, using 0 as default');
        userBalance = 0;
      }

      // Tính toán ngày tháng theo timezone Việt Nam (đồng bộ với server)
      const todayStr = await getTodayDateVietnam(); // yyyy-mm-dd
      const currentMonth = await getCurrentMonthVietnam(); // yyyy-mm

      // Monthly expense - tính từ allExpenses
      let monthlyExpense = 0;
      if (allExpenses.length > 0) {
        const monthExpenses = allExpenses.filter(e => {
          const expDate = e.date ? e.date.substring(0, 7) : '';
          return expDate === currentMonth && e.type === 'expense';
        });
        monthlyExpense = monthExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      }
      // Fallback to API data if allExpenses is empty
      if (monthlyExpense === 0 && data.monthly && data.monthly[0]) {
        monthlyExpense = data.monthly[0].amount || 0;
      }

      // Today expense - tính từ allExpenses với ngày thực từ server
      let todayExpense = 0;
      if (allExpenses.length > 0) {
        const todayExpenses = allExpenses.filter(e => {
          // Chuẩn hóa định dạng ngày để so sánh chính xác
          let expDate = e.date || '';
          if (expDate && typeof expDate === 'string') {
            // Loại bỏ phần thời gian nếu có (2025-01-15T00:00:00.000Z -> 2025-01-15)
            expDate = expDate.substring(0, 10);
          } else if (expDate && expDate.getFullYear) {
            // Nếu là Date object, chuyển sang string
            const d = expDate;
            expDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          }
          return expDate === todayStr && e.type === 'expense';
        });
        todayExpense = todayExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
        console.log('💰 Tổng chi tiêu hôm nay (' + todayStr + '):', formatCurrency(todayExpense), 'từ', todayExpenses.length, 'giao dịch');
      }

      // Calculate monthly income from expenses
      let monthlyIncome = 0;
      if (allExpenses.length > 0) {
        const monthExpenses = allExpenses.filter(e => {
          const expDate = e.date ? e.date.substring(0, 7) : '';
          return expDate === currentMonth && e.type === 'income';
        });
        monthlyIncome = monthExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      }

      // Update balance (hiển thị số dư gốc - số tiền đã nhập ở phần "số dư tháng")
      const balanceAmount = document.getElementById('balanceAmount');
      if (balanceAmount) {
        // Hiển thị số dư gốc (số tiền user đã nhập), không trừ chi tiêu
        balanceAmount.textContent = formatCurrency(userBalance);
        balanceAmount.style.color = '#10b981';

        // Update localStorage to keep it in sync
        const currentUser = checkAuth();
        if (currentUser && currentUser.user) {
          currentUser.user.balance = userBalance;
          currentUser.user.monthly_budget = userBalance;
          localStorage.setItem('smartexpense_user', JSON.stringify(currentUser.user));
          localStorage.setItem('monthly_budget', String(userBalance));
        }
      }

      // Monthly expense display
      const monthlyExpenseElement = document.getElementById('monthlyExpense');
      if (monthlyExpenseElement) {
        monthlyExpenseElement.textContent = formatCurrency(monthlyExpense);
      }

      // Calculate remaining (Số tiền còn lại = Số dư - Chi tiêu THÁNG)
      // Allow negative to show when budget is exceeded
      const remaining = userBalance - monthlyExpense;

      // Update monthly expense input (Tổng chi tiêu tháng này) - hiển thị tổng số tiền đã chi trong tháng
      const monthlyExpenseInput = document.getElementById('monthlyExpenseInput');
      if (monthlyExpenseInput) {
        monthlyExpenseInput.value = formatCurrency(monthlyExpense);
      }

      // Update today expense input (Tổng chi tiêu hôm nay)
      const todayExpenseInput = document.getElementById('todayExpenseInput');
      if (todayExpenseInput) {
        todayExpenseInput.value = formatCurrency(todayExpense);
      }

      // Monthly income
      const monthlyIncomeElement = document.getElementById('monthlyIncome');
      if (monthlyIncomeElement) {
        monthlyIncomeElement.textContent = formatCurrency(monthlyIncome);
      }

      // Monthly budget
      const monthlyBudget = data.monthly && data.monthly[0] ? data.monthly[0].budget : 0;
      const monthlyBudgetElement = document.getElementById('monthlyBudget');
      if (monthlyBudgetElement) {
        monthlyBudgetElement.textContent = formatCurrency(monthlyBudget);
      }

      // Remaining budget (Số tiền còn lại = Số dư - Chi tiêu THÁNG)
      const remainingBudgetInput = document.getElementById('remainingBudgetInput');
      if (remainingBudgetInput) {
        remainingBudgetInput.value = formatCurrency(remaining);
        // Cập nhật màu sắc
        if (remaining < 0) {
          remainingBudgetInput.style.color = '#ef4444'; // Red if negative
        } else if (remaining < userBalance * 0.2) {
          remainingBudgetInput.style.color = '#f59e0b'; // Orange if less than 20% left
        } else {
          remainingBudgetInput.style.color = '#10b981'; // Green if OK
        }
        console.log('✅ Updated remainingBudgetInput:', formatCurrency(remaining),
          '(balance:', userBalance, '- monthly expense:', monthlyExpense, ')');
      }
    }
  } catch (error) {
    console.error('Error loading user balance:', error);
  }

  // Fallback: load balance from localStorage if API fails
  // Vẫn dùng ngày thực từ server để tính toán chính xác
  const todayStr = await getTodayDateVietnam();
  const currentMonth = await getCurrentMonthVietnam();

  // Calculate monthly expense from allExpenses
  let monthlyExpense = 0;
  if (allExpenses.length > 0) {
    const monthExpenses = allExpenses.filter(e => {
      const expDate = e.date ? e.date.substring(0, 7) : '';
      return expDate === currentMonth && e.type === 'expense';
    });
    monthlyExpense = monthExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
  }
  // Fallback to API data
  if (monthlyExpense === 0 && data.monthly && data.monthly[0]) {
    monthlyExpense = data.monthly[0].amount || 0;
  }

  // Calculate today expense from allExpenses với ngày thực
  let todayExpense = 0;
  if (allExpenses.length > 0) {
    const todayExpenses = allExpenses.filter(e => {
      // Chuẩn hóa định dạng ngày để so sánh chính xác
      let expDate = e.date || '';
      if (expDate && typeof expDate === 'string') {
        expDate = expDate.substring(0, 10);
      } else if (expDate && expDate.getFullYear) {
        const d = expDate;
        expDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      return expDate === todayStr && e.type === 'expense';
    });
    todayExpense = todayExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
  }
  
  // Cập nhật hiển thị tổng chi tiêu hôm nay (quan trọng!)
  const todayExpenseInput = document.getElementById('todayExpenseInput');
  if (todayExpenseInput) {
    todayExpenseInput.value = formatCurrency(todayExpense);
    console.log('✅ Đã cập nhật tổng chi tiêu hôm nay:', formatCurrency(todayExpense));
  }

  let monthlyIncome = 0;
  if (allExpenses.length > 0) {
    const monthExpenses = allExpenses.filter(e => {
      const expDate = e.date ? e.date.substring(0, 7) : '';
      return expDate === currentMonth && e.type === 'income';
    });
    monthlyIncome = monthExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
  }

  // Fallback: try to get balance from localStorage (always update if balanceAmount exists)
  const balanceAmount = document.getElementById('balanceAmount');
  if (balanceAmount) {
    try {
      // Try to get from smartexpense_user first
      const userData = localStorage.getItem('smartexpense_user');
      if (userData) {
        const user = JSON.parse(userData);
        if (user.balance !== undefined && user.balance !== null) {
          balanceAmount.textContent = formatCurrency(user.balance);
          balanceAmount.style.color = '#10b981';
        } else if (user.monthly_budget !== undefined && user.monthly_budget !== null) {
          balanceAmount.textContent = formatCurrency(user.monthly_budget);
          balanceAmount.style.color = '#10b981';
        } else {
          // Fallback to legacy localStorage
          const monthlyBudget = localStorage.getItem('monthly_budget');
          if (monthlyBudget) {
            balanceAmount.textContent = formatCurrency(Number(monthlyBudget) || 0);
            balanceAmount.style.color = '#10b981';
          }
        }
      } else {
        // Try legacy profile
        const profileData = localStorage.getItem('profile');
        if (profileData) {
          const profile = JSON.parse(profileData);
          if (profile.monthly_budget !== undefined) {
            balanceAmount.textContent = formatCurrency(profile.monthly_budget || 0);
            balanceAmount.style.color = '#10b981';
          } else if (profile.balance !== undefined) {
            balanceAmount.textContent = formatCurrency(profile.balance || 0);
            balanceAmount.style.color = '#10b981';
          }
        } else {
          // Last resort: calculate from income - expense
          const balance = monthlyIncome - monthlyExpense;
          balanceAmount.textContent = formatCurrency(balance);
          balanceAmount.style.color = balance >= 0 ? '#10b981' : '#ef4444';
        }
      }
    } catch (e) {
      console.warn('Error loading balance from localStorage:', e);
      // Last resort: calculate from income - expense
      const balance = monthlyIncome - monthlyExpense;
      balanceAmount.textContent = formatCurrency(balance);
      balanceAmount.style.color = balance >= 0 ? '#10b981' : '#ef4444';
    }
  }

  // Monthly budget
  const monthlyBudget = data.monthly && data.monthly[0] ? data.monthly[0].budget : 0;
  const monthlyBudgetElement = document.getElementById('monthlyBudget');
  if (monthlyBudgetElement) {
    monthlyBudgetElement.textContent = formatCurrency(monthlyBudget);
  }

  // Budget status and progress
  const budgetStatusElement = document.getElementById('budgetStatus');
  const budgetProgressElement = document.getElementById('budgetProgress');

  if (monthlyBudget > 0) {
    const usagePercent = Math.min((monthlyExpense / monthlyBudget) * 100, 100);
    if (budgetStatusElement) {
      if (usagePercent >= 100) {
        budgetStatusElement.textContent = 'Vượt ngân sách';
      } else {
        budgetStatusElement.textContent = `${usagePercent.toFixed(0)}% ngân sách`;
      }
    }
    if (budgetProgressElement) {
      budgetProgressElement.style.width = `${usagePercent}%`;
      budgetProgressElement.style.background = usagePercent >= 100 ? '#ef4444' : (usagePercent >= 80 ? '#f59e0b' : '#60a5fa');
    }

    // Remaining budget (using monthly budget for progress bar, but remaining input shows balance - today expense)
    // Note: This is handled above in the main section
  } else {
    if (budgetStatusElement) {
      budgetStatusElement.textContent = 'Chưa đặt ngân sách';
    }
    if (budgetProgressElement) {
      budgetProgressElement.style.width = '0%';
    }
    // Remaining budget still shows balance - today expense (handled in main section above)
  }

  // Ensure today expense and remaining budget are updated even in fallback
  // (already updated above, no need to duplicate)

  // Update monthly expense input (Tổng chi tiêu tháng này) - hiển thị tổng số tiền đã chi trong tháng
  const monthlyExpenseInput = document.getElementById('monthlyExpenseInput');
  if (monthlyExpenseInput) {
    monthlyExpenseInput.value = formatCurrency(monthlyExpense);
  }

  // Update remaining budget with balance - monthly expense
  const remainingBudgetInput = document.getElementById('remainingBudgetInput');
  if (remainingBudgetInput) {
    // Get userBalance for fallback calculation
    let fallbackBalance = 0;
    try {
      const userData = localStorage.getItem('smartexpense_user');
      if (userData) {
        const user = JSON.parse(userData);
        fallbackBalance = user.balance || user.monthly_budget || 0;
      } else {
        const monthlyBudget = localStorage.getItem('monthly_budget');
        if (monthlyBudget) {
          fallbackBalance = Number(monthlyBudget) || 0;
        }
      }
    } catch (e) {
      console.warn('Error getting balance for remaining calculation:', e);
    }
    // Allow negative to show when budget is exceeded
    const remaining = fallbackBalance - monthlyExpense;
    remainingBudgetInput.value = formatCurrency(remaining);
    // Cập nhật màu sắc để đồng nhất với các phần khác
    if (remaining < 0) {
      remainingBudgetInput.style.color = '#ef4444'; // Red if negative
    } else if (remaining < fallbackBalance * 0.2) {
      remainingBudgetInput.style.color = '#f59e0b'; // Orange if less than 20% left
    } else {
      remainingBudgetInput.style.color = '#10b981'; // Green if OK
    }
    console.log('✅ Updated remainingBudgetInput (fallback):', formatCurrency(remaining),
      '(balance:', fallbackBalance, '- monthly expense:', monthlyExpense, ')');
  }

  // Calculate expense change (compare with previous month)
  // Calculate from allExpenses for accurate comparison
  const expenseChangeElement = document.getElementById('expenseChange');
  if (expenseChangeElement) {
    try {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1; // 1-12

      // Calculate current month expense
      const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      let currentMonthExpense = 0;
      if (allExpenses.length > 0) {
        const currentMonthExpenses = allExpenses.filter(e => {
          const expDate = e.date ? e.date.substring(0, 7) : '';
          return expDate === currentMonthStr && e.type === 'expense';
        });
        currentMonthExpense = currentMonthExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      }

      // Calculate previous month expense
      let previousMonth = currentMonth - 1;
      let previousYear = currentYear;
      if (previousMonth === 0) {
        previousMonth = 12;
        previousYear = currentYear - 1;
      }
      const previousMonthStr = `${previousYear}-${String(previousMonth).padStart(2, '0')}`;
      let previousMonthExpense = 0;
      if (allExpenses.length > 0) {
        const previousMonthExpenses = allExpenses.filter(e => {
          const expDate = e.date ? e.date.substring(0, 7) : '';
          return expDate === previousMonthStr && e.type === 'expense';
        });
        previousMonthExpense = previousMonthExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      }

      // Calculate percentage change
      if (previousMonthExpense > 0) {
        const change = ((currentMonthExpense - previousMonthExpense) / previousMonthExpense) * 100;
        expenseChangeElement.innerHTML = `<span class="${change >= 0 ? 'down' : 'up'}">${change >= 0 ? '+' : ''}${change.toFixed(0)}%</span> so với tháng trước`;
        console.log(`✅ Expense change: ${currentMonthExpense} vs ${previousMonthExpense} = ${change.toFixed(0)}%`);
      } else if (previousMonthExpense === 0 && currentMonthExpense > 0) {
        // If previous month had no expenses but current month has expenses
        expenseChangeElement.innerHTML = `<span class="up">+100%</span> so với tháng trước`;
        console.log(`✅ Expense change: ${currentMonthExpense} vs 0 = +100%`);
      } else {
        // Both months have no expenses or both are 0
        expenseChangeElement.innerHTML = `<span class="up">0%</span> so với tháng trước`;
        console.log(`✅ Expense change: Both months have no expenses`);
      }
    } catch (error) {
      console.error('Error calculating expense change:', error);
      expenseChangeElement.innerHTML = `<span class="up">0%</span> so với tháng trước`;
    }
  }

  // Calculate income change (compare with previous month)
  const incomeChangeElement = document.getElementById('incomeChange');
  if (incomeChangeElement) {
    try {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1; // 1-12

      // Calculate current month income
      const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      let currentMonthIncome = 0;
      if (allExpenses.length > 0) {
        const currentMonthIncomes = allExpenses.filter(e => {
          const expDate = e.date ? e.date.substring(0, 7) : '';
          return expDate === currentMonthStr && e.type === 'income';
        });
        currentMonthIncome = currentMonthIncomes.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      }

      // Calculate previous month income
      let previousMonth = currentMonth - 1;
      let previousYear = currentYear;
      if (previousMonth === 0) {
        previousMonth = 12;
        previousYear = currentYear - 1;
      }
      const previousMonthStr = `${previousYear}-${String(previousMonth).padStart(2, '0')}`;
      let previousMonthIncome = 0;
      if (allExpenses.length > 0) {
        const previousMonthIncomes = allExpenses.filter(e => {
          const expDate = e.date ? e.date.substring(0, 7) : '';
          return expDate === previousMonthStr && e.type === 'income';
        });
        previousMonthIncome = previousMonthIncomes.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      }

      // Calculate percentage change
      if (previousMonthIncome > 0) {
        const change = ((currentMonthIncome - previousMonthIncome) / previousMonthIncome) * 100;
        incomeChangeElement.innerHTML = `<span class="${change >= 0 ? 'up' : 'down'}">${change >= 0 ? '+' : ''}${change.toFixed(0)}%</span> so với tháng trước`;
        console.log(`✅ Income change: ${currentMonthIncome} vs ${previousMonthIncome} = ${change.toFixed(0)}%`);
      } else if (previousMonthIncome === 0 && currentMonthIncome > 0) {
        // If previous month had no income but current month has income
        incomeChangeElement.innerHTML = `<span class="up">+100%</span> so với tháng trước`;
        console.log(`✅ Income change: ${currentMonthIncome} vs 0 = +100%`);
      } else {
        // Both months have no income or both are 0
        incomeChangeElement.innerHTML = `<span class="up">0%</span> so với tháng trước`;
        console.log(`✅ Income change: Both months have no income`);
      }
    } catch (error) {
      console.error('Error calculating income change:', error);
      incomeChangeElement.innerHTML = `<span class="up">0%</span> so với tháng trước`;
    }
  }

  // Check budget warning after updating stats
  setTimeout(() => {
    checkBudgetWarning();
  }, 100);
}

// Filter expenses based on current filter and search
function filterExpenses(expenses) {
  let filtered = [...expenses];

  // Apply search filter
  if (currentSearchQuery) {
    const query = currentSearchQuery.toLowerCase();
    filtered = filtered.filter(e => {
      const categoryName = (e.categoryName || '').toLowerCase();
      const note = (e.note || '').toLowerCase();
      return categoryName.includes(query) || note.includes(query);
    });
  }

  // Apply filter (time or category)
  if (currentFilter && currentFilter !== 'all') {
    // Check if it's a category filter (format: "category:1" or "category-name:%E1%BA%AFn%20u%E1%BB%91ng")
    if (currentFilter.startsWith('category-name:')) {
      const encodedName = currentFilter.slice('category-name:'.length);
      const decodedName = decodeURIComponent(encodedName || '');
      filtered = filtered.filter(e => {
        const expenseCategoryName = e.categoryName || (e.categoryId ? 'Danh mục' : 'Khác');
        return expenseCategoryName === (decodedName || 'Khác');
      });
    } else if (currentFilter.startsWith('category:')) {
      const categoryIdStr = currentFilter.split(':')[1];
      const categoryIdNum = parseInt(categoryIdStr);
      filtered = filtered.filter(e => {
        // Match by categoryId (can be number or string)
        // Normalize both values to strings for comparison
        const expenseCategoryId = e.categoryId != null ? String(e.categoryId) : null;
        const filterCategoryId = String(categoryIdNum);
        return expenseCategoryId === filterCategoryId;
      });
    } else {
      // Apply time filter - sử dụng ngày thực theo timezone Việt Nam (UTC+7)
      // Sử dụng cached date nếu có, nếu không tính toán sync theo timezone VN
      let todayStr = cachedTodayDate;
      let currentMonth = todayStr ? todayStr.substring(0, 7) : null;
      
      // Nếu chưa có cache, tính toán theo timezone VN
      if (!todayStr) {
        const today = new Date();
        const vietnamOffset = 7 * 60; // UTC+7
        const utc = today.getTime() + (today.getTimezoneOffset() * 60000);
        const vietnamTime = new Date(utc + (vietnamOffset * 60000));
        todayStr = `${vietnamTime.getFullYear()}-${String(vietnamTime.getMonth() + 1).padStart(2, '0')}-${String(vietnamTime.getDate()).padStart(2, '0')}`;
        currentMonth = todayStr.substring(0, 7);
      }

      if (currentFilter === 'today') {
        filtered = filtered.filter(e => {
          let expDate = e.date || '';
          if (expDate && typeof expDate === 'string') {
            expDate = expDate.substring(0, 10);
          } else if (expDate && expDate.getFullYear) {
            const d = expDate;
            expDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          }
          return expDate === todayStr;
        });
      } else if (currentFilter === 'week') {
        // Tính 7 ngày trước từ todayStr
        const todayDate = new Date(todayStr + 'T00:00:00');
        const weekAgoDate = new Date(todayDate);
        weekAgoDate.setDate(todayDate.getDate() - 7);
        const weekAgoStr = `${weekAgoDate.getFullYear()}-${String(weekAgoDate.getMonth() + 1).padStart(2, '0')}-${String(weekAgoDate.getDate()).padStart(2, '0')}`;
        filtered = filtered.filter(e => {
          let expDate = e.date || '';
          if (expDate && typeof expDate === 'string') {
            expDate = expDate.substring(0, 10);
          } else if (expDate && expDate.getFullYear) {
            const d = expDate;
            expDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          }
          return expDate >= weekAgoStr && expDate <= todayStr;
        });
      } else if (currentFilter === 'month') {
        filtered = filtered.filter(e => {
          const expDate = e.date ? e.date.substring(0, 7) : '';
          return expDate === currentMonth;
        });
      }
    }
  }
  // 'all' filter - no additional filtering needed

  return filtered;
}

// Quick update UI when new expense is added (real-time update)
async function quickUpdateUIWithNewExpense(newExpense) {
  if (!newExpense) {
    console.warn('⚠️ quickUpdateUIWithNewExpense: newExpense is null/undefined');
    return;
  }

  console.log('📊 Quick update started with expense:', newExpense);

  // Initialize allExpenses if not exists
  if (!Array.isArray(allExpenses)) {
    allExpenses = [];
  }

  // Nếu allExpenses rỗng hoặc chưa được load, reload từ API trước để đảm bảo tính toán chính xác
  if (allExpenses.length === 0) {
    console.log('⚠️ allExpenses is empty, reloading from API first...');
    try {
      const expensesResult = await apiRequest('/api/expenses');
      if (expensesResult && expensesResult.ok && expensesResult.data && expensesResult.data.items) {
        allExpenses = expensesResult.data.items || [];
        console.log(`✅ Reloaded ${allExpenses.length} expenses from API`);
      }
    } catch (e) {
      console.warn('⚠️ Error reloading expenses, will use existing data:', e);
    }
  }

  // Normalize expense data before adding
  // Ensure date is in yyyy-mm-dd format
  let normalizedExpense = { ...newExpense };
  if (normalizedExpense.date) {
    if (typeof normalizedExpense.date === 'string') {
      // Already a string, ensure it's yyyy-mm-dd format
      normalizedExpense.date = normalizedExpense.date.substring(0, 10);
    } else if (normalizedExpense.date.getFullYear) {
      // Date object - convert to yyyy-mm-dd
      const d = normalizedExpense.date;
      normalizedExpense.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  // Ensure amount is positive number for display (we use Math.abs when calculating)
  if (normalizedExpense.amount) {
    normalizedExpense.amount = Math.abs(Number(normalizedExpense.amount));
  }
  // Ensure type is 'expense'
  if (!normalizedExpense.type) {
    normalizedExpense.type = 'expense';
  }

  // Store new expense ID for debugging
  const newExpenseId = normalizedExpense.id;

  // Check if expense already exists (avoid duplicates)
  const existingIndex = allExpenses.findIndex(e => e.id === normalizedExpense.id);
  if (existingIndex >= 0) {
    // Update existing expense
    allExpenses[existingIndex] = normalizedExpense;
    console.log('🔄 Updated existing expense at index', existingIndex, normalizedExpense);
  } else {
    // Add to allExpenses array immediately
    allExpenses.push(normalizedExpense);
    console.log('➕ Added new expense, total count:', allExpenses.length, normalizedExpense);
  }

  // Tính toán ngày tháng theo timezone Việt Nam (đồng bộ với server)
  const todayStr = await getTodayDateVietnam(); // yyyy-mm-dd
  const currentMonth = await getCurrentMonthVietnam(); // yyyy-mm
  console.log('📅 Current month:', currentMonth, 'Today:', todayStr);
  console.log('📦 allExpenses count before filter:', allExpenses.length);
  console.log('📦 Sample expenses:', allExpenses.slice(-3).map(e => ({ id: e.id, date: e.date, amount: e.amount, type: e.type })));

  // Calculate monthly expense - tính tổng tất cả chi tiêu trong tháng
  const monthExpenses = allExpenses.filter(e => {
    if (!e || e.type !== 'expense') {
      if (e) console.log('❌ Filtered out (not expense):', e.type);
      return false;
    }
    // Handle different date formats
    let expDate = '';
    if (e.date) {
      if (typeof e.date === 'string') {
        expDate = e.date.substring(0, 7); // yyyy-mm-dd -> yyyy-mm
      } else if (e.date.getFullYear) {
        // Date object
        expDate = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`;
      }
    } else {
      console.log('❌ Expense has no date:', e);
      return false;
    }
    const matches = expDate === currentMonth;
    if (matches) {
      console.log('✓ Expense matches month:', { id: e.id, date: e.date, expDate, currentMonth, amount: e.amount });
    }
    return matches;
  });
  const monthlyExpense = monthExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
  console.log('💰 Monthly expense calculated:', monthlyExpense, 'from', monthExpenses.length, 'expenses');

  // Calculate today expense - tính tổng chi tiêu hôm nay
  const todayExpenses = allExpenses.filter(e => {
    if (!e || e.type !== 'expense') {
      if (e) console.log('❌ Filtered out (not expense):', e.type);
      return false;
    }
    // Handle different date formats
    let expDate = '';
    if (e.date) {
      if (typeof e.date === 'string') {
        expDate = e.date.substring(0, 10); // yyyy-mm-dd
      } else if (e.date.getFullYear) {
        // Date object - convert to yyyy-mm-dd
        const d = e.date;
        expDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    } else {
      console.warn('⚠️ Expense missing date:', e);
      return false;
    }
    const isToday = expDate === todayStr;
    if (isToday) {
      console.log('✓✓✓ Today expense found:', { id: e.id, date: e.date, expDate, todayStr, amount: e.amount, matches: expDate === todayStr });
    } else {
      // Log why it doesn't match (for debugging)
      if (e.id === newExpenseId) {
        console.warn('⚠️⚠️⚠️ New expense date mismatch!', {
          expenseId: e.id,
          expenseDate: e.date,
          expDate,
          todayStr,
          match: expDate === todayStr
        });
      }
    }
    return isToday;
  });
  const todayExpense = todayExpenses.reduce((sum, e) => {
    const amount = Math.abs(Number(e.amount) || 0);
    console.log('💰 Adding to todayExpense:', { id: e.id, amount: e.amount, normalized: amount });
    return sum + amount;
  }, 0);
  console.log('📅📅📅 Today expense calculated:', todayExpense, 'from', todayExpenses.length, 'expenses');
  console.log('📅 Today expenses breakdown:', todayExpenses.map(e => ({ id: e.id, date: e.date, amount: e.amount, note: e.note })));

  // Get user balance from API (always fetch from database, not localStorage)
  let userBalance = 0;
  try {
    const meResult = await apiRequest('/api/me');
    if (meResult && meResult.ok && meResult.data) {
      const apiBalance = meResult.data.balance !== undefined && meResult.data.balance !== null
        ? meResult.data.balance
        : null;

      // Nếu API trả về balance (kể cả 0), sử dụng giá trị từ API
      // Balance = 0 là giá trị hợp lệ cho account mới, không cần fallback
      if (apiBalance !== null) {
        userBalance = apiBalance;
        console.log('✅ Got balance from API:', userBalance);
      } else {
        // Chỉ fallback khi API không trả về balance (null/undefined)
        console.warn('⚠️ API balance is null/undefined, using 0 as default');
        userBalance = 0;
      }
    } else {
      // API request failed - use 0 as default for new accounts
      console.warn('⚠️ API request failed, using 0 as default');
      userBalance = 0;
    }
  } catch (e) {
    // API error - use 0 as default for new accounts
    console.warn('⚠️ Error getting balance from API, using 0 as default:', e);
    userBalance = 0;
  }
  console.log('💵 Final user balance:', userBalance);

  // Calculate remaining - Số tiền còn lại = Số dư - Chi tiêu THÁNG
  // Allow negative to show when budget is exceeded
  const remaining = userBalance - monthlyExpense;
  console.log('✅✅✅ Remaining calculated:', remaining,
    '(balance:', userBalance, '- monthly expense:', monthlyExpense, ')');
  console.log('📊 Summary:', {
    userBalance,
    monthlyExpense,
    remaining,
    formula: `${userBalance} - ${monthlyExpense} = ${remaining}`
  });

  // Update UI immediately - check each element
  const monthlyExpenseInput = document.getElementById('monthlyExpenseInput');
  if (monthlyExpenseInput) {
    monthlyExpenseInput.value = formatCurrency(monthlyExpense);
    console.log('✓ Updated monthlyExpenseInput:', formatCurrency(monthlyExpense));
  } else {
    console.warn('⚠️ monthlyExpenseInput element not found');
  }

  const monthlyExpenseElement = document.getElementById('monthlyExpense');
  if (monthlyExpenseElement) {
    monthlyExpenseElement.textContent = formatCurrency(monthlyExpense);
    console.log('✓ Updated monthlyExpense element:', formatCurrency(monthlyExpense));
  } else {
    console.warn('⚠️ monthlyExpense element not found');
  }

  const todayExpenseInput = document.getElementById('todayExpenseInput');
  if (todayExpenseInput) {
    todayExpenseInput.value = formatCurrency(todayExpense);
    console.log('✓ Updated todayExpenseInput:', formatCurrency(todayExpense));
  } else {
    console.warn('⚠️ todayExpenseInput element not found');
  }

  // Update remaining budget (Số tiền còn lại) - ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT
  console.log('🔍🔍🔍 Attempting to update remainingBudgetInput...');
  console.log('🔍 Values:', { userBalance, monthlyExpense, remaining, formula: `${userBalance} - ${monthlyExpense} = ${remaining}` });
  const remainingBudgetInput = document.getElementById('remainingBudgetInput');
  if (remainingBudgetInput) {
    const oldValue = remainingBudgetInput.value;
    remainingBudgetInput.value = formatCurrency(remaining);
    // Also update the visual style if needed (optional, for better UX)
    if (remaining < 0) {
      remainingBudgetInput.style.color = '#ef4444'; // Red if negative
    } else if (remaining < userBalance * 0.2) {
      remainingBudgetInput.style.color = '#f59e0b'; // Orange if less than 20% left
    } else {
      remainingBudgetInput.style.color = '#10b981'; // Green if OK
    }
    console.log('✅✅✅ Updated remainingBudgetInput:',
      'old:', oldValue,
      'new:', formatCurrency(remaining),
      '(balance:', userBalance, '- monthly expense:', monthlyExpense, ')');
    console.log('✅✅✅ Element after update:', {
      value: remainingBudgetInput.value,
      color: remainingBudgetInput.style.color,
      id: remainingBudgetInput.id
    });
  } else {
    console.error('❌❌❌ remainingBudgetInput element not found! Cannot update remaining amount!');
    // Try to find alternative elements
    const altElements = document.querySelectorAll('[id*="remaining"], [id*="remainingBudget"], [id*="còn lại"]');
    console.log('Alternative elements found:', altElements);
    // Also try to find by placeholder or label
    const allInputs = document.querySelectorAll('input');
    console.log('All inputs on page:', Array.from(allInputs).map(i => ({ id: i.id, value: i.value, placeholder: i.placeholder })));
  }

  // Update recent expenses list
  try {
    updateRecentExpenses(allExpenses);
    console.log('✓ Updated recent expenses list');
  } catch (e) {
    console.error('Error updating recent expenses:', e);
  }

  // Update category list
  try {
    updateCategoryList(allExpenses);
    updateFilterDropdown();
    console.log('✓ Updated category list');
  } catch (e) {
    console.error('Error updating category list:', e);
  }

  // Update expense trend chart - làm mới biểu đồ xu hướng chi tiêu
  try {
    await loadChartData();
    console.log('✓ Đã cập nhật biểu đồ xu hướng chi tiêu');
  } catch (e) {
    console.error('❌ Lỗi cập nhật biểu đồ:', e);
  }

  console.log('✅ UI updated instantly with new expense');
}

// Update recent expenses
function updateRecentExpenses(expenses) {
  // Store all expenses globally
  allExpenses = expenses;

  // Apply filters
  const filtered = filterExpenses(expenses);

  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  // Reset to page 1 if current page is out of bounds
  if (currentPage > totalPages) {
    currentPage = 1;
  }

  // Calculate pagination slice
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedExpenses = filtered.slice(startIndex, endIndex);

  const container = document.getElementById('recentExpenses');
  const tableBody = document.getElementById('recentExpensesTable');

  // Update table view
  if (tableBody) {
    if (filtered.length === 0) {
      const emptyRow = tableBody.querySelector('.empty-state');
      if (emptyRow) {
        emptyRow.style.display = '';
      } else {
        // Hiển thị thông báo phù hợp dựa trên filter
        let emptyMessage = 'Chưa có giao dịch nào';
        if (currentFilter === 'today') {
          emptyMessage = 'Chưa có giao dịch hôm nay';
        } else if (currentFilter === 'week') {
          emptyMessage = 'Chưa có giao dịch trong tuần này';
        } else if (currentFilter === 'month') {
          emptyMessage = 'Chưa có giao dịch trong tháng này';
        } else if (currentSearchQuery) {
          emptyMessage = 'Không tìm thấy giao dịch phù hợp';
        } else if (expenses.length === 0) {
          emptyMessage = 'Bạn chưa có giao dịch nào. Hãy thêm giao dịch đầu tiên của bạn!';
        }
        tableBody.innerHTML = `<tr class="empty-state"><td colspan="4" style="text-align:center;padding:40px;color:#94a3b8">${emptyMessage}</td></tr>`;
      }
      // Hide pagination if no data
      updatePagination(0, 1);
    } else {
      // Hide empty state
      const emptyRow = tableBody.querySelector('.empty-state');
      if (emptyRow) emptyRow.style.display = 'none';

      // Show paginated expenses
      tableBody.innerHTML = paginatedExpenses.map(expense => {
        const categoryName = expense.categoryName || (expense.categoryId ? 'Danh mục' : 'Khác');
        const safeCategoryName = categoryName || 'Khác';
        const categoryAttr = (safeCategoryName || 'Khác').replace(/"/g, '&quot;');
        const note = expense.note || 'Không có ghi chú';
        const amount = Math.abs(expense.amount);
        // Chuẩn hóa định dạng ngày: từ 2025-11-10T17:00:00.000Z → chỉ còn 2025-11-10
        let date = expense.date || '';
        if (date && date.includes('T')) {
          date = date.split('T')[0];
        }
        const typeClass = expense.type === 'income' ? 'income' : 'expense';
        const sign = expense.type === 'income' ? '+' : '-';

        return `
          <tr>
            <td class="category-clickable" data-expense-id="${expense.id}" data-category-name="${categoryAttr}" style="cursor:pointer;padding:4px 8px;border-radius:6px;transition:background 0.2s" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'" title="Click để chọn hạng mục">${safeCategoryName}</td>
            <td>${note}</td>
            <td class="${typeClass}" style="font-weight:600;color:${expense.type === 'income' ? '#10b981' : '#ef4444'}">${sign}${formatCurrency(amount)}</td>
            <td>${date}</td>
          </tr>
        `;
      }).join('');

      // Add click listeners to category cells
      tableBody.querySelectorAll('.category-clickable').forEach(cell => {
        cell.addEventListener('click', function (e) {
          e.stopPropagation();
          const expenseId = this.getAttribute('data-expense-id');
          const categoryName = this.getAttribute('data-category-name') || this.textContent.trim();

          // Open category selection modal
          if (expenseId) {
            openCategoryModal(expenseId);
          }

          // Highlight the category in "Theo hạng mục" section
          highlightCategoryInList(categoryName);
        });
      });

      // Update pagination
      updatePagination(filtered.length, totalPages);
    }
  }

  // Update container view (if exists)
  if (container) {
    if (expenses.length === 0) {
      container.innerHTML = '<div class="loading">Chưa có giao dịch nào</div>';
      return;
    }

    const expensesHTML = expenses.map(expense => {
      const categoryDisplay = expense.categoryName || (expense.categoryId ? 'Danh mục' : 'Khác');
      return `
      <div class="expense-item">
        <div class="expense-info">
          <div class="expense-category">${categoryDisplay}</div>
          <div class="expense-note">${expense.note || 'Không có ghi chú'}</div>
        </div>
        <div class="expense-amount ${expense.type === 'income' ? 'income' : 'expense'}">
          ${expense.type === 'income' ? '+' : '-'}${formatCurrency(Math.abs(expense.amount))}
        </div>
      </div>
    `;
    }).join('');

    container.innerHTML = expensesHTML;
  }

  // Calculate today's expenses
  const today = new Date().toISOString().split('T')[0];
  const todayExpenses = expenses.filter(e => e.date === today && e.type === 'expense');
  const todayTotal = todayExpenses.reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const todayExpenseInput = document.getElementById('todayExpenseInput');
  if (todayExpenseInput) {
    todayExpenseInput.value = formatCurrency(todayTotal);
  }

  // Defensive: also refresh remaining = balance - MONTHLY expense (avoid any accidental today-only calc)
  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthExpenses = expenses.filter(e => {
      const expDate = e.date ? e.date.substring(0, 7) : '';
      return expDate === currentMonth && e.type === 'expense';
    });
    const monthlyTotal = monthExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);

    // Get balance from stored profile/UI
    let balanceForUI = 0;
    try {
      const userData = localStorage.getItem('smartexpense_user');
      if (userData) {
        const user = JSON.parse(userData);
        balanceForUI = user.balance || user.monthly_budget || 0;
      } else {
        const monthlyBudget = localStorage.getItem('monthly_budget');
        if (monthlyBudget) balanceForUI = Number(monthlyBudget) || 0;
      }
    } catch (_) { }

    const remainingEl = document.getElementById('remainingBudgetInput');
    if (remainingEl) {
      const remainingCalc = balanceForUI - monthlyTotal;
      remainingEl.value = formatCurrency(remainingCalc);
      if (remainingCalc < 0) {
        remainingEl.style.color = '#ef4444';
      } else if (remainingCalc < balanceForUI * 0.2) {
        remainingEl.style.color = '#f59e0b';
      } else {
        remainingEl.style.color = '#10b981';
      }
    }
  } catch (_) { }

  // Update category list after updating expenses
  updateCategoryList(expenses);
}

// Update pagination UI
function updatePagination(totalItems, totalPages) {
  const paginationContainer = document.getElementById('paginationContainer');
  if (!paginationContainer) return;

  if (totalItems === 0 || totalPages <= 1) {
    paginationContainer.style.display = 'none';
    return;
  }

  paginationContainer.style.display = 'flex';

  // Calculate display range
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Build pagination HTML
  let paginationHTML = `
    <div class="pagination-info" style="color:#64748b;font-size:14px">
      Hiển thị ${startItem}-${endItem} của ${totalItems} giao dịch
    </div>
    <div class="pagination-controls" style="display:flex;align-items:center;gap:8px">
      <button id="prevPageBtn" class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''}
              style="padding:6px 12px;border:1px solid var(--border);border-radius:8px;background:#fff;cursor:pointer;font-weight:600;color:#475569;${currentPage === 1 ? 'opacity:0.5;cursor:not-allowed' : ''}">
        Trước
      </button>
      <div class="pagination-pages" style="display:flex;align-items:center;gap:4px">
  `;

  // Show page numbers (max 5 pages visible)
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    paginationHTML += `<button class="pagination-page" data-page="1" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:#fff;cursor:pointer;font-weight:600;color:#475569">1</button>`;
    if (startPage > 2) {
      paginationHTML += `<span style="color:#94a3b8">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === currentPage;
    paginationHTML += `
      <button class="pagination-page ${isActive ? 'active' : ''}" data-page="${i}"
              style="padding:6px 10px;border:1px solid ${isActive ? 'var(--blue)' : 'var(--border)'};border-radius:6px;background:${isActive ? 'var(--blue)' : '#fff'};cursor:pointer;font-weight:600;color:${isActive ? '#fff' : '#475569'}">
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHTML += `<span style="color:#94a3b8">...</span>`;
    }
    paginationHTML += `<button class="pagination-page" data-page="${totalPages}" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:#fff;cursor:pointer;font-weight:600;color:#475569">${totalPages}</button>`;
  }

  paginationHTML += `
      </div>
      <button id="nextPageBtn" class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''}
              style="padding:6px 12px;border:1px solid var(--border);border-radius:8px;background:#fff;cursor:pointer;font-weight:600;color:#475569;${currentPage === totalPages ? 'opacity:0.5;cursor:not-allowed' : ''}">
        Sau
      </button>
    </div>
  `;

  paginationContainer.innerHTML = paginationHTML;

  // Add event listeners
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const pageBtns = document.querySelectorAll('.pagination-page');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        updateRecentExpenses(allExpenses);
        // Scroll to top of table
        const tableBody = document.getElementById('recentExpensesTable');
        if (tableBody) {
          tableBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        updateRecentExpenses(allExpenses);
        // Scroll to top of table
        const tableBody = document.getElementById('recentExpensesTable');
        if (tableBody) {
          tableBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  pageBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.getAttribute('data-page'));
      if (page !== currentPage) {
        currentPage = page;
        updateRecentExpenses(allExpenses);
        // Scroll to top of table
        const tableBody = document.getElementById('recentExpensesTable');
        if (tableBody) {
          tableBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
}

// Load dashboard data from API
async function loadDashboardData() {
  const auth = checkAuth();
  if (!auth) {
    // Không redirect ở đây, để apiRequest() xử lý redirect
    // Tránh redirect vòng lặp
    return;
  }

  try {
    console.log('🔄 Loading dashboard data from API...');

    // Load all expenses first (needed for accurate calculations)
    const expensesResult = await apiRequest('/api/expenses');
    if (expensesResult && expensesResult.ok) {
      // Update global allExpenses array with API data
      allExpenses = expensesResult.data.items || [];
      console.log(`✅ Loaded ${allExpenses.length} expenses from API`);

      // Update recent expenses display
      updateRecentExpenses(allExpenses);

      // Also update dataManager cache for offline support
      if (window.dataManager) {
        window.dataManager.data.expenses = allExpenses;
        window.dataManager.saveData();
      }
    }

    // Load summary data (called after expenses to ensure allExpenses is updated)
    const summaryResult = await apiRequest('/api/reports/summary');
    if (summaryResult && summaryResult.ok) {
      updateSummaryStats(summaryResult.data);
    }

    // Load categories for filter dropdown
    const categoriesResult = await apiRequest('/api/categories');
    if (categoriesResult && categoriesResult.ok) {
      allCategories = categoriesResult.data.items || [];
      updateFilterDropdown();

      // Also update dataManager cache
      if (window.dataManager) {
        window.dataManager.data.categories = allCategories;
        window.dataManager.saveData();
      }
    }

    // Load chart data
    loadChartData();

    console.log('✅ Dashboard data loaded successfully');
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    const recentExpensesElement = document.getElementById('recentExpenses');
    if (recentExpensesElement) {
      recentExpensesElement.innerHTML =
        '<div class="error">Lỗi tải dữ liệu. Vui lòng thử lại.</div>';
    }
  }
}

// Reload dashboard data (for realtime updates) - với debounce để tránh reload nhiều lần
async function reloadDashboardData(immediate = false) {
  // Nếu đang reload, bỏ qua
  if (isReloading && !immediate) {
    console.log('⏭️ Reload đang chạy, bỏ qua request mới');
    return;
  }

  // Debounce: đợi 500ms trước khi reload (trừ khi immediate = true)
  if (!immediate && reloadDebounceTimer) {
    clearTimeout(reloadDebounceTimer);
  }

  const doReload = async () => {
    if (isReloading) {
      console.log('⏭️ Reload đang chạy, bỏ qua');
      return;
    }

    isReloading = true;
    try {
      await loadDashboardData();
    } catch (error) {
      console.error('Error reloading dashboard:', error);
    } finally {
      // Đợi 1 giây trước khi cho phép reload tiếp (tránh spam)
      setTimeout(() => {
        isReloading = false;
      }, 1000);
    }
  };

  if (immediate) {
    await doReload();
  } else {
    reloadDebounceTimer = setTimeout(doReload, 500);
  }
}

// logout function is now available from utils.js

// ===== Search and Filter Functionality =====
function initSearchAndFilter() {
  // Search box
  const searchInput = document.getElementById('expenseFilter');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value;
      currentPage = 1; // Reset to first page when search changes
      updateRecentExpenses(allExpenses);
    });
  }

  // Filter dropdown (time filter)
  const filterSelect = document.getElementById('expenseFilterSelect');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      currentPage = 1; // Reset to first page when filter changes
      updateRecentExpenses(allExpenses);
    });
  }
}

// Update filter dropdown with categories
function updateFilterDropdown() {
  const filterSelect = document.getElementById('expenseFilterSelect');
  if (!filterSelect) return;

  const escapeHtml = (str) => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Keep existing selection to restore later if still valid
  const currentValue = filterSelect.value;
  const baseOptions = [
    { value: 'all', text: 'Tất cả' },
    { value: 'today', text: 'Hôm nay' },
    { value: 'week', text: 'Tuần này' },
    { value: 'month', text: 'Tháng này' }
  ];

  let html = baseOptions.map(opt =>
    `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.text)}</option>`
  ).join('');

  // Collect category options from backend categories and current expenses
  const categoryOptions = [];
  const optionValues = new Set();

  const addOption = (value, text) => {
    if (!value || !text) return;
    if (optionValues.has(value)) return;
    optionValues.add(value);
    categoryOptions.push({ value, text });
  };

  if (Array.isArray(allCategories)) {
    allCategories.forEach(cat => {
      if (!cat) return;
      const id = cat.id != null ? String(cat.id) : null;
      const name = cat.name || (id ? `Danh mục ${id}` : null);
      if (id) {
        addOption(`category:${id}`, name);
      } else if (name) {
        addOption(`category-name:${encodeURIComponent(name)}`, name);
      }
    });
  }

  if (Array.isArray(allExpenses)) {
    allExpenses.forEach(expense => {
      if (!expense || expense.type !== 'expense') return;
      const id = expense.categoryId != null ? String(expense.categoryId) : null;
      const name = (expense.categoryName || '').trim();
      if (id) {
        addOption(`category:${id}`, name || `Danh mục ${id}`);
      } else if (name) {
        addOption(`category-name:${encodeURIComponent(name)}`, name);
      } else {
        addOption(`category-name:${encodeURIComponent('Khác')}`, 'Khác');
      }
    });
  }

  // Ensure "Khác" option exists so users can filter uncategorised items
  if (!categoryOptions.some(opt => opt.text === 'Khác')) {
    addOption(`category-name:${encodeURIComponent('Khác')}`, 'Khác');
  }

  // Sort options alphabetically by text for predictable order
  categoryOptions.sort((a, b) => a.text.localeCompare(b.text, 'vi')); 

  if (categoryOptions.length > 0) {
    html += '<optgroup label="Theo danh mục">';
    html += categoryOptions.map(opt => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.text)}</option>`).join('');
    html += '</optgroup>';
  }

  filterSelect.innerHTML = html;

  if (currentValue && Array.from(filterSelect.options).some(opt => opt.value === currentValue)) {
    filterSelect.value = currentValue;
  } else {
    filterSelect.value = 'all';
    currentFilter = 'all';
  }
}

// Highlight category in "Theo hạng mục" section when clicked from "Giao dịch gần đây"
function highlightCategoryInList(categoryName) {
  const categoryList = document.getElementById('categoryList');
  if (!categoryList) return;
  
  // Remove previous highlights
  categoryList.querySelectorAll('li').forEach(li => {
    li.style.background = 'transparent';
    li.style.borderLeft = 'none';
  });
  
  // Find and highlight the matching category
  const categoryItems = categoryList.querySelectorAll('li[data-category-name]');
  categoryItems.forEach(item => {
    const itemCategoryName = item.getAttribute('data-category-name');
    if (itemCategoryName === categoryName || (categoryName === 'Khác' && !itemCategoryName)) {
      item.style.background = '#e0f2fe';
      item.style.borderLeft = '4px solid #2563eb';
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        item.style.background = 'transparent';
        item.style.borderLeft = 'none';
      }, 3000);
    }
  });
}

// ===== Category List Functionality =====
function updateCategoryList(expenses) {
  const categoryList = document.getElementById('categoryList');
  if (!categoryList) return;

  // Calculate expenses by category
  const categoryTotals = {};
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  // Filter expenses for current month only
  const monthExpenses = expenses.filter(e => {
    const expDate = e.date ? e.date.substring(0, 7) : '';
    return expDate === currentMonth && e.type === 'expense';
  });

  monthExpenses.forEach(expense => {
    const catId = expense.categoryId;
    const catName = expense.categoryName || 'Khác';
    // Use categoryId as key, or 'other' if no category
    const key = catId !== null && catId !== undefined ? catId : 'other';

    if (!categoryTotals[key]) {
      categoryTotals[key] = {
        id: catId,
        name: catName,
        total: 0
      };
    }
    categoryTotals[key].total += Math.abs(expense.amount || 0);
  });

  const categories = Object.values(categoryTotals);
  categories.sort((a, b) => b.total - a.total);

  if (categories.length === 0) {
    const emptyState = categoryList.querySelector('.empty-state');
    if (emptyState) {
      emptyState.style.display = '';
    } else {
      categoryList.innerHTML = '<li class="empty-state" style="display:block;text-align:center;padding:20px;color:#94a3b8;border:none">Chưa có dữ liệu</li>';
    }
    return;
  }

  // Hide empty state
  const emptyState = categoryList.querySelector('.empty-state');
  if (emptyState) emptyState.style.display = 'none';

  // Calculate max amount for percentage
  const maxAmount = Math.max(...categories.map(c => c.total), 1);

  categoryList.innerHTML = categories.slice(0, 5).map(cat => {
    const percentage = Math.round((cat.total / maxAmount) * 100);
    const categoryColor = getCategoryColorByName(cat.name);
    return `
      <li style="display:flex;align-items:center;justify-content:space-between;padding:12px;border-bottom:1px solid var(--border);gap:12px;cursor:pointer;transition:background 0.2s" 
          data-category-name="${cat.name}"
          onmouseover="this.style.background='#f1f5f9'"
          onmouseout="this.style.background='transparent'"
          onclick="openCategoryFilterModal('${cat.name}')">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;color:var(--text);margin-bottom:4px">${cat.name}</div>
          <div style="font-size:12px;color:#64748b">${formatCurrency(cat.total)}</div>
        </div>
        <div style="flex:1;max-width:150px;height:8px;background:#eef2f7;border-radius:999px;overflow:hidden">
          <div style="width:${percentage}%;height:100%;background:${categoryColor};transition:width 0.3s"></div>
        </div>
      </li>
    `;
  }).join('');
}

// ===== Quick Expense Input Handler =====
function parseExpenseInput(inputText) {
  // Parse input like "Cà phê 10000" or "Cà phê 10,000" or "10000 Cà phê"
  inputText = inputText.trim();
  if (!inputText) return null;

  // Remove commas and spaces, then extract number
  const cleanText = inputText.replace(/,/g, '');

  // Try to find number at the end (e.g., "Cà phê 10000")
  let match = cleanText.match(/^(.+?)\s+(\d+)$/);
  if (match) {
    return {
      note: match[1].trim(),
      amount: parseFloat(match[2])
    };
  }

  // Try to find number at the beginning (e.g., "10000 Cà phê")
  match = cleanText.match(/^(\d+)\s+(.+)$/);
  if (match) {
    return {
      note: match[2].trim(),
      amount: parseFloat(match[1])
    };
  }

  // If only number, use default note
  const onlyNumber = parseFloat(cleanText);
  if (!isNaN(onlyNumber) && onlyNumber > 0) {
    return {
      note: 'Chi tiêu',
      amount: onlyNumber
    };
  }

  return null;
}

async function handleQuickAddExpense() {
  const input = document.getElementById('quickExpenseInput');
  const btn = document.getElementById('quickExpenseBtn');

  if (!input || !btn) return;

  const inputText = input.value.trim();
  if (!inputText) {
    // Show error message
    const originalText = btn.textContent;
    btn.textContent = 'Nhập chi tiêu!';
    btn.style.backgroundColor = '#ef4444';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.backgroundColor = '';
    }, 2000);
    return;
  }

  // Parse input
  const parsed = parseExpenseInput(inputText);
  if (!parsed || !parsed.amount || parsed.amount <= 0) {
    const originalText = btn.textContent;
    btn.textContent = 'Sai định dạng!';
    btn.style.backgroundColor = '#ef4444';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.backgroundColor = '';
    }, 2000);
    return;
  }

  // Disable button and show loading
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Đang thêm...';

  try {
    const auth = checkAuth();
    if (!auth) {
      throw new Error('Vui lòng đăng nhập lại');
    }

    // Lấy ngày từ server để đảm bảo đúng ngày
    let today;
    if (typeof window.getCurrentDateFromServer === 'function') {
      today = await window.getCurrentDateFromServer();
    } else {
      // Fallback nếu helper không có
      today = new Date().toISOString().split('T')[0];
    }

    // Create expense data
    const expenseData = {
      date: today,
      amount: -Math.abs(parsed.amount), // Negative for expense
      type: 'expense',
      categoryId: null,
      note: parsed.note
    };

    // Send to API
    const result = await apiRequest('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(expenseData)
    });

    if (!result || !result.ok) {
      const errorMsg = result?.data?.message || 'Lỗi khi thêm chi tiêu';
      throw new Error(errorMsg);
    }

    // Clear input
    input.value = '';

    // Show success
    btn.textContent = '✓ Đã thêm!';
    btn.style.backgroundColor = '#10b981';

    // Quick update UI immediately (real-time)
    // Use API response if available, otherwise use parsed data
    const expenseResponse = result.data;
    let displayExpense;

    if (expenseResponse && expenseResponse.id) {
      // Use API response (preferred) - ensure amount is positive for display
      displayExpense = {
        id: expenseResponse.id,
        userId: expenseResponse.userId,
        date: expenseResponse.date || today,
        amount: Math.abs(expenseResponse.amount || parsed.amount), // Always positive for display
        type: expenseResponse.type || 'expense',
        categoryId: expenseResponse.categoryId || null,
        note: expenseResponse.note || parsed.note || 'Chi tiêu',
        categoryName: expenseResponse.categoryName || null
      };
      console.log('✅ Using API response expense:', displayExpense);
    } else {
      // Fallback: use parsed data with temporary ID
      displayExpense = {
        id: Date.now(), // Temporary ID until reload
        userId: null,
        date: today,
        amount: Math.abs(parsed.amount),
        type: 'expense',
        categoryId: null,
        note: parsed.note || 'Chi tiêu',
        categoryName: null
      };
      console.warn('⚠️ Using fallback expense data, API response:', expenseResponse);
    }

    console.log('🔄 Quick updating UI with expense:', displayExpense);
    await quickUpdateUIWithNewExpense(displayExpense);

    // Notify expense added (this handles cross-tab sync via localStorage)
    notifyExpenseAdded();

    // Dispatch event for same-page updates (works in same tab)
    // Note: quickUpdated flag tells listeners that UI was already updated, no need to reload
    window.dispatchEvent(new CustomEvent('expenseAdded', {
      detail: {
        expense: displayExpense,
        quickUpdated: true  // Flag để listeners biết UI đã được update rồi
      }
    }));

    // Also broadcast via BroadcastChannel for same-origin cross-tab communication (faster than storage events)
    // This is mainly for OTHER tabs, not the current tab (which already got quick update)
    if (window.expenseBroadcastChannel) {
      try {
        window.expenseBroadcastChannel.postMessage({
          type: 'expenseAdded',
          expense: displayExpense,
          timestamp: Date.now(),
          fromCurrentTab: true  // Flag để tránh reload ở chính tab này
        });
      } catch (e) {
        console.warn('BroadcastChannel not available:', e);
      }
    }

    // Reload dashboard data in background to sync with server (after quick update)
    // Delay longer to ensure server has processed the new expense and avoid duplicate reloads
    setTimeout(() => {
      reloadDashboardData().catch(err => {
        console.warn('Background reload error (non-critical):', err);
      });
    }, 1500);

    // Reset button after delay
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.backgroundColor = '';
      btn.disabled = false;
    }, 1500);

  } catch (error) {
    console.error('Error adding expense:', error);

    // Show error
    btn.textContent = 'Lỗi!';
    btn.style.backgroundColor = '#ef4444';

    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.backgroundColor = '';
      btn.disabled = false;
    }, 2000);

    // Show error message (optional - you can use toast if available)
    alert('Lỗi: ' + (error.message || 'Không thể thêm chi tiêu. Vui lòng thử lại.'));
  }
}

function initQuickExpenseInput() {
  const input = document.getElementById('quickExpenseInput');
  const btn = document.getElementById('quickExpenseBtn');

  if (!input || !btn) return;

  // Handle button click
  btn.addEventListener('click', handleQuickAddExpense);

  // Handle Enter key
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleQuickAddExpense();
    }
  });
}

// ===== Chart Functionality =====
let chartPeriod = 10;
let chartData = [];

async function loadChartData() {
  try {
    const result = await apiRequest(`/api/expenses/stats?period=${chartPeriod}&groupBy=day`);
    if (result && result.ok) {
      chartData = result.data.items || [];
      renderChart();
    }
  } catch (error) {
    console.error('Error loading chart data:', error);
  }
}

function renderChart() {
  const chartContainer = document.getElementById('expenseChart');
  if (!chartContainer) return;

  if (chartData.length === 0) {
    const emptyState = chartContainer.querySelector('.empty-state');
    if (emptyState) {
      emptyState.style.display = 'block';
    } else {
      chartContainer.innerHTML = '<div class="empty-state" style="display:block;text-align:center;padding:40px;color:#94a3b8">Chưa có dữ liệu chi tiêu</div>';
    }
    return;
  }

  // Hide empty state
  const emptyState = chartContainer.querySelector('.empty-state');
  if (emptyState) emptyState.style.display = 'none';

  // Find max amount for scaling
  const maxAmount = Math.max(...chartData.map(d => d.amount), 1);

  // Render bars
  chartContainer.innerHTML = chartData.map(item => {
    const heightPercent = maxAmount > 0 ? Math.max((item.amount / maxAmount) * 100, 5) : 5;
    return `
      <div class="bar" style="height: ${heightPercent}%" title="${item.date}: ${formatCurrency(item.amount)}">
        <div style="position:absolute;bottom:100%;left:50%;transform:translateX(-50%);font-size:10px;color:#64748b;margin-bottom:4px;white-space:nowrap">
          ${item.amount > 0 ? formatCurrency(item.amount) : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Chart period selector
function initChartPeriodSelector() {
  const chartPeriodSelect = document.getElementById('chartPeriod');
  if (chartPeriodSelect) {
    chartPeriodSelect.addEventListener('change', (e) => {
      chartPeriod = parseInt(e.target.value) || 10;
      loadChartData();
    });
  }
}

// ===== Table Filter Functionality (legacy, kept for compatibility) =====
function initTableFilter() {
  // This is now handled by initSearchAndFilter
  // Keeping for backward compatibility
  initSearchAndFilter();
}

// ===== Chatbox Functionality =====
let chatInitialized = false;
let greeted = false;

function initChatbox() {
  // Tránh khởi tạo chat ở nhiều nơi
  if (window.__INLINE_CHAT || chatInitialized) return;
  chatInitialized = true;
  window.__INLINE_CHAT = true;

  const chatToggle = document.getElementById('chatToggle');
  const chatbox = document.getElementById('chatbox');
  const chatBody = document.getElementById('chatBody');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');

  if (!chatToggle || !chatbox || !chatBody || !chatInput || !sendBtn) {
    console.log('Chat elements not found');
    return;
  }

  function openChat() {
    chatbox.classList.add('open');
    chatbox.setAttribute('aria-hidden', 'false');
    if (!greeted) {
      botSay('Tôi là trợ lý SmartExpense. Bạn có thể nhờ tôi tạo chi tiêu, xem báo cáo, hoặc hỏi mẹo sử dụng.');
      greeted = true;
    }
    setTimeout(() => chatInput.focus(), 100);
  }

  function closeChat() {
    chatbox.classList.remove('open');
    chatbox.setAttribute('aria-hidden', 'true');
  }

  function scrollBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function addMsg(text, who = 'bot') {
    const wrap = document.createElement('div');
    wrap.className = `msg ${who}`;
    const avatar = document.createElement('div');
    avatar.className = 'avatar-s';
    avatar.textContent = who === 'bot' ? '🐷' : '👤';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerText = text;
    if (who === 'bot') {
      wrap.append(avatar, bubble);
    } else {
      wrap.append(bubble, avatar);
    }
    chatBody.appendChild(wrap);
    scrollBottom();
  }

  function addTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'msg bot';
    wrap.dataset.typing = '1';
    wrap.innerHTML = `<div class="avatar-s">🐷</div>
      <div class="bubble"><span class="typing"><span></span><span></span><span></span></span></div>`;
    chatBody.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function botSay(text, delay = 0) {
    const t = addTyping();
    setTimeout(() => {
      t.remove();
      addMsg(text, 'bot');
    }, Math.max(300, delay));
  }

  function handleSend() {
    const txt = chatInput.value.trim();
    if (!txt) return;
    addMsg(txt, 'user');
    chatInput.value = '';
    const say = txt.toLowerCase();
    if (say.includes('tạo') && (say.includes('tháng') || say.includes('thang'))) {
      botSay('Đang tạo câu trả lời dựa theo yêu cầu…', 900);
      setTimeout(() => botSay('Tôi đã tạo thành công chi tiêu tiếp theo của tháng sau. Bạn hãy kiểm tra ở mục Danh sách chi tiêu.', 1200), 1100);
    } else {
      botSay('Mình đã nhận được yêu cầu. Bạn muốn mình làm gì tiếp theo?');
    }
  }

  // Event listeners
  chatToggle.addEventListener('click', () => {
    if (chatbox.classList.contains('open')) closeChat(); else openChat();
  });

  sendBtn.addEventListener('click', handleSend);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });
}

// ===== Logout Link Handler =====
function initLogoutHandler() {
  document.addEventListener('click', async function (e) {
    const link = e.target && e.target.closest && e.target.closest('a[href="login.html"]');
    if (!link) return;
    e.preventDefault();

    // Use global logout function which handles sync properly
    if (typeof window.logout === 'function') {
      await window.logout();
    } else {
      // Fallback if logout function not available
      // Sync data before logout
      if (window.dataManager && typeof window.dataManager.syncAllDataToAPI === 'function') {
        try {
          console.log('🔄 Syncing data before logout...');
          const syncPromise = window.dataManager.syncAllDataToAPI();
          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 10000));
          await Promise.race([syncPromise, timeoutPromise]);
          console.log('✅ Data sync completed before logout');
        } catch (error) {
          console.error('❌ Error syncing before logout:', error);
        }
      }

      try {
        localStorage.removeItem('smartexpense_user');
        localStorage.removeItem('smartexpense_token');
      } catch (_) { }
      window.location.href = 'login.html';
    }
  });
}

// Expose reload function globally for realtime updates
window.reloadDashboard = reloadDashboardData;
// Alias for compatibility with callers expecting reloadDashboardData
window.reloadDashboardData = reloadDashboardData;

// ===== Date Change Detector =====
// Tự động cập nhật khi đồng hồ chuyển qua 00:00 (nửa đêm)
let dateChangeDetector = null;
let currentTrackedDate = null;

function initDateChangeDetector() {
  // Lưu ngày hiện tại
  const today = new Date();
  currentTrackedDate = today.toISOString().split('T')[0];
  console.log('📅 Tracking date:', currentTrackedDate);

  // Hàm kiểm tra ngày thay đổi
  function checkDateChange() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Nếu ngày đã thay đổi (qua nửa đêm)
    if (todayStr !== currentTrackedDate) {
      console.log('🔄 Date changed detected!', currentTrackedDate, '->', todayStr);
      currentTrackedDate = todayStr;

      // Reload toàn bộ dữ liệu để cập nhật UI
      reloadDashboardData();

      // Cập nhật filter nếu đang chọn "Hôm nay"
      const filterSelect = document.getElementById('expenseFilterSelect');
      if (filterSelect && filterSelect.value === 'today') {
        // Trigger filter update để refresh danh sách giao dịch
        updateRecentExpenses(allExpenses);
      }

      // Hiển thị thông báo nhẹ nhàng (tùy chọn)
      console.log('✅ Dashboard updated for new day:', todayStr);
    }
  }

  // Tính toán thời gian đến nửa đêm tiếp theo và set timeout chính xác
  function scheduleNextMidnightCheck() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Set timeout để check ngay khi đến nửa đêm
    setTimeout(() => {
      checkDateChange();
      // Sau khi check xong, schedule lại cho nửa đêm tiếp theo
      scheduleNextMidnightCheck();
    }, msUntilMidnight);

    console.log(`⏰ Scheduled next date check at midnight (in ${Math.round(msUntilMidnight / 1000 / 60)} minutes)`);
  }

  // Schedule check đầu tiên
  scheduleNextMidnightCheck();

  // Kiểm tra mỗi phút để phát hiện khi ngày thay đổi (backup, phòng khi timeout bị miss)
  // (Kiểm tra mỗi phút đủ để catch khi qua nửa đêm)
  dateChangeDetector = setInterval(checkDateChange, 60000); // 60 giây

  // Kiểm tra ngay lập tức khi trang được focus lại (khi user quay lại tab)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkDateChange();
    }
  });

  // Kiểm tra khi window được focus
  window.addEventListener('focus', checkDateChange);

  console.log('✅ Date change detector initialized');
}

function stopDateChangeDetector() {
  if (dateChangeDetector) {
    clearInterval(dateChangeDetector);
    dateChangeDetector = null;
    console.log('🛑 Date change detector stopped');
  }
}

// Initialize dashboard
async function initDashboard() {
  await loadUserData();
  loadDashboardData();

  // Load and display avatar
  await loadHomeAvatar();
  setupAvatarUpdateListener();

  // Initialize date change detector
  initDateChangeDetector();

  // Initialize BroadcastChannel for fast cross-tab communication
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      window.expenseBroadcastChannel = new BroadcastChannel('smartexpense_updates');
      window.expenseBroadcastChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'expenseAdded') {
          // Skip nếu message đến từ chính tab này (đã được quick update rồi)
          if (event.data.fromCurrentTab) {
            console.log('⏭️ BroadcastChannel: Skipping - expense from current tab (already updated)');
            return;
          }
          console.log('📡 BroadcastChannel: Expense added in another tab, reloading...');
          // Sử dụng debounced reload
          reloadDashboardData();
        }
      };
      console.log('✅ BroadcastChannel initialized for cross-tab sync');
    }
  } catch (e) {
    console.warn('BroadcastChannel not available:', e);
  }

  // Initialize additional features
  initTableFilter();
  initSearchAndFilter();
  initChartPeriodSelector();
  initChatbox();
  initLogoutHandler();
  initQuickExpenseInput();
  initCategoryModal();
  initIncomeAndBudgetModals();

  // Make logout function globally available
  window.logout = logout;

  // Listen for expense updates from other pages
  window.addEventListener('storage', async (e) => {
    if (e.key === 'smartexpense_expense_added') {
      // Sử dụng debounced reload
      reloadDashboardData();
    }
    // Listen for profile updates (balance changes) from other pages
    if (e.key === 'smartexpense_profile_updated') {
      console.log('Profile updated (storage event), reloading dashboard...');

      // Lấy balance từ localStorage nếu có
      const balanceUpdated = localStorage.getItem('smartexpense_balance_updated');
      if (balanceUpdated) {
        const balanceValue = parseFloat(balanceUpdated);
        console.log('💰 Updating balance from storage:', balanceValue);

        // Cập nhật localStorage
        const currentUser = checkAuth();
        if (currentUser && currentUser.user) {
          currentUser.user.balance = balanceValue;
          currentUser.user.monthly_budget = balanceValue;
          localStorage.setItem('smartexpense_user', JSON.stringify(currentUser.user));
          localStorage.setItem('monthly_budget', String(balanceValue));
        }

        // Cập nhật UI ngay lập tức
        const balanceAmount = document.getElementById('balanceAmount');
        if (balanceAmount) {
          balanceAmount.textContent = formatCurrency(balanceValue);
          balanceAmount.style.color = '#10b981';
        }
      }

      // Reload toàn bộ dữ liệu từ API (sử dụng debounced reload)
      reloadDashboardData();
    }
  });

  // Listen for custom events (for same-page updates)
  // Skip reload if expense was already quick-updated (to avoid duplicate reloads)
  window.addEventListener('expenseAdded', (event) => {
    if (event.detail && event.detail.quickUpdated) {
      console.log('⏭️ Skipping reload - expense already quick-updated');
      return; // UI đã được update rồi, không cần reload
    }
    // Chỉ reload nếu expense đến từ nguồn khác (ví dụ: từ code khác, chưa được quick update)
    console.log('🔄 Reloading dashboard - expense from external source');
    // Sử dụng debounced reload
    reloadDashboardData();
  });

  /**
   * @brief Lắng nghe sự kiện cập nhật hồ sơ để hiển thị ngay số tiền đã lưu trên trang chủ
   * @note Sự kiện 'profileUpdated' được phát từ hoso.js sau khi người dùng lưu hồ sơ.
   *       Tại đây ta: (1) đồng bộ localStorage, (2) cập nhật phần tử #balanceAmount trên UI.
   *       Nếu chưa có #balanceAmount trong DOM, sẽ tạo tối giản để đảm bảo hiển thị.
   */
  window.addEventListener('profileUpdated', async (event) => {
    console.log('Profile updated event received, updating dashboard...', event);

    // Lấy balance từ event detail nếu có
    const balanceFromEvent = event.detail?.balance;
    if (balanceFromEvent !== undefined) {
      console.log('💰 Updating balance from event:', balanceFromEvent);
      // Cập nhật localStorage trước
      const currentUser = checkAuth();
      if (currentUser && currentUser.user) {
        currentUser.user.balance = balanceFromEvent;
        currentUser.user.monthly_budget = balanceFromEvent;
        localStorage.setItem('smartexpense_user', JSON.stringify(currentUser.user));
        localStorage.setItem('monthly_budget', String(balanceFromEvent));
      }

      // Cập nhật UI ngay lập tức
      let balanceAmount = document.getElementById('balanceAmount');
      if (!balanceAmount) {
        // Nếu phần tử hiển thị chưa tồn tại, tạo nhanh để đảm bảo người dùng thấy số tiền đã lưu
        balanceAmount = document.createElement('span');
        balanceAmount.id = 'balanceAmount';
        balanceAmount.style.marginLeft = '4px';
        // Gắn vào body như một fallback tối giản; dự án có thể thay thế bằng khu vực UI phù hợp
        document.body.appendChild(balanceAmount);
      }
      balanceAmount.textContent = formatCurrency(balanceFromEvent);
      balanceAmount.style.color = '#10b981';

      // Tính lại số tiền còn lại = balance - chi tiêu THÁNG
      let monthlyExpenseForEvent = 0;
      if (allExpenses.length > 0) {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthExpenses = allExpenses.filter(e => {
          const expMonth = e.date ? e.date.substring(0, 7) : '';
          return expMonth === currentMonth && e.type === 'expense';
        });
        monthlyExpenseForEvent = monthExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      } else {
        // Fallback: lấy từ monthlyExpenseInput nếu có
        const monthlyExpenseInput = document.getElementById('monthlyExpenseInput');
        if (monthlyExpenseInput && monthlyExpenseInput.value) {
          const monthlyExpenseStr = monthlyExpenseInput.value.replace(/[^\d.-]/g, '');
          monthlyExpenseForEvent = parseFloat(monthlyExpenseStr) || 0;
        }
      }

      // Tính remaining = balance - monthlyExpense
      // Allow negative to show when budget is exceeded
      const remaining = balanceFromEvent - monthlyExpenseForEvent;
      console.log('💰 Calculating remaining:', balanceFromEvent, '-', monthlyExpenseForEvent, '=', remaining);

      // Cập nhật remainingBudgetInput (số tiền còn lại)
      const remainingBudgetInput = document.getElementById('remainingBudgetInput');
      if (remainingBudgetInput) {
        remainingBudgetInput.value = formatCurrency(remaining);
        // Cập nhật màu sắc
        if (remaining < 0) {
          remainingBudgetInput.style.color = '#ef4444'; // Red if negative
        } else if (remaining < balanceFromEvent * 0.2) {
          remainingBudgetInput.style.color = '#f59e0b'; // Orange if less than 20% left
        } else {
          remainingBudgetInput.style.color = '#10b981'; // Green if OK
        }
        console.log('✅ Updated remainingBudgetInput:', formatCurrency(remaining));
      } else {
        console.warn('⚠️ remainingBudgetInput element not found!');
      }
    }

    // Reload toàn bộ dữ liệu từ API để đảm bảo đồng bộ
    reloadDashboardData();
  });

  console.log('Dashboard initialized with all features');
}

// Load avatar from localStorage and display on home page
async function loadHomeAvatar() {
  try {
    const userData = localStorage.getItem('smartexpense_user');
    if (!userData) {
      // Nếu không có user data, ẩn avatar
      hideHomeAvatar();
      return;
    }

    const user = JSON.parse(userData);

    // Ưu tiên 1: Avatar từ localStorage (đã upload)
    if (user.avatar) {
      displayHomeAvatar(user.avatar);
      return;
    }

    // Ưu tiên 2: Avatar từ API (avatar_url từ Google hoặc đã lưu)
    if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
      try {
        const meResult = await window.apiRequest('/api/me');
        if (meResult && meResult.ok && meResult.data) {
          const profile = meResult.data;

          // Nếu có avatar_url từ API (Google avatar hoặc đã upload lên server)
          if (profile.avatar_url) {
            // Load avatar từ URL
            const avatarImage = document.getElementById('homeAvatarImage');
            const avatarPlaceholder = document.getElementById('homeAvatarPlaceholder');
            if (avatarImage && avatarPlaceholder) {
              avatarImage.src = profile.avatar_url;
              avatarImage.style.display = 'block';
              avatarPlaceholder.style.display = 'none';
              // Lưu vào localStorage để dùng lại
              user.avatar = profile.avatar_url;
              localStorage.setItem('smartexpense_user', JSON.stringify(user));
              return;
            }
          }
        }
      } catch (error) {
        console.warn('Không thể tải avatar từ API:', error);
      }
    }

    // Nếu không có avatar nào (chưa upload), ẩn avatar
    hideHomeAvatar();

  } catch (error) {
    console.warn('Lỗi khi tải avatar trên trang chủ:', error);
    // Nếu có lỗi, ẩn avatar
    hideHomeAvatar();
  }
}

// Hide avatar when user hasn't uploaded one
function hideHomeAvatar() {
  const avatarImage = document.getElementById('homeAvatarImage');
  const avatarPlaceholder = document.getElementById('homeAvatarPlaceholder');
  const avatarContainer = document.getElementById('homeAvatar');

  if (avatarImage) {
    avatarImage.src = '';
    avatarImage.style.display = 'none';
  }

  if (avatarPlaceholder) {
    avatarPlaceholder.textContent = '';
    avatarPlaceholder.style.display = 'none';
  }

  // Ẩn toàn bộ container avatar khi chưa có avatar
  if (avatarContainer) {
    avatarContainer.style.display = 'none';
  }
}

// Display avatar on home page
function displayHomeAvatar(imageDataUrl) {
  const avatarImage = document.getElementById('homeAvatarImage');
  const avatarPlaceholder = document.getElementById('homeAvatarPlaceholder');
  const avatarContainer = document.getElementById('homeAvatar');

  // Hiển thị container avatar
  if (avatarContainer) {
    avatarContainer.style.display = '';
  }

  if (avatarImage && avatarPlaceholder) {
    avatarImage.src = imageDataUrl;
    avatarImage.style.display = 'block';
    avatarPlaceholder.style.display = 'none';
  }
}

// Setup listener for avatar updates
function setupAvatarUpdateListener() {
  // Listen for storage events
  window.addEventListener('storage', function (e) {
    if (e.key === 'smartexpense_user' || e.key === 'smartexpense_avatar_updated') {
      loadHomeAvatar();
    }
  });

  // Listen for BroadcastChannel messages
  if (typeof BroadcastChannel !== 'undefined') {
    if (!window.avatarBroadcastChannel) {
      window.avatarBroadcastChannel = new BroadcastChannel('smartexpense_avatar_channel');
    }
    window.avatarBroadcastChannel.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'avatarUpdated') {
        if (e.data.avatar) {
          displayHomeAvatar(e.data.avatar);
        } else {
          // Hide avatar if avatar is removed
          hideHomeAvatar();
        }
      }
    });
  }

  // Also listen for custom events (for same-tab updates)
  window.addEventListener('avatarUpdated', function (e) {
    if (e.detail && e.detail.avatar) {
      displayHomeAvatar(e.detail.avatar);
    } else {
      loadHomeAvatar(); // Reload to check if avatar was removed
    }
  });
}

// ===== Category Selection Modal =====
let currentExpenseId = null;

// Category mapping: frontend category -> backend category name
const categoryMap = {
  'food': 'Ăn uống',
  'play': 'Chơi',
  'fixed': 'Cố định',
  'other': 'Khác'
};

// Open category selection modal
function openCategoryModal(expenseId) {
  currentExpenseId = expenseId;
  const modal = document.getElementById('categoryModal');
  if (modal) {
    modal.classList.add('open');

    // Find current category for this expense
    const expense = allExpenses.find(e => e.id == expenseId);
    if (expense && expense.categoryName) {
      // Highlight current category
      const categoryOptions = modal.querySelectorAll('.category-option');
      categoryOptions.forEach(option => {
        option.classList.remove('selected');
        const categoryName = option.getAttribute('data-name');
        if (categoryName === expense.categoryName) {
          option.classList.add('selected');
        }
      });
    }
  }
}

// Close category modal
function closeCategoryModal() {
  const modal = document.getElementById('categoryModal');
  if (modal) {
    modal.classList.remove('open');
    // Reset filter mode
    modal.removeAttribute('data-filter-mode');
    modal.removeAttribute('data-filter-category');
    // Reset title
    const title = modal.querySelector('.category-modal-title');
    if (title) {
      title.textContent = 'Chọn hạng mục';
    }
  }
  currentExpenseId = null;
}

// Handle category selection
async function selectCategory(categoryKey, categoryName) {
  // Check if in filter mode (changing category for multiple expenses)
  const modal = document.getElementById('categoryModal');
  const isFilterMode = modal && modal.getAttribute('data-filter-mode') === 'true';
  const oldCategoryName = modal ? modal.getAttribute('data-filter-category') : null;

  if (!isFilterMode && !currentExpenseId) return;

  try {
    if (isFilterMode && oldCategoryName) {
      // Change category for ALL expenses with oldCategoryName
      const expensesToUpdate = allExpenses.filter(e => e.categoryName === oldCategoryName && e.type === 'expense');
      
      if (expensesToUpdate.length === 0) {
        alert('Không tìm thấy chi tiêu nào cho hạng mục này');
        closeCategoryModal();
        return;
      }

      // Get category ID
      let categoryId = null;
      try {
        const categoriesResult = await apiRequest('/api/categories');
        if (categoriesResult && categoriesResult.ok && categoriesResult.data && categoriesResult.data.items) {
          const existingCategory = categoriesResult.data.items.find(cat => cat.name === categoryName);
          if (existingCategory) {
            categoryId = existingCategory.id;
          } else {
            // Create new category
            const createResult = await apiRequest('/api/categories', {
              method: 'POST',
              body: JSON.stringify({
                name: categoryName,
                color: getCategoryColor(categoryKey)
              })
            });
            if (createResult && createResult.ok && createResult.data) {
              categoryId = createResult.data.id;
              if (allCategories) {
                allCategories.push(createResult.data);
              }
            }
          }
        }
      } catch (error) {
        console.warn('Error handling category:', error);
      }

      // Update all expenses with old category to new category
      let updateCount = 0;
      for (const expense of expensesToUpdate) {
        try {
          const updateResult = await apiRequest(`/api/expenses/${expense.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              categoryId: categoryId,
              categoryName: categoryName
            })
          });

          if (updateResult && updateResult.ok) {
            // Update in allExpenses
            const expenseIndex = allExpenses.findIndex(e => e.id == expense.id);
            if (expenseIndex >= 0) {
              allExpenses[expenseIndex].categoryId = categoryId;
              allExpenses[expenseIndex].categoryName = categoryName;
            }
            updateCount++;
          }
        } catch (error) {
          console.error(`Error updating expense ${expense.id}:`, error);
        }
      }

      // Update UI
      updateRecentExpenses(allExpenses);
      updateCategoryList(allExpenses);
      updateFilterDropdown();
      alert(`Đã cập nhật ${updateCount} chi tiêu từ "${oldCategoryName}" sang "${categoryName}"`);
      closeCategoryModal();
    } else {
      // Original behavior: change category for single expense
      if (!currentExpenseId) return;

      // Find expense in allExpenses
      const expense = allExpenses.find(e => e.id == currentExpenseId);
      if (!expense) {
        console.error('Expense not found:', currentExpenseId);
        return;
      }

      // First, check if category exists in database, if not create it
      let categoryId = null;
      try {
        // Try to find existing category
        const categoriesResult = await apiRequest('/api/categories');
        if (categoriesResult && categoriesResult.ok && categoriesResult.data && categoriesResult.data.items) {
          const existingCategory = categoriesResult.data.items.find(cat => cat.name === categoryName);
          if (existingCategory) {
            categoryId = existingCategory.id;
          } else {
            // Create new category
            const createResult = await apiRequest('/api/categories', {
              method: 'POST',
              body: JSON.stringify({
                name: categoryName,
                color: getCategoryColor(categoryKey)
              })
            });
            if (createResult && createResult.ok && createResult.data) {
              categoryId = createResult.data.id;
              // Update allCategories array
              if (allCategories) {
                allCategories.push(createResult.data);
              }
            }
          }
        }
      } catch (error) {
        console.warn('Error handling category:', error);
      }

      // Update expense with category
      const updateResult = await apiRequest(`/api/expenses/${currentExpenseId}`, {
        method: 'PUT',
        body: JSON.stringify({
          categoryId: categoryId,
          categoryName: categoryName
        })
      });

      if (updateResult && updateResult.ok) {
        // Update expense in allExpenses array
        const expenseIndex = allExpenses.findIndex(e => e.id == currentExpenseId);
        if (expenseIndex >= 0) {
          allExpenses[expenseIndex].categoryId = categoryId;
          allExpenses[expenseIndex].categoryName = categoryName;
        }

        // Update UI
        updateRecentExpenses(allExpenses);
        updateCategoryList(allExpenses);
        updateFilterDropdown();

        // Close modal
        closeCategoryModal();
      } else {
        throw new Error(updateResult?.data?.message || 'Lỗi khi cập nhật hạng mục');
      }
    }
  } catch (error) {
    console.error('Error updating category:', error);
    alert('Lỗi: ' + (error.message || 'Không thể cập nhật hạng mục. Vui lòng thử lại.'));
  }
}

// Get category color based on category key
function getCategoryColor(categoryKey) {
  const colorMap = {
    'food': '#ff6b6b',
    'play': '#4ecdc4',
    'fixed': '#ffe66d',
    'other': '#95a5a6'
  };
  return colorMap[categoryKey] || '#95a5a6';
}

// Get category color based on category name
function getCategoryColorByName(categoryName) {
  const nameColorMap = {
    'Ăn uống': '#ff6b6b',
    'Chơi': '#4ecdc4',
    'Cố định': '#ffe66d',
    'Khác': '#95a5a6'
  };
  return nameColorMap[categoryName] || '#2563eb';
}

// Open category filter modal (when clicking on a category in "Theo hạng mục")
function openCategoryFilterModal(selectedCategoryName) {
  // Store selected category to filter expenses
  window.selectedCategoryFilter = selectedCategoryName;
  
  // Open the modal to select new category
  const modal = document.getElementById('categoryModal');
  if (modal) {
    modal.classList.add('open');
    modal.setAttribute('data-filter-mode', 'true');
    modal.setAttribute('data-filter-category', selectedCategoryName);
    
    // Update modal title
    const title = modal.querySelector('.category-modal-title');
    if (title) {
      title.textContent = `Thay đổi hạng mục "${selectedCategoryName}" thành`;
    }
  }
}

// Initialize category modal
function initCategoryModal() {
  const modal = document.getElementById('categoryModal');
  if (!modal) return;

  // Close modal when clicking outside
  modal.addEventListener('click', function (e) {
    if (e.target === modal) {
      closeCategoryModal();
    }
  });

  // Handle category option clicks
  const categoryOptions = modal.querySelectorAll('.category-option');
  categoryOptions.forEach(option => {
    option.addEventListener('click', function () {
      const categoryKey = this.getAttribute('data-category');
      const categoryName = this.getAttribute('data-name');
      selectCategory(categoryKey, categoryName);
    });
  });

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeCategoryModal();
    }
  });
}

// ========== INCOME DETAIL MODAL ==========
function openIncomeDetailModal() {
  const modal = document.getElementById('incomeDetailModal');
  if (!modal) {
    console.error('Income detail modal not found');
    return;
  }

  modal.classList.add('open');
  loadIncomeDetailData();
}

function closeIncomeDetailModal() {
  const modal = document.getElementById('incomeDetailModal');
  if (modal) {
    modal.classList.remove('open');
  }
}

// Format date helper function
function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateString;
  }
}

async function loadIncomeDetailData() {
  try {
    const currentUser = checkAuth();
    if (!currentUser) {
      console.error('User not authenticated');
      return;
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    // Get all expenses (including income) using apiRequest
    let allExpenses = [];

    // Try API first (with cookie authentication for Google login)
    if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
      try {
        const expensesResult = await window.apiRequest('/api/expenses');
        if (expensesResult && expensesResult.ok && expensesResult.data && expensesResult.data.items) {
          allExpenses = expensesResult.data.items;
          console.log(`✅ Loaded ${allExpenses.length} expenses from API for income detail`);
        } else {
          console.warn('API expenses load failed, trying fallback:', expensesResult);
          // Fallback to DataManager or localStorage
          if (window.dataManager && window.dataManager.data && window.dataManager.data.expenses) {
            allExpenses = window.dataManager.data.expenses;
            console.log(`✅ Using ${allExpenses.length} expenses from DataManager cache`);
          }
        }
      } catch (apiError) {
        console.error('Error fetching expenses from API:', apiError);
        // Fallback to DataManager or localStorage
        if (window.dataManager && window.dataManager.data && window.dataManager.data.expenses) {
          allExpenses = window.dataManager.data.expenses;
          console.log(`✅ Using ${allExpenses.length} expenses from DataManager cache (fallback)`);
        }
      }
    } else {
      // apiRequest not available, use DataManager or localStorage
      console.warn('apiRequest not available, using DataManager or localStorage');
      if (window.dataManager && window.dataManager.data && window.dataManager.data.expenses) {
        allExpenses = window.dataManager.data.expenses;
      } else {
        // Last resort: try localStorage
        try {
          const dataManagerData = localStorage.getItem('smartexpense_data');
          if (dataManagerData) {
            const parsed = JSON.parse(dataManagerData);
            allExpenses = parsed.expenses || [];
          }
        } catch (e) {
          console.error('Error loading from localStorage:', e);
        }
      }
    }

    // If still no data, show empty state
    if (!Array.isArray(allExpenses) || allExpenses.length === 0) {
      console.log('No expenses data available, showing empty state');
      allExpenses = [];
    }

    // Filter income for current month
    const currentMonthIncomes = allExpenses.filter(e => {
      const expDate = e.date ? e.date.substring(0, 7) : '';
      return expDate === currentMonthStr && e.type === 'income';
    });

    // Calculate total income
    const totalIncome = currentMonthIncomes.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);

    // Get income for last 6 months for trend chart
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1 - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;

      const monthIncomes = allExpenses.filter(e => {
        const expDate = e.date ? e.date.substring(0, 7) : '';
        return expDate === monthStr && e.type === 'income';
      });

      const monthTotal = monthIncomes.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      last6Months.push({
        month: monthStr,
        label: `${month}/${year}`,
        amount: monthTotal
      });
    }

    // Update modal content
    const totalElement = document.getElementById('incomeDetailTotal');
    const listElement = document.getElementById('incomeDetailList');
    const chartElement = document.getElementById('incomeTrendChart');

    if (totalElement) {
      totalElement.textContent = formatCurrency(totalIncome);
    }

    if (listElement) {
      if (currentMonthIncomes.length === 0) {
        listElement.innerHTML = '<li class="empty-state" style="text-align:center;padding:20px;color:#94a3b8">Chưa có thu nhập trong tháng này</li>';
      } else {
        listElement.innerHTML = currentMonthIncomes
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .map(income => `
            <li style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid #e5e7eb">
              <div>
                <div style="font-weight:600;margin-bottom:4px">${income.note || 'Không có mô tả'}</div>
                <div style="font-size:12px;color:#94a3b8">${formatDate(income.date)}</div>
              </div>
              <div style="font-weight:700;color:#10b981">${formatCurrency(Math.abs(income.amount || 0))}</div>
            </li>
          `).join('');
      }
    }

    // Draw trend chart
    if (chartElement) {
      drawIncomeTrendChart(chartElement, last6Months);
    }

  } catch (error) {
    console.error('Error loading income detail:', error);
    // Don't show alert, just show empty state
    const totalElement = document.getElementById('incomeDetailTotal');
    const listElement = document.getElementById('incomeDetailList');
    const chartElement = document.getElementById('incomeTrendChart');

    if (totalElement) {
      totalElement.textContent = formatCurrency(0);
    }

    if (listElement) {
      listElement.innerHTML = '<li class="empty-state" style="text-align:center;padding:20px;color:#94a3b8">Không thể tải dữ liệu. Vui lòng thử lại sau.</li>';
    }

    if (chartElement) {
      chartElement.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">Không thể tải biểu đồ</div>';
    }
  }
}

function drawIncomeTrendChart(container, data) {
  if (!data || data.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">Chưa có dữ liệu</div>';
    return;
  }

  const maxAmount = Math.max(...data.map(d => d.amount), 1);
  const chartHeight = 200;
  const barWidth = Math.max(40, (container.clientWidth - 40) / data.length - 10);

  container.innerHTML = `
    <div style="display:flex;align-items:flex-end;gap:8px;height:${chartHeight}px;padding:20px;justify-content:center">
      ${data.map((item, index) => {
    const height = maxAmount > 0 ? (item.amount / maxAmount) * (chartHeight - 40) : 0;
    return `
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;max-width:${barWidth}px">
            <div style="width:100%;height:${chartHeight - 40}px;display:flex;align-items:flex-end;justify-content:center">
              <div style="width:80%;height:${height}px;background:linear-gradient(to top, #10b981, #34d399);border-radius:8px 8px 0 0;transition:height 0.3s;min-height:${height > 0 ? '4px' : '0'}" title="${formatCurrency(item.amount)}"></div>
            </div>
            <div style="font-size:11px;color:#94a3b8;text-align:center;transform:rotate(-45deg);white-space:nowrap;margin-top:4px">${item.label}</div>
            <div style="font-size:12px;font-weight:600;color:#10b981;margin-top:4px">${formatCurrency(item.amount)}</div>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

// ========== BUDGET SET MODAL ==========
function openBudgetSetModal() {
  const modal = document.getElementById('budgetSetModal');
  if (!modal) {
    console.error('Budget set modal not found');
    return;
  }

  loadBudgetSetData();
  modal.classList.add('open');
}

function closeBudgetSetModal() {
  const modal = document.getElementById('budgetSetModal');
  if (modal) {
    modal.classList.remove('open');
  }
}

async function loadBudgetSetData() {
  try {
    const currentUser = checkAuth();
    if (!currentUser) {
      console.error('User not authenticated');
      return;
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentMonthStr = `${currentYear}${String(currentMonth).padStart(2, '0')}`; // Format: YYYYMM

    // Get current budget using correct API endpoint
    let currentBudget = 0;
    const budgetResult = await apiRequest(`/api/budgets/${currentMonthStr}`);
    if (budgetResult && budgetResult.ok && budgetResult.data) {
      currentBudget = budgetResult.data.amount || 0;
    }

    // Get expenses for last 3 months to calculate average
    const expensesResult = await apiRequest('/api/expenses');
    let suggestedBudget = 0;
    if (expensesResult && expensesResult.ok) {
      const allExpenses = expensesResult.data.items || [];

      const last3MonthsExpenses = [];
      for (let i = 2; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - 1 - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;

        const monthExpenses = allExpenses.filter(e => {
          const expDate = e.date ? e.date.substring(0, 7) : '';
          return expDate === monthStr && e.type === 'expense';
        });

        const monthTotal = monthExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
        last3MonthsExpenses.push(monthTotal);
      }

      if (last3MonthsExpenses.length > 0 && last3MonthsExpenses.some(v => v > 0)) {
        const sum = last3MonthsExpenses.reduce((a, b) => a + b, 0);
        const count = last3MonthsExpenses.filter(v => v > 0).length;
        if (count > 0) {
          suggestedBudget = Math.ceil((sum / count) * 1.1); // 10% buffer
        }
      }
    }

    // Update modal content
    const currentBudgetInput = document.getElementById('budgetSetCurrent');
    const suggestedBudgetElement = document.getElementById('budgetSetSuggested');
    const newBudgetInput = document.getElementById('budgetSetNew');

    if (currentBudgetInput) {
      currentBudgetInput.textContent = formatCurrency(currentBudget);
    }

    if (suggestedBudgetElement) {
      if (suggestedBudget > 0) {
        suggestedBudgetElement.textContent = formatCurrency(suggestedBudget);
        suggestedBudgetElement.parentElement.style.display = 'flex';
        const useSuggestedBtn = document.getElementById('useSuggestedBudget');
        if (useSuggestedBtn) {
          useSuggestedBtn.style.display = 'inline-block';
          useSuggestedBtn.onclick = () => {
            if (newBudgetInput) {
              newBudgetInput.value = suggestedBudget.toLocaleString('vi-VN');
            }
          };
        }
      } else {
        suggestedBudgetElement.parentElement.style.display = 'none';
        const useSuggestedBtn = document.getElementById('useSuggestedBudget');
        if (useSuggestedBtn) {
          useSuggestedBtn.style.display = 'none';
        }
      }
    }

    if (newBudgetInput) {
      newBudgetInput.value = currentBudget > 0 ? currentBudget.toLocaleString('vi-VN') : '';
    }

  } catch (error) {
    console.error('Error loading budget set data:', error);
  }
}

async function saveBudget() {
  try {
    const newBudgetInput = document.getElementById('budgetSetNew');
    if (!newBudgetInput) {
      alert('Không tìm thấy input budget');
      return;
    }

    const budgetValue = parseFloat(newBudgetInput.value.replace(/[^\d]/g, ''));
    if (isNaN(budgetValue) || budgetValue <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    const currentUser = checkAuth();
    if (!currentUser) {
      alert('Bạn chưa đăng nhập');
      return;
    }

    // Lấy tháng hiện tại (định dạng: YYYYMM)
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentMonthStr = `${currentYear}${String(currentMonth).padStart(2, '0')}`;

    // Cập nhật ngân sách sử dụng API endpoint
    const result = await apiRequest(`/api/budgets/${currentMonthStr}`, {
      method: 'PUT',
      body: JSON.stringify({
        amount: budgetValue
      })
    });

    if (!result || !result.ok) {
      const errorMsg = result?.data?.message || 'Lỗi khi lưu ngân sách';
      throw new Error(errorMsg);
    }

    // Cập nhật localStorage
    if (currentUser.user) {
      currentUser.user.monthly_budget = budgetValue;
      currentUser.user.balance = budgetValue;
      localStorage.setItem('smartexpense_user', JSON.stringify(currentUser.user));
      localStorage.setItem('monthly_budget', String(budgetValue));
    }

    // Đóng modal và tải lại dashboard
    closeBudgetSetModal();
    await reloadDashboardData();

    // Hiển thị thông báo thành công
    alert('Đã cập nhật ngân sách thành công!');

  } catch (error) {
    console.error('Lỗi khi lưu ngân sách:', error);
    alert('Lỗi khi lưu ngân sách: ' + (error.message || 'Vui lòng thử lại'));
  }
}

async function resetBudget() {
  try {
    // Xác nhận trước khi đặt lại
    const confirmed = confirm('Bạn có chắc chắn muốn đặt lại ngân sách về 0?');
    if (!confirmed) {
      return;
    }

    const currentUser = checkAuth();
    if (!currentUser) {
      alert('Bạn chưa đăng nhập');
      return;
    }

    // Lấy tháng hiện tại (định dạng: YYYYMM)
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentMonthStr = `${currentYear}${String(currentMonth).padStart(2, '0')}`;

    // Cập nhật ngân sách về 0 sử dụng API endpoint
    const result = await apiRequest(`/api/budgets/${currentMonthStr}`, {
      method: 'PUT',
      body: JSON.stringify({
        amount: 0
      })
    });

    if (!result || !result.ok) {
      const errorMsg = result?.data?.message || 'Lỗi khi đặt lại ngân sách';
      throw new Error(errorMsg);
    }

    // Cập nhật localStorage
    if (currentUser.user) {
      currentUser.user.monthly_budget = 0;
      currentUser.user.balance = 0;
      localStorage.setItem('smartexpense_user', JSON.stringify(currentUser.user));
      localStorage.setItem('monthly_budget', '0');
    }

    // Đóng modal và tải lại dashboard
    closeBudgetSetModal();
    await reloadDashboardData();

    // Hiển thị thông báo thành công
    alert('Đã đặt lại ngân sách về 0 thành công!');

  } catch (error) {
    console.error('Lỗi khi đặt lại ngân sách:', error);
    alert('Lỗi khi đặt lại ngân sách: ' + (error.message || 'Vui lòng thử lại'));
  }
}

// ========== BUDGET WARNING ==========
function checkBudgetWarning() {
  try {
    const monthlyBudgetElement = document.getElementById('monthlyBudget');
    const monthlyExpenseElement = document.getElementById('monthlyExpense');
    const budgetStatusElement = document.getElementById('budgetStatus');
    const budgetProgressElement = document.getElementById('budgetProgress');

    if (!monthlyBudgetElement || !monthlyExpenseElement) return;

    const monthlyBudget = parseFloat(monthlyBudgetElement.textContent.replace(/[^\d]/g, '')) || 0;
    const monthlyExpense = parseFloat(monthlyExpenseElement.textContent.replace(/[^\d]/g, '')) || 0;

    if (monthlyBudget <= 0) return; // No budget set

    const usagePercent = (monthlyExpense / monthlyBudget) * 100;
    const remaining = monthlyBudget - monthlyExpense;

    // Update progress bar color
    if (budgetProgressElement) {
      if (usagePercent >= 100) {
        budgetProgressElement.style.background = '#ef4444'; // Red
      } else if (usagePercent >= 80) {
        budgetProgressElement.style.background = '#f59e0b'; // Orange
      } else {
        budgetProgressElement.style.background = '#60a5fa'; // Blue
      }
    }

    // Show warning if budget is almost exhausted
    if (usagePercent >= 90 && usagePercent < 100) {
      const warningMessage = `⚠️ Cảnh báo: Bạn đã sử dụng ${usagePercent.toFixed(0)}% ngân sách. Còn lại ${formatCurrency(remaining)}.`;
      console.warn(warningMessage);

      // You can show a toast notification here if you have a toast system
      // For now, we'll just update the status text
      if (budgetStatusElement) {
        budgetStatusElement.innerHTML = `<span style="color:#f59e0b">⚠️ ${usagePercent.toFixed(0)}% - Cảnh báo!</span>`;
      }
    } else if (usagePercent >= 100) {
      if (budgetStatusElement) {
        budgetStatusElement.innerHTML = `<span style="color:#ef4444">🚨 Vượt ngân sách ${formatCurrency(Math.abs(remaining))}</span>`;
      }
    }
  } catch (error) {
    console.error('Error checking budget warning:', error);
  }
}

// ========== AUTO SET BUDGET FOR NEXT MONTH ==========
async function autoSetBudgetForNextMonth() {
  try {
    const currentUser = checkAuth();
    if (!currentUser) {
      return;
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    // Calculate next month (format: YYYYMM)
    const nextMonthDate = new Date(currentYear, currentMonth, 1);
    const nextYear = nextMonthDate.getFullYear();
    const nextMonth = nextMonthDate.getMonth() + 1;
    const nextMonthStr = `${nextYear}${String(nextMonth).padStart(2, '0')}`;

    // Check if budget for next month already exists
    const checkResult = await apiRequest(`/api/budgets/${nextMonthStr}`);
    if (checkResult && checkResult.ok && checkResult.data && checkResult.data.amount > 0) {
      console.log('Budget for next month already set');
      return; // Already set
    }

    // Get current month budget
    const currentMonthStr = `${currentYear}${String(currentMonth).padStart(2, '0')}`;
    const currentResult = await apiRequest(`/api/budgets/${currentMonthStr}`);

    let nextMonthBudget = 0;
    if (currentResult && currentResult.ok && currentResult.data && currentResult.data.amount > 0) {
      // Use current month budget as next month budget
      nextMonthBudget = currentResult.data.amount;
    } else {
      // Try to get from user profile
      if (currentUser.user && currentUser.user.monthly_budget) {
        nextMonthBudget = currentUser.user.monthly_budget;
      }
    }

    // If still no budget, calculate from average expenses
    if (nextMonthBudget <= 0) {
      const expensesResult = await apiRequest('/api/expenses');
      if (expensesResult && expensesResult.ok) {
        const allExpenses = expensesResult.data.items || [];
        const last3MonthsExpenses = [];

        for (let i = 2; i >= 0; i--) {
          const date = new Date(currentYear, currentMonth - 1 - i, 1);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const monthStr = `${year}-${String(month).padStart(2, '0')}`;

          const monthExpenses = allExpenses.filter(e => {
            const expDate = e.date ? e.date.substring(0, 7) : '';
            return expDate === monthStr && e.type === 'expense';
          });

          const monthTotal = monthExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
          last3MonthsExpenses.push(monthTotal);
        }

        if (last3MonthsExpenses.length > 0 && last3MonthsExpenses.some(v => v > 0)) {
          const sum = last3MonthsExpenses.reduce((a, b) => a + b, 0);
          const count = last3MonthsExpenses.filter(v => v > 0).length;
          if (count > 0) {
            nextMonthBudget = Math.ceil((sum / count) * 1.1); // 10% buffer
          }
        }
      }
    }

    // Set budget for next month if we have a value
    if (nextMonthBudget > 0) {
      const setResult = await apiRequest(`/api/budgets/${nextMonthStr}`, {
        method: 'PUT',
        body: JSON.stringify({
          amount: nextMonthBudget
        })
      });

      if (setResult && setResult.ok) {
        console.log(`✅ Auto-set budget for ${nextMonthStr}: ${formatCurrency(nextMonthBudget)}`);
      }
    }

  } catch (error) {
    console.error('Error auto-setting budget for next month:', error);
  }
}

// ========== INITIALIZE MODALS AND CLICK HANDLERS ==========
function initIncomeAndBudgetModals() {
  // Add click handlers to income and budget cards
  const incomeCard = document.querySelector('.kpi .card:nth-child(3)'); // Third card (Thu tháng này)
  const budgetCard = document.querySelector('.kpi .card:nth-child(4)'); // Fourth card (Ngân sách)

  if (incomeCard) {
    incomeCard.style.cursor = 'pointer';
    incomeCard.addEventListener('click', openIncomeDetailModal);
    incomeCard.title = 'Click để xem chi tiết thu nhập';
  }

  if (budgetCard) {
    budgetCard.style.cursor = 'pointer';
    budgetCard.addEventListener('click', openBudgetSetModal);
    budgetCard.title = 'Click để đặt ngân sách';
  }

  // Initialize income detail modal
  const incomeModal = document.getElementById('incomeDetailModal');
  if (incomeModal) {
    incomeModal.addEventListener('click', function (e) {
      if (e.target === incomeModal) {
        closeIncomeDetailModal();
      }
    });

    const closeIncomeBtn = document.getElementById('closeIncomeDetailModal');
    if (closeIncomeBtn) {
      closeIncomeBtn.addEventListener('click', closeIncomeDetailModal);
    }
  }

  // Initialize budget set modal
  const budgetModal = document.getElementById('budgetSetModal');
  if (budgetModal) {
    budgetModal.addEventListener('click', function (e) {
      if (e.target === budgetModal) {
        closeBudgetSetModal();
      }
    });

    const closeBudgetBtn = document.getElementById('closeBudgetSetModal');
    if (closeBudgetBtn) {
      closeBudgetBtn.addEventListener('click', closeBudgetSetModal);
    }

    const saveBudgetBtn = document.getElementById('saveBudgetBtn');
    if (saveBudgetBtn) {
      saveBudgetBtn.addEventListener('click', saveBudget);
    }

    const resetBudgetBtn = document.getElementById('resetBudgetBtn');
    if (resetBudgetBtn) {
      resetBudgetBtn.addEventListener('click', resetBudget);
    }

    // Format budget input
    const budgetInput = document.getElementById('budgetSetNew');
    if (budgetInput) {
      budgetInput.addEventListener('input', function (e) {
        let value = e.target.value.replace(/[^\d]/g, '');
        if (value) {
          value = parseInt(value).toLocaleString('vi-VN');
        }
        e.target.value = value;
      });
    }
  }

  // Close modals on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeIncomeDetailModal();
      closeBudgetSetModal();
    }
  });

  // Check budget warning after data loads
  setTimeout(() => {
    checkBudgetWarning();
  }, 1000);

  // Auto-set budget for next month (run once per day)
  const lastAutoSetDate = localStorage.getItem('lastAutoSetBudgetDate');
  const today = new Date().toDateString();
  if (lastAutoSetDate !== today) {
    autoSetBudgetForNextMonth();
    localStorage.setItem('lastAutoSetBudgetDate', today);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);
