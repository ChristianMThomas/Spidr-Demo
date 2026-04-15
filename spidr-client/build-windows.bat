@echo off
title Spidr Build Tool
color 0A
echo.
echo  ========================================
echo   SPIDR - Windows Build Tool
echo  ========================================
echo.

if not exist "package.json" (
    echo ERROR: Must run from inside the spidr-client folder.
    pause & exit /b 1
)

:: Disable code signing
set CSC_LINK=
set CSC_KEY_PASSWORD=

:: Step 1: Clean
echo [1/4] Cleaning old build...
if exist "dist"           rd /s /q "dist"
if exist "dist_installer" rd /s /q "dist_installer"
if exist "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" (
    rd /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign"
)
echo       Done.

:: Step 2: Install
echo [2/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 ( echo FAILED & pause & exit /b 1 )

:: Step 3: Vite build
echo [3/4] Building frontend...
call npx vite build
if %errorlevel% neq 0 ( echo FAILED: Vite build error & pause & exit /b 1 )
if not exist "dist\index.html" ( echo FAILED: no dist\index.html & pause & exit /b 1 )
echo       dist\index.html confirmed OK.

:: Step 4: Electron build
echo [4/4] Building installer...
call npx electron-builder build --win --x64 --publish=never
echo.

if exist "dist_installer\SpidrSetup-1.0.0.exe" (
    echo  ========================================
    echo   SUCCESS: SpidrSetup-1.0.0.exe
    echo  ========================================
    start "" "dist_installer"
) else if exist "dist_installer\Spidr-1.0.0.exe" (
    echo  ========================================
    echo   SUCCESS: Spidr-1.0.0.exe (portable)
    echo  ========================================
    start "" "dist_installer"
) else (
    echo  Checking dist_installer:
    dir dist_installer\ 2>nul || echo  (not found)
)
pause
