@echo off
title POS Print Server Launcher
cd /d "%~dp0"

echo Checking dependencies...
if not exist "node_modules" (
    echo [!] node_modules not found. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies. Please check your internet connection or Node.js installation.
        pause
        exit /b
    )
    echo [OK] Dependencies installed.
)

echo.
echo Launching Setup...
call node setup.js

echo.
echo Starting Server...
echo ==============================================
call node server.js
pause
