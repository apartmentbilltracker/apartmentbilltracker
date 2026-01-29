@echo off
REM Apartment Bill Tracker - Mobile App Installation Script (Windows)

echo ================================
echo Apartment Bill Tracker Mobile App
echo ================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo Error: Node.js is not installed. Please install Node.js first.
    exit /b 1
)

echo Node.js found: 
node --version
echo.

REM Install dependencies
echo Installing dependencies...
call npm install

echo.
echo Installation complete!
echo.
echo ================================
echo Next Steps:
echo ================================
echo.
echo 1. Update API Configuration:
echo    Edit: src/config/config.js
echo    Change API_BASE_URL to your backend server IP
echo.
echo 2. Start the development server:
echo    npm start
echo.
echo 3. Run on Android/iOS:
echo    - Download Expo Go app
echo    - Scan the QR code
echo.
echo ================================
echo.
pause
