const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const { query } = require('../database');
const bcrypt = require("bcryptjs");


// ===== Helpers cho settings chung (caidat.html Admin) =====
const DEFAULT_APP_SETTINGS = {
  // đúng UI caidat.html
  theme: "system",              // light | dark | system
  lang: "vi",
  dateFmt: "DD/MM/YYYY",        // đúng option UI
  timeFmt: "24h",               // 24h | 12h
  timezone: "Asia/Ho_Chi_Minh",

  // Security
  twoFA: false,
  sessionLen: "24",             // 24 | 72 | 0

  // Notify (UI có thể chưa render đủ nhưng collect() có)
  nWeekly: true,
  nPush: true,
  nChannel: "email",
  fraudThreshold: 95,

  // App prefs
  currency: "VND",
  density: "comfortable",       // comfortable | compact
  startPage: "tongquan.html",

  // Auto refresh
  autoRefresh: false,
  autoMins: "5",                // 1|5|10|30 (string trong UI)

  // Integrations
  intVCB: false,
  intMomo: false,
  intZalo: false,

  // Avatar (dataURL or url)
  avatar: null,
};

const KEYMAP = {
  theme: "theme",
  lang: "language",
  dateFmt: "date_format",
  timeFmt: "time_format",
  timezone: "timezone",

  twoFA: "two_factor_enabled",
  sessionLen: "session_length_hours",

  nWeekly: "notify_weekly",
  nPush: "notify_push",
  nChannel: "notify_channel",

  autoRefresh: "auto_refresh_enabled",
  autoMins: "auto_refresh_minutes",

  fraudThreshold: "fraud_threshold",

  density: "density",
  startPage: "start_page",

  integrations: "integrations_json",

  // optional: lưu avatar fallback ở settings (vì UI gửi base64)
  avatar: "avatar_data_url",
};

function toBool(v, def = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "1" || s === "true" || s === "yes" || s === "on") return true;
    if (s === "0" || s === "false" || s === "no" || s === "off") return false;
  }
  return def;
}
function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}
function normTheme(v, def) {
  const s = String(v || "").toLowerCase();
  return ["light", "dark", "system"].includes(s) ? s : def;
}
function normTimeFmt(v, def) {
  const s = String(v || "").toLowerCase();
  return ["24h", "12h"].includes(s) ? s : def;
}
function normDensity(v, def) {
  const s = String(v || "").toLowerCase();
  return ["comfortable", "compact"].includes(s) ? s : def;
}

async function getSettingValue(userId, key) {
  const rows = await query(
    "SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?",
    [userId, key]
  );
  return rows && rows.length ? rows[0].setting_value : null;
}

async function upsertSettingValue(userId, key, value) {
  const existing = await query(
    "SELECT id FROM user_settings WHERE user_id = ? AND setting_key = ?",
    [userId, key]
  );

  if (existing && existing.length > 0) {
    await query(
      "UPDATE user_settings SET setting_value = ?, updated_at = NOW() WHERE user_id = ? AND setting_key = ?",
      [value, userId, key]
    );
  } else {
    await query(
      "INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
      [userId, key, value]
    );
  }
}

// =====================
// ✅ Giữ nguyên các routes: budget-alerts / test-budget-alert / budget-status
// =====================

/**
 * GET /api/settings/budget-alerts
 * Lấy cài đặt cảnh báo ngân sách của user hiện tại
 */
router.get('/budget-alerts', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [userId, 'budget_alert_settings']
    );

    if (result && result.length > 0) {
      try {
        const settings = JSON.parse(result[0].setting_value);
        return res.json({ ok: true, settings });
      } catch (parseError) {
        console.error('❌ [settings.js] Lỗi parse JSON:', parseError);
      }
    }

    const defaultSettings = {
      enabled: true,
      anomalyEnabled: true,
      threshold: 95,
      notifyInApp: true,
      notifyEmail: false
    };

    return res.json({ ok: true, settings: defaultSettings });
  } catch (error) {
    console.error('❌ [settings.js] Lỗi khi lấy cài đặt cảnh báo ngân sách:', error);
    res.status(500).json({ ok: false, message: 'Không thể lấy cài đặt cảnh báo ngân sách' });
  }
});

