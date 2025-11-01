@echo off
echo ========================================
echo    SmartExpense - Quick Start Flask
echo ========================================
echo.

echo Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python chua duoc cai dat!
    echo Vui long cai dat Python tu: https://python.org/
    pause
    exit /b 1
)

echo Checking if virtual environment exists...
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate

echo Checking if dependencies are installed...
if not exist "venv\Lib\site-packages\flask" (
    echo Installing dependencies...
    pip install -r requirements.txt
)

echo Checking .env file...
if not exist ".env" (
    echo Creating .env file...
    copy "env.example" ".env"
    echo.
    echo ========================================
    echo    CAU HINH CAN THIET
    echo ========================================
    echo File .env da duoc tao tai: backend\.env
    echo Vui long chinh sua file nay voi thong tin cua ban:
    echo.
    echo - DB_PASS: Mat khau MySQL cua ban
    echo - JWT_SECRET: Thay doi thanh chuoi bi mat
    echo - GOOGLE_CLIENT_ID: Client ID cua Google (neu muon dung Google login)
    echo.
    echo Sau khi chinh sua, chay lai script nay.
    echo.
    pause
    exit /b 0
)

echo Starting Flask Backend...
start "Flask Backend" cmd /k "cd /d E:\AI-Powered Smart Expense Management System\backend && venv\Scripts\activate && python app.py"

timeout /t 3 /nobreak > nul

echo Starting Frontend...
start "Frontend Server" cmd /k "cd /d E:\AI-Powered Smart Expense Management System && python -m http.server 8080"

echo.
echo ========================================
echo    SERVERS ARE RUNNING!
echo ========================================
echo Backend Flask: http://127.0.0.1:5000
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
echo - Kiem tra MySQL da chay chua
echo - Restart lai bang cach dong cac cua so va chay lai
echo.
echo Press any key to exit...
pause > nul