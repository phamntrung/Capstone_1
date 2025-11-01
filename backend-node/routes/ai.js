const express = require('express');
const { authRequired } = require('../middleware/auth');
const aiService = require('../ai/aiService');

const router = express.Router();

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

// Import data stores
const expenses = require('../data/expenses');
const categoriesById = require('../data/categories');
const budgetsByKey = require('../data/budgets');

function findCategoryIdByName(userId, name) {
  for (const [id, cat] of categoriesById.entries()) {
    if (cat.userId === userId && cat.name.toLowerCase() === name.toLowerCase()) {
      return id;
    }
  }
  return null;
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
router.post('/categorize', authRequired, (req, res) => {
  try {
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
    let categoryId = matchedName ? findCategoryIdByName(req.user.id, matchedName) : null;
    
    // Try ML model if available and no rule matched
    if (!categoryId && aiService.isModelAvailable()) {
      try {
        const [predCategoryId, prob] = aiService.predictCategory(text);
        if (predCategoryId) {
          const userHasCategory = categoriesById.get(predCategoryId);
          if (userHasCategory && userHasCategory.userId === req.user.id) {
            categoryId = predCategoryId;
            matchedName = userHasCategory.name;
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
router.get('/forecast', authRequired, (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const yyyymm = `${year}-${month.toString().padStart(2, '0')}`;
    const endOfMonth = monthEnd(today);
    
    // Get month expenses
    const monthExpenses = expenses.filter(e => 
      e.userId === userId && 
      e.date && 
      e.date.startsWith(yyyymm) &&
      (e.type === 'expense' || e.amount < 0)
    );
    
    const totalSpent = monthExpenses.reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const daysPassed = today.getDate();
    const avgPerDay = totalSpent / Math.max(1, daysPassed);
    const daysTotal = endOfMonth.getDate();
    const forecast = avgPerDay * daysTotal;
    
    // Get budget
    const budgetKey = `${userId}:${yyyymm.replace('-', '')}`;
    const budget = budgetsByKey.get(budgetKey) || { amount: 0 };
    
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
router.get('/alerts', authRequired, (req, res) => {
  try {
    // Get forecast data
    const userId = req.user.id;
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const yyyymm = `${year}-${month.toString().padStart(2, '0')}`;
    
    const monthExpenses = expenses.filter(e => 
      e.userId === userId && 
      e.date && 
      e.date.startsWith(yyyymm) &&
      (e.type === 'expense' || e.amount < 0)
    );
    
    const totalSpent = monthExpenses.reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const daysPassed = today.getDate();
    const avgPerDay = totalSpent / Math.max(1, daysPassed);
    const endOfMonth = monthEnd(today);
    const forecast = avgPerDay * endOfMonth.getDate();
    
    const budgetKey = `${userId}:${yyyymm.replace('-', '')}`;
    const budget = budgetsByKey.get(budgetKey) || { amount: 0 };
    
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
router.get('/insights', authRequired, (req, res) => {
  try {
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
    
    const last7Amount = expenses
      .filter(e => e.userId === userId && last7Days.includes(e.date) && (e.type === 'expense' || e.amount < 0))
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
    
    const prev7Amount = expenses
      .filter(e => e.userId === userId && prev7Days.includes(e.date) && (e.type === 'expense' || e.amount < 0))
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
    expenses
      .filter(e => e.userId === userId && e.date && e.date.startsWith(yyyymm) && (e.type === 'expense' || e.amount < 0))
      .forEach(e => {
        const categoryId = e.categoryId || 0;
        const current = categoryTotals.get(categoryId) || 0;
        categoryTotals.set(categoryId, current + Math.abs(e.amount));
      });
    
    if (categoryTotals.size > 0) {
      const topCategoryId = Array.from(categoryTotals.entries())
        .reduce((max, [id, amount]) => amount > max.amount ? { id, amount } : max, { id: 0, amount: 0 }).id;
      
      const topCategory = categoriesById.get(topCategoryId);
      const topName = topCategory ? topCategory.name : 'Khác';
      
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
router.post('/chat', authRequired, (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || !text.trim()) {
      return res.json({ reply: 'Xin chào! Tôi có thể giúp gì cho bạn?' });
    }
    
    const textLower = text.toLowerCase();
    
    // Simple intent: create expense like "tạo chi 50000 cafe"
    const createMatch = textLower.match(/tạo\s+chi\s+(\d+)/);
    if (createMatch) {
      const amount = -parseInt(createMatch[1]);
      const expense = {
        id: Math.max(...expenses.map(e => e.id), 0) + 1,
        userId: req.user.id,
        date: new Date().toISOString().split('T')[0],
        amount,
        type: 'expense',
        categoryId: null,
        note: 'chat-created'
      };
      
      expenses.push(expense);
      
      return res.json({
        reply: `Đã tạo chi tiêu ${Math.abs(amount).toLocaleString()}đ hôm nay.`,
        created: expense
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
router.post('/admin/train_categories', authRequired, (req, res) => {
  try {
    const userId = req.user.id;
    const labeledExpenses = expenses.filter(e => e.userId === userId && e.categoryId);
    
    if (labeledExpenses.length < 5) {
      return res.status(400).json({ message: 'Chưa đủ dữ liệu có nhãn (>=5)' });
    }
    
    const texts = labeledExpenses.map(e => 
      `${e.note || ''} ${e.date} ${e.amount}`.trim()
    );
    const labels = labeledExpenses.map(e => e.categoryId);
    
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
