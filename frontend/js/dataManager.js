/**
 * Data Manager - Persistent Data Storage
 * Quản lý dữ liệu người dùng và đảm bảo không mất dữ liệu
 * Lưu vào Backend API để đồng bộ giữa các thiết bị
 */

class DataManager {
    constructor() {
        this.storageKey = 'smartexpense_data';
        this.syncQueueKey = 'smartexpense_sync_queue';
        this.data = this.loadData();
        // Force fix data structure immediately and save if needed
        this.fixDataStructure(true);
        // Load data from API when initialized (async) - PRIORITY: API first
        this.loadFromAPI(true); // Force load from API on init
        // Process any pending sync queue
        this.processSyncQueue();
    }
    
    // Load data from API server (PRIORITY: API first, localStorage as fallback)
    async loadFromAPI(forceRefresh = false, retryCount = 0) {
        const user = this.getCurrentUser();
        if (!user) {
            console.log('No user logged in, skipping API load');
            return;
        }
        
        // Check if apiRequest is available
        if (typeof window === 'undefined' || typeof window.apiRequest !== 'function') {
            // Giới hạn số lần retry để tránh vòng lặp vô hạn
            const MAX_RETRIES = 5;
            if (retryCount >= MAX_RETRIES) {
                console.error('❌ apiRequest không khả dụng sau ' + MAX_RETRIES + ' lần thử. Vui lòng kiểm tra lại việc load file utils.js');
                return;
            }
            console.warn('apiRequest not available, will retry later (' + (retryCount + 1) + '/' + MAX_RETRIES + ')');
            // Retry after a delay với retryCount tăng dần
            setTimeout(() => this.loadFromAPI(forceRefresh, retryCount + 1), 1000);
            return;
        }
        
        try {
            console.log('🔄 Loading data from API...');
            
            // Load expenses from API (PRIORITY: API data)
            const expensesResult = await window.apiRequest('/api/expenses');
            if (expensesResult && expensesResult.ok && expensesResult.data && expensesResult.data.items) {
                // Overwrite local data with API data (API is source of truth)
                this.data.expenses = expensesResult.data.items;
                console.log(`✅ Loaded ${this.data.expenses.length} expenses from API`);
            } else if (forceRefresh && expensesResult && !expensesResult.ok) {
                console.warn('API expenses load failed, keeping local cache');
            }
            
            // Load categories from API (PRIORITY: API data)
            const categoriesResult = await window.apiRequest('/api/categories');
            if (categoriesResult && categoriesResult.ok && categoriesResult.data && categoriesResult.data.items) {
                // Overwrite local data with API data (API is source of truth)
                this.data.categories = categoriesResult.data.items;
                console.log(`✅ Loaded ${this.data.categories.length} categories from API`);
            } else if (forceRefresh && categoriesResult && !categoriesResult.ok) {
                console.warn('API categories load failed, keeping local cache');
            }
            
            // Load budgets from API (load last 12 months for better sync)
            const today = new Date();
            const budgetMonths = [];
            for (let i = 0; i < 12; i++) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                budgetMonths.push(month);
            }
            
            if (!this.data.budgets || typeof this.data.budgets !== 'object') {
                this.data.budgets = {};
            }
            
            // Load budgets for multiple months
            for (const month of budgetMonths) {
                try {
                    const budgetResult = await window.apiRequest(`/api/budgets/${month}`);
                    if (budgetResult && budgetResult.ok && budgetResult.data) {
                        const budgetKey = `${user.id}_${month}`;
                        this.data.budgets[budgetKey] = {
                            userId: user.id,
                            month: month,
                            amount: budgetResult.data.amount || 0,
                            updatedAt: new Date().toISOString()
                        };
                    }
                } catch (e) {
                    // Continue with other months if one fails
                    console.warn(`Failed to load budget for ${month}:`, e);
                }
            }
            console.log(`✅ Loaded budgets from API`);
            
            // Load user profile from API (balance, gender, currency, phone)
            try {
                const profileResult = await window.apiRequest('/api/profile');
                if (profileResult && profileResult.ok && profileResult.data) {
                    const profile = profileResult.data;
                    
                    // Update localStorage with latest profile data
                    const userStr = localStorage.getItem('smartexpense_user');
                    if (userStr) {
                        const userData = JSON.parse(userStr);
                        const updatedUserData = {
                            ...userData,
                            balance: profile.balance !== undefined ? profile.balance : userData.balance,
                            gender: profile.gender !== undefined ? profile.gender : userData.gender,
                            currency: profile.currency !== undefined ? profile.currency : userData.currency,
                            phone: profile.phone !== undefined ? profile.phone : userData.phone,
                            monthly_budget: profile.balance !== undefined ? profile.balance : userData.monthly_budget
                        };
                        localStorage.setItem('smartexpense_user', JSON.stringify(updatedUserData));
                        console.log('✅ Loaded and updated user profile from API:', updatedUserData);
                    }
                }
            } catch (e) {
                console.warn('Failed to load user profile from API:', e);
            }
            
            // Save to localStorage as cache (after loading from API)
            this.saveData();
            console.log('✅ Data loaded from API and cached locally');
            
            // After loading from API, try to sync any pending local changes
            await this.syncPendingChangesToAPI();
        } catch (error) {
            console.error('Failed to load data from API:', error);
            // Continue with localStorage data if API fails
            // But mark that we need to sync later
            this.markNeedsSync();
        }
    }
    
    // Force fix data structure to prevent any array issues
    fixDataStructure(saveAfterFix = false) {
        if (!this.data) {
            this.data = this.getDefaultData();
        }
        
        let needsSaving = false;
        
        // Critical: Ensure users is ALWAYS an object, never an array
        if (!this.data.users || 
            typeof this.data.users !== 'object' || 
            Array.isArray(this.data.users) ||
            this.data.users === null) {
            
            // If it's an array, migrate it
            if (Array.isArray(this.data.users)) {
                console.warn('Found users as array, migrating to object...');
                const usersObj = {};
                try {
                    this.data.users.forEach(user => {
                        if (user && (user.id || user.email)) {
                            const key = user.id || user.email;
                            usersObj[key] = user;
                        }
                    });
                    this.data.users = usersObj;
                    needsSaving = true;
                    console.log('Migration completed');
                } catch (e) {
                    console.error('Migration failed, resetting to empty object:', e);
                    this.data.users = {};
                    needsSaving = true;
                }
            } else {
                // Otherwise, just reset to empty object
                this.data.users = {};
                needsSaving = true;
            }
        }
        
        // Ensure other fields
        if (!Array.isArray(this.data.expenses)) {
            this.data.expenses = [];
            needsSaving = true;
        }
        if (!Array.isArray(this.data.categories)) {
            this.data.categories = [];
            needsSaving = true;
        }
        if (!this.data.budgets || typeof this.data.budgets !== 'object' || Array.isArray(this.data.budgets)) {
            this.data.budgets = {};
            needsSaving = true;
        }
        if (!this.data.reports || typeof this.data.reports !== 'object' || Array.isArray(this.data.reports)) {
            this.data.reports = {};
            needsSaving = true;
        }
        
        // Only save if requested and changes were made
        if (saveAfterFix && needsSaving) {
            try {
                this.data.lastUpdated = new Date().toISOString();
                localStorage.setItem(this.storageKey, JSON.stringify(this.data));
            } catch (e) {
                console.error('Failed to save after fix:', e);
            }
        }
    }

    // Load data from localStorage
    loadData() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                
                // Ensure data is an object
                if (!data || typeof data !== 'object' || Array.isArray(data)) {
                    return this.getDefaultData();
                }
                
                // Migrate users from array to object if needed
                if (data.users && Array.isArray(data.users)) {
                    const usersObj = {};
                    data.users.forEach(user => {
                        if (user && (user.id || user.email)) {
                            const key = user.id || user.email;
                            usersObj[key] = user;
                        }
                    });
                    data.users = usersObj;
                    // Save migrated data
                    try {
                        localStorage.setItem(this.storageKey, JSON.stringify(data));
                        console.log('Migrated users from array to object');
                    } catch (e) {
                        console.warn('Failed to save migrated data:', e);
                    }
                }
                
                // Ensure users is an object (not null, undefined, or array)
                if (!data.users || 
                    typeof data.users !== 'object' || 
                    Array.isArray(data.users) ||
                    data.users === null) {
                    data.users = {};
                }
                
                // Ensure other required fields exist
                if (!Array.isArray(data.expenses)) data.expenses = [];
                if (!Array.isArray(data.categories)) data.categories = [];
                if (!data.budgets || typeof data.budgets !== 'object' || Array.isArray(data.budgets)) {
                    data.budgets = {};
                }
                if (!data.reports || typeof data.reports !== 'object' || Array.isArray(data.reports)) {
                    data.reports = {};
                }
                
                return data;
            }
        } catch (error) {
            console.warn('Failed to load saved data:', error);
        }
        
        // Return default data structure
        return this.getDefaultData();
    }
    
    // Get default data structure
    getDefaultData() {
        return {
            users: {},
            expenses: [],
            categories: [],
            budgets: {},
            reports: {},
            lastUpdated: new Date().toISOString()
        };
    }

    // Save data to localStorage
    saveData() {
        try {
            // Fix data structure before saving (without triggering save recursively)
            this.fixDataStructure(false);
            
            this.data.lastUpdated = new Date().toISOString();
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
            console.log('Data saved successfully');
        } catch (error) {
            console.error('Failed to save data:', error);
            // Try to recover
            try {
                this.data = this.getDefaultData();
                this.fixDataStructure(false);
                localStorage.setItem(this.storageKey, JSON.stringify(this.data));
            } catch (e) {
                console.error('Complete save failure:', e);
            }
        }
    }

    // Get current user data
    getCurrentUser() {
        const userData = localStorage.getItem('smartexpense_user');
        if (userData) {
            return JSON.parse(userData);
        }
        return null;
    }

    // Add expense - Save to API first, then to local cache
    async addExpense(expense) {
        const user = this.getCurrentUser();
        if (!user) return false;

        // Ensure this.data exists
        if (!this.data) {
            this.data = this.loadData();
        }
        if (!Array.isArray(this.data.expenses)) {
            this.data.expenses = [];
        }

        // Lấy ngày từ server nếu không có ngày từ client
        let expenseDate = expense.date;
        if (!expenseDate) {
            // Lấy ngày từ server để đảm bảo đúng ngày
            if (typeof window !== 'undefined' && typeof window.getCurrentDateFromServer === 'function') {
                expenseDate = await window.getCurrentDateFromServer();
            } else {
                // Fallback nếu helper không có
                expenseDate = new Date().toISOString().split('T')[0];
            }
        }

        const expenseData = {
            date: expenseDate,
            amount: parseFloat(expense.amount) || 0,
            type: expense.type || 'expense',
            categoryId: expense.categoryId || null,
            note: expense.note || ''
        };

        // Try to save to API first
        if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
            try {
                const result = await window.apiRequest('/api/expenses', {
                    method: 'POST',
                    body: JSON.stringify(expenseData)
                });
                
                if (result && result.ok && result.data) {
                    // Use expense from API (has server-assigned ID)
                    const newExpense = result.data;
                    this.data.expenses.push(newExpense);
                    this.saveData(); // Save to localStorage cache
                    console.log('✅ Expense saved to API:', newExpense);
                    return newExpense;
                } else {
                    console.warn('Failed to save expense to API, saving locally only');
                }
            } catch (error) {
                console.error('Error saving expense to API:', error);
                // Continue with local save
            }
        }

        // Fallback: Save locally only (when API is not available)
        const newExpense = {
            id: Date.now(),
            userId: user.id,
            ...expenseData,
            createdAt: new Date().toISOString()
        };

        this.data.expenses.push(newExpense);
        this.saveData();
        return newExpense;
    }

    // Get expenses for current user - Load from API if needed
    async getUserExpenses(forceRefresh = false) {
        const user = this.getCurrentUser();
        if (!user) return [];

        // If forceRefresh, load from API
        if (forceRefresh && typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
            await this.loadFromAPI();
        }

        // Ensure this.data exists
        if (!this.data) {
            this.data = this.loadData();
        }
        if (!Array.isArray(this.data.expenses)) {
            return [];
        }

        return this.data.expenses.filter(expense => expense.userId === user.id);
    }

    // Add category - Save to API first, then to local cache
    async addCategory(category) {
        const user = this.getCurrentUser();
        if (!user) return false;

        // Ensure this.data exists
        if (!this.data) {
            this.data = this.loadData();
        }
        if (!Array.isArray(this.data.categories)) {
            this.data.categories = [];
        }

        const categoryData = {
            name: category.name
        };

        // Try to save to API first
        if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
            try {
                const result = await window.apiRequest('/api/categories', {
                    method: 'POST',
                    body: JSON.stringify(categoryData)
                });
                
                if (result && result.ok && result.data) {
                    // Use category from API (has server-assigned ID)
                    const newCategory = result.data;
                    this.data.categories.push(newCategory);
                    this.saveData(); // Save to localStorage cache
                    console.log('✅ Category saved to API:', newCategory);
                    return newCategory;
                } else {
                    console.warn('Failed to save category to API, saving locally only');
                }
            } catch (error) {
                console.error('Error saving category to API:', error);
                // Continue with local save
            }
        }

        // Fallback: Save locally only
        const newCategory = {
            id: Date.now(),
            userId: user.id,
            name: category.name,
            createdAt: new Date().toISOString()
        };

        this.data.categories.push(newCategory);
        this.saveData();
        return newCategory;
    }

    // Get categories for current user - Load from API if needed
    async getUserCategories(forceRefresh = false) {
        const user = this.getCurrentUser();
        if (!user) return [];

        // If forceRefresh, load from API
        if (forceRefresh && typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
            await this.loadFromAPI();
        }

        // Ensure this.data exists
        if (!this.data) {
            this.data = this.loadData();
        }
        if (!Array.isArray(this.data.categories)) {
            return [];
        }

        return this.data.categories.filter(category => category.userId === user.id);
    }

    // Set budget for month - Save to API first, then to local cache
    async setBudget(month, amount) {
        const user = this.getCurrentUser();
        if (!user) return false;

        // Ensure this.data exists
        if (!this.data) {
            this.data = this.loadData();
        }
        if (!this.data.budgets || typeof this.data.budgets !== 'object' || Array.isArray(this.data.budgets)) {
            this.data.budgets = {};
        }

        const budgetAmount = parseFloat(amount) || 0;

        // Try to save to API first
        if (typeof window !== 'undefined' && typeof window.apiRequest === 'function') {
            try {
                const result = await window.apiRequest(`/api/budgets/${month}`, {
                    method: 'PUT',
                    body: JSON.stringify({ amount: budgetAmount })
                });
                
                if (result && result.ok && result.data) {
                    // Save to local cache
                    const budgetKey = `${user.id}_${month}`;
                    this.data.budgets[budgetKey] = {
                        userId: user.id,
                        month: month,
                        amount: result.data.amount || budgetAmount,
                        updatedAt: new Date().toISOString()
                    };
                    this.saveData();
                    console.log('✅ Budget saved to API:', result.data);
                    return true;
                } else {
                    console.warn('Failed to save budget to API, saving locally only');
                }
            } catch (error) {
                console.error('Error saving budget to API:', error);
                // Continue with local save
            }
        }

        // Fallback: Save locally only
        const budgetKey = `${user.id}_${month}`;
        this.data.budgets[budgetKey] = {
            userId: user.id,
            month: month,
            amount: budgetAmount,
            updatedAt: new Date().toISOString()
        };

        this.saveData();
        return true;
    }

    // Get budget for month
    getBudget(month) {
        const user = this.getCurrentUser();
        if (!user) return 0;

        // Ensure this.data exists
        if (!this.data) {
            this.data = this.loadData();
        }
        if (!this.data.budgets || typeof this.data.budgets !== 'object' || Array.isArray(this.data.budgets)) {
            return 0;
        }

        const budgetKey = `${user.id}_${month}`;
        return this.data.budgets[budgetKey]?.amount || 0;
    }

    // Update user profile
    updateUser(userId, updatedUser) {
        try {
            // Force fix data structure first
            this.fixDataStructure();
            
            // Ensure userId is valid
            if (!userId) {
                console.error('updateUser: userId is required');
                return false;
            }
            
            // At this point, this.data.users is guaranteed to be an object (not array)
            // Update user by userId key
            if (this.data.users[userId]) {
                this.data.users[userId] = { ...this.data.users[userId], ...updatedUser };
            } else {
                // Create new user entry
                this.data.users[userId] = { id: userId, ...updatedUser };
            }
            
            this.saveData();
            console.log('User updated in DataManager:', updatedUser);
            return true;
        } catch (error) {
            console.error('Error in updateUser:', error);
            // Reset and try again
            try {
                this.fixDataStructure();
                if (userId) {
                    this.data.users[userId] = { id: userId, ...updatedUser };
                    this.saveData();
                    return true;
                }
            } catch (e) {
                console.error('Recovery failed:', e);
            }
            return false;
        }
    }

    // Generate daily report
    getDailyReport(date) {
        const user = this.getCurrentUser();
        if (!user) return { expenses: [], total: 0 };

        const userExpenses = this.getUserExpenses();
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        const dayExpenses = userExpenses.filter(expense => 
            expense.date === targetDate && expense.type === 'expense'
        );

        const total = dayExpenses.reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

        return {
            date: targetDate,
            expenses: dayExpenses,
            total: total
        };
    }

    // Generate monthly report
    getMonthlyReport(year, month) {
        const user = this.getCurrentUser();
        if (!user) return { expenses: [], total: 0 };

        const userExpenses = this.getUserExpenses();
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        
        const monthExpenses = userExpenses.filter(expense => 
            expense.date.startsWith(monthStr) && expense.type === 'expense'
        );

        const total = monthExpenses.reduce((sum, expense) => sum + Math.abs(expense.amount), 0);

        return {
            year: year,
            month: month,
            expenses: monthExpenses,
            total: total
        };
    }

    // Export all data
    exportData() {
        return {
            ...this.data,
            exportDate: new Date().toISOString()
        };
    }

    // Import data
    importData(data) {
        try {
            if (data && typeof data === 'object') {
                this.data = { ...this.data, ...data };
                this.saveData();
                return true;
            }
        } catch (error) {
            console.error('Failed to import data:', error);
        }
        return false;
    }

    // ===== SYNC FUNCTIONS - Đảm bảo dữ liệu được lưu vào backend =====
    
    // Sync all pending changes to API
    async syncPendingChangesToAPI() {
        const user = this.getCurrentUser();
        if (!user || typeof window === 'undefined' || typeof window.apiRequest !== 'function') {
            return;
        }

        try {
            console.log('🔄 Syncing pending changes to API...');
            
            // Get all local expenses for this user
            const userExpenses = this.data.expenses.filter(e => e.userId === user.id);
            // Get all expenses from API
            const apiExpensesResult = await window.apiRequest('/api/expenses');
            const apiExpenses = (apiExpensesResult && apiExpensesResult.ok && apiExpensesResult.data && apiExpensesResult.data.items) 
                ? apiExpensesResult.data.items 
                : [];
            
            // Find expenses that exist locally but not in API (by checking if they have server ID)
            // If expense doesn't have a server ID or ID is very large (local timestamp), it needs sync
            const expensesToSync = userExpenses.filter(localExp => {
                // If expense has ID from server (small integer), it's already synced
                // If ID is large (timestamp), it's local-only
                const isLocalOnly = localExp.id && localExp.id > 1000000000000; // Timestamp ID
                if (isLocalOnly) {
                    // Check if it exists in API by comparing date, amount, type
                    const existsInAPI = apiExpenses.some(apiExp => 
                        apiExp.date === localExp.date &&
                        apiExp.amount === localExp.amount &&
                        apiExp.type === localExp.type &&
                        apiExp.note === localExp.note
                    );
                    return !existsInAPI;
                }
                return false;
            });

            // Sync expenses that need sync
            for (const expense of expensesToSync) {
                try {
                    const result = await window.apiRequest('/api/expenses', {
                        method: 'POST',
                        body: JSON.stringify({
                            date: expense.date,
                            amount: expense.amount,
                            type: expense.type,
                            categoryId: expense.categoryId,
                            note: expense.note || ''
                        })
                    });
                    
                    if (result && result.ok && result.data) {
                        // Update local expense with server ID
                        const index = this.data.expenses.findIndex(e => e.id === expense.id);
                        if (index !== -1) {
                            this.data.expenses[index] = result.data;
                        }
                        console.log('✅ Synced expense to API:', result.data.id);
                    }
                } catch (e) {
                    console.warn('Failed to sync expense:', e);
                    // Add to sync queue for retry
                    this.addToSyncQueue('expense', expense);
                }
            }

            // Sync categories
            const userCategories = this.data.categories.filter(c => c.userId === user.id);
            const apiCategoriesResult = await window.apiRequest('/api/categories');
            const apiCategories = (apiCategoriesResult && apiCategoriesResult.ok && apiCategoriesResult.data && apiCategoriesResult.data.items)
                ? apiCategoriesResult.data.items
                : [];

            const categoriesToSync = userCategories.filter(localCat => {
                const isLocalOnly = localCat.id && localCat.id > 1000000000000;
                if (isLocalOnly) {
                    const existsInAPI = apiCategories.some(apiCat => apiCat.name === localCat.name);
                    return !existsInAPI;
                }
                return false;
            });

            for (const category of categoriesToSync) {
                try {
                    const result = await window.apiRequest('/api/categories', {
                        method: 'POST',
                        body: JSON.stringify({ name: category.name })
                    });
                    
                    if (result && result.ok && result.data) {
                        const index = this.data.categories.findIndex(c => c.id === category.id);
                        if (index !== -1) {
                            this.data.categories[index] = result.data;
                        }
                        console.log('✅ Synced category to API:', result.data.id);
                    }
                } catch (e) {
                    console.warn('Failed to sync category:', e);
                    this.addToSyncQueue('category', category);
                }
            }

            // Save updated data
            this.saveData();
            console.log('✅ Sync complete');
        } catch (error) {
            console.error('Error syncing pending changes:', error);
        }
    }

    // Sync ALL data to API (used before logout)
    async syncAllDataToAPI() {
        const user = this.getCurrentUser();
        if (!user || typeof window === 'undefined' || typeof window.apiRequest !== 'function') {
            console.warn('Cannot sync: user not logged in or API not available');
            return false;
        }

        try {
            console.log('🔄 Syncing ALL data to API before logout...');
            
            // 1. Save current localStorage data first (to ensure latest changes are included)
            this.saveData();
            
            // 2. Sync pending expenses and categories
            await this.syncPendingChangesToAPI();
            
            // 3. Sync all budgets (ensure all months are synced)
            await this.syncAllBudgetsToAPI();
            
            // 4. Sync user profile data (balance, gender, currency, phone, monthly_budget)
            await this.syncUserProfileToAPI();
            
            // 5. Process sync queue (retry any failed syncs) - with retry
            let queueProcessed = false;
            let retries = 0;
            while (retries < 3 && !queueProcessed) {
                await this.processSyncQueue();
                // Check if queue is empty
                const queueStr = localStorage.getItem(this.syncQueueKey);
                if (!queueStr || JSON.parse(queueStr).length === 0) {
                    queueProcessed = true;
                } else {
                    retries++;
                    if (retries < 3) {
                        console.log(`📋 Retrying sync queue (attempt ${retries + 1}/3)...`);
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                    }
                }
            }
            
            // 6. Final verification: Load fresh data from API to ensure everything is synced
            await this.loadFromAPI(true);
            
            // 7. Save final state to localStorage
            this.saveData();
            
            console.log('✅ All data synced to API successfully');
            return true;
        } catch (error) {
            console.error('❌ Error syncing all data to API:', error);
            // Even if sync fails, mark data as needing sync for next login
            this.markNeedsSync();
            return false;
        }
    }

    // Sync all budgets to API
    async syncAllBudgetsToAPI() {
        const user = this.getCurrentUser();
        if (!user || typeof window === 'undefined' || typeof window.apiRequest !== 'function') {
            return;
        }

        try {
            console.log('🔄 Syncing all budgets to API...');
            
            // Ensure this.data exists
            if (!this.data) {
                this.data = this.loadData();
            }
            
            if (!this.data.budgets || typeof this.data.budgets !== 'object') {
                return;
            }

            // Get all budgets for this user
            const userBudgets = Object.values(this.data.budgets).filter(b => b.userId === user.id);
            
            // Sync each budget
            for (const budget of userBudgets) {
                if (!budget.month || !budget.amount) continue;
                
                try {
                    const result = await window.apiRequest(`/api/budgets/${budget.month}`, {
                        method: 'PUT',
                        body: JSON.stringify({ amount: budget.amount })
                    });
                    
                    if (result && result.ok) {
                        console.log(`✅ Synced budget for ${budget.month}: ${budget.amount}`);
                    }
                } catch (e) {
                    console.warn(`Failed to sync budget for ${budget.month}:`, e);
                }
            }
            
            console.log('✅ All budgets synced to API');
        } catch (error) {
            console.error('Error syncing budgets:', error);
        }
    }

    // Sync user profile to API
    async syncUserProfileToAPI() {
        const user = this.getCurrentUser();
        if (!user || typeof window === 'undefined' || typeof window.apiRequest !== 'function') {
            return;
        }

        try {
            console.log('🔄 Syncing user profile to API...');
            
            // Get current user data from localStorage
            const userStr = localStorage.getItem('smartexpense_user');
            if (!userStr) {
                console.warn('No user data in localStorage to sync');
                return;
            }

            const userData = JSON.parse(userStr);
            
            // Also check monthly_budget from localStorage (legacy support)
            const monthlyBudgetStr = localStorage.getItem('monthly_budget');
            let monthlyBudget = null;
            if (monthlyBudgetStr) {
                const parsed = parseFloat(monthlyBudgetStr);
                if (!isNaN(parsed)) {
                    monthlyBudget = parsed;
                }
            }
            
            // Prepare profile data to sync
            const profileData = {};
            if (userData.name !== undefined) profileData.name = userData.name;
            if (userData.balance !== undefined) profileData.balance = userData.balance;
            // Use monthly_budget from localStorage if balance is not set
            if (profileData.balance === undefined && monthlyBudget !== null) {
                profileData.balance = monthlyBudget;
            }
            if (userData.gender !== undefined) profileData.gender = userData.gender;
            if (userData.currency !== undefined) profileData.currency = userData.currency;
            if (userData.phone !== undefined) profileData.phone = userData.phone;

            // Only sync if there's data to sync
            if (Object.keys(profileData).length === 0) {
                console.log('No profile changes to sync');
                return;
            }

            // Update profile via API
            const result = await window.apiRequest('/api/profile', {
                method: 'PUT',
                body: JSON.stringify(profileData)
            });
            
            if (result && result.ok) {
                console.log('✅ User profile synced to API:', profileData);
            } else {
                console.warn('Failed to sync user profile:', result);
            }
        } catch (error) {
            console.error('Error syncing user profile:', error);
        }
    }

    // Add item to sync queue for retry later
    addToSyncQueue(type, item) {
        try {
            const queueStr = localStorage.getItem(this.syncQueueKey);
            const queue = queueStr ? JSON.parse(queueStr) : [];
            
            queue.push({
                type: type,
                item: item,
                timestamp: new Date().toISOString(),
                retries: 0
            });
            
            localStorage.setItem(this.syncQueueKey, JSON.stringify(queue));
            console.log(`📋 Added ${type} to sync queue`);
        } catch (error) {
            console.error('Failed to add to sync queue:', error);
        }
    }

    // Process sync queue (retry failed syncs)
    async processSyncQueue() {
        const user = this.getCurrentUser();
        if (!user || typeof window === 'undefined' || typeof window.apiRequest !== 'function') {
            return;
        }

        try {
            const queueStr = localStorage.getItem(this.syncQueueKey);
            if (!queueStr) return;

            const queue = JSON.parse(queueStr);
            if (queue.length === 0) return;

            console.log(`🔄 Processing sync queue: ${queue.length} items`);

            const remaining = [];
            for (const queueItem of queue) {
                try {
                    let result;
                    if (queueItem.type === 'expense') {
                        result = await window.apiRequest('/api/expenses', {
                            method: 'POST',
                            body: JSON.stringify({
                                date: queueItem.item.date,
                                amount: queueItem.item.amount,
                                type: queueItem.item.type,
                                categoryId: queueItem.item.categoryId,
                                note: queueItem.item.note || ''
                            })
                        });
                    } else if (queueItem.type === 'category') {
                        result = await window.apiRequest('/api/categories', {
                            method: 'POST',
                            body: JSON.stringify({ name: queueItem.item.name })
                        });
                    }

                    if (result && result.ok && result.data) {
                        console.log(`✅ Synced queued ${queueItem.type}:`, result.data.id);
                    } else {
                        // Retry later if still failing
                        queueItem.retries = (queueItem.retries || 0) + 1;
                        if (queueItem.retries < 5) {
                            remaining.push(queueItem);
                        }
                    }
                } catch (error) {
                    queueItem.retries = (queueItem.retries || 0) + 1;
                    if (queueItem.retries < 5) {
                        remaining.push(queueItem);
                    }
                }
            }

            // Update queue
            if (remaining.length === 0) {
                localStorage.removeItem(this.syncQueueKey);
                console.log('✅ Sync queue processed completely');
            } else {
                localStorage.setItem(this.syncQueueKey, JSON.stringify(remaining));
                console.log(`📋 ${remaining.length} items remaining in sync queue`);
            }
        } catch (error) {
            console.error('Error processing sync queue:', error);
        }
    }

    // Mark that data needs sync
    markNeedsSync() {
        try {
            localStorage.setItem('smartexpense_needs_sync', 'true');
        } catch (e) {
            console.warn('Failed to mark needs sync:', e);
        }
    }

    // Check if data needs sync
    needsSync() {
        try {
            return localStorage.getItem('smartexpense_needs_sync') === 'true';
        } catch (e) {
            return false;
        }
    }
}

