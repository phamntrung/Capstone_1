# 📤 HƯỚNG DẪN PUSH TOÀN BỘ DỰ ÁN LÊN GITHUB

## 🎯 MỤC TIÊU
- Repository: `Capstone_1`
- Branch: `feat/trung1211`
- URL: `https://github.com/phamntrung/Capstone_1`

---

## 📊 TRẠNG THÁI HIỆN TẠI

✅ **Đã có:**
- Remote repository đã cấu hình: `origin` → `https://github.com/phamntrung/Capstone_1`
- Branch `feat/trung1211` đã tồn tại trên GitHub
- Đang ở branch: `feat/trung`

⚠️ **Cần xử lý:**
- Có thay đổi chưa commit: `frontend/Admin (new commits)`

---

## 🔧 CÁC BƯỚC THỰC HIỆN

### **BƯỚC 1: Kiểm tra trạng thái Git**

```powershell
# Xem tất cả thay đổi
git status

# Xem các file đã thay đổi
git status --short
```

**Kết quả mong đợi:** Hiển thị các file đã thay đổi, thêm mới, hoặc xóa.

---

### **BƯỚC 2: Thêm tất cả thay đổi vào staging area**

```powershell
# Thêm tất cả file mới và thay đổi
git add .

# Hoặc thêm từng file cụ thể (nếu muốn kiểm soát)
git add frontend/Admin
git add backend-node/
git add backend/
```

**Giải thích:**
- `git add .` → Thêm tất cả file trong thư mục hiện tại
- `git add <file>` → Thêm file/thư mục cụ thể

**Kiểm tra sau khi add:**
```powershell
git status
```
→ Các file sẽ chuyển từ màu đỏ sang màu xanh (đã staged)

---

### **BƯỚC 3: Commit các thay đổi**

```powershell
# Commit với message mô tả rõ ràng
git commit -m "feat: Cập nhật toàn bộ dự án Capstone_1 - [Ngày tháng]"

# Hoặc message chi tiết hơn
git commit -m "feat: Cập nhật toàn bộ dự án

- Cập nhật frontend Admin
- Cập nhật backend Node.js
- Cập nhật backend Python
- Cập nhật các file cấu hình"
```

**Lưu ý:**
- Message nên rõ ràng, mô tả được những gì đã thay đổi
- Format: `feat:` (tính năng mới), `fix:` (sửa lỗi), `update:` (cập nhật)

**Kiểm tra commit:**
```powershell
git log --oneline -5
```
→ Xem 5 commit gần nhất để xác nhận

---

### **BƯỚC 4: Chuyển sang branch feat/trung1211**

**Tùy chọn A: Branch đã tồn tại local**

```powershell
# Chuyển sang branch
git checkout feat/trung1211

# Hoặc nếu branch chưa có local, tạo mới từ remote
git checkout -b feat/trung1211 origin/feat/trung1211
```

**Tùy chọn B: Tạo branch mới từ branch hiện tại**

```powershell
# Tạo và chuyển sang branch mới
git checkout -b feat/trung1211

# Hoặc nếu muốn tạo từ branch khác
git checkout -b feat/trung1211 main
```

**Kiểm tra branch hiện tại:**
```powershell
git branch
```
→ Dấu `*` hiển thị branch đang ở

---

### **BƯỚC 5: Merge code từ branch hiện tại (nếu cần)**

**Nếu bạn đang ở `feat/trung` và muốn đưa code sang `feat/trung1211`:**

```powershell
# Đảm bảo đã commit hết thay đổi ở feat/trung
git checkout feat/trung
git add .
git commit -m "feat: Cập nhật code trước khi merge"

# Chuyển sang feat/trung1211
git checkout feat/trung1211

# Merge code từ feat/trung
git merge feat/trung
```

**Hoặc nếu muốn đưa code hiện tại lên feat/trung1211 trực tiếp:**

```powershell
# Ở branch feat/trung, đã commit xong
# Chuyển sang feat/trung1211
git checkout feat/trung1211

# Cherry-pick commit từ feat/trung (nếu cần)
# Hoặc đơn giản là commit ở feat/trung1211 luôn
```

---

### **BƯỚC 6: Push code lên GitHub**

**Lần đầu push branch mới:**

```powershell
# Push và set upstream
git push -u origin feat/trung1211
```

**Các lần sau (branch đã có trên GitHub):**

```powershell
# Push đơn giản
git push origin feat/trung1211

# Hoặc nếu đã set upstream
git push
```

**Giải thích:**
- `-u origin feat/trung1211` → Set upstream để lần sau chỉ cần `git push`
- `origin` → Tên remote (đã cấu hình sẵn)
- `feat/trung1211` → Tên branch

**Kiểm tra sau khi push:**
```powershell
git log --oneline --graph --all -10
```
→ Xem cây commit và xác nhận đã push

