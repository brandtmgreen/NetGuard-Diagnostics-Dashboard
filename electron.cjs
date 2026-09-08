// NetGuard Standalone Windows Desktop Application (Electron Bootstrap)
// Manages Express backend lifecycle, health checks, and Chromium viewport

const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const { fork } = require("child_process");
const http = require("http");

let serverProcess = null;
let mainWindow = null;
const SERVER_PORT = 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const MAX_SERVER_RETRIES = 30;
const SERVER_RETRY_DELAY = 100; // ms

/**
 * Performs a health check on the Express server
 * @returns {Promise<boolean>}
 */
async function isServerReady() {
  return new Promise((resolve) => {
    const req = http.get(`${SERVER_URL}/api/system/status`, (res) => {
      resolve(res.statusCode === 200);
      res.resume(); // Drain response
    });
    req.on("error", () => resolve(false));
    req.setTimeout(500);
  });
}

/**
 * Waits for the Express server to become ready
 * @returns {Promise<boolean>}
 */
async function waitForServer() {
  console.log("[DESKTOP HOST] Waiting for Express server to be ready...");
  for (let i = 0; i < MAX_SERVER_RETRIES; i++) {
    if (await isServerReady()) {
      console.log("[DESKTOP HOST] ✓ Express server is ready");
      return true;
    }
    await new Promise((r) => setTimeout(r, SERVER_RETRY_DELAY));
  }
  console.error("[DESKTOP HOST] ✗ Server failed to start within timeout");
  return false;
}

/**
 * Spawns the Express backend server as isolated process
 */
function spawnServer() {
  const serverPath = path.join(__dirname, "dist", "server.cjs");

  if (!require("fs").existsSync(serverPath)) {
    console.error(`[FATAL] Server executable not found at: ${serverPath}`);
    console.error("[FATAL] Did you run 'npm run build' before launching?");
    dialog.showErrorBox(
      "NetGuard Launch Error",
      `Server executable missing at: ${serverPath}\n\nPlease run 'npm run build' first.`
    );
    app.quit();
    return false;
  }

  console.log(`[DESKTOP HOST] Spawning backend server: ${serverPath}`);
  serverProcess = fork(serverPath, [], {
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(SERVER_PORT),
    },
  });

  // Log server output
  if (serverProcess.stdout) {
    serverProcess.stdout.on("data", (data) => {
      console.log(`[EXPRESS SERVER] ${data.toString().trim()}`);
    });
  }
  if (serverProcess.stderr) {
    serverProcess.stderr.on("data", (data) => {
      console.error(`[EXPRESS SERVER ERROR] ${data.toString().trim()}`);
    });
  }

  serverProcess.on("error", (err) => {
    console.error("[DESKTOP HOST] Server process error:", err);
  });

  serverProcess.on("exit", (code) => {
    console.log(`[DESKTOP HOST] Server process exited with code ${code}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("server-crashed", { code });
    }
  });

  return true;
}

/**
 * Creates the main Chromium BrowserWindow
 */
async function createWindow() {
  // Spawn server first
  if (!spawnServer()) {
    return;
  }

  // Wait for server to be ready
  const serverReady = await waitForServer();
  if (!serverReady) {
    dialog.showErrorBox(
      "NetGuard Startup Error",
      "Failed to start backend server. Check logs for details."
    );
    if (serverProcess) {
      serverProcess.kill();
    }
    app.quit();
    return;
  }

  // Create window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: "NetGuard Diagnostics & Security Control Dashboard",
    backgroundColor: "#0b0c0f",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "assets", "icon.png"), // Optional: add icon
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, "preload.cjs"), // Optional: add preload for IPC
      devTools: process.env.NODE_ENV !== "production",
    },
  });

  mainWindow.loadURL(SERVER_URL);

  if (process.env.NODE_ENV !== "production") {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  console.log("[DESKTOP HOST] ✓ Application window opened");
}

/**
 * Enforce single instance
 */
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  console.log("[DESKTOP HOST] Another instance is already running. Exiting.");
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on("ready", createWindow);
}

/**
 * Cleanup on exit
 */
app.on("window-all-closed", () => {
  if (serverProcess && !serverProcess.killed) {
    console.log("[DESKTOP HOST] Terminating backend server...");
    serverProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

/**
 * Handle app reactivation (macOS)
 */
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

/**
 * Graceful shutdown on SIGTERM
 */
process.on("SIGTERM", () => {
  console.log("[DESKTOP HOST] SIGTERM received, shutting down gracefully...");
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
  app.quit();
});
