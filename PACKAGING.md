# NetGuard Desktop Packaging & Deployment Guide

## Overview

This guide walks through building and packaging NetGuard as a standalone Windows executable (.exe) with all dependencies bundled.

---

## Prerequisites

- **Node.js** v18+ (LTS recommended)
- **npm** v9+
- **Git** (for cloning the repository)
- **Windows** (for building the Windows installer; can cross-compile on macOS/Linux)

Verify installation:
```bash
node --version
npm --version
```

---

## Build & Package Steps

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/brandtmgreen/NetGuard-Diagnostics-Dashboard.git
cd NetGuard-Diagnostics-Dashboard
npm install
```

### 2. Configure Environment

Copy the environment template:
```bash
cp .env.example .env
```

Edit `.env` and set your Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
APP_URL=http://localhost:3000
```

### 3. Build Frontend & Backend

```bash
npm run build
```

This generates:
- **`dist/`** — Compiled React SPA + bundled Express server (`dist/server.cjs`)

Verify the build:
```bash
ls -la dist/
# Should contain: index.html, server.cjs, and bundled assets
```

### 4. Package for Windows

#### Option A: Automated Script (Recommended)

**Windows:**
```bash
.\build-package.bat
```

**macOS/Linux:**
```bash
chmod +x build-package.sh
./build-package.sh
```

#### Option B: Manual Command

```bash
npm run electron-build:win
```

**Output:** Installers in `dist/electron-builds/`
- `NetGuard-Diagnostics-<version>-x64.exe` (NSIS installer)
- `NetGuard-Diagnostics-<version>-x64-portable.exe` (standalone portable)

---

## Testing

### 1. Test Bundled Executable

Run the portable version:
```bash
.\dist\electron-builds\NetGuard-Diagnostics-*-portable.exe
```

Or install and run from Start Menu:
```bash
.\dist\electron-builds\NetGuard-Diagnostics-*.exe
```

### 2. Verify Functionality

- ✅ Dashboard loads at startup
- ✅ Network discovery works (`/api/network/discover`)
- ✅ Terminal commands execute (`/api/terminal/run`)
- ✅ NMAP scans run (`/api/security/nmap`)
- ✅ Gemini AI responds to diagnostics
- ✅ Firewall rules create/apply properly

### 3. Check Logs

Electron logs are written to:
- **Windows:** `%APPDATA%\NetGuard Diagnostics\logs\` (if logging configured)
- **Console output:** Visible in development mode via DevTools (F12)

---

## Production Distribution

### Code Signing (Required for Enterprise/Retail)

Windows SmartScreen will warn unsigned executables. To bypass:

1. **Obtain a Code Signing Certificate**
   - Self-signed (for internal/testing): Use OpenSSL or Windows Certificate Authority
   - Commercial (for production): DigiCert, GlobalSign, Sectigo (~$200–400/year)

2. **Configure electron-builder.yml**

```yaml
win:
  certificateFile: "path/to/cert.pfx"
  certificatePassword: "${CERT_PASSWORD}"
  signingHashAlgorithms:
    - sha256
```

3. **Build & Sign**

```bash
CERT_PASSWORD=your_password npm run electron-build:win
```

### Auto-Updates (Optional)

To enable auto-updates, configure electron-updater:

```bash
npm install electron-updater
```

Then in `electron.cjs`:
```javascript
const { autoUpdater } = require("electron-updater");
autoUpdater.checkForUpdatesAndNotify();
```

---

## Troubleshooting

### Build Fails: "dist/server.cjs not found"

**Cause:** `npm run build` didn't complete successfully.

**Solution:**
```bash
npm run clean
npm install
npm run build
```

### Build Fails: "Electron not found"

**Cause:** electron-builder not installed.

**Solution:**
```bash
npm install --save-dev electron electron-builder
```

### EXE Fails to Start: "Server executable missing"

**Cause:** Bundled `dist/server.cjs` is corrupted or missing.

**Solution:**
```bash
npm run clean
npm run build
npm run electron-build:win
```

### EXE Fails to Start: "Backend server failed to start"

**Cause:** Port 3000 already in use, or GEMINI_API_KEY not set.

**Solution:**
1. Verify `.env` file exists in the app installation directory
2. Kill any process on port 3000: `netstat -ano | find "3000"`
3. Check that Gemini API key is valid

### Windows Defender/SmartScreen Blocks EXE

**Cause:** Unsigned executable.

**Solution:**
- Add code signing certificate (see Production Distribution)
- Or: Bypass via SmartScreen on first run ("Run anyway")

---

## File Structure After Packaging

```
dist/
├── electron-builds/
│   ├── NetGuard-Diagnostics-1.0.0-x64.exe          # NSIS installer
│   ├── NetGuard-Diagnostics-1.0.0-x64-portable.exe # Portable standalone
│   └── ...other metadata files
├── index.html              # Compiled React SPA
├── server.cjs              # Bundled Express backend
└── ...bundled assets
```

---

## Performance & Size

- **Installer size:** ~250–350 MB (includes Chromium + Node.js)
- **Installed size:** ~500–700 MB (unpacked)
- **Startup time:** 2–5s (Electron + Express bootstrap)
- **Memory at idle:** ~150–200 MB

---

## Next Steps

1. ✅ **Build & test** the Windows package
2. 📋 **Code signing** (if distributing to enterprises)
3. 🚀 **Deploy** via your distribution channel (GitHub Releases, S3, custom installer server)
4. 📊 **Monitor** adoption and crash reports via Sentry or similar

---

## Support

For issues:
1. Check console logs (F12 in Electron)
2. Run `npm run build && npm run electron-build:dir` for a test build
3. File an issue on GitHub: https://github.com/brandtmgreen/NetGuard-Diagnostics-Dashboard/issues

---

**Last Updated:** September 2026
