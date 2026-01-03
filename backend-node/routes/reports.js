const express = require('express');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Import database module
let db = null;
try {
  db = require('../database');
} catch (error) {
  console.log('⚠️ Database module not available for reports');
}

// Định dạng ngày theo múi giờ Việt Nam để đồng bộ dữ liệu giữa backend và frontend
const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VIETNAM_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

// Chuẩn hoá ngày về dạng YYYY-MM-DD (múi giờ Việt Nam)
function toVietnamDateString(value) {
  if (!value && value !== 0) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{8}$/.test(trimmed)) {
      return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
    }

    const replaced = trimmed.includes(' ') ? trimmed.replace(' ', 'T') : trimmed;
    const parsedFromString = new Date(replaced);
    if (!Number.isNaN(parsedFromString.getTime())) {
      return vietnamDateFormatter.format(parsedFromString);
    }

    if (trimmed.length >= 10) {
      return trimmed.slice(0, 10);
    }
    return '';
  }

  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      return vietnamDateFormatter.format(value);
    }
    return '';
  }

  if (typeof value === 'number') {
    const parsedFromNumber = new Date(value);
    if (!Number.isNaN(parsedFromNumber.getTime())) {
      return vietnamDateFormatter.format(parsedFromNumber);
    }
  }

  return '';
}

// Tạo Date (UTC) từ chuỗi YYYY-MM-DD, đảm bảo tính toán không lệch ngày
function createUTCDateFromVietnamString(dateString) {
  if (!dateString) return null;
  const parts = dateString.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

// Lấy ngày hiện tại theo múi giờ Việt Nam
function getTodayVietnam() {
  const todayStr = toVietnamDateString(new Date());
  const todayDate = createUTCDateFromVietnamString(todayStr) || new Date();
  return { todayStr, todayDate };
}

function budgetKey(userId, yyyymm) {
  return `${userId}:${yyyymm}`;
}

function monthEnd(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  return new Date(year, month + 1, 0);
}

/**
 * Lưu report vào database
 */
async function saveReportToDB(userId, reportType, period, data) {
  if (!db || !db.query) {
    return null; // Database not available
  }
  
  try {
    const { amount, budget, transactions, categoryId, categoryName, percentage, metadata } = data;
    
    // Insert or update report
    await db.query(
      `INSERT INTO reports (
        user_id, report_type, period, amount, budget, transactions,
        category_id, category_name, percentage, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        amount = VALUES(amount),
        budget = VALUES(budget),
        transactions = VALUES(transactions),
        category_id = VALUES(category_id),
        category_name = VALUES(category_name),
        percentage = VALUES(percentage),
        metadata = VALUES(metadata),
        updated_at = NOW()`,
      [
        userId,
        reportType,
        period,
        amount || 0,
        budget || null,
        transactions || 0,
        categoryId || null,
        categoryName || null,
        percentage || null,
        metadata ? JSON.stringify(metadata) : null
      ]
    );
    
    return true;
  } catch (error) {
    console.error('Error saving report to DB:', error);
    return null;
  }
}

/**
 * Lưu report cache vào database
 */
async function saveReportCacheToDB(userId, cacheKey, cacheData, expiresInHours = 1) {
  if (!db || !db.query) {
    return null;
  }
  
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    
    await db.query(
      `INSERT INTO report_cache (
        user_id, cache_key, cache_data, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        cache_data = VALUES(cache_data),
        expires_at = VALUES(expires_at),
        updated_at = NOW()`,
      [
        userId,
        cacheKey,
        JSON.stringify(cacheData),
        expiresAt.toISOString().slice(0, 19).replace('T', ' ')
      ]
    );
    
    return true;
  } catch (error) {
    console.error('Error saving report cache to DB:', error);
    return null;
  }
}

/**
 * Đọc report cache từ database
 */
async function getReportCacheFromDB(userId, cacheKey) {
  if (!db || !db.query) {
    return null;
  }
  
  try {
    const results = await db.query(
      `SELECT cache_data, expires_at FROM report_cache
       WHERE user_id = ? AND cache_key = ? AND expires_at > NOW()`,
      [userId, cacheKey]
    );
    
    if (results.length > 0) {
      return JSON.parse(results[0].cache_data);
    }
    
    return null;
  } catch (error) {
    console.error('Error reading report cache from DB:', error);
    return null;
  }
}

/**
 * Lấy expenses từ database
 */
async function getUserExpenses(userId) {
  if (!db || !db.getExpensesByUserId) {
    throw new Error('Database not available');
  }
  
  try {
    const results = await db.getExpensesByUserId(userId);
    return results.map(e => ({
      id: e.id,
      userId: e.user_id,
      date: toVietnamDateString(e.date),
      amount: parseFloat(e.amount) || 0,
      type: e.type || (e.amount < 0 ? 'expense' : 'income'),
      categoryId: e.category_id || null,
      note: e.note || ''
    }));
  } catch (error) {
    console.error('Error loading expenses from DB:', error);
    throw error;
  }
}

