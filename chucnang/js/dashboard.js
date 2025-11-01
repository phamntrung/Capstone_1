/**
 * Dashboard JavaScript
 * Xử lý trang chủ và hiển thị dữ liệu
 */

// Load utilities first
// (utils.js should be loaded before this file)

// Load user data
function loadUserData() {
  const auth = checkAuth();
  if (!auth) return;
  
  const user = auth.user;
  
  const userNameElement = document.getElementById('userName');
  const welcomeTitleElement = document.getElementById('welcomeTitle');
  
  if (userNameElement) {
    userNameElement.textContent = user.name;
  }
  
  if (welcomeTitleElement) {
    welcomeTitleElement.textContent = `Chào mừng, ${user.name}!`;
  }
}

// formatCurrency is now available from utils.js

// Global state
let allExpenses = [];
let allCategories = [];
let currentFilter = 'all';
let currentSearchQuery = '';

// Update summary statistics
async function updateSummaryStats(data) {
  // Load user balance from API (always fetch from database, not localStorage)
  let userBalance = null;
  try {
    const meResult = await apiRequest('/api/me');
    if (meResult && meResult.ok && meResult.data) {
      const apiBalance = meResult.data.balance !== undefined && meResult.data.balance !== null 
        ? meResult.data.balance 
        : null;
      
      // Nếu API trả về balance = 0 hoặc null, kiểm tra localStorage
      if (apiBalance === null || apiBalance === 0) {
        // Kiểm tra localStorage để lấy giá trị đã lưu
        try {
          const userData = localStorage.getItem('smartexpense_user');
          if (userData) {
            const user = JSON.parse(userData);
            if (user.balance !== undefined && user.balance !== null && user.balance > 0) {
              userBalance = user.balance;
              console.log('📦 Using balance from localStorage:', userBalance);
            } else if (user.monthly_budget !== undefined && user.monthly_budget !== null && user.monthly_budget > 0) {
              userBalance = user.monthly_budget;
              console.log('📦 Using monthly_budget from localStorage:', userBalance);
            } else {
              // Thử legacy profile
              const profileData = localStorage.getItem('profile');
              if (profileData) {
                const profile = JSON.parse(profileData);
                if (profile.monthly_budget !== undefined && profile.monthly_budget !== null && profile.monthly_budget > 0) {
                  userBalance = profile.monthly_budget;
                  console.log('📦 Using monthly_budget from profile:', userBalance);
                } else if (profile.balance !== undefined && profile.balance !== null && profile.balance > 0) {
                  userBalance = profile.balance;
                  console.log('📦 Using balance from profile:', userBalance);
                }
              }
              // Thử legacy monthly_budget
              if (!userBalance) {
                const monthlyBudget = localStorage.getItem('monthly_budget');
                if (monthlyBudget) {
                  const budgetValue = Number(monthlyBudget);
                  if (budgetValue > 0) {
                    userBalance = budgetValue;
                    console.log('📦 Using monthly_budget from localStorage:', userBalance);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn('Error reading from localStorage:', e);
        }
      } else {
        // API trả về giá trị hợp lệ (> 0)
        userBalance = apiBalance;
      }
      
      // Nếu vẫn không có giá trị, dùng 0
      if (userBalance === null) {
        userBalance = 0;
      }
      
      // Calculate expenses from allExpenses (more accurate)
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // yyyy-mm-dd
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      
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
      
      // Today expense - tính từ allExpenses
      let todayExpense = 0;
      if (allExpenses.length > 0) {
        const todayExpenses = allExpenses.filter(e => {
          return e.date === todayStr && e.type === 'expense';
        });
        todayExpense = todayExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
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
      
      // Calculate remaining (Số tiền còn lại = Số dư - Chi tiêu hôm nay)
      // Allow negative to show when budget is exceeded
      const remaining = userBalance - todayExpense;
      
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
      
      // Remaining budget (Số tiền còn lại = Số dư - Chi tiêu hôm nay)
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
                    '(balance:', userBalance, '- today expense:', todayExpense, ')');
      }
    }
  } catch (error) {
    console.error('Error loading user balance:', error);
  }
  
  // Fallback: load balance from localStorage if API fails
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
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
  
  // Calculate today expense from allExpenses
  let todayExpense = 0;
  if (allExpenses.length > 0) {
    const todayExpenses = allExpenses.filter(e => {
      return e.date === todayStr && e.type === 'expense';
    });
    todayExpense = todayExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
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
  const todayExpenseInput = document.getElementById('todayExpenseInput');
  if (todayExpenseInput) {
    todayExpenseInput.value = formatCurrency(todayExpense);
  }
  
  // Update monthly expense input (Tổng chi tiêu tháng này) - hiển thị tổng số tiền đã chi trong tháng
  const monthlyExpenseInput = document.getElementById('monthlyExpenseInput');
  if (monthlyExpenseInput) {
    monthlyExpenseInput.value = formatCurrency(monthlyExpense);
  }
  
  // Update remaining budget with balance - today expense
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
    const remaining = fallbackBalance - todayExpense;
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
                '(balance:', fallbackBalance, '- today expense:', todayExpense, ')');
  }
  
  // Calculate expense change (compare with previous month)
  if (data.monthly && data.monthly.length >= 2) {
    const current = data.monthly[0].amount;
    const previous = data.monthly[1].amount;
    if (previous > 0) {
      const change = ((current - previous) / previous) * 100;
      const expenseChangeElement = document.getElementById('expenseChange');
      if (expenseChangeElement) {
        expenseChangeElement.innerHTML = `<span class="${change >= 0 ? 'down' : 'up'}">${change >= 0 ? '+' : ''}${change.toFixed(0)}%</span> so với tháng trước`;
      }
    }
  }
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
  
  // Apply time filter
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (currentFilter === 'today') {
    const todayStr = today.toISOString().split('T')[0];
    filtered = filtered.filter(e => e.date === todayStr);
  } else if (currentFilter === 'week') {
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    filtered = filtered.filter(e => e.date >= weekAgoStr && e.date <= today.toISOString().split('T')[0]);
  } else if (currentFilter === 'month') {
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    filtered = filtered.filter(e => e.date && e.date.startsWith(currentMonth));
  } else if (currentFilter.startsWith('category:')) {
    const categoryId = parseInt(currentFilter.split(':')[1]);
    filtered = filtered.filter(e => e.categoryId === categoryId);
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
  
  // Calculate current values
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // yyyy-mm-dd
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
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
      
      // Nếu API trả về balance, sử dụng nó
      if (apiBalance !== null && apiBalance !== undefined) {
        userBalance = apiBalance;
        console.log('✅ Got balance from API:', userBalance);
      } else {
        // Nếu API trả về balance = 0 hoặc null, kiểm tra localStorage
        console.log('⚠️ API balance is null/0, checking localStorage...');
        try {
          const userData = localStorage.getItem('smartexpense_user');
          if (userData) {
            const user = JSON.parse(userData);
            if (user.balance !== undefined && user.balance !== null && user.balance > 0) {
              userBalance = user.balance;
              console.log('📦 Using balance from localStorage:', userBalance);
            } else if (user.monthly_budget !== undefined && user.monthly_budget !== null && user.monthly_budget > 0) {
              userBalance = user.monthly_budget;
              console.log('📦 Using monthly_budget from localStorage:', userBalance);
            } else {
              // Thử legacy monthly_budget
              const monthlyBudget = localStorage.getItem('monthly_budget');
              if (monthlyBudget) {
                const budgetValue = Number(monthlyBudget);
                if (budgetValue > 0) {
                  userBalance = budgetValue;
                  console.log('📦 Using monthly_budget from localStorage:', userBalance);
                }
              }
            }
          }
        } catch (e) {
          console.warn('⚠️ Error reading localStorage:', e);
        }
      }
    } else {
      // Fallback to localStorage if API fails
      console.warn('⚠️ API request failed, using localStorage fallback');
  try {
    const userData = localStorage.getItem('smartexpense_user');
    if (userData) {
      const user = JSON.parse(userData);
      userBalance = user.balance || user.monthly_budget || 0;
    } else {
      const monthlyBudget = localStorage.getItem('monthly_budget');
      if (monthlyBudget) {
        userBalance = Number(monthlyBudget) || 0;
      }
    }
  } catch (e) {
        console.warn('⚠️ Error reading localStorage:', e);
      }
    }
  } catch (e) {
    console.warn('⚠️ Error getting balance from API, using localStorage fallback:', e);
    // Fallback to localStorage
    try {
      const userData = localStorage.getItem('smartexpense_user');
      if (userData) {
        const user = JSON.parse(userData);
        userBalance = user.balance || user.monthly_budget || 0;
      } else {
        const monthlyBudget = localStorage.getItem('monthly_budget');
        if (monthlyBudget) {
          userBalance = Number(monthlyBudget) || 0;
        }
      }
    } catch (e2) {
      console.warn('⚠️ Error reading localStorage:', e2);
    }
  }
  console.log('💵 Final user balance:', userBalance);
  
  // Calculate remaining - Số tiền còn lại = Số dư - Chi tiêu hôm nay
  // Allow negative to show when budget is exceeded
  const remaining = userBalance - todayExpense;
  console.log('✅✅✅ Remaining calculated:', remaining, 
              '(balance:', userBalance, '- today expense:', todayExpense, ')');
  console.log('📊 Summary:', {
    userBalance,
    todayExpense,
    remaining,
    formula: `${userBalance} - ${todayExpense} = ${remaining}`
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
  console.log('🔍 Values:', { userBalance, todayExpense, remaining, formula: `${userBalance} - ${todayExpense} = ${remaining}` });
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
                '(balance:', userBalance, '- today expense:', todayExpense, ')');
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
    console.log('✓ Updated category list');
  } catch (e) {
    console.error('Error updating category list:', e);
  }
  
  console.log('✅ UI updated instantly with new expense');
}

// Update recent expenses
function updateRecentExpenses(expenses) {
  // Store all expenses globally
  allExpenses = expenses;
  
  // Apply filters
  const filtered = filterExpenses(expenses);
  
  const container = document.getElementById('recentExpenses');
  const tableBody = document.getElementById('recentExpensesTable');
  
  // Update table view
  if (tableBody) {
    if (filtered.length === 0) {
      const emptyRow = tableBody.querySelector('.empty-state');
      if (emptyRow) {
        emptyRow.style.display = '';
      } else {
        tableBody.innerHTML = '<tr class="empty-state"><td colspan="4" style="text-align:center;padding:40px;color:#94a3b8">Chưa có giao dịch nào</td></tr>';
      }
    } else {
      // Hide empty state
      const emptyRow = tableBody.querySelector('.empty-state');
      if (emptyRow) emptyRow.style.display = 'none';
      
      // Show expenses (show up to 10)
      tableBody.innerHTML = filtered.slice(0, 10).map(expense => {
        const categoryName = expense.categoryId ? (expense.categoryName || 'Danh mục') : 'Khác';
        const note = expense.note || 'Không có ghi chú';
        const amount = Math.abs(expense.amount);
        const date = expense.date || '';
        const typeClass = expense.type === 'income' ? 'income' : 'expense';
        const sign = expense.type === 'income' ? '+' : '-';
        
        return `
          <tr>
            <td>${categoryName}</td>
            <td>${note}</td>
            <td class="${typeClass}" style="font-weight:600;color:${expense.type === 'income' ? '#10b981' : '#ef4444'}">${sign}${formatCurrency(amount)}</td>
            <td>${date}</td>
          </tr>
        `;
      }).join('');
    }
  }
  
  // Update container view (if exists)
  if (container) {
    if (expenses.length === 0) {
      container.innerHTML = '<div class="loading">Chưa có giao dịch nào</div>';
      return;
    }

    const expensesHTML = expenses.map(expense => `
      <div class="expense-item">
        <div class="expense-info">
          <div class="expense-category">${expense.categoryId ? 'Danh mục' : 'Khác'}</div>
          <div class="expense-note">${expense.note || 'Không có ghi chú'}</div>
        </div>
        <div class="expense-amount ${expense.type === 'income' ? 'income' : 'expense'}">
          ${expense.type === 'income' ? '+' : '-'}${formatCurrency(Math.abs(expense.amount))}
        </div>
      </div>
    `).join('');

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
  
  // Update category list after updating expenses
  updateCategoryList(expenses);
}

// Load dashboard data from API
async function loadDashboardData() {
  const auth = checkAuth();
  if (!auth) return;

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

// Reload dashboard data (for realtime updates)
async function reloadDashboardData() {
  await loadDashboardData();
}

// logout function is now available from utils.js

// ===== Search and Filter Functionality =====
function initSearchAndFilter() {
  // Search box
  const searchInput = document.getElementById('expenseFilter');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value;
      updateRecentExpenses(allExpenses);
    });
  }
  
  // Filter dropdown
  const filterSelect = document.getElementById('expenseFilterSelect');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      updateRecentExpenses(allExpenses);
    });
  }
}

