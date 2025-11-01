@echo off
echo ========================================
echo    KHOI DONG BACKEND FLASK
echo ========================================
echo.

cd /d "%~dp0backend"

echo Dang kiem tra Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [LOI] Python chua duoc cai dat!
    echo Vui long cai dat Python tu: https://python.org/
    pause
    exit /b 1
)

echo Dang kiem tra virtual environment...
if not exist "venv" (
    echo Tao virtual environment...
    python -m venv venv
)

echo Kich hoat virtual environment...
call venv\Scripts\activate

echo Dang kiem tra dependencies...
if not exist "venv\Lib\site-packages\flask" (
    echo Cai dat dependencies...
    pip install -r requirements.txt
)

echo Dang kiem tra file .env...
if not exist ".env" (
    echo [CANH BAO] File .env chua ton tai!
    echo Dang tao file .env tu env.example...
    copy env.example .env
    echo.
    echo ========================================
    echo    CAU HINH CAN THIET
    echo ========================================
    echo File .env da duoc tao.
    echo Vui long chinh sua file .env trong thu muc backend:
    echo - DB_PASS hoac MYSQL_PASSWORD: Mat khau MySQL
    echo - JWT_SECRET: Thay doi thanh chuoi bi mat
    echo.
    echo Sau do chay lai script nay.
    echo.
    pause
    exit /b 0
)

echo.
echo ========================================
echo    KHOI DONG BACKEND FLASK
echo ========================================
echo Backend se chay tai: http://127.0.0.1:5000
echo.
echo Nhan Ctrl+C de dung server
echo.

python app.py

pause

