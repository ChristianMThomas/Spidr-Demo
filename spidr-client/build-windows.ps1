# SPIDR Windows Build Script (PowerShell)
# Run with: powershell -ExecutionPolicy Bypass -File build-windows.ps1

Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "  SPIDR Windows Build"                    -ForegroundColor Cyan
Write-Host "========================================"  -ForegroundColor Cyan
Write-Host ""

# Disable code signing
$env:CSC_LINK = ""
$env:CSC_KEY_PASSWORD = ""

# Clear the winCodeSign cache that causes the symlink error
$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
if (Test-Path $cacheDir) {
    Write-Host "Clearing winCodeSign cache..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $cacheDir
    Write-Host "Cache cleared." -ForegroundColor Green
}

# Step 1: Build frontend
Write-Host ""
Write-Host "Step 1: Building Vite frontend..." -ForegroundColor Yellow
npx vite build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Vite build failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 2: Build Electron
Write-Host ""
Write-Host "Step 2: Building Electron app..." -ForegroundColor Yellow
npx electron-builder build --win --x64 --publish=never --config electron-builder.yml

# Check for output
Write-Host ""
$setupExe    = "dist_installer\SpidrSetup-1.0.0.exe"
$portableExe = "dist_installer\Spidr-1.0.0.exe"

if (Test-Path $setupExe) {
    Write-Host "========================================"  -ForegroundColor Green
    Write-Host "  SUCCESS!"                               -ForegroundColor Green
    Write-Host "  $setupExe"                              -ForegroundColor Green
    Write-Host "========================================"  -ForegroundColor Green
} elseif (Test-Path $portableExe) {
    Write-Host "========================================"  -ForegroundColor Green
    Write-Host "  SUCCESS! (portable)"                    -ForegroundColor Green
    Write-Host "  $portableExe"                           -ForegroundColor Green
    Write-Host "========================================"  -ForegroundColor Green
} else {
    Write-Host "Checking dist_installer..." -ForegroundColor Yellow
    if (Test-Path "dist_installer") {
        Get-ChildItem "dist_installer"
    } else {
        Write-Host "No output found." -ForegroundColor Red
    }
}

Read-Host "Press Enter to exit"
