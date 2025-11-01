@echo off
echo ========================================
echo    SmartExpense - Quick Start Node.js
echo ========================================
echo.

echo Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js chua duoc cai dat!
    echo Vui long cai dat Node.js tu: https://nodejs.org/
    pause
    exit /b 1
)

echo Checking if dependencies are installed...
if not exist "backend-node\node_modules" (
    echo Installing dependencies...
    cd backend-node
    npm install
    cd ..
)

echo Checking .env file...
if not exist "backend-node\.env" (
    echo Creating .env file...
    copy "backend-node\env.example" "backend-node\.env"
    echo.
    echo ========================================
    echo    CAU HINH CAN THIET
    echo ========================================
    echo File .env da duoc tao tai: backend-node\.env
    echo Vui long chinh sua file nay voi thong tin cua ban:
    echo.
    echo - JWT_SECRET: Thay doi thanh chuoi bi mat
    echo - EMAIL_USER: Email cua ban (neu muon dung email)
    echo - EMAIL_PASS: App Password cua Gmail
    echo.
    echo Sau khi chinh sua, chay lai script nay.
    echo.
    pause
    exit /b 0
)

echo Starting Node.js Backend...
start "Node.js Backend" cmd /k "cd /d E:\AI-Powered Smart Expense Management System\backend-node && npm run dev"

timeout /t 3 /nobreak > nul

echo Starting Frontend...
start "Frontend Server" cmd /k "cd /d E:\AI-Powered Smart Expense Management System && python -m http.server 8080"

echo.
echo ========================================
echo    SERVERS ARE RUNNING!
echo ========================================
echo Backend Node.js: http://127.0.0.1:5001
echo Frontend: http://localhost:8080/frontend/trangchu.html
echo.
echo ========================================
echo    CAC BUOC TIEP THEO
echo ========================================
echo 1. Mo trinh duyet: http://localhost:8080/frontend/trangchu.html
echo 2. Dang ky tai khoan moi
echo 3. Bat dau su dung SmartExpense!
echo.
echo ========================================
echo    NEU CO LOI
echo ========================================
echo - Kiem tra console backend co loi gi khong
echo - Kiem tra file .env da cau hinh dung chua
echo - Restart lai bang cach dong cac cua so va chay lai
echo.
echo Press any key to exit...
pause > nul
