/**
 * SmartExpense AI Service (FINAL, SAFE)
 * - Exposes window.AI.chat()
 * - Single render source (NO DUPLICATE)
 * - HTML only calls AI.chat()
 * - UI rendering via window.renderAIMessage if provided
 */

(function () {
  'use strict';

  /* =========================
   * API helpers
   * ========================= */

  function getAPIBase() {
    return window.SMARTEXPENSE_API || 'http://127.0.0.1:5000';
  }

  function getToken() {
    try {
      return localStorage.getItem('smartexpense_token') || '';
    } catch (_) {
      return '';
    }
  }

  async function apiFetch(path, options = {}) {
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      options.headers || {}
    );

    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    return fetch(getAPIBase() + path, {
      credentials: 'include',
      ...options,
      headers
    });
  }

  /* =========================
   * History (per page)
   * ========================= */

  function pageKey() {
    try {
      return location.pathname || 'default';
    } catch (_) {
      return 'default';
    }
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem('smartexpense_chat_history');
      const all = raw ? JSON.parse(raw) : {};
      return Array.isArray(all[pageKey()]) ? all[pageKey()] : [];
    } catch (_) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      const raw = localStorage.getItem('smartexpense_chat_history');
      const all = raw ? JSON.parse(raw) : {};
      all[pageKey()] = list.slice(-100);
      localStorage.setItem('smartexpense_chat_history', JSON.stringify(all));
    } catch (_) {}
  }

  function appendMessage(role, text) {
    const hist = loadHistory();
    hist.push({ role, text, ts: Date.now() });
    saveHistory(hist);
  }

  /* =========================
   * UI render (SINGLE SOURCE)
   * ========================= */

  function render(role, text) {
    try {
      // 👉 HTML phải đăng ký hàm này
      if (typeof window.renderAIMessage === 'function') {
        window.renderAIMessage(role, text);
      }
    } catch (_) {}
  }

  /* =========================
   * AI Chat
   * ========================= */

  async function chat(text) {
    if (!text) return;

    console.log('🤖 AI.chat:', text);

    // 1️⃣ Render USER (CHỈ Ở ĐÂY)
    appendMessage('user', text);
    render('user', text);

    try {
      const res = await apiFetch('/api/ai-new', {
        method: 'POST',
        body: JSON.stringify({ message: text })
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { reply: raw };
      }

      const reply =
        data?.reply ||
        data?.message ||
        'Mình chưa hiểu, bạn thử nói cách khác nhé.';

      console.log('💬 AI reply:', reply);

      // 2️⃣ Render BOT (CHỈ Ở ĐÂY)
      appendMessage('bot', reply);
      render('bot', reply);

      return data;
    } catch (err) {
      console.error('❌ AI.chat error:', err);

      const fallback =
        'Xin lỗi, hiện không thể kết nối AI. Bạn thử lại sau nhé.';

      appendMessage('bot', fallback);
      render('bot', fallback);

      return { reply: fallback };
    }
  }

  /* =========================
   * Expose
   * ========================= */

  window.AI = {
    chat,
    loadHistory,
    appendMessage
  };

  console.log('✅ AI service initialized (FINAL)', {
    chat: typeof chat,
    loadHistory: typeof loadHistory,
    appendMessage: typeof appendMessage
  });
})();
