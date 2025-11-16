const express = require('express');
const { authRequired } = require('../middleware/auth');
const aiService = require('../ai/aiService');

const router = express.Router();

// Import database module
let db = null;
try {
  db = require('../database');
} catch (error) {
  console.log('⚠️ Database module not available for AI routes');
}

// Keyword to category mapping (same as Flask version)
const KEYWORD_TO_CATEGORY = {
  'grab': 'Di chuyển',
  'taxi': 'Di chuyển',
  'xang': 'Di chuyển',
  'xăng': 'Di chuyển',
  'bus': 'Di chuyển',
  'cafe': 'Ăn uống',
  'cà phê': 'Ăn uống',
  'trasua': 'Ăn uống',
  'trà sữa': 'Ăn uống',
  'kfc': 'Ăn uống',
  'lotteria': 'Ăn uống',
  'com': 'Ăn uống',
  'cơm': 'Ăn uống',
  'an trua': 'Ăn uống',
  'ăn trưa': 'Ăn uống',
  'sieu thi': 'Nhà ở',
  'siêu thị': 'Nhà ở',
  'dien': 'Nhà ở',
  'điện': 'Nhà ở',
  'nuoc': 'Nhà ở',
  'nước': 'Nhà ở',
  'tien nha': 'Nhà ở',
  'tiền nhà': 'Nhà ở',
};

async function findCategoryIdByName(userId, name) {
  if (!db) return null;
  try {
    const categories = await db.getCategoriesByUserId(userId);
    const found = categories.find(cat => cat.name.toLowerCase() === name.toLowerCase());
    return found ? found.id : null;
  } catch (error) {
    console.error('Error finding category by name:', error);
    return null;
  }
}

function budgetKey(userId, yyyymm) {
  return `${userId}:${yyyymm}`;
}

function monthEnd(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  return new Date(year, month + 1, 0);
}

// Auto-categorize
router.post('/categorize', authRequired, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: 'Database not available' });
    }

    const { description, merchant } = req.body;
    const text = `${description || ''} ${merchant || ''}`.toLowerCase();
    
    // Rule-based matching
    let matchedName = null;
    for (const [key, catName] of Object.entries(KEYWORD_TO_CATEGORY)) {
      if (text.includes(key)) {
        matchedName = catName;
        break;
      }
    }
    
    let confidence = matchedName ? 0.6 : 0.2;
    let categoryId = matchedName ? await findCategoryIdByName(req.user.id, matchedName) : null;
    
    // Try ML model if available and no rule matched
    if (!categoryId && aiService.isModelAvailable()) {
      try {
        const [predCategoryId, prob] = aiService.predictCategory(text);
        if (predCategoryId) {
          const userCategory = await db.getCategoryById(predCategoryId, req.user.id);
          if (userCategory) {
            categoryId = predCategoryId;
            matchedName = userCategory.name;
            confidence = prob;
          }
        }
      } catch (error) {
        console.warn('ML prediction failed:', error);
      }
    }
    
    res.json({
      categoryId,
      categoryName: matchedName,
      confidence,
      strategy: categoryId ? (matchedName ? 'rule' : 'ml') : 'none'
    });
  } catch (error) {
    console.error('Categorize error:', error);
    res.status(500).json({ message: 'Lỗi phân loại' });
  }
});