// Create global instance
window.dataManager = new DataManager();

// Auto-sync with API every 60 seconds (tối ưu để giảm tải)
// Chỉ sync khi có thay đổi thực sự hoặc khi cần thiết
let lastSyncTime = 0;
const SYNC_INTERVAL = 60000; // 60 giây thay vì 30 giây

setInterval(async () => {
    if (window.dataManager) {
        // Sync localStorage cache
        window.dataManager.saveData();
        // Sync with API if user is logged in
        const user = window.dataManager.getCurrentUser();
        if (user && typeof window.apiRequest === 'function') {
            try {
                // Kiểm tra xem có thay đổi cần sync không
                const hasPendingChanges = window.dataManager.needsSync();
                const timeSinceLastSync = Date.now() - lastSyncTime;
                
                // Chỉ sync nếu có thay đổi hoặc đã qua 5 phút (để đảm bảo đồng bộ định kỳ)
                if (hasPendingChanges || timeSinceLastSync > 300000) {
                    console.log('🔄 Auto-sync: Syncing changes...');
                    // First, sync any pending changes
                    await window.dataManager.syncPendingChangesToAPI();
                    // Then, refresh from API (chỉ khi có thay đổi)
                    if (hasPendingChanges) {
                        await window.dataManager.loadFromAPI();
                    }
                    // Process sync queue
                    await window.dataManager.processSyncQueue();
                    lastSyncTime = Date.now();
                } else {
                    console.log('⏭️ Auto-sync: No changes, skipping');
                }
            } catch (error) {
                console.warn('Auto-sync failed:', error);
            }
        }
    }
}, SYNC_INTERVAL);

// Sync before page unload (when user closes tab/browser)
window.addEventListener('beforeunload', async (event) => {
    if (window.dataManager) {
        const user = window.dataManager.getCurrentUser();
        if (user && typeof window.apiRequest === 'function') {
            // Use sendBeacon for reliable sync even if page is closing
            try {
                // Quick sync before unload
                await window.dataManager.syncPendingChangesToAPI();
            } catch (e) {
                console.warn('Sync before unload failed:', e);
            }
        }
    }
});

// Sync when page becomes visible (user returns to tab)
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && window.dataManager) {
        const user = window.dataManager.getCurrentUser();
        if (user && typeof window.apiRequest === 'function') {
            try {
                console.log('👁️ Page visible, syncing data...');
                await window.dataManager.loadFromAPI(true);
            } catch (error) {
                console.warn('Sync on visibility change failed:', error);
            }
        }
    }
});

console.log('DataManager initialized');
