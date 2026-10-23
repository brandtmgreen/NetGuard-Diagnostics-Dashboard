// NetGuard Standalone Windows Window Controller (Electron Bootstrap)
// Suitable for direct retail bundling, enterprise white-labeling, or standalone EXE packaging.
const { app, BrowserWindow } = require("electron");
const path = require("path");
const { fork } = require("child_process");
const net = require("net");

let serverProcess = null;
let mainWindow = null;

// Dynamically find available port to avoid crashing if 3000 is taken
function getAvailablePort(startingAt = 3000) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startingAt, () => {
      server.once("close", () => resolve(startingAt));
      server.close();
    });
    server.on("error", () => resolve(getAvailablePort(startingAt + 1)));
  });
}

async function createWindow() {
  const dynamicPort = await getAvailablePort(3000);
  console.log(`[DESKTOP HOST] Selected dynamic port: ${dynamicPort}`);

  // 1. Spawns compiled Node/Express production backend server as isolated system thread
  const fs = require("fs");
  let serverPath = path.join(__dirname, "dist", "server.cjs");
  if (!fs.existsSync(serverPath)) {
    const candidatePaths = [
      path.join(process.resourcesPath, "app.asar.unpacked", "dist", "server.cjs"),
      path.join(process.resourcesPath, "dist", "server.cjs"),
      path.join(__dirname, "server.cjs"),
      path.join(process.cwd(), "dist", "server.cjs")
    ];
    for (const candidate of candidatePaths) {
      if (fs.existsSync(candidate)) {
        serverPath = candidate;
        break;
      }
    }
  }
  
  console.log(`[DESKTOP HOST] Forking standalone background daemon: ${serverPath}`);
  serverProcess = fork(serverPath, [], {
    env: { 
      ...process.env,
      NODE_ENV: "production", 
      PORT: dynamicPort.toString()
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

  // Wait 1.5s for Express ports to arm, then render viewport
  setTimeout(() => {
    mainWindow.loadURL(`http://localhost:${dynamicPort}`);
  }, 1500);

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