/**
 * POST /api/settings/budget-alerts
 * Lưu cài đặt cảnh báo ngân sách của user hiện tại
 */
router.post('/budget-alerts', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ ok: false, message: 'Dữ liệu cài đặt không hợp lệ' });
    }

    let threshold = parseInt(settings.threshold) || 95;
    if (threshold < 1) threshold = 1;
    if (threshold > 100) threshold = 100;

    const normalizedSettings = {
      enabled: settings.enabled !== false,
      anomalyEnabled: settings.anomalyEnabled !== false,
      threshold,
      notifyInApp: settings.notifyInApp !== false,
      notifyEmail: settings.notifyEmail === true
    };

    const settingsJson = JSON.stringify(normalizedSettings);

    const existing = await query(
      'SELECT id FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [userId, 'budget_alert_settings']
    );

    if (existing && existing.length > 0) {
      await query(
        'UPDATE user_settings SET setting_value = ?, updated_at = NOW() WHERE user_id = ? AND setting_key = ?',
        [settingsJson, userId, 'budget_alert_settings']
      );
    } else {
      await query(
        'INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [userId, 'budget_alert_settings', settingsJson]
      );
    }

    console.log(`✅ [settings.js] Đã lưu cài đặt cảnh báo ngân sách cho user ${userId}:`, normalizedSettings);

    return res.json({ ok: true, message: 'Đã lưu cài đặt thành công', settings: normalizedSettings });
  } catch (error) {
    console.error('❌ [settings.js] Lỗi khi lưu cài đặt cảnh báo ngân sách:', error);
    res.status(500).json({ ok: false, message: 'Không thể lưu cài đặt cảnh báo ngân sách' });
  }
});

/**
 * POST /api/settings/test-budget-alert
 */
router.post('/test-budget-alert', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { year, month, forceSend } = req.body;

    const budgetAlertService = require('../services/budgetAlertService');

    const result = await budgetAlertService.checkAndSendBudgetAlert(
      userId,
      year || null,
      month || null,
      forceSend === true
    );

    return res.json({ ok: true, message: 'Đã kiểm tra cảnh báo ngân sách', result });
  } catch (error) {
    console.error('❌ [settings.js] Lỗi khi test cảnh báo ngân sách:', error);
    res.status(500).json({ ok: false, message: 'Lỗi khi kiểm tra cảnh báo: ' + error.message });
  }
});

/**
 * GET /api/settings/budget-status
 */
router.get('/budget-status', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const budgetAlertService = require('../services/budgetAlertService');

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const settings = await budgetAlertService.getSettings(userId);
    const budgetData = await budgetAlertService.getBudgetData(userId, year, month);

    const isOverThreshold = budgetData.budget > 0 &&
      budgetData.percentage >= settings.threshold;

    let alertLevel = 'none';
    let alertMessage = '';

    if (budgetData.budget === 0) {
      alertLevel = 'none';
      alertMessage = '';
    } else if (budgetData.percentage >= 100) {
      alertLevel = 'error';
      alertMessage = `Bạn đã vượt quá ngân sách! Đã chi ${budgetData.percentage}% ngân sách tháng này.`;
    } else if (budgetData.percentage >= settings.threshold) {
      alertLevel = 'warning';
      alertMessage = `Cảnh báo: Bạn đã chi ${budgetData.percentage}% ngân sách (ngưỡng: ${settings.threshold}%).`;
    } else if (budgetData.percentage >= settings.threshold - 10) {
      alertLevel = 'info';
      alertMessage = `Lưu ý: Bạn đã chi ${budgetData.percentage}% ngân sách. Còn ${100 - budgetData.percentage}% trước khi đạt ngưỡng cảnh báo.`;
    }

    return res.json({
      ok: true,
      data: {
        budget: budgetData.budget,
        spent: budgetData.spent,
        remaining: budgetData.remaining,
        percentage: budgetData.percentage,
        threshold: settings.threshold,
        enabled: settings.enabled,
        isOverThreshold,
        alertLevel,
        alertMessage,
        month: `${month}/${year}`
      }
    });
  } catch (error) {
    console.error('❌ [settings.js] Lỗi khi lấy trạng thái ngân sách:', error);
    res.status(500).json({ ok: false, message: 'Không thể lấy trạng thái ngân sách' });
  }
});