// Forecast spending
router.get('/forecast', authRequired, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: 'Database not available' });
    }

    const userId = req.user.id;
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const yyyymm = `${year}-${month.toString().padStart(2, '0')}`;
    const endOfMonth = monthEnd(today);
    
    // Get month expenses from database
    const allExpenses = await db.getExpensesByUserId(userId, {
      date_from: `${yyyymm}-01`,
      date_to: `${yyyymm}-31`
    });
    
    const monthExpenses = allExpenses.filter(e => 
      e.date && 
      e.date.startsWith(yyyymm) &&
      (e.type === 'expense' || e.amount < 0)
    );
    
    const totalSpent = monthExpenses.reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const daysPassed = today.getDate();
    const avgPerDay = totalSpent / Math.max(1, daysPassed);
    const daysTotal = endOfMonth.getDate();
    const forecast = avgPerDay * daysTotal;
    
    // Budget is not implemented in database yet, return 0
    const budget = { amount: 0 };
    
    res.json({
      month: yyyymm,
      spentToDate: Math.round(totalSpent * 100) / 100,
      avgPerDay: Math.round(avgPerDay * 100) / 100,
      forecast: Math.round(forecast * 100) / 100,
      budget: budget.amount
    });
  } catch (error) {
    console.error('Forecast error:', error);
    res.status(500).json({ message: 'Lỗi dự báo' });
  }
});

// Budget alerts
router.get('/alerts', authRequired, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: 'Database not available' });
    }

    // Get forecast data
    const userId = req.user.id;
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const yyyymm = `${year}-${month.toString().padStart(2, '0')}`;
    
    // Get month expenses from database
    const allExpenses = await db.getExpensesByUserId(userId, {
      date_from: `${yyyymm}-01`,
      date_to: `${yyyymm}-31`
    });
    
    const monthExpenses = allExpenses.filter(e => 
      e.date && 
      e.date.startsWith(yyyymm) &&
      (e.type === 'expense' || e.amount < 0)
    );
    
    const totalSpent = monthExpenses.reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const daysPassed = today.getDate();
    const avgPerDay = totalSpent / Math.max(1, daysPassed);
    const endOfMonth = monthEnd(today);
    const forecast = avgPerDay * endOfMonth.getDate();
    
    // Budget is not implemented in database yet, return 0
    const budget = { amount: 0 };
    
    const alerts = [];
    if (budget.amount > 0 && forecast > 0) {
      const usedPercent = Math.round((forecast / budget.amount) * 100);
      let level, message;
      
      if (usedPercent >= 100) {
        level = 'over';
        message = 'Dự báo vượt quá ngân sách tháng';
      } else if (usedPercent >= 85) {
        level = 'high';
        message = 'Cảnh báo: Dự báo sẽ chạm 85%+ ngân sách';
      } else if (usedPercent >= 70) {
        level = 'medium';
        message = 'Lưu ý: Dự báo sẽ vượt 70% ngân sách';
      } else {
        level = 'ok';
        message = 'Chi tiêu trong ngưỡng an toàn';
      }
      
      alerts.push({
        level,
        message,
        usedPercent
      });
    }
    
    res.json({ alerts });
  } catch (error) {
    console.error('Alerts error:', error);
    res.status(500).json({ message: 'Lỗi cảnh báo' });
  }
});

