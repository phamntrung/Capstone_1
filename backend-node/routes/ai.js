const express = require('express');
const { authRequired } = require('../middleware/auth');
const aiService = require('../ai/aiService');
const OpenAI = require('openai');

const router = express.Router();

// Initialize OpenAI client
let openaiClient = null;
try {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    openaiClient = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: false // Server-side only
    });
    console.log('✅ OpenAI client initialized');
  } else {
    console.warn('⚠️ OPENAI_API_KEY not found in environment variables');
  }
} catch (error) {
  console.error('❌ Failed to initialize OpenAI client:', error);
}

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

// Classify voice input to expense data using OpenAI
router.post('/classify', authRequired, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Text is required' });
    }

    // If OpenAI is not available, fallback to simple parsing
    if (!openaiClient) {
      console.warn('⚠️ OpenAI not available, using fallback parsing');
      return res.json(parseExpenseTextFallback(text));
    }

    const prompt = `Phân tích câu nói về chi tiêu: "${text}"

Trả về JSON theo đúng format sau (KHÔNG có markdown, KHÔNG có giải thích, CHỈ trả về JSON):

{
  "amount": số tiền dạng number (bắt buộc),
  "category": "ăn uống | xăng xe | hoá đơn | mua sắm | giải trí | chuyển khoản | lương | khác" (bắt buộc),
  "note": "mô tả ngắn gọn KHÔNG BAO GỒM số tiền" (bắt buộc)
}

QUAN TRỌNG:
- "note" là phần mô tả chi tiêu, KHÔNG được bao gồm số tiền
- Tách riêng số tiền ra khỏi phần mô tả
- Nếu người dùng nói "ăn uống 30000" thì note là "ăn uống" (không có 30000)

Ví dụ:
- "Cà phê 50000" → {"amount": 50000, "category": "ăn uống", "note": "Cà phê"}
- "Đổ xăng 200000" → {"amount": 200000, "category": "xăng xe", "note": "Đổ xăng"}
- "Tiền điện tháng này 500000" → {"amount": 500000, "category": "hoá đơn", "note": "Tiền điện"}
- "Mua quần áo 300000" → {"amount": 300000, "category": "mua sắm", "note": "Mua quần áo"}
- "ăn uống 30000" → {"amount": 30000, "category": "ăn uống", "note": "ăn uống"}

Nếu không thể xác định số tiền, trả về {"amount": 0, "category": "khác", "note": "Không xác định"}`;

    try {
      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Bạn là trợ lý phân tích chi tiêu. Trả về JSON hợp lệ, không có markdown, không có giải thích.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      });

      const responseText = completion.choices[0]?.message?.content?.trim() || '';
      
      // Remove markdown code blocks if present
      let jsonText = responseText;
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }
      
      jsonText = jsonText.trim();

      try {
        const parsed = JSON.parse(jsonText);
        
        // Validate and normalize
        // Đảm bảo note không bao gồm số tiền
        let note = parsed.note || text.trim();
        // Loại bỏ số tiền khỏi note nếu có
        note = note.replace(/\d+[.,\s]?\d*(?:k|nghìn|ngàn)?/gi, '').trim();
        // Nếu note rỗng sau khi loại bỏ số, dùng text gốc (đã loại số)
        if (!note || note.length === 0) {
          note = text.trim().replace(/\d+[.,\s]?\d*(?:k|nghìn|ngàn)?/gi, '').trim();
          if (!note || note.length === 0) {
            note = 'Chi tiêu';
          }
        }
        
        const result = {
          amount: typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : 0,
          category: parsed.category || 'khác',
          note: note
        };

        // Map category to database category names if needed
        const categoryMap = {
          'ăn uống': 'Ăn uống',
          'xăng xe': 'Di chuyển',
          'hoá đơn': 'Nhà ở',
          'mua sắm': 'Mua sắm',
          'giải trí': 'Giải trí',
          'chuyển khoản': 'Chuyển khoản',
          'lương': 'Thu nhập',
          'khác': 'Khác'
        };

        result.categoryName = categoryMap[result.category.toLowerCase()] || 'Khác';

        // Try to find categoryId from database
        if (db) {
          try {
            const categoryId = await findCategoryIdByName(req.user.id, result.categoryName);
            if (categoryId) {
              result.categoryId = categoryId;
            }
          } catch (error) {
            console.warn('Error finding category ID:', error);
          }
        }

        return res.json(result);
      } catch (parseError) {
        console.error('❌ Failed to parse OpenAI response:', parseError);
        console.error('Response text:', responseText);
        // Fallback to simple parsing
        return res.json(parseExpenseTextFallback(text));
      }
    } catch (openaiError) {
      console.error('❌ OpenAI API error:', openaiError);
      // Fallback to simple parsing
      return res.json(parseExpenseTextFallback(text));
    }
  } catch (error) {
    console.error('Classify error:', error);
    res.status(500).json({ message: 'Lỗi phân tích chi tiêu' });
  }
});


