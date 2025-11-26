(function () {
  'use strict';

  /**
   * ===== CẤU HÌNH & BIẾN DÙNG CHUNG =====
   */
  const API_ENDPOINT = '/api/admin/overview';
  const REQUIRED_CATEGORIES = ['Ăn uống', 'Cố định', 'Chơi', 'Khác'];
  const CATEGORY_ICONS = {
    'Ăn uống': '🍜',
    'Cố định': '🏠',
    'Chơi': '🎮',
    'Khác': '📦'
  };

  let currentRange = 30;
  let latestTrendValues = [];
  let isLoading = false;
  
  // Lưu trữ dữ liệu giao dịch gốc để có thể filter khi tìm kiếm
  let allTransactions = [];
  
  // Phân trang
  let currentPage = 1;
  const itemsPerPage = 10; // Số giao dịch hiển thị mỗi trang

  const sidebar = document.getElementById('sidebar');
  const btnMenu = document.getElementById('btnMenu');
  const btnRange = document.getElementById('btnRange');
  const btnRefresh = document.getElementById('btnRefresh');
  const searchInput = document.getElementById('searchInput');
  console.log('🔍 [init] searchInput:', searchInput ? '✅ Tìm thấy' : '❌ Không tìm thấy');

  const lastUpdatedEl = document.getElementById('lastUpdated');
  const chartTitleEl = document.getElementById('chartTitle');
  const categoryListEl = document.getElementById('categoryList');
  const categorySummaryEl = document.getElementById('categorySummary');
  const txTableEl = document.getElementById('txTable');

  const metricUsersEl = document.getElementById('k_users');
  const metricTxEl = document.getElementById('k_tx');
  const metricExpenseEl = document.getElementById('k_expense');
  const metricRevenueEl = document.getElementById('k_revenue');
  const trendUsersEl = document.getElementById('trend_users');
  const trendTxEl = document.getElementById('trend_tx');
  
  // Phân trang elements
  const paginationEl = document.getElementById('pagination');
  const btnPrevPage = document.getElementById('btnPrevPage');
  const btnNextPage = document.getElementById('btnNextPage');
  const pageNumbersEl = document.getElementById('pageNumbers');
  const pageInfoEl = document.getElementById('pageInfo');

  const canvas = document.getElementById('chartActivity');
  const chartCtx = canvas ? canvas.getContext('2d') : null;

  /**
   * ===== HÀM TIỆN ÍCH =====
   */

  // Định dạng số theo chuẩn Việt Nam.
  function formatNumber(value) {
    return Number(value || 0).toLocaleString('vi-VN');
  }

  // Định dạng tiền tệ (luôn hiển thị dấu âm/dương).
  function formatCurrency(value) {
    const numeric = Number(value || 0);
    const sign = numeric >= 0 ? '+ ' : '- ';
    return `${sign}${formatNumber(Math.abs(numeric))} ₫`;
  }

  // Lấy chuỗi thời gian tương đối (ví dụ: "2 giờ trước").
  function formatRelativeTime(input) {
    if (!input) return '—';

    const date = new Date(typeof input === 'string' ? input.replace(' ', 'T') : input);
    if (Number.isNaN(date.getTime())) {
      return input;
    }

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'Vừa xong';
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;

    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return `${diffDays} ngày trước`;

    return date.toLocaleString('vi-VN');
  }

  // Cập nhật dòng "Cập nhật lúc ..." trên UI.
  function updateLastUpdatedLabel(timestamp) {
    if (!lastUpdatedEl) return;
    const time = timestamp ? new Date(timestamp) : new Date();
    lastUpdatedEl.textContent = `Cập nhật lúc ${time.toLocaleString('vi-VN')}`;
  }

  // Chuyển mảng categories từ API về đủ 4 nhóm chuẩn.
  function normalizeCategories(items) {
    const totals = REQUIRED_CATEGORIES.reduce((acc, name) => {
      acc[name] = { name, amount: 0, percentage: 0 };
      return acc;
    }, {});

    (items || []).forEach((item) => {
      const key = REQUIRED_CATEGORIES.includes(item.name) ? item.name : 'Khác';
      if (!totals[key]) {
        totals[key] = { name: key, amount: 0, percentage: 0 };
      }
      totals[key].amount += Number(item.amount || 0);
      totals[key].percentage = Number(item.percentage || 0);
    });

    return Object.values(totals);
  }

  // Thiết lập kích thước canvas cho màn hình Retina.
  function resizeCanvas() {
    if (!canvas || !chartCtx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Vẽ biểu đồ đường dựa trên dữ liệu trend.
  function drawLineChart(values) {
    if (!canvas || !chartCtx) return;

    const safeValues = Array.isArray(values) && values.length > 0 ? values : [0];
    resizeCanvas();

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const padding = 32;
    const maxValue = Math.max(...safeValues, 1);
    const step = safeValues.length > 1 ? (width - padding * 2) / (safeValues.length - 1) : 0;

    chartCtx.clearRect(0, 0, width, height);

    // Lưới nền
    chartCtx.strokeStyle = '#E5E7EB';
    chartCtx.lineWidth = 1;
    for (let i = 0; i < 5; i += 1) {
      const y = padding + ((height - padding * 2) / 4) * i;
      chartCtx.beginPath();
      chartCtx.moveTo(padding, y);
      chartCtx.lineTo(width - padding, y);
      chartCtx.stroke();
    }

    const points = safeValues.map((value, index) => {
      const x = padding + step * index;
      const y = height - padding - (value / maxValue) * (height - padding * 2);
      return [x, y];
    });

    // Vẽ vùng đổ màu
    if (points.length > 1) {
      const gradient = chartCtx.createLinearGradient(0, padding, 0, height - padding);
      gradient.addColorStop(0, 'rgba(34,197,94,0.25)');
      gradient.addColorStop(1, 'rgba(34,197,94,0)');

      chartCtx.beginPath();
      chartCtx.moveTo(points[0][0], height - padding);
      points.forEach(([x, y]) => chartCtx.lineTo(x, y));
      chartCtx.lineTo(points[points.length - 1][0], height - padding);
      chartCtx.closePath();
      chartCtx.fillStyle = gradient;
      chartCtx.fill();
    }

    // Vẽ đường chính
    chartCtx.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) chartCtx.moveTo(x, y);
      else chartCtx.lineTo(x, y);
    });
    chartCtx.strokeStyle = '#22C55E';
    chartCtx.lineWidth = 3;
    chartCtx.stroke();

    // Vẽ các điểm tròn
    chartCtx.fillStyle = '#22C55E';
    points.forEach(([x, y]) => {
      chartCtx.beginPath();
      chartCtx.arc(x, y, 3, 0, Math.PI * 2);
      chartCtx.fill();
    });
  }

  function handleWindowResize() {
    drawLineChart(latestTrendValues);
  }

  /**
   * ===== XỬ LÝ GỌI API & HIỂN THỊ =====
   */
  async function fetchOverview(range) {
    if (typeof window.apiRequest !== 'function') {
      throw new Error('apiRequest chưa sẵn sàng. Hãy đảm bảo utils.js đã được load.');
    }

    const query = new URLSearchParams({ range: String(range) });
    const endpoint = `${API_ENDPOINT}?${query.toString()}`;
    console.log('📤 Fetching admin overview from:', endpoint);
    
    const response = await window.apiRequest(endpoint, {
      method: 'GET'
    });

    console.log('📥 Admin overview response:', {
      ok: response?.ok,
      status: response?.status,
      hasData: !!response?.data,
      message: response?.data?.message || response?.message
    });

    if (!response) {
      throw new Error('Không nhận được phản hồi từ máy chủ.');
    }

    if (!response.ok) {
      const errorMsg = response?.data?.message || response?.message || `Lỗi ${response.status}: Không thể tải dữ liệu tổng quan.`;
      if (response.status === 404) {
        throw new Error(`Endpoint không tồn tại (404). Vui lòng kiểm tra backend có đang chạy và endpoint /api/admin/overview có được đăng ký không.`);
      }
      if (response.status === 403) {
        throw new Error('Bạn không có quyền truy cập trang quản trị.');
      }
      throw new Error(errorMsg);
    }

    if (!response.data) {
      throw new Error('Không nhận được dữ liệu hợp lệ từ máy chủ.');
    }

    return response;
  }

  /**
   * Định dạng phần trăm tăng trưởng với dấu mũi tên và màu sắc phù hợp.
   * @param {number} percentage - Phần trăm tăng trưởng (có thể âm nếu giảm)
   * @param {string} label - Nhãn hiển thị (ví dụ: "tuần này")
   * @returns {Object} Object chứa text và badgeClass
   */
  function formatTrendPercentage(percentage, label = '') {
    const numeric = Number(percentage || 0);
    const isPositive = numeric >= 0;
    const arrow = isPositive ? '▲' : '▼';
    const sign = isPositive ? '+' : '';
    const absValue = Math.abs(numeric);
    const badgeClass = isPositive ? 'b-blue' : 'b-red';
    const labelText = label ? ` ${label}` : '';
    
    return {
      text: `${arrow} ${sign}${absValue.toFixed(1)}%${labelText}`,
      badgeClass: badgeClass
    };
  }

  /**
   * Render các metrics và trend percentages lên UI.
   * @param {Object} metrics - Object chứa totalUsers, totalTransactions, totalRevenue, totalExpense, userGrowthPercentage, txGrowthPercentage
   */
  function renderMetrics(metrics) {
    // Debug: log dữ liệu nhận được
    console.log('📊 [renderMetrics] Dữ liệu metrics:', metrics);
    console.log('📊 [renderMetrics] userGrowthPercentage:', metrics.userGrowthPercentage);
    console.log('📊 [renderMetrics] txGrowthPercentage:', metrics.txGrowthPercentage);
    
    // Render các giá trị chính
    if (metricUsersEl) metricUsersEl.textContent = formatNumber(metrics.totalUsers);
    if (metricTxEl) metricTxEl.textContent = formatNumber(metrics.totalTransactions);
    if (metricExpenseEl) metricExpenseEl.textContent = `${formatNumber(metrics.totalExpense)} ₫`;
    if (metricRevenueEl) metricRevenueEl.textContent = `${formatNumber(metrics.totalRevenue)} ₫`;
    
    // Render phần trăm tăng trưởng (tuần này so với tuần trước)
    if (trendUsersEl) {
      const userGrowth = metrics.userGrowthPercentage !== undefined ? metrics.userGrowthPercentage : 0;
      console.log('📊 [renderMetrics] Rendering userGrowth:', userGrowth);
      const trendData = formatTrendPercentage(userGrowth, 'tuần này');
      trendUsersEl.textContent = trendData.text;
      // Cập nhật class badge (xóa class cũ và thêm class mới)
      trendUsersEl.className = 'badge ' + trendData.badgeClass;
      console.log('📊 [renderMetrics] trendUsersEl updated:', trendUsersEl.textContent);
    } else {
      console.warn('⚠️ [renderMetrics] trendUsersEl không tồn tại!');
    }
    
    if (trendTxEl) {
      const txGrowth = metrics.txGrowthPercentage !== undefined ? metrics.txGrowthPercentage : 0;
      console.log('📊 [renderMetrics] Rendering txGrowth:', txGrowth);
      const trendData = formatTrendPercentage(txGrowth, '');
      trendTxEl.textContent = trendData.text;
      // Cập nhật class badge (xóa class cũ và thêm class mới)
      trendTxEl.className = 'badge ' + trendData.badgeClass;
      console.log('📊 [renderMetrics] trendTxEl updated:', trendTxEl.textContent);
    } else {
      console.warn('⚠️ [renderMetrics] trendTxEl không tồn tại!');
    }
  }

  function renderCategories(categories) {
    if (!categoryListEl || !categorySummaryEl) return;

    const normalized = normalizeCategories(categories);
    const totalAmount = normalized.reduce((sum, item) => sum + item.amount, 0);

    categoryListEl.innerHTML = normalized
      .map((item) => {
        const percentage = totalAmount > 0 ? Math.round((item.amount / totalAmount) * 100) : item.percentage || 0;
        const icon = CATEGORY_ICONS[item.name] || '📦';
        return `
          <div class="cat-row">
            <div class="cat-left">
              <span style="font-size:18px">${icon}</span>
              <div>${item.name}</div>
            </div>
            <div class="cat-bar" aria-hidden="true">
              <div class="cat-fill" style="width:${percentage}%"></div>
            </div>
            <strong class="num" style="min-width:130px;text-align:right">${formatNumber(item.amount)} ₫</strong>
          </div>
        `;
      })
      .join('');

    const summaryPieces = normalized
      .map((item) => `${item.name}: ${totalAmount > 0 ? Math.round((item.amount / totalAmount) * 100) : item.percentage || 0}%`)
      .join(' · ');

    categorySummaryEl.textContent = totalAmount > 0
      ? `Tổng chi tiêu: ${formatNumber(totalAmount)} ₫ · ${summaryPieces}`
      : 'Chưa có dữ liệu chi tiêu để hiển thị.';
  }

  /**
   * Highlight từ khóa tìm kiếm trong text
   * @param {string} text - Text cần highlight
   * @param {string} query - Từ khóa tìm kiếm
   * @returns {string} - Text đã được highlight với HTML
   */
  function highlightSearchText(text, query) {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(text).replace(regex, '<mark style="background:#FEF9C3;padding:2px 4px;border-radius:4px;font-weight:600">$1</mark>');
  }

  /**
   * Lọc danh sách giao dịch theo từ khóa tìm kiếm
   * Tìm kiếm trong: ID giao dịch, tên người dùng, loại giao dịch, số tiền, ghi chú
   * @param {Array} transactions - Danh sách giao dịch cần lọc
   * @param {string} searchQuery - Từ khóa tìm kiếm
   * @returns {Array} - Danh sách giao dịch đã được lọc
   */
  function filterTransactions(transactions, searchQuery) {
    if (!searchQuery || !searchQuery.trim()) {
      return transactions;
    }

    const query = searchQuery.trim().toLowerCase();
    console.log('🔍 [filterTransactions] Bắt đầu filter với query:', query, '| Số giao dịch:', transactions?.length || 0);
    
    const filtered = transactions.filter((tx) => {
      // Tìm trong ID giao dịch
      const txId = String(tx.id || '').toLowerCase();
      const txCode = String(tx.code || `#TX${tx.id}` || '').toLowerCase();
      
      // Tìm trong tên người dùng
      const userName = String(tx.userName || '').toLowerCase();
      const userEmail = String(tx.userEmail || '').toLowerCase();
      
      // Tìm trong loại giao dịch
      const type = String(tx.type || '').toLowerCase();
      const typeLabel = type === 'income' ? 'thu nhập' : 'chi tiêu';
      
      // Tìm trong số tiền (cả số gốc và số đã format)
      const amount = Math.abs(Number(tx.amount || 0));
      const amountStr = formatNumber(amount).toLowerCase();
      const amountRaw = String(amount).toLowerCase();
      
      // Tìm trong ghi chú
      const note = String(tx.note || '').toLowerCase();
      
      // Tìm trong trạng thái
      const statusLabel = amount >= 0 ? 'thu' : 'chi';
      
      // Kiểm tra từ khóa có xuất hiện trong bất kỳ trường nào không
      const matches = txId.includes(query) ||
             txCode.includes(query) ||
             userName.includes(query) ||
             userEmail.includes(query) ||
             type.includes(query) ||
             typeLabel.includes(query) ||
             amountStr.includes(query) ||
             amountRaw.includes(query) ||
             note.includes(query) ||
             statusLabel.includes(query);
      
      return matches;
    });
    
    console.log('🔍 [filterTransactions] Kết quả:', filtered.length, 'giao dịch phù hợp');
    return filtered;
  }

  /**
   * Render danh sách giao dịch lên bảng
   * @param {Array} transactions - Danh sách giao dịch cần render
   * @param {string} searchQuery - Từ khóa tìm kiếm (để highlight, optional)
   */
  function renderTransactions(transactions, searchQuery = '') {
    if (!txTableEl) return;

    if (!transactions || transactions.length === 0) {
      const noResultsMsg = searchQuery 
        ? `Không tìm thấy giao dịch nào phù hợp với "${searchQuery}"`
        : 'Chưa có giao dịch nào trong hệ thống.';
      txTableEl.innerHTML = `
        <tr>
          <td colspan="6" class="muted" style="text-align:center;padding:24px">
            ${noResultsMsg}
          </td>
        </tr>`;
      // Ẩn phân trang nếu không có dữ liệu
      if (paginationEl) paginationEl.style.display = 'none';
      return;
    }

    // Tính toán phân trang
    const totalPages = Math.ceil(transactions.length / itemsPerPage);
    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;

    // Đảm bảo currentPage không vượt quá tổng số trang
    if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages;
      startIndex = (currentPage - 1) * itemsPerPage;
      endIndex = startIndex + itemsPerPage;
    }
    
    // Chỉ lấy 10 giao dịch cho trang hiện tại
    const paginatedTransactions = transactions.slice(startIndex, endIndex);
    
    // Tính toán số giao dịch hiển thị (từ X đến Y)
    const startDisplay = transactions.length > 0 ? startIndex + 1 : 0;
    const endDisplay = Math.min(endIndex, transactions.length);
    
    // Debug log để kiểm tra
    console.log(`📄 Phân trang: Tổng ${transactions.length} giao dịch, Trang ${currentPage}/${totalPages}, Hiển thị ${paginatedTransactions.length} giao dịch (từ ${startIndex} đến ${endIndex})`);

    const query = searchQuery ? searchQuery.trim() : '';
    
    txTableEl.innerHTML = paginatedTransactions
      .map((tx) => {
        const amount = Number(tx.amount || 0);
        const statusClass = amount >= 0 ? 's-ok' : 's-flag';
        const statusLabel = amount >= 0 ? 'Thu' : 'Chi';
        const typeLabel = (tx.type || '').toLowerCase() === 'income' ? 'Thu nhập' : 'Chi tiêu';
        
        // Format các trường với highlight nếu có từ khóa tìm kiếm
        const txCode = tx.code || `#TX${tx.id}`;
        const txCodeDisplay = query ? highlightSearchText(txCode, query) : txCode;
        const userNameDisplay = query ? highlightSearchText(tx.userName || 'Không rõ', query) : (tx.userName || 'Không rõ');
        const typeLabelDisplay = query ? highlightSearchText(typeLabel, query) : typeLabel;
        const amountDisplay = formatCurrency(amount);
        const statusLabelDisplay = query ? highlightSearchText(statusLabel, query) : statusLabel;
        
        return `
          <tr>
            <td>${txCodeDisplay}</td>
            <td>${userNameDisplay}</td>
            <td class="muted">${typeLabelDisplay}</td>
            <td class="num"><strong>${amountDisplay}</strong></td>
            <td><span class="status ${statusClass}">${statusLabelDisplay}</span></td>
            <td class="muted">${formatRelativeTime(tx.createdAt || tx.date)}</td>
          </tr>
        `;
      })
      .join('');

    // Hiển thị phân trang (ngay cả khi chỉ có 1 trang)
    console.log(`📊 Gọi renderPagination: ${transactions.length} giao dịch, ${totalPages} trang, hiển thị ${startDisplay}-${endDisplay}`);
    renderPagination(transactions.length, totalPages, startDisplay, endDisplay);
  }

  /**
   * Render phân trang
   */
  function renderPagination(totalItems, totalPages, startDisplay = 0, endDisplay = 0) {
    if (!paginationEl) {
      console.warn('⚠️ Không tìm thấy element phân trang');
      return;
    }

    // Hiển thị phân trang nếu có dữ liệu (ngay cả khi chỉ có 1 trang)
    if (totalItems === 0) {
      paginationEl.style.display = 'none';
      return;
    }

    // Hiển thị phân trang với flex
    paginationEl.style.display = 'flex';
    console.log(`📄 Hiển thị phân trang: ${totalPages} trang, ${totalItems} giao dịch, hiển thị ${startDisplay}-${endDisplay}`);
    console.log('📄 paginationEl:', paginationEl);
    console.log('📄 paginationEl.style.display:', paginationEl.style.display);

    // Cập nhật nút Previous/Next với style
    if (btnPrevPage) {
      const isDisabled = currentPage === 1 || totalPages <= 1;
      btnPrevPage.disabled = isDisabled;
      if (isDisabled) {
        btnPrevPage.style.background = '#F3F4F6';
        btnPrevPage.style.color = '#9CA3AF';
        btnPrevPage.style.cursor = 'not-allowed';
      } else {
        btnPrevPage.style.background = '#FFFFFF';
        btnPrevPage.style.color = '#374151';
        btnPrevPage.style.cursor = 'pointer';
      }
    }
    if (btnNextPage) {
      const isDisabled = currentPage === totalPages || totalPages <= 1;
      btnNextPage.disabled = isDisabled;
      if (isDisabled) {
        btnNextPage.style.background = '#F3F4F6';
        btnNextPage.style.color = '#9CA3AF';
        btnNextPage.style.cursor = 'not-allowed';
      } else {
        btnNextPage.style.background = '#FFFFFF';
        btnNextPage.style.color = '#374151';
        btnNextPage.style.cursor = 'pointer';
      }
    }

    // Cập nhật thông tin trang: "Hiển thị X-Y của Z giao dịch"
    if (pageInfoEl) {
      pageInfoEl.textContent = `Hiển thị ${startDisplay}-${endDisplay} của ${totalItems} giao dịch`;
    }

    // Render số trang
    if (pageNumbersEl) {
      let pageNumbersHTML = '';
      
      // Nếu chỉ có 1 trang, chỉ hiển thị số 1
      if (totalPages === 1) {
        pageNumbersHTML = `<button class="btn" data-page="1" style="padding:6px 12px;min-width:36px;background:#3B82F6;color:#FFFFFF;font-weight:500;border:none;border-radius:6px;cursor:pointer" disabled>1</button>`;
      } else {
        const maxVisiblePages = 5; // Số trang hiển thị tối đa
        
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // Điều chỉnh nếu gần cuối
        if (endPage - startPage < maxVisiblePages - 1) {
          startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        // Nút đầu tiên
        if (startPage > 1) {
          pageNumbersHTML += `<button class="btn" data-page="1" style="padding:6px 12px;min-width:36px;background:#FFFFFF;color:#374151;border:1px solid #E5E7EB;border-radius:6px;cursor:pointer">1</button>`;
          if (startPage > 2) {
            pageNumbersHTML += `<span class="muted" style="padding:0 4px">...</span>`;
          }
        }

        // Các trang ở giữa
        for (let i = startPage; i <= endPage; i++) {
          const isActive = i === currentPage;
          if (isActive) {
            // Trang active: màu xanh với chữ trắng
            pageNumbersHTML += `<button class="btn" data-page="${i}" style="padding:6px 12px;min-width:36px;background:#3B82F6;color:#FFFFFF;font-weight:500;border:none;border-radius:6px;cursor:pointer" disabled>${i}</button>`;
          } else {
            // Trang không active: màu trắng với chữ xám
            pageNumbersHTML += `<button class="btn" data-page="${i}" style="padding:6px 12px;min-width:36px;background:#FFFFFF;color:#374151;border:1px solid #E5E7EB;border-radius:6px;cursor:pointer">${i}</button>`;
          }
        }

        // Nút cuối cùng
        if (endPage < totalPages) {
          if (endPage < totalPages - 1) {
            pageNumbersHTML += `<span class="muted" style="padding:0 4px">...</span>`;
          }
          pageNumbersHTML += `<button class="btn" data-page="${totalPages}" style="padding:6px 12px;min-width:36px;background:#FFFFFF;color:#374151;border:1px solid #E5E7EB;border-radius:6px;cursor:pointer">${totalPages}</button>`;
        }
      }

      pageNumbersEl.innerHTML = pageNumbersHTML;

      // Thêm event listeners cho các nút số trang
      pageNumbersEl.querySelectorAll('button[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
          const page = parseInt(btn.getAttribute('data-page'));
          if (page !== currentPage) {
            currentPage = page;
            // Render lại với dữ liệu hiện tại
            const searchInputEl = document.getElementById('searchInput');
            const currentSearchQuery = searchInputEl ? searchInputEl.value.trim() : '';
            const filteredTransactions = filterTransactions(allTransactions, currentSearchQuery);
            renderTransactions(filteredTransactions, currentSearchQuery);
            // Scroll lên đầu bảng
            if (txTableEl) {
              txTableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        });
      });
    }
  }

  function renderTrend(trend) {
    latestTrendValues = Array.isArray(trend?.values) ? trend.values : [];
    if (chartTitleEl) {
      chartTitleEl.textContent = `Xu hướng hoạt động (${trend?.range || currentRange} ngày)`;
    }
    drawLineChart(latestTrendValues);
  }

  function updateRangeLabel() {
    if (btnRange) {
      btnRange.textContent = `${currentRange} ngày ▾`;
    }
  }

  async function loadOverview(range = currentRange) {
    if (isLoading) return;
    isLoading = true;
    if (btnRefresh) btnRefresh.disabled = true;
    if (btnRange) btnRange.disabled = true;

    try {
      const response = await fetchOverview(range);
      // apiRequest returns { ok, status, data } where data is the backend response
      // Backend response is { ok, generatedAt, data: { metrics, trend, categories, recentTransactions } }
      
      console.log('📥 [loadOverview] Full response structure:', {
        hasResponse: !!response,
        hasResponseData: !!response?.data,
        responseDataType: typeof response?.data,
        responseDataKeys: response?.data ? Object.keys(response?.data) : []
      });
      
      const { data, generatedAt } = response.data || {};
      
      console.log('📥 [loadOverview] Extracted data:', {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        hasMetrics: !!data?.metrics,
        metricsKeys: data?.metrics ? Object.keys(data.metrics) : []
      });

      if (!data) {
        throw new Error('Không nhận được dữ liệu từ máy chủ.');
      }

      console.log('📊 [loadOverview] Calling renderMetrics with:', data.metrics);
      renderMetrics(data.metrics);
      renderCategories(data.categories);
      
      // Lưu trữ dữ liệu giao dịch gốc để có thể filter khi tìm kiếm
      allTransactions = Array.isArray(data.recentTransactions) ? data.recentTransactions : [];
      console.log('💾 [loadOverview] Đã lưu', allTransactions.length, 'giao dịch vào allTransactions');
      
      // Reset về trang 1 khi load dữ liệu mới
      currentPage = 1;
      
      // Render giao dịch với từ khóa tìm kiếm hiện tại (nếu có)
      const searchInputEl = document.getElementById('searchInput');
      const currentSearchQuery = searchInputEl ? searchInputEl.value.trim() : '';
      console.log('🔍 [loadOverview] Từ khóa tìm kiếm hiện tại:', currentSearchQuery);
      // Reset về trang 1 khi load lại dữ liệu
      currentPage = 1;
      const filteredTransactions = filterTransactions(allTransactions, currentSearchQuery);
      renderTransactions(filteredTransactions, currentSearchQuery);
      
      renderTrend(data.trend);
      updateLastUpdatedLabel(generatedAt);

      currentRange = data.trend?.range || range;
      updateRangeLabel();
    } catch (error) {
      console.error('❌ Không thể tải dữ liệu tổng quan admin:', error);
      if (categorySummaryEl) {
        categorySummaryEl.textContent = 'Không thể tải dữ liệu. Vui lòng thử lại.';
      }
    } finally {
      isLoading = false;
      if (btnRefresh) btnRefresh.disabled = false;
      if (btnRange) btnRange.disabled = false;
    }
  }

  /**
   * ===== KHỞI TẠO SỰ KIỆN GIAO DIỆN =====
   */
  function initEventListeners() {
    // Lấy lại searchInput để đảm bảo DOM đã sẵn sàng
    const searchInputEl = document.getElementById('searchInput') || searchInput;
    if (btnMenu && sidebar) {
      btnMenu.addEventListener('click', () => {
        sidebar.classList.toggle('show');
      });
    }

    // Prevent reload khi click vào link "Tổng quan" nếu đang ở trang tongquan.html
    // QUAN TRỌNG: 
    // - CHỈ prevent khi đang ở tongquan.html VÀ đã có auth
    // - KHÔNG prevent khi click từ trang khác (cho phép navigate)
    // - KHÔNG prevent khi chưa có auth (cho phép redirect về login)
    // - KHÔNG chặn logout links (có data-logout="true")
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;
      
      // QUAN TRỌNG: KHÔNG chặn logout links - để logout handler xử lý
      if (link.hasAttribute('data-logout') && link.getAttribute('data-logout') === 'true') {
        return; // Cho phép logout handler xử lý
      }
      
      const href = link.getAttribute('href');
      if (!href) return;
      
      // Chỉ xử lý link "Tổng quan" (tongquan.html)
      if (href === 'tongquan.html' || href.endsWith('/tongquan.html')) {
        const currentPath = window.location.pathname;
        
        // CHỈ prevent reload nếu:
        // 1. Đang ở trang tongquan.html (không prevent khi click từ trang khác)
        // 2. VÀ đã có auth (để tránh prevent khi chưa có auth - lúc đó cần cho phép navigate để redirect về login)
        if (currentPath.includes('tongquan.html')) {
          // Kiểm tra xem có auth không
          let hasAuth = false;
          try {
            // Kiểm tra localStorage trực tiếp (nhanh hơn)
            const userStr = localStorage.getItem('smartexpense_user');
            const tokenStr = localStorage.getItem('smartexpense_token');
            if (userStr && tokenStr) {
              hasAuth = true;
            } else if (typeof window.checkAuth === 'function') {
              // Fallback: dùng checkAuth nếu có
              const auth = window.checkAuth();
              hasAuth = !!(auth && auth.user);
            }
          } catch (err) {
            console.warn('⚠️ [initEventListeners] Lỗi khi kiểm tra auth:', err);
            // Nếu có lỗi, không prevent (để an toàn)
            return;
          }
          
          // CHỈ prevent reload nếu đã có auth
          if (hasAuth) {
            e.preventDefault();
            e.stopPropagation();
            console.log('⏭️ [initEventListeners] Đang ở trang Tổng quan và đã có auth, không reload');
            return false;
          } else {
            // Không có auth - cho phép navigate để trang có thể redirect về login
            console.log('⚠️ [initEventListeners] Đang ở trang Tổng quan nhưng chưa có auth, cho phép navigate để redirect về login');
          }
        } else {
          // Đang ở trang khác, click vào "Tổng quan" - CHO PHÉP navigate (không prevent)
          console.log('✅ [initEventListeners] Click "Tổng quan" từ trang khác, cho phép navigate');
        }
      }
      
      // KHÔNG chặn các link khác (để chúng hoạt động bình thường)
    }, false); // Dùng bubble phase để logout handler (capture phase) chạy trước

    window.addEventListener('keydown', (event) => {
      if (!searchInputEl) return;

      if (event.key === '/') {
        event.preventDefault();
        searchInputEl.focus();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputEl.focus();
      }
    });

    /**
     * ===== XỬ LÝ TÌM KIẾM =====
     * Tìm kiếm trong danh sách giao dịch gần nhất
     * Không ảnh hưởng đến các chức năng khác (refresh, range, etc.)
     */
    if (searchInputEl) {
      console.log('✅ [initEventListeners] Đã tìm thấy searchInput:', searchInputEl);
      // Xử lý khi người dùng nhập từ khóa tìm kiếm
      searchInputEl.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        console.log('🔍 [searchInput] Tìm kiếm với từ khóa:', query, '| allTransactions.length:', allTransactions?.length || 0);
        
        // Reset về trang 1 khi tìm kiếm
        currentPage = 1;
        
        // Nếu có dữ liệu giao dịch gốc, filter và render lại
        if (allTransactions && allTransactions.length > 0) {
          // Reset về trang 1 khi tìm kiếm
          currentPage = 1;
          const filtered = filterTransactions(allTransactions, query);
          console.log('🔍 [searchInput] Kết quả filter:', filtered.length, 'giao dịch');
          renderTransactions(filtered, query);
        } else {
          console.warn('⚠️ [searchInput] Chưa có dữ liệu giao dịch để tìm kiếm');
          // Nếu chưa có dữ liệu, chỉ render thông báo
          if (txTableEl) {
            txTableEl.innerHTML = `
              <tr>
                <td colspan="6" class="muted" style="text-align:center;padding:24px">
                  Đang tải dữ liệu...
                </td>
              </tr>`;
          }
        }
      });

      // Xử lý khi người dùng xóa hết từ khóa (phím Escape hoặc xóa hết)
      searchInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchInputEl.value = '';
          // Reset về trang 1
          currentPage = 1;
          // Render lại danh sách gốc
          if (allTransactions && allTransactions.length > 0) {
            renderTransactions(allTransactions, '');
          }
        }
      });
    } else {
      console.error('❌ [initEventListeners] Không tìm thấy searchInput element!');
    }

    /**
     * ===== XỬ LÝ PHÂN TRANG =====
     */
    if (btnPrevPage) {
      btnPrevPage.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          const searchInputEl = document.getElementById('searchInput');
          const currentSearchQuery = searchInputEl ? searchInputEl.value.trim() : '';
          const filteredTransactions = filterTransactions(allTransactions, currentSearchQuery);
          renderTransactions(filteredTransactions, currentSearchQuery);
          // Scroll lên đầu bảng
          if (txTableEl) {
            txTableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    }

    if (btnNextPage) {
      btnNextPage.addEventListener('click', () => {
        const searchInputEl = document.getElementById('searchInput');
        const currentSearchQuery = searchInputEl ? searchInputEl.value.trim() : '';
        const filteredTransactions = filterTransactions(allTransactions, currentSearchQuery);
        const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
        
        if (currentPage < totalPages) {
          currentPage++;
          renderTransactions(filteredTransactions, currentSearchQuery);
          // Scroll lên đầu bảng
          if (txTableEl) {
            txTableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    }

    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        updateLastUpdatedLabel();
        loadOverview(currentRange);
      });
    }

    if (btnRange) {
      btnRange.addEventListener('click', () => {
        if (currentRange === 30) currentRange = 90;
        else if (currentRange === 90) currentRange = 7;
        else currentRange = 30;
        updateRangeLabel();
        loadOverview(currentRange);
      });
    }

    window.addEventListener('resize', handleWindowResize);
  }

  /**
   * ===== ĐIỂM KHỞI ĐỘNG CHÍNH =====
   */
  async function initAdminOverview() {
    try {
      console.log('🚀 [initAdminOverview] Bắt đầu khởi tạo trang tổng quan admin');
      
      // Đợi utils.js load xong (tối đa 5 giây - tăng thời gian đợi)
      let checkAuthAvailable = typeof window.checkAuth === 'function';
      if (!checkAuthAvailable) {
        console.log('⏳ [initAdminOverview] Đang đợi utils.js load...');
        for (let i = 0; i < 50; i++) { // Tăng từ 20 lên 50 (5 giây)
          await new Promise(resolve => setTimeout(resolve, 100));
          if (typeof window.checkAuth === 'function') {
            checkAuthAvailable = true;
            console.log('✅ [initAdminOverview] utils.js đã load xong sau', (i + 1) * 100, 'ms');
            break;
          }
        }
      }

      // Kiểm tra authentication
      if (checkAuthAvailable && typeof window.checkAuth === 'function') {
        console.log('🔍 [initAdminOverview] Đang kiểm tra authentication...');
        
        // QUAN TRỌNG: Kiểm tra flag logout TRƯỚC KHI check auth
        const isLoggingOut = localStorage.getItem('smartexpense_logging_out') === 'true';
        if (isLoggingOut) {
          console.log('⚠️ [initAdminOverview] Đang trong quá trình logout, bỏ qua check auth');
          setTimeout(() => {
            localStorage.removeItem('smartexpense_logging_out');
          }, 3000);
          return; // Không làm gì cả, để logout handler xử lý
        }
        
        // Kiểm tra localStorage trực tiếp để debug
        const userStr = localStorage.getItem('smartexpense_user');
        const tokenStr = localStorage.getItem('smartexpense_token');
        console.log('🔍 [initAdminOverview] localStorage check:', {
          hasUser: !!userStr,
          hasToken: !!tokenStr,
          userLength: userStr ? userStr.length : 0,
          userStr: userStr ? userStr.substring(0, 100) + '...' : null, // Log một phần để debug
          tokenStr: tokenStr ? tokenStr.substring(0, 20) + '...' : null
        });
        
        let auth = window.checkAuth();
        console.log('🔍 [initAdminOverview] checkAuth() result:', {
          hasAuth: !!auth,
          authType: auth ? typeof auth : 'null',
          hasUser: !!(auth && auth.user),
          userRole: auth && auth.user ? auth.user.role : null,
          userId: auth && auth.user ? auth.user.id : null,
          authKeys: auth ? Object.keys(auth) : []
        });
        
        if (!auth || !auth.user) {
          console.error('❌ [initAdminOverview] Không tìm thấy thông tin đăng nhập');
          console.error('❌ [initAdminOverview] auth object:', auth);
          console.error('❌ [initAdminOverview] auth type:', typeof auth);
          console.error('❌ [initAdminOverview] localStorage user:', userStr);
          console.error('❌ [initAdminOverview] localStorage token:', tokenStr);
          
          // Kiểm tra lại flag logout một lần nữa (có thể được set trong lúc check)
          const retryIsLoggingOut = localStorage.getItem('smartexpense_logging_out') === 'true';
          if (retryIsLoggingOut) {
            console.log('⚠️ [initAdminOverview] Phát hiện flag logout sau khi check auth, bỏ qua redirect');
            setTimeout(() => {
              localStorage.removeItem('smartexpense_logging_out');
            }, 3000);
            return;
          }
          
          // Kiểm tra lại localStorage trực tiếp trước khi redirect
          // Có thể checkAuth() chưa kịp parse nhưng localStorage đã có
          if (userStr && tokenStr) {
            try {
              const user = JSON.parse(userStr);
              console.log('⚠️ [initAdminOverview] localStorage có user nhưng checkAuth() trả về null, thử parse trực tiếp...');
              console.log('⚠️ [initAdminOverview] Parsed user:', user);
              
              // Nếu có user và token trong localStorage, thử đợi thêm một chút để checkAuth() có thể hoạt động
              console.log('⏳ [initAdminOverview] Đợi thêm 500ms để checkAuth() có thể hoạt động...');
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Kiểm tra lại lần nữa
              const retryAuth = window.checkAuth();
              if (retryAuth && retryAuth.user) {
                console.log('✅ [initAdminOverview] Tìm thấy auth sau khi đợi thêm');
                auth = retryAuth; // Sử dụng auth từ lần retry
              } else {
                // Vẫn không có auth từ checkAuth(), nhưng có localStorage
                // Sử dụng user từ localStorage để tiếp tục (có thể checkAuth() có vấn đề)
                console.warn('⚠️ [initAdminOverview] checkAuth() vẫn trả về null nhưng localStorage có user, tiếp tục với user từ localStorage');
                auth = { user: user }; // Tạo auth object từ localStorage
              }
            } catch (parseError) {
              console.error('❌ [initAdminOverview] Lỗi parse user từ localStorage:', parseError);
              // Nếu parse lỗi, redirect về login
              console.error('❌ [initAdminOverview] Redirect về login do lỗi parse');
              window.location.href = '/frontend/User/UI_User/login.html';
              return;
            }
          } else {
            // Không có user hoặc token trong localStorage, đợi thêm một chút rồi redirect
            console.log('⏳ [initAdminOverview] Không có user/token trong localStorage, đợi thêm 1 giây rồi redirect...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Kiểm tra lại flag logout trước khi redirect
            const retryIsLoggingOut = localStorage.getItem('smartexpense_logging_out') === 'true';
            if (retryIsLoggingOut) {
              console.log('⚠️ [initAdminOverview] Đang trong quá trình logout (sau khi đợi), bỏ qua redirect');
              setTimeout(() => {
                localStorage.removeItem('smartexpense_logging_out');
              }, 3000);
              return;
            }
            
            // Kiểm tra lại lần nữa
            const retryUserStr = localStorage.getItem('smartexpense_user');
            const retryTokenStr = localStorage.getItem('smartexpense_token');
            const retryAuth = window.checkAuth();
            
            if (!retryUserStr || !retryTokenStr || !retryAuth || !retryAuth.user) {
              console.error('❌ [initAdminOverview] Vẫn không tìm thấy auth sau khi đợi, redirect về login');
              window.location.href = '/frontend/User/UI_User/login.html';
              return;
            } else {
              console.log('✅ [initAdminOverview] Tìm thấy auth sau khi đợi thêm');
              auth = retryAuth; // Sử dụng auth từ lần retry
            }
          }
        }
        
        // Kiểm tra role
        const role = (auth.user.role || '').toString().toLowerCase();
        console.log('🔍 [initAdminOverview] User role:', role);
        
        const adminRoles = ['admin', 'super_admin', 'superadmin', 'owner', 'root'];
        if (!adminRoles.includes(role)) {
          console.error('❌ [initAdminOverview] User không có quyền admin, role:', role);
          alert('Tài khoản hiện tại không có quyền truy cập trang quản trị.');
          window.location.href = '/frontend/User/UI_User/trangchu.html';
          return;
        }
        
        console.log('✅ [initAdminOverview] Authentication check passed, role:', role);
      } else {
        console.error('❌ [initAdminOverview] Không tìm thấy hàm checkAuth sau khi đợi');
        console.error('❌ [initAdminOverview] window.checkAuth type:', typeof window.checkAuth);
        console.error('❌ [initAdminOverview] window.apiRequest type:', typeof window.apiRequest);
        
        // QUAN TRỌNG: Kiểm tra flag đang logout trước khi redirect
        const isLoggingOut = localStorage.getItem('smartexpense_logging_out') === 'true';
        if (isLoggingOut) {
          console.log('⚠️ [initAdminOverview] Đang trong quá trình logout (checkAuth không có), bỏ qua redirect');
          setTimeout(() => {
            localStorage.removeItem('smartexpense_logging_out');
          }, 3000);
          return;
        }
        
        // Thử kiểm tra localStorage trực tiếp như fallback
        const userStr = localStorage.getItem('smartexpense_user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            const role = (user.role || '').toString().toLowerCase();
            const adminRoles = ['admin', 'super_admin', 'superadmin', 'owner', 'root'];
            
            if (adminRoles.includes(role)) {
              console.warn('⚠️ [initAdminOverview] checkAuth không có nhưng localStorage có user với role admin, tiếp tục...');
            } else {
              console.error('❌ [initAdminOverview] User không có quyền admin, redirect');
              alert('Tài khoản hiện tại không có quyền truy cập trang quản trị.');
              window.location.href = '/frontend/User/UI_User/trangchu.html';
              return;
            }
          } catch (e) {
            console.error('❌ [initAdminOverview] Lỗi parse user từ localStorage:', e);
            // Kiểm tra lại flag logout trước khi redirect
            const retryIsLoggingOut = localStorage.getItem('smartexpense_logging_out') === 'true';
            if (!retryIsLoggingOut) {
              window.location.href = '/frontend/User/UI_User/login.html';
            } else {
              console.log('⚠️ [initAdminOverview] Đang trong quá trình logout, bỏ qua redirect do lỗi parse');
              setTimeout(() => {
                localStorage.removeItem('smartexpense_logging_out');
              }, 3000);
            }
            return;
          }
        } else {
          console.error('❌ [initAdminOverview] Không có user trong localStorage, redirect về login');
          // Kiểm tra lại flag logout trước khi redirect
          const retryIsLoggingOut = localStorage.getItem('smartexpense_logging_out') === 'true';
          if (!retryIsLoggingOut) {
            window.location.href = '/frontend/User/UI_User/login.html';
          } else {
            console.log('⚠️ [initAdminOverview] Đang trong quá trình logout, bỏ qua redirect');
            setTimeout(() => {
              localStorage.removeItem('smartexpense_logging_out');
            }, 3000);
          }
          return;
        }
      }

      initEventListeners();
      updateRangeLabel();
      updateLastUpdatedLabel();
      await loadOverview(currentRange);
    } catch (error) {
      console.error('❌ [initAdminOverview] Lỗi khởi tạo trang tổng quan admin:', error);
      console.error('❌ [initAdminOverview] Error stack:', error.stack);
      if (categorySummaryEl) {
        categorySummaryEl.textContent = 'Không thể khởi tạo trang tổng quan.';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminOverview);
  } else {
    initAdminOverview();
  }
})();

