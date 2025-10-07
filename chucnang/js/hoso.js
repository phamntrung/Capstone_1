// hoso.js - Logic cho trang Hồ sơ
// Mục tiêu: đồng bộ thông tin người dùng Google vào hồ sơ, tách khỏi HTML

(function initProfilePage(){
  document.addEventListener('DOMContentLoaded', function(){
    try {
      // 1) Nếu đã đăng nhập (qua Google hoặc thường), đồng bộ vào giao diện
      const sessionRaw = localStorage.getItem('smartexpense_user');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        const name = session.name || '';
        const email = session.email || '';
        const nameEl = document.getElementById('fullNameValue');
        const emailEl = document.getElementById('emailValue');
        const inputName = document.getElementById('fullNameInput');
        if (name && nameEl) nameEl.textContent = name;
        if (email && emailEl) emailEl.textContent = email;
        if (name && inputName) inputName.value = name;
        // avatar initial
        const initial = (name || email || 'Q').trim().charAt(0).toUpperCase();
        const circle = document.querySelector('.avatar-big .circle');
        if (circle) circle.textContent = initial || 'Q';

        // merge vào profile
        const pRaw = localStorage.getItem('profile');
        const p = pRaw ? JSON.parse(pRaw) : {};
        if (name) p.name = name;
        if (email) p.email = email;
        localStorage.setItem('profile', JSON.stringify(p));
      }

      // 2) Đồng bộ monthly_budget sang key rút gọn để trang chủ đọc
      try {
        const pRaw = localStorage.getItem('profile');
        if (pRaw) {
          const p = JSON.parse(pRaw);
          if (typeof p.monthly_budget === 'number') {
            localStorage.setItem('monthly_budget', String(p.monthly_budget));
          }
        }
      } catch(_) {}

      // 3) Nút Đăng nhập qua Google trên hồ sơ
      const googleBtn = document.getElementById('googleSignInBtn');
      if (googleBtn) {
        googleBtn.style.cursor = 'pointer';
        googleBtn.addEventListener('click', function(){
          // Nếu đã có phiên, thông báo và cho phép đổi tài khoản bằng cách đi tới trang đăng nhập
          const hasToken = !!localStorage.getItem('smartexpense_token');
          if (hasToken) {
            if (confirm('Bạn đã đăng nhập. Bạn có muốn đổi tài khoản Google?')) {
              window.location.href = 'login.html';
            }
            return;
          }
          // Chuyển đến trang đăng nhập để dùng Google Identity Services
          window.location.href = 'login.html';
        });
      }
    } catch (e) {
      console.warn('Init profile failed:', e);
    }
  });
})();


