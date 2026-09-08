#!/bin/bash
# NetGuard Build & Package Script
# Builds React + Express bundle and packages as Windows NSIS installer + portable EXE

set -e

echo "============================================"
echo "NetGuard Desktop Build & Package Pipeline"
echo "============================================"
echo ""

# Step 1: Clean previous builds
echo "[1/4] Cleaning previous builds..."
npm run clean

# Step 2: Install dependencies (if needed)
echo "[2/4] Installing dependencies..."
npm install

# Step 3: Build React frontend + Express backend
echo "[3/4] Building React frontend and Express backend..."
npm run build

if [ ! -f "dist/server.cjs" ]; then
  echo "❌ Build failed: dist/server.cjs not found"
  exit 1
fi

echo "✓ Build complete"
echo ""

# Step 4: Package with electron-builder
echo "[4/4] Packaging with electron-builder..."
npx electron-builder --win --publish never

if [ -d "dist/electron-builds" ]; then
  echo ""
  echo "============================================"
  echo "✓ Packaging complete!"
  echo "============================================"
  echo ""
  echo "Installers available in: dist/electron-builds/"
  ls -lh dist/electron-builds/
  echo ""
  echo "Next steps:"
  echo "  1. Test: dist/electron-builds/NetGuard-Diagnostics-*.exe (NSIS installer)"
  echo "  2. Test: dist/electron-builds/NetGuard-Diagnostics-*-portable.exe (portable)"
  echo "  3. Sign with code certificate before production distribution"
  echo ""
else
  echo "❌ Packaging failed"
  exit 1
fi