// Fallback function for simple text parsing
function parseExpenseTextFallback(text) {
  const cleanText = text.trim().toLowerCase();
  const originalText = text.trim();
  
  // Extract number (supports formats like "50000", "50.000", "50 000", "50k", "50 nghìn")
  const numberMatch = cleanText.match(/(\d+(?:[.,\s]?\d+)*(?:k|nghìn|ngàn)?)/);
  let amount = 0;
  
  if (numberMatch) {
    let numStr = numberMatch[1].replace(/[.,\s]/g, '');
    if (numStr.endsWith('k') || numStr.endsWith('nghìn') || numStr.endsWith('ngàn')) {
      numStr = numStr.replace(/[kngàihn\s]/g, '');
      amount = parseInt(numStr) * 1000;
    } else {
      amount = parseInt(numStr);
    }
  }

  // Simple category detection
  let category = 'khác';
  let categoryName = 'Khác';
  
  if (/(cà phê|cafe|trà|nước|ăn|uống|com|cơm|bánh|kfc|lotteria|mcdonald)/.test(cleanText)) {
    category = 'ăn uống';
    categoryName = 'Ăn uống';
  } else if (/(xăng|đổ xăng|gas|nhiên liệu)/.test(cleanText)) {
    category = 'xăng xe';
    categoryName = 'Di chuyển';
  } else if (/(điện|nước|tiền nhà|internet|wifi)/.test(cleanText)) {
    category = 'hoá đơn';
    categoryName = 'Nhà ở';
  } else if (/(mua|quần áo|giày|dép|đồ)/.test(cleanText)) {
    category = 'mua sắm';
    categoryName = 'Mua sắm';
  }

  // Tách note (phần mô tả) - loại bỏ số tiền
  let note = originalText;
  // Loại bỏ số tiền khỏi note
  note = note
  .replace(/\d+[.,\s]?\d*(?:k|nghìn|ngàn)?/gi, '') // remove số
  .replace(/\bđ\b|\bvnd\b|\bvnđ\b/gi, '')         // remove đơn vị tiền
  .trim();
  // Nếu note rỗng, dùng text gốc (đã loại số)
  if (!note || note.length === 0) {
    note = originalText.replace(/\d+[.,\s]?\d*(?:k|nghìn|ngàn)?/gi, '').trim();
    if (!note || note.length === 0) {
      note = 'Chi tiêu';
    }
  }

  return {
    amount: amount,
    category: category,
    categoryName: categoryName,
    note: note
  };
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
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.json({ reply: 'Bạn muốn hỏi gì về chi tiêu?' });
    }

    // =========================
    // 1. SERVER TRUY CẬP DATABASE
    // =========================
  const today = new Date();
const yyyymm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

const expenses = await db.getExpensesByUserId(req.user.id);

const monthExpenses = expenses.filter(e =>
  e.date?.startsWith(yyyymm) &&
  (e.type === 'expense' || e.amount < 0)
);

const totalSpent = monthExpenses.reduce(
  (sum, e) => sum + Math.abs(e.amount),
  0
);

    // =========================
    // 2. BUILD CONTEXT CHO AI
    // =========================
    const context = {
      app: 'SmartExpense',
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
      },
      period: yyyymm,
      stats: {
        totalSpent,
        expenseCount: monthExpenses.length,
      }
    };

    // =========================
    // 3. GỬI CONTEXT CHO AI
    // =========================
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `
Bạn là trợ lý tài chính của ứng dụng SmartExpense.
Bạn KHÔNG tự suy đoán.
CHỈ được trả lời dựa trên dữ liệu hệ thống được cung cấp.
Nếu không đủ dữ liệu, phải nói rõ.
Trả lời bằng tiếng Việt, ngắn gọn, rõ ràng.
`
        },
        {
          role: 'user',
          content: `
DỮ LIỆU HỆ THỐNG:
${JSON.stringify(context, null, 2)}

NGƯỜI DÙNG HỎI:
"${text}"

Hãy trả lời.
`
        }
      ],
      max_tokens: 300
    });

    const reply =
      completion.choices[0]?.message?.content ||
      'Hiện tôi chưa thể trả lời câu hỏi này.';

    res.json({
      reply,
      data: context.stats
    });

  } catch (err) {
    console.error('❌ AI chat error:', err);
    res.status(500).json({
      reply: 'Có lỗi khi xử lý AI'
    });
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