// Update filter dropdown with categories
function updateFilterDropdown() {
  const filterSelect = document.getElementById('expenseFilterSelect');
  if (!filterSelect) return;
  
  // Keep existing options but update category options
  const currentValue = filterSelect.value;
  const baseOptions = [
    { value: 'all', text: 'Tất cả' },
    { value: 'today', text: 'Hôm nay' },
    { value: 'week', text: 'Tuần này' },
    { value: 'month', text: 'Tháng này' }
  ];
  
  let html = baseOptions.map(opt => 
    `<option value="${opt.value}">${opt.text}</option>`
  ).join('');
  
  // Add category options
  if (allCategories.length > 0) {
    html += '<optgroup label="Theo danh mục">';
    allCategories.forEach(cat => {
      html += `<option value="category:${cat.id}">${cat.name}</option>`;
    });
    html += '</optgroup>';
  }
  
  filterSelect.innerHTML = html;
  
  // Restore selected value if still valid
  if (currentValue && Array.from(filterSelect.options).some(opt => opt.value === currentValue)) {
    filterSelect.value = currentValue;
  }
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
    return `
      <li style="display:flex;align-items:center;justify-content:space-between;padding:12px;border-bottom:1px solid var(--border);gap:12px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;color:var(--text);margin-bottom:4px">${cat.name}</div>
          <div style="font-size:12px;color:#64748b">${formatCurrency(cat.total)}</div>
        </div>
        <div style="flex:1;max-width:150px;height:8px;background:#eef2f7;border-radius:999px;overflow:hidden">
          <div style="width:${percentage}%;height:100%;background:#2563eb;transition:width 0.3s"></div>
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
  document.addEventListener('click', async function(e) {
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
      } catch (_) {}
      window.location.href = 'login.html';
    }
  });
}

// Expose reload function globally for realtime updates
window.reloadDashboard = reloadDashboardData;

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
function initDashboard() {
  loadUserData();
  loadDashboardData();
  
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
          setTimeout(() => {
            reloadDashboardData();
          }, 300);
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
  
  // Make logout function globally available
  window.logout = logout;
  
  // Listen for expense updates from other pages
  window.addEventListener('storage', async (e) => {
    if (e.key === 'smartexpense_expense_added') {
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
      
      // Reload toàn bộ dữ liệu từ API
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
    reloadDashboardData();
  });
  
  // Listen for profile updates (for same-page updates)
  window.addEventListener('profileUpdated', async (event) => {
    console.log('Profile updated event received, reloading dashboard...', event);
    
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
      const balanceAmount = document.getElementById('balanceAmount');
      if (balanceAmount) {
        balanceAmount.textContent = formatCurrency(balanceFromEvent);
        balanceAmount.style.color = '#10b981';
      }
      
      // Tính lại số tiền còn lại = balance - chi tiêu hôm nay
      let todayExpense = 0;
      
      // Lấy todayExpense từ allExpenses nếu có
      if (allExpenses.length > 0) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0]; // yyyy-mm-dd
        const todayExpenses = allExpenses.filter(e => {
          return e.date === todayStr && e.type === 'expense';
        });
        todayExpense = todayExpenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      } else {
        // Fallback: lấy từ todayExpenseInput nếu có
        const todayExpenseInput = document.getElementById('todayExpenseInput');
        if (todayExpenseInput && todayExpenseInput.value) {
          // Parse giá trị từ input (có thể có format currency)
          const todayExpenseStr = todayExpenseInput.value.replace(/[^\d.-]/g, '');
          todayExpense = parseFloat(todayExpenseStr) || 0;
        }
      }
      
      // Tính remaining = balance - todayExpense
      // Allow negative to show when budget is exceeded
      const remaining = balanceFromEvent - todayExpense;
      console.log('💰 Calculating remaining:', balanceFromEvent, '-', todayExpense, '=', remaining);
      
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);