// =====================
// ✅ PHẦN MỚI: GET/PUT /api/settings cho caidat.html Admin
// =====================

/**
 * GET /api/settings
 * Trả về { ok, user, settings } đúng với caidat.html
 */
router.get("/", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    // Lấy user từ DB để có currency/avatar_url (nếu có cột)
    let dbUser = null;
    try {
      const rows = await query(
        "SELECT id, name, email, role, currency, avatar_url FROM users WHERE id = ? LIMIT 1",
        [userId]
      );
      if (rows && rows.length) dbUser = rows[0];
    } catch (e) {
      console.warn("⚠️ [settings.js] Không lấy được users row:", e.message);
    }

    const user = {
      id: userId,
      email: dbUser?.email || req.user.email,
      name: dbUser?.name || req.user.name,
      role: dbUser?.role || req.user.role || "Admin",
    };

    const s = { ...DEFAULT_APP_SETTINGS };

    const theme = await getSettingValue(userId, KEYMAP.theme);
    if (theme !== null) s.theme = normTheme(theme, s.theme);

    const lang = await getSettingValue(userId, KEYMAP.lang);
    if (lang !== null) s.lang = String(lang || s.lang);

    const dateFmt = await getSettingValue(userId, KEYMAP.dateFmt);
    if (dateFmt !== null) s.dateFmt = String(dateFmt || s.dateFmt);

    const timeFmt = await getSettingValue(userId, KEYMAP.timeFmt);
    if (timeFmt !== null) s.timeFmt = normTimeFmt(timeFmt, s.timeFmt);

    const timezone = await getSettingValue(userId, KEYMAP.timezone);
    if (timezone !== null) s.timezone = String(timezone || s.timezone);

    const twoFA = await getSettingValue(userId, KEYMAP.twoFA);
    if (twoFA !== null) s.twoFA = toBool(twoFA, s.twoFA);

    const sessionLen = await getSettingValue(userId, KEYMAP.sessionLen);
    if (sessionLen !== null) s.sessionLen = String(sessionLen || s.sessionLen);

    const nWeekly = await getSettingValue(userId, KEYMAP.nWeekly);
    if (nWeekly !== null) s.nWeekly = toBool(nWeekly, s.nWeekly);

    const nPush = await getSettingValue(userId, KEYMAP.nPush);
    if (nPush !== null) s.nPush = toBool(nPush, s.nPush);

    const nChannel = await getSettingValue(userId, KEYMAP.nChannel);
    if (nChannel !== null) s.nChannel = String(nChannel || s.nChannel);

    const fraudThreshold = await getSettingValue(userId, KEYMAP.fraudThreshold);
    if (fraudThreshold !== null) s.fraudThreshold = toInt(fraudThreshold, s.fraudThreshold);

    const density = await getSettingValue(userId, KEYMAP.density);
    if (density !== null) s.density = normDensity(density, s.density);

    const startPage = await getSettingValue(userId, KEYMAP.startPage);
    if (startPage !== null) s.startPage = String(startPage || s.startPage);

    const autoRefresh = await getSettingValue(userId, KEYMAP.autoRefresh);
    if (autoRefresh !== null) s.autoRefresh = toBool(autoRefresh, s.autoRefresh);

    const autoMins = await getSettingValue(userId, KEYMAP.autoMins);
    if (autoMins !== null) s.autoMins = String(autoMins || s.autoMins);

    const integrations = await getSettingValue(userId, KEYMAP.integrations);
    if (integrations) {
      try {
        const obj = JSON.parse(integrations);
        s.intVCB = !!obj.intVCB;
        s.intMomo = !!obj.intMomo;
        s.intZalo = !!obj.intZalo;
      } catch {}
    }

    // avatar fallback (settings) nếu users chưa có
    const avatarData = await getSettingValue(userId, KEYMAP.avatar);
    if (avatarData) s.avatar = avatarData;

    // currency/avatar ưu tiên từ bảng users
    if (dbUser?.currency) s.currency = dbUser.currency;
    if (dbUser?.avatar_url) s.avatar = dbUser.avatar_url;

    return res.json({ ok: true, user, settings: s });
  } catch (error) {
    console.error("❌ [settings.js] Lỗi GET /api/settings:", error);
    return res.status(500).json({ ok: false, message: "Không thể lấy cài đặt" });
  }
});

