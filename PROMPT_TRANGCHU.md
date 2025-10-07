# PROMPT CHO CÁC CHỨC NĂNG TRANG CHỦ SMARTEXPENSE

## 🎯 MỤC TIÊU TỔNG QUAN
Tạo một ứng dụng quản lý chi tiêu cá nhân thông minh với giao diện hiện đại, tính năng AI chatbot và khả năng theo dõi tài chính real-time.

## 📊 CÁC CHỨC NĂNG CHÍNH TRANG CHỦ

### 1. DASHBOARD KPI (Key Performance Indicators)
**Mô tả:** Hiển thị 4 thẻ thông tin quan trọng nhất
- **Số dư hiện tại:** Hiển thị số tiền còn lại trong tài khoản
- **Chi tiêu tháng này:** Tổng số tiền đã chi trong tháng hiện tại với % thay đổi so với tháng trước
- **Thu nhập tháng này:** Tổng thu nhập tháng hiện tại với % tăng trưởng
- **Mục tiêu tiết kiệm:** Hiển thị tiến độ đạt mục tiêu với thanh progress bar

**Yêu cầu kỹ thuật:**
- Cập nhật real-time khi có giao dịch mới
- Hiển thị màu sắc khác nhau cho tăng/giảm (xanh/đỏ)
- Animation khi cập nhật số liệu
- Format số tiền theo chuẩn Việt Nam (dấu phẩy phân cách)

### 2. BIỂU ĐỒ XU HƯỚNG CHI TIÊU
**Mô tả:** Biểu đồ cột thể hiện xu hướng chi tiêu theo thời gian
- Dropdown chọn khoảng thời gian: 30/60/90 ngày
- Hiển thị 6 cột đại diện cho các khoảng thời gian
- Màu sắc gradient từ nhạt đến đậm

**Yêu cầu kỹ thuật:**
- Responsive design cho mobile
- Hover effect hiển thị số liệu chính xác
- Animation khi thay đổi khoảng thời gian
- Tích hợp với dữ liệu thực từ database

### 3. PHÂN TÍCH THEO HẠNG MỤC
**Mô tả:** Danh sách các danh mục chi tiêu phổ biến
- Ăn uống 🍽️
- Di chuyển 🚗  
- Nhà ở 🏠
- Mua sắm 🛍️
- Giải trí 🎮

**Yêu cầu kỹ thuật:**
- Click vào từng hạng mục để xem chi tiết
- Hiển thị icon emoji cho từng danh mục
- Sắp xếp theo số tiền từ cao đến thấp
- Tính phần trăm so với tổng chi tiêu

### 4. SỔ CHI TIÊU NHANH
**Mô tả:** Panel bên phải cho phép nhập chi tiêu nhanh
- Hiển thị tổng chi tiêu tháng này
- Hiển thị chi tiêu hôm nay
- Ô input để thêm chi tiêu mới với cú pháp: "[mô tả] [số tiền]"
- Nút "Thêm" để xác nhận

**Yêu cầu kỹ thuật:**
- Validation input theo format: "Cà phê 25000"
- Auto-complete cho các mô tả thường dùng
- Cập nhật ngay lập tức các KPI khi thêm
- Lưu vào localStorage hoặc database
- Enter key để submit nhanh

### 5. BẢNG GIAO DỊCH GẦN ĐÂY
**Mô tả:** Bảng hiển thị các giao dịch mới nhất
- Cột: Hạng mục, Mô tả, Số tiền
- Ô tìm kiếm để lọc giao dịch
- Nút "Thêm" để tạo giao dịch mới
- Hiển thị 5-10 giao dịch gần nhất

**Yêu cầu kỹ thuật:**
- Real-time search/filter
- Pagination hoặc infinite scroll
- Click vào row để edit giao dịch
- Export data ra CSV/Excel
- Responsive table cho mobile

### 6. CHATBOT AI ASSISTANT
**Mô tả:** Trợ lý AI thông minh hỗ trợ người dùng
- Floating button hình con heo ở góc phải màn hình
- Chat popup với giao diện thân thiện
- Có thể trả lời câu hỏi về tài chính
- Hỗ trợ thêm chi tiêu bằng chat
- Đưa ra lời khuyên tiết kiệm

**Các câu lệnh chatbot hỗ trợ:**
- "Thêm chi tiêu [mô tả] [số tiền]"
- "Xem báo cáo tháng này"
- "Mục tiêu tiết kiệm của tôi thế nào?"
- "Tư vấn cách tiết kiệm"
- "Phân tích chi tiêu theo danh mục"

