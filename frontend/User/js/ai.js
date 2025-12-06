// Simple shared helpers for API and AI features across pages
// This file exposes window.API and window.AI without requiring any bundler

(function(){
  function getAPIBase(){
    return (typeof window !== 'undefined' && window.SMARTEXPENSE_API) || 'http://127.0.0.1:5000';
  }

  function getToken(){
    try{ 
      // Thử lấy token từ localStorage
      const token = localStorage.getItem('smartexpense_token');
      if (token) return token;
      
      // Nếu không có, thử lấy từ auth object (tương thích với utils.js)
      const auth = localStorage.getItem('smartexpense_user');
      if (auth) {
        try {
          const authObj = JSON.parse(auth);
          if (authObj && authObj.token) return authObj.token;
        } catch(_) {}
      }
      
      return '';
    }catch(_){ return ''; }
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
      console.log('🤖 AI.chat called with:', text);
      
      // Lưu message của user vào history
      appendMessage('user', text);
      
      const apiBase = getAPIBase();
      const token = getToken();
      console.log('🌐 API Base:', apiBase);
      console.log('🔑 Token exists:', !!token);
      
      // Gọi API mới /api/ai-new với body { message }
      const url = apiBase + '/api/ai-new';
      console.log('📡 Calling:', url);
      
      const res = await apiFetch('/api/ai-new', {
        method: 'POST',
        body: JSON.stringify({ message: text })
      });
      
      console.log('📥 Response status:', res.status, res.statusText);
      
      // Xử lý response
      let data;
      if (!res.ok) {
        // Nếu có lỗi từ server, lấy error message
        const errorText = await res.text();
        console.error('❌ API Error response:', errorText);
        try {
          data = JSON.parse(errorText);
        } catch {
          data = { error: errorText || 'Xin lỗi, có lỗi xảy ra.' };
        }
      } else {
        const responseText = await res.text();
        console.log('✅ API Success response:', responseText);
        try {
          data = JSON.parse(responseText);
        } catch {
          data = { reply: responseText || 'Xin lỗi, có lỗi xảy ra.' };
        }
      }
      
      console.log('📦 Parsed data:', data);
      
      // Lấy reply từ response (hoặc error message)
      const reply = (data && data.reply) 
        ? data.reply 
        : (data && data.error)
        ? `Xin lỗi: ${data.error}`
        : (data && data.message)
        ? data.message
        : 'Mình chưa hiểu, bạn thử nói cách khác nhé.';
      
      console.log('💬 Final reply:', reply);
      
      // Lưu reply của bot vào history
      appendMessage('bot', reply);
      
      // Xử lý created expense nếu có
      if (data && data.created) mirrorCreatedExpense(data.created);
      
      return data || { reply };
    }catch(error){
      console.error('❌ AI chat error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      const reply = 'Xin lỗi, hiện không thể kết nối AI. Bạn thử lại sau nhé.';
      appendMessage('bot', reply);
      return { reply };
    }
  }

  // Expose API and AI services to window
  window.API = { base: getAPIBase, token: getToken, fetch: apiFetch };
  window.AI = { chat, loadHistory, appendMessage };
  
  console.log('✅ AI service initialized:', {
    chat: typeof chat,
    loadHistory: typeof loadHistory,
    appendMessage: typeof appendMessage
  });
})();


