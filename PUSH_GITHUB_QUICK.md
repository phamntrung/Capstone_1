# ⚡ PUSH GITHUB - HƯỚNG DẪN NHANH

## 🎯 MỤC TIÊU
- **Repository:** `Capstone_1`
- **Branch:** `feat/trung1211`
- **URL:** `https://github.com/phamntrung/Capstone_1`

---

## 🚀 QUY TRÌNH NHANH (3 BƯỚC)

### **Bước 1: Add & Commit**
```powershell
git add .
git commit -m "feat: Cập nhật toàn bộ dự án Capstone_1"
```

### **Bước 2: Chuyển sang branch**
```powershell
git checkout feat/trung1211
```
*Nếu branch chưa có: `git checkout -b feat/trung1211`*

### **Bước 3: Push lên GitHub**
```powershell
git push -u origin feat/trung1211
```

---

## 📋 COPY & PASTE (TẤT CẢ TRONG 1 LẦN)

### **Nếu đang ở branch `feat/trung`:**
```powershell
git add .
git commit -m "feat: Cập nhật toàn bộ dự án Capstone_1"
git checkout feat/trung1211
git merge feat/trung
git push -u origin feat/trung1211
```

### **Nếu muốn commit trực tiếp ở `feat/trung1211`:**
```powershell
git checkout feat/trung1211
git add .
git commit -m "feat: Cập nhật toàn bộ dự án Capstone_1"
git push -u origin feat/trung1211
```

---

## 🔍 KIỂM TRA

### **Trước khi push:**
```powershell
git status          # Xem thay đổi
git log --oneline -5 # Xem commit
```

### **Sau khi push:**
```powershell
git log origin/feat/trung1211 --oneline -5
```

**Hoặc kiểm tra trên web:**
👉 `https://github.com/phamntrung/Capstone_1/tree/feat/trung1211`

---

## ⚠️ XỬ LÝ LỖI

### **Lỗi: "Updates were rejected"**
```powershell
git pull origin feat/trung1211
git push origin feat/trung1211
```

### **Lỗi: "Branch not found"**
→ Bình thường, lần đầu push sẽ tự tạo branch

---

## 📖 HƯỚNG DẪN CHI TIẾT
👉 Xem file: `HUONG_DAN_PUSH_GITHUB.md`

