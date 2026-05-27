@echo off
title Spidr Dev Launcher
echo.
echo  ========================================
echo   SPIDR Dev Launcher
echo  ========================================
echo.

:: Kill anything already using port 4000 (old server instance)
echo Freeing port 4000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":4000 "') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Done.
echo.

:: Start backend
echo Starting backend server...
start "Spidr Backend" cmd /k "cd /d %~dp0spidr-server && npm install --silent && npm run dev"

:: Wait for backend
echo Waiting for backend to start...
timeout /t 4 /nobreak > nul

:: Start frontend
echo Starting frontend...
start "Spidr Frontend" cmd /k "cd /d %~dp0spidr-client && npm install --silent && npm run dev"

echo.
echo  Both servers starting in separate windows.
echo  Open: http://localhost:5173
echo.
timeout /t 5 /nobreak > nul
start "" "http://localhost:5173"