**Yêu cầu kỹ thuật:**
- Natural Language Processing cơ bản
- Typing indicator khi bot đang "suy nghĩ"
- Lưu lịch sử chat
- Integration với các chức năng khác
- Voice input (tùy chọn)

### 7. TÌM KIẾM TOÀN CỤC
**Mô tả:** Ô tìm kiếm ở header
- Tìm kiếm giao dịch theo mô tả
- Tìm kiếm theo số tiền
- Tìm kiếm theo ngày tháng
- Auto-suggest khi gõ

**Yêu cầu kỹ thuật:**
- Debounce search để tối ưu performance
- Highlight kết quả tìm được
- Search history
- Advanced filter options

### 8. PROFILE & SETTINGS
**Mô tả:** Avatar người dùng ở góc phải header
- Click để xem profile
- Dropdown menu với các tùy chọn
- Đăng xuất
- Cài đặt tài khoản

## 🎨 YÊU CẦU THIẾT KẾ UI/UX

### Màu sắc chủ đạo:
- **Primary:** #2563eb (xanh dương)
- **Success:** #10b981 (xanh lá)
- **Danger:** #ef4444 (đỏ)
- **Background:** #eaf3f9 (xanh nhạt)
- **Card:** #ffffff (trắng)
- **Text:** #0f172a (đen nhạt)

### Typography:
- Font chính: Inter, system-ui
- Font size: 14px (body), 18px (heading), 22px (title)
- Font weight: 400 (normal), 600 (semibold), 800 (bold)

### Layout:
- Sidebar 260px cố định
- Main content responsive
- Grid system 12 columns
- Border radius: 14px cho cards
- Box shadow: subtle shadow cho depth

### Responsive Breakpoints:
- Desktop: > 1200px
- Tablet: 768px - 1200px  
- Mobile: < 768px

## 🔧 YÊU CẦU KỸ THUẬT

### Frontend:
- **HTML5** semantic markup
- **CSS3** với CSS Variables
- **Vanilla JavaScript** ES6+
- **Local Storage** cho dữ liệu offline
- **Service Worker** cho PWA (tùy chọn)

### Performance:
- Page load < 2 seconds
- Smooth animations 60fps
- Lazy loading cho images
- Minify CSS/JS cho production

### Accessibility:
- ARIA labels cho screen readers
- Keyboard navigation support
- Color contrast ratio > 4.5:1
- Focus indicators rõ ràng

### Browser Support:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers

## 📱 TÍNH NĂNG MOBILE

### Touch Interactions:
- Swipe để xóa giao dịch
- Pull to refresh
- Touch-friendly button sizes (44px minimum)
- Haptic feedback (nếu có)

### Mobile-specific:
- Bottom navigation cho mobile
- Floating Action Button
- Collapsible sidebar
- One-hand operation friendly

## 🔐 BẢO MẬT & PRIVACY

### Data Protection:
- Encrypt sensitive data
- Secure API endpoints
- Input validation & sanitization
- XSS protection

### User Privacy:
- Không thu thập dữ liệu không cần thiết
- Option để xóa tất cả dữ liệu
- Offline-first approach
- GDPR compliance (nếu cần)

## 🚀 TÍNH NĂNG NÂNG CAO (FUTURE)

### AI & Machine Learning:
- Phân tích pattern chi tiêu
- Dự đoán chi tiêu tương lai
- Gợi ý tiết kiệm thông minh
- Phát hiện giao dịch bất thường

### Integration:
- Sync với ngân hàng (Open Banking)
- Import từ SMS banking
- Export sang các ứng dụng khác
- API cho third-party apps

### Social Features:
- Chia sẻ mục tiêu tiết kiệm
- So sánh với bạn bè (anonymous)
- Community challenges
- Leaderboard tiết kiệm

## 📊 METRICS & ANALYTICS

### User Engagement:
- Daily/Monthly Active Users
- Session duration
- Feature usage frequency
- Retention rate

### Financial Metrics:
- Average savings per user
- Most popular expense categories
- Goal completion rate
- Budget adherence rate

---

**Lưu ý:** Đây là prompt chi tiết cho việc phát triển trang chủ SmartExpense. Có thể điều chỉnh và mở rộng theo nhu cầu cụ thể của dự án.