---

## 🔄 QUY TRÌNH ĐẦY ĐỦ (COPY & PASTE)

### **Trường hợp 1: Đang ở branch `feat/trung`, muốn push lên `feat/trung1211`**

```powershell
# 1. Kiểm tra trạng thái
git status

# 2. Add tất cả thay đổi
git add .

# 3. Commit
git commit -m "feat: Cập nhật toàn bộ dự án Capstone_1"

# 4. Chuyển sang branch feat/trung1211 (hoặc tạo mới)
git checkout feat/trung1211
# Nếu branch chưa có: git checkout -b feat/trung1211

# 5. Merge code từ feat/trung (nếu cần)
git merge feat/trung

# 6. Push lên GitHub
git push -u origin feat/trung1211
```

### **Trường hợp 2: Muốn commit và push trực tiếp ở branch `feat/trung1211`**

```powershell
# 1. Chuyển sang branch feat/trung1211
git checkout feat/trung1211

# 2. Kiểm tra trạng thái
git status

# 3. Add tất cả thay đổi
git add .

# 4. Commit
git commit -m "feat: Cập nhật toàn bộ dự án Capstone_1"

# 5. Push lên GitHub
git push -u origin feat/trung1211
```

---

## ⚠️ XỬ LÝ LỖI THƯỜNG GẶP

### **Lỗi 1: "Updates were rejected because the remote contains work"**

**Nguyên nhân:** Branch trên GitHub có code mới hơn local

**Giải pháp:**
```powershell
# Pull code mới nhất trước
git pull origin feat/trung1211

# Giải quyết conflict nếu có, sau đó push lại
git push origin feat/trung1211
```

### **Lỗi 2: "Authentication failed"**

**Nguyên nhân:** Chưa đăng nhập GitHub

**Giải pháp:**
```powershell
# Sử dụng Personal Access Token thay vì password
# Hoặc cấu hình SSH key
```

### **Lỗi 3: "Branch not found"**

**Nguyên nhân:** Branch chưa tồn tại trên GitHub

**Giải pháp:**
```powershell
# Tạo branch mới và push
git push -u origin feat/trung1211
```

---

## 📋 CHECKLIST TRƯỚC KHI PUSH

- [ ] Đã kiểm tra `git status` - không còn file nào bỏ sót
- [ ] Đã `git add .` - tất cả file đã được staged
- [ ] Đã `git commit` - có message rõ ràng
- [ ] Đã chuyển sang đúng branch `feat/trung1211`
- [ ] Đã kiểm tra `git log` - commit đã được tạo
- [ ] Sẵn sàng push lên GitHub

---

## 🔍 KIỂM TRA SAU KHI PUSH

### **1. Kiểm tra trên GitHub:**
- Truy cập: `https://github.com/phamntrung/Capstone_1/tree/feat/trung1211`
- Xem các file đã được cập nhật

### **2. Kiểm tra bằng Git:**
```powershell
# Xem remote branches
git branch -r

# Xem log với remote
git log origin/feat/trung1211 --oneline -5

# So sánh local và remote
git log HEAD..origin/feat/trung1211
```

---

## 💡 TIPS & BEST PRACTICES

1. **Commit thường xuyên:**
   - Mỗi tính năng hoàn thành → 1 commit
   - Message rõ ràng, dễ hiểu

2. **Kiểm tra trước khi push:**
   - `git status` → Xem thay đổi
   - `git diff` → Xem chi tiết thay đổi
   - `git log` → Xem lịch sử commit

3. **Sử dụng .gitignore:**
   - Không commit file nhạy cảm (.env)
   - Không commit node_modules, venv
   - Đã có sẵn trong dự án ✅

4. **Backup trước khi push:**
   - Đảm bảo code đã được backup
   - Có thể rollback nếu cần

---

## 📞 TÓM TẮT NHANH

```powershell
# QUY TRÌNH ĐƠN GIẢN NHẤT:
git add .
git commit -m "feat: Cập nhật toàn bộ dự án"
git checkout feat/trung1211
git push -u origin feat/trung1211
```

**Hoặc nếu đã ở branch `feat/trung1211`:**
```powershell
git add .
git commit -m "feat: Cập nhật toàn bộ dự án"
git push -u origin feat/trung1211
```

---

## 🎯 KẾT LUẬN

Sau khi hoàn thành các bước trên, toàn bộ dự án sẽ được push lên GitHub tại:
- **Repository:** `https://github.com/phamntrung/Capstone_1`
- **Branch:** `feat/trung1211`
- **URL trực tiếp:** `https://github.com/phamntrung/Capstone_1/tree/feat/trung1211`

**Lưu ý:** Chỉ hướng dẫn, không tự động chạy lệnh. Bạn cần tự thực hiện từng bước!

