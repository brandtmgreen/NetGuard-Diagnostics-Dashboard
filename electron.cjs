// NetGuard Standalone Windows Window Controller (Electron Bootstrap)
// Suitable for direct retail bundling, enterprise white-labeling, or standalone EXE packaging.

const { app, BrowserWindow } = require("electron");
const path = require("path");
const { fork } = require("child_process");

let serverProcess = null;
let mainWindow = null;

function createWindow() {
  // 1. Spawns compiled Node/Express production backend server as isolated system thread
  // Resolves from dist/server.cjs (pre-bundled with all dependencies)
  const serverPath = path.join(__dirname, "dist", "server.cjs");
  
  console.log(`[DESKTOP HOST] Forking standalone background daemon: ${serverPath}`);
  serverProcess = fork(serverPath, [], {
    env: { 
      NODE_ENV: "production", 
      PORT: "3000"
    }
  });

  serverProcess.on("message", (msg) => {
    console.log(`[BACKGROUND SERVER] ${msg}`);
  });

  serverProcess.on("error", (err) => {
    console.error("[BACKGROUND SERVER FATAL]", err);
  });

  // 2. Open high-fidelity hardware-accelerated Chromium viewport
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    title: "NetGuard Diagnostics & Security Control Desk",
    backgroundColor: "#0b0c0f",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true // Kept active for technician diagnostic inspects
    }
  });

  // Wait 1.2s for Express ports to arm, then render viewport
  setTimeout(() => {
    mainWindow.loadURL("http://localhost:3000");
  }, 1200);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Limit instance execution concurrency
const additionalClientInstance = app.requestSingleInstanceLock();
if (!additionalClientInstance) {
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

app.on("window-all-closed", () => {
  // Gracefully terminate child threads upon console quit
  if (serverProcess) {
    console.log("[DESKTOP HOST] Terminating background server processes.");
    serverProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
