// Simple shared helpers for API and AI features across pages
// This file exposes window.API and window.AI without requiring any bundler

(function(){
  function getAPIBase(){
    return (typeof window !== 'undefined' && window.SMARTEXPENSE_API) || 'http://127.0.0.1:5000';
  }

  function getToken(){
    try{ return localStorage.getItem('smartexpense_token') || ''; }catch(_){ return ''; }
  }

  async function apiFetch(path, options){
    const token = getToken();
    const headers = Object.assign({ 'Content-Type': 'application/json' }, (options && options.headers) || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(getAPIBase() + path, Object.assign({}, options, { headers }));
    return res;
  }

  function pageKey(){
    try{ return (location && location.pathname) ? location.pathname : 'default'; }catch(_){ return 'default'; }
  }

  // Chat history persistence
  function loadHistory(){
    try{
      const raw = localStorage.getItem('smartexpense_chat_history');
      const all = raw ? JSON.parse(raw) : {};
      return Array.isArray(all[pageKey()]) ? all[pageKey()] : [];
    }catch(_){ return []; }
  }

  function saveHistory(messages){
    try{
      const raw = localStorage.getItem('smartexpense_chat_history');
      const all = raw ? JSON.parse(raw) : {};
      all[pageKey()] = messages.slice(-100); // keep last 100
      localStorage.setItem('smartexpense_chat_history', JSON.stringify(all));
    }catch(_){ /* ignore */ }
  }

  function appendMessage(role, text){
    const hist = loadHistory();
    hist.push({ role, text, ts: Date.now() });
    saveHistory(hist);
  }

  // Mirror created expense to localStorage for demo persistence after refresh
  function mirrorCreatedExpense(created){
    if (!created) return;
    try{
      const raw = localStorage.getItem('transactions');
      const list = raw ? JSON.parse(raw) : [];
      const item = {
        date: created.date || new Date().toISOString().split('T')[0],
        amount: typeof created.amount === 'number' ? created.amount : Number(created.amount) || 0,
        type: created.type || (created.amount < 0 ? 'expense' : 'income'),
        categoryId: created.categoryId || null,
        note: created.note || 'ai',
      };
      list.push(item);
      localStorage.setItem('transactions', JSON.stringify(list));
    }catch(_){ /* ignore */ }
  }

  async function chat(text){
    try{
      appendMessage('user', text);
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      const data = await res.json().catch(()=>({ reply: 'Xin lỗi, có lỗi xảy ra.' }));
      const reply = (data && data.reply) ? data.reply : 'Mình chưa hiểu, bạn thử nói cách khác nhé.';
      appendMessage('bot', reply);
      if (data && data.created) mirrorCreatedExpense(data.created);
      return data || { reply };
    }catch(_){
      const reply = 'Xin lỗi, hiện không thể kết nối AI. Bạn thử lại sau nhé.';
      appendMessage('bot', reply);
      return { reply };
    }
  }

  window.API = { base: getAPIBase, token: getToken, fetch: apiFetch };
  window.AI = { chat, loadHistory, appendMessage };
})();