// Insights
router.get('/insights', authRequired, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: 'Database not available' });
    }

    const userId = req.user.id;
    const today = new Date();
    const insights = [];
    
    // Compare last 7 days vs previous 7 days
    const last7Days = [];
    const prev7Days = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      last7Days.push(dateStr);
    }
    
    for (let i = 7; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      prev7Days.push(dateStr);
    }
    
    // Get expenses from database
    const allExpenses = await db.getExpensesByUserId(userId);
    
    const last7Amount = allExpenses
      .filter(e => last7Days.includes(e.date) && (e.type === 'expense' || e.amount < 0))
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
    
    const prev7Amount = allExpenses
      .filter(e => prev7Days.includes(e.date) && (e.type === 'expense' || e.amount < 0))
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
    
    if (prev7Amount > 0) {
      const change = Math.round(((last7Amount - prev7Amount) / prev7Amount) * 100);
      if (Math.abs(change) >= 20) {
        insights.push({
          type: 'trend',
          message: `Chi tiêu 7 ngày qua thay đổi ${change}% so với tuần trước`
        });
      }
    }
    
    // Top category this month
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const yyyymm = `${year}-${month.toString().padStart(2, '0')}`;
    
    const categoryTotals = new Map();
    allExpenses
      .filter(e => e.date && e.date.startsWith(yyyymm) && (e.type === 'expense' || e.amount < 0))
      .forEach(e => {
        const categoryId = e.category_id || 0;
        const current = categoryTotals.get(categoryId) || 0;
        categoryTotals.set(categoryId, current + Math.abs(e.amount));
      });
    
    if (categoryTotals.size > 0) {
      const topCategoryId = Array.from(categoryTotals.entries())
        .reduce((max, [id, amount]) => amount > max.amount ? { id, amount } : max, { id: 0, amount: 0 }).id;
      
      let topName = 'Khác';
      if (topCategoryId > 0) {
        try {
          const topCategory = await db.getCategoryById(topCategoryId, userId);
          if (topCategory) {
            topName = topCategory.name;
          }
        } catch (error) {
          console.warn('Error getting top category:', error);
        }
      }
      
      insights.push({
        type: 'category',
        message: `Danh mục chi tiêu nhiều nhất tháng này: ${topName}`
      });
    }
    
    // Budget recommendation
    const avgDay = last7Amount / 7;
    if (avgDay > 0) {
      const endOfMonth = monthEnd(today);
      const suggestBudget = Math.round(avgDay * endOfMonth.getDate() * 1.1);
      
      insights.push({
        type: 'budget_suggestion',
        message: `Gợi ý ngân sách tháng tới: ~ ${suggestBudget.toLocaleString()}đ`
      });
    }
    
    res.json({ insights });
  } catch (error) {
    console.error('Insights error:', error);
    res.status(500).json({ message: 'Lỗi insights' });
  }
});

// Smart chat
router.post('/chat', authRequired, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: 'Database not available' });
    }

    const { text } = req.body;
    
    if (!text || !text.trim()) {
      return res.json({ reply: 'Xin chào! Tôi có thể giúp gì cho bạn?' });
    }
    
    const textLower = text.toLowerCase();
    
    // Simple intent: create expense like "tạo chi 50000 cafe"
    const createMatch = textLower.match(/tạo\s+chi\s+(\d+)/);
    if (createMatch) {
      const amount = -parseInt(createMatch[1]);
      const expense = await db.createExpense(req.user.id, {
        date: new Date().toISOString().split('T')[0],
        amount: Math.abs(amount),
        type: 'expense',
        categoryId: null,
        categoryName: null,
        note: 'chat-created'
      });
      
      return res.json({
        reply: `Đã tạo chi tiêu ${Math.abs(amount).toLocaleString()}đ hôm nay.`,
        created: {
          id: expense.id,
          userId: expense.user_id,
          date: expense.date,
          amount: expense.amount,
          type: expense.type,
          categoryId: expense.category_id,
          note: expense.note
        }
      });
    }
    
    // Fallback response
    res.json({
      reply: 'Mình có thể giúp gợi ý danh mục, dự báo chi tiêu và cảnh báo ngân sách. Bạn muốn làm gì?'
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ message: 'Lỗi chat' });
  }
});

// Admin training endpoint
router.post('/admin/train_categories', authRequired, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ message: 'Database not available' });
    }

    const userId = req.user.id;
    const allExpenses = await db.getExpensesByUserId(userId);
    const labeledExpenses = allExpenses.filter(e => e.category_id);
    
    if (labeledExpenses.length < 5) {
      return res.status(400).json({ message: 'Chưa đủ dữ liệu có nhãn (>=5)' });
    }
    
    const texts = labeledExpenses.map(e => 
      `${e.note || ''} ${e.date} ${e.amount}`.trim()
    );
    const labels = labeledExpenses.map(e => e.category_id);
    
    aiService.trainCategoryModel(texts, labels);
    
    res.json({
      trained: true,
      count: labels.length
    });
  } catch (error) {
    console.error('Train error:', error);
    res.status(500).json({ message: `Lỗi train: ${error.message}` });
  }
});

module.exports = router;
