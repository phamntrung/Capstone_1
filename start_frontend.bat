@echo off
echo ========================================
echo    SmartExpense - Frontend Server
echo ========================================
echo.

echo Starting Frontend Server on port 8080...
echo Serving from: E:\AI-Powered Smart Expense Management System
echo.
echo Access URLs:
echo - Trang chu: http://localhost:8080/frontend/trangchu.html
echo - Dang nhap: http://localhost:8080/frontend/login.html
echo - Dang ky: http://localhost:8080/frontend/dangki.html
echo.

cd /d "E:\AI-Powered Smart Expense Management System"
python -m http.server 8080