/**
 * PUT /api/settings
 * Nhận body: { settings } đúng caidat.html và lưu DB
 */
router.put("/", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const incoming = req.body?.settings || req.body;

    if (!incoming || typeof incoming !== "object") {
      return res.status(400).json({ ok: false, message: "Dữ liệu không hợp lệ" });
    }

    // ===== 1) Update USERS (displayName, currency, avatar) =====
    const displayName = typeof incoming.displayName === "string" ? incoming.displayName.trim() : null;
    const currency = typeof incoming.currency === "string" ? incoming.currency.trim() : null;
    const avatar = typeof incoming.avatar === "string" ? incoming.avatar : null;

    // email/role UI đang disabled => không update (an toàn)
    try {
      if (displayName || currency || avatar) {
        await query(
          `UPDATE users
           SET
             name = COALESCE(?, name),
             currency = COALESCE(?, currency),
             avatar_url = COALESCE(?, avatar_url),
             updated_at = NOW()
           WHERE id = ?`,
          [displayName || null, currency || null, avatar || null, userId]
        );
      }
    } catch (e) {
      console.warn("⚠️ [settings.js] Update users fail (có thể thiếu cột currency/avatar_url):", e.message);
      // Không throw để vẫn lưu settings bình thường
    }

    // ===== 2) Normalize settings đúng UI =====
    const s = { ...DEFAULT_APP_SETTINGS };

    if (typeof incoming.theme === "string") s.theme = normTheme(incoming.theme, s.theme);
    if (typeof incoming.lang === "string") s.lang = incoming.lang;
    if (typeof incoming.dateFmt === "string") s.dateFmt = incoming.dateFmt;
    if (typeof incoming.timeFmt === "string") s.timeFmt = normTimeFmt(incoming.timeFmt, s.timeFmt);
    if (typeof incoming.timezone === "string") s.timezone = incoming.timezone;

    if (incoming.twoFA !== undefined) s.twoFA = toBool(incoming.twoFA, s.twoFA);
    if (incoming.sessionLen !== undefined) s.sessionLen = String(incoming.sessionLen ?? s.sessionLen);

    if (incoming.nWeekly !== undefined) s.nWeekly = toBool(incoming.nWeekly, s.nWeekly);
    if (incoming.nPush !== undefined) s.nPush = toBool(incoming.nPush, s.nPush);
    if (incoming.nChannel !== undefined && incoming.nChannel !== null) s.nChannel = String(incoming.nChannel);

    if (incoming.fraudThreshold !== undefined && incoming.fraudThreshold !== null) {
      let th = toInt(incoming.fraudThreshold, s.fraudThreshold);
      if (th < 1) th = 1;
      if (th > 100) th = 100;
      s.fraudThreshold = th;
    }

    if (incoming.density !== undefined) s.density = normDensity(incoming.density, s.density);
    if (incoming.startPage !== undefined) s.startPage = String(incoming.startPage || s.startPage);

    if (incoming.autoRefresh !== undefined) s.autoRefresh = toBool(incoming.autoRefresh, s.autoRefresh);
    if (incoming.autoMins !== undefined) s.autoMins = String(incoming.autoMins ?? s.autoMins);

    // integrations
    if (incoming.intVCB !== undefined) s.intVCB = !!incoming.intVCB;
    if (incoming.intMomo !== undefined) s.intMomo = !!incoming.intMomo;
    if (incoming.intZalo !== undefined) s.intZalo = !!incoming.intZalo;

    // avatar fallback lưu vào user_settings (để load được nếu users chưa có avatar_url)
    if (avatar) s.avatar = avatar;

    // ===== 3) upsert vào DB user_settings =====
    await upsertSettingValue(userId, KEYMAP.theme, s.theme);
    await upsertSettingValue(userId, KEYMAP.lang, s.lang);
    await upsertSettingValue(userId, KEYMAP.dateFmt, s.dateFmt);
    await upsertSettingValue(userId, KEYMAP.timeFmt, s.timeFmt);
    await upsertSettingValue(userId, KEYMAP.timezone, s.timezone);

    await upsertSettingValue(userId, KEYMAP.twoFA, s.twoFA ? "true" : "false");
    await upsertSettingValue(userId, KEYMAP.sessionLen, String(s.sessionLen));

    await upsertSettingValue(userId, KEYMAP.nWeekly, s.nWeekly ? "true" : "false");
    await upsertSettingValue(userId, KEYMAP.nPush, s.nPush ? "true" : "false");
    await upsertSettingValue(userId, KEYMAP.nChannel, s.nChannel);

    await upsertSettingValue(userId, KEYMAP.fraudThreshold, String(s.fraudThreshold));

    await upsertSettingValue(userId, KEYMAP.density, s.density);
    await upsertSettingValue(userId, KEYMAP.startPage, s.startPage);

    await upsertSettingValue(userId, KEYMAP.autoRefresh, s.autoRefresh ? "true" : "false");
    await upsertSettingValue(userId, KEYMAP.autoMins, String(s.autoMins));

    await upsertSettingValue(
      userId,
      KEYMAP.integrations,
      JSON.stringify({ intVCB: s.intVCB, intMomo: s.intMomo, intZalo: s.intZalo })
    );

    if (s.avatar) {
      await upsertSettingValue(userId, KEYMAP.avatar, s.avatar);
    }

    return res.json({ ok: true, message: "Đã lưu cài đặt", settings: s });
  } catch (error) {
    console.error("❌ [settings.js] Lỗi PUT /api/settings:", error);
    return res.status(500).json({ ok: false, message: "Không thể lưu cài đặt" });
  }
});