// Get summary report
router.get('/summary', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { todayStr, todayDate } = getTodayVietnam();
    
    // Check cache first
    const cacheKey = 'summary';
    const cachedData = await getReportCacheFromDB(userId, cacheKey);
    if (cachedData) {
      console.log(`✅ Using cached report for user ${userId}`);
      return res.json(cachedData);
    }
    
    // Get expenses from database or in-memory
    const userExpenses = await getUserExpenses(userId);
    
    // Daily data - last 10 days
    const daily = [];
    for (let i = 0; i < 10; i++) {
      const date = new Date(todayDate);
      date.setUTCDate(date.getUTCDate() - i);
      const dateStr = toVietnamDateString(date);
      
      const dayExpenses = userExpenses.filter(e => 
        e.date === dateStr && (e.type === 'expense' || e.amount < 0)
      );
      
      const dayAmount = dayExpenses.reduce((sum, e) => sum + Math.abs(e.amount), 0);
      const transactionCount = dayExpenses.length;
      
      daily.push({
        date: dateStr,
        amount: Math.round(dayAmount * 100) / 100,
        transactions: transactionCount
      });
    }
    
    // Monthly data - last 6 months
    const monthly = [];
    const baseDate = createUTCDateFromVietnamString(`${todayStr.slice(0, 7)}-01`) || new Date(todayDate);
    
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(baseDate);
      monthDate.setUTCMonth(monthDate.getUTCMonth() - i);
      
      const year = monthDate.getUTCFullYear();
      const month = monthDate.getUTCMonth() + 1;
      const yyyymm = `${year}-${month.toString().padStart(2, '0')}`;
      const label = `${month.toString().padStart(2, '0')}/${year}`;
      
      const monthExpenses = userExpenses.filter(e => 
        e.date && e.date.startsWith(yyyymm) && (e.type === 'expense' || e.amount < 0)
      );
      
      const monthAmount = monthExpenses.reduce((sum, e) => sum + Math.abs(e.amount), 0);
      const transactionCount = monthExpenses.length;
      
      // Budget is not implemented in database yet, return 0
      const budget = { amount: 0 };
      
      monthly.push({
        month: label,
        amount: Math.round(monthAmount * 100) / 100,
        budget: budget.amount,
        transactions: transactionCount
      });
    }
    
    // Category totals
    const categoryTotals = new Map();
    userExpenses.forEach(e => {
      if (e.type === 'expense' || e.amount < 0) {
        const categoryId = e.categoryId || 0;
        const current = categoryTotals.get(categoryId) || 0;
        categoryTotals.set(categoryId, current + Math.abs(e.amount));
      }
    });
    
    const categories = [];
    const totalFirstMonth = monthly[0]?.amount || 0;
    
    // Get all user categories from database
    const userCategories = await db.getCategoriesByUserId(userId);
    const categoryMap = new Map(userCategories.map(c => [c.id, c]));
    
    categoryTotals.forEach((amount, categoryId) => {
      const category = categoryMap.get(categoryId);
      const name = category ? category.name : 'Khác';
      const percentage = totalFirstMonth > 0 ? Math.round((amount / totalFirstMonth) * 100) : 0;
      
      categories.push({
        id: categoryId,
        name,
        amount: Math.round(amount * 100) / 100,
        percentage
      });
    });
    
    const reportData = {
      daily,
      monthly,
      categories
    };
    
    // Save individual reports to database
    if (db && db.query) {
      // Save daily reports
      for (const day of daily) {
        await saveReportToDB(userId, 'daily', day.date, {
          amount: day.amount,
          transactions: day.transactions
        });
      }
      
      // Save monthly reports
      for (const month of monthly) {
        // Convert MM/YYYY to YYYY-MM
        const parts = month.month.split('/');
        const period = parts.length === 2 ? `${parts[1]}-${parts[0]}` : month.month;
        await saveReportToDB(userId, 'monthly', period, {
          amount: month.amount,
          budget: month.budget,
          transactions: month.transactions
        });
      }
      
      // Save category reports
      for (const cat of categories) {
        await saveReportToDB(userId, 'category', 'all', {
          amount: cat.amount,
          categoryId: cat.id,
          categoryName: cat.name,
          percentage: cat.percentage
        });
      }
      
      // Save cache for 1 hour
      await saveReportCacheToDB(userId, cacheKey, reportData, 1);
    }
    
    res.json(reportData);
  } catch (error) {
    console.error('Report summary error:', error);
    res.status(500).json({ message: 'Lỗi tạo báo cáo' });
  }
});

// POST endpoint để lưu report (có thể gọi từ frontend)
router.post('/save', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reportType, period, data } = req.body;
    
    if (!reportType || !period || !data) {
      return res.status(400).json({ message: 'Thiếu thông tin báo cáo' });
    }
    
    const saved = await saveReportToDB(userId, reportType, period, data);
    
    if (saved) {
      res.json({ message: 'Đã lưu báo cáo thành công', saved: true });
    } else {
      res.status(500).json({ message: 'Không thể lưu báo cáo' });
    }
  } catch (error) {
    console.error('Save report error:', error);
    res.status(500).json({ message: 'Lỗi lưu báo cáo' });
  }
});


module.exports = router;
