@echo off
REM NetGuard Build & Package Script (Windows)
REM Builds React + Express bundle and packages as Windows NSIS installer + portable EXE

setlocal enabledelayedexpansion

echo.
echo ============================================
echo NetGuard Desktop Build ^& Package Pipeline
echo ============================================
echo.

REM Step 1: Clean previous builds
echo [1/4] Cleaning previous builds...
call npm run clean
if !errorlevel! neq 0 (
  echo Clean failed
  exit /b 1
)

REM Step 2: Install dependencies
echo [2/4] Installing dependencies...
call npm install
if !errorlevel! neq 0 (
  echo Install failed
  exit /b 1
)

REM Step 3: Build React frontend + Express backend
echo [3/4] Building React frontend and Express backend...
call npm run build
if !errorlevel! neq 0 (
  echo Build failed
  exit /b 1
)

if not exist "dist\server.cjs" (
  echo ❌ Build failed: dist\server.cjs not found
  exit /b 1
)

echo ✓ Build complete
echo.

REM Step 4: Package with electron-builder
echo [4/4] Packaging with electron-builder...
call npx electron-builder --win --publish never
if !errorlevel! neq 0 (
  echo Packaging failed
  exit /b 1
)

if exist "dist\electron-builds" (
  echo.
  echo ============================================
  echo ✓ Packaging complete!
  echo ============================================
  echo.
  echo Installers available in: dist\electron-builds\
  dir /B dist\electron-builds\
  echo.
  echo Next steps:
  echo   1. Test: dist\electron-builds\NetGuard-Diagnostics-*.exe (NSIS installer)
  echo   2. Test: dist\electron-builds\NetGuard-Diagnostics-*-portable.exe (portable)
  echo   3. Sign with code certificate before production distribution
  echo.
) else (
  echo ❌ Packaging failed
  exit /b 1
)

endlocal