/**
 * POST /api/settings/change-password
 * Body: { currentPassword, newPassword }
 */
router.post("/change-password", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, message: "Thiếu dữ liệu mật khẩu" });
    }

    // Validate basic
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ ok: false, message: "Mật khẩu mới phải >= 8 ký tự" });
    }
    // ít nhất 1 chữ + 1 số (đúng UI bạn ghi)
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ ok: false, message: "Mật khẩu mới phải có cả chữ và số" });
    }

    const rows = await query(
      "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    if (!rows || !rows.length) {
      return res.status(404).json({ ok: false, message: "Không tìm thấy user" });
    }

    const hashInDb = rows[0].password_hash;
    const ok = await bcrypt.compare(String(currentPassword), String(hashInDb || ""));
    if (!ok) {
      return res.status(400).json({ ok: false, message: "Mật khẩu hiện tại không đúng", code: "WRONG_PASSWORD" });
    }

    // Không cho đặt trùng mật khẩu cũ
    const sameAsOld = await bcrypt.compare(String(newPassword), String(hashInDb || ""));
    if (sameAsOld) {
      return res.status(400).json({ ok: false, message: "Mật khẩu mới phải khác mật khẩu cũ" });
    }

    const newHash = await bcrypt.hash(String(newPassword), 10);

    await query(
      "UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?",
      [newHash, userId]
    );

    return res.json({ ok: true, message: "Đổi mật khẩu thành công" });
  } catch (err) {
    console.error("❌ [settings.js] change-password error:", err);
    return res.status(500).json({ ok: false, message: "Không thể đổi mật khẩu" });
  }
});


module.exports = router;
