// NetGuard Standalone Windows Window Controller (Electron Bootstrap)
// Starts the compiled Express server as a real Node child, waits for it to
// answer, then loads the dashboard. In a packaged app the server and static
// assets must live in app.asar.unpacked/dist because Node cannot fork a script
// from inside an asar archive.

const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { execFileSync, fork, spawn } = require("child_process");

const PORT = Number(process.env.NETGUARD_PORT || 3000);
const DASHBOARD_URL = `http://127.0.0.1:${PORT}/`;

let serverProcess = null;
let mainWindow = null;

function isAdministrator() {
  try {
    const output = execFileSync("whoami.exe", ["/groups"], {
      windowsHide: true,
      encoding: "utf8",
    });
    return /S-1-5-32-544/.test(output) && /Mandatory Label\\High/i.test(output);
  } catch {
    return false;
  }
}

function relaunchElevated() {
  if (process.argv.includes("--netguard-elevated")) return false;
  const executable = process.execPath.replace(/'/g, "''");
  try {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Start-Process -FilePath '${executable}' -ArgumentList '--netguard-elevated' -Verb RunAs`,
      ],
      { detached: true, stdio: "ignore", windowsHide: true }
    );
    child.unref();
    app.quit();
    return true;
  } catch (error) {
    console.error("[DESKTOP HOST] Elevation launch failed:", error);
    return false;
  }
}

function getServerPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app.asar.unpacked", "dist", "server.cjs");
  }
  return path.join(__dirname, "dist", "server.cjs");
}

function waitForServer(timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const attempt = () => {
      const req = http.get(DASHBOARD_URL, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
      });
      req.on("error", retry);
      req.setTimeout(1500, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started >= timeoutMs) {
        reject(new Error(`Dashboard did not respond within ${timeoutMs / 1000}s`));
        return;
      }
      setTimeout(attempt, 350);
    };
    attempt();
  });
}

function showStartupError(message) {
  const safeMessage = String(message || "Unknown startup error")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const serverPath = getServerPath().replace(/&/g, "&amp;").replace(/</g, "&lt;");
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(`<!doctype html><html><body style="margin:0;background:#0b0c0f;color:#a9b1d6;font-family:Segoe UI,Arial,sans-serif;padding:32px">
          <h1 style="color:#f7768e">NetGuard could not start</h1>
          <p>The local dashboard server did not come up.</p>
          <pre style="white-space:pre-wrap;background:#16161e;padding:16px;border:1px solid #24283b">${safeMessage}</pre>
          <p style="color:#565f89">Expected server: ${serverPath}</p>
          <p style="color:#565f89">Run <code>npm run build</code> and make sure <code>dist/server.cjs</code> exists.</p>
        </body></html>`)
    );
  } else {
    dialog.showErrorBox("NetGuard could not start", String(message || "Unknown startup error"));
  }
}

async function createWindow() {
  if (app.isPackaged && process.env.NETGUARD_NO_ELEVATE !== "1" && !isAdministrator()) {
    if (relaunchElevated()) return;
    dialog.showErrorBox(
      "NetGuard requires administrator access",
      "Restart NetGuard as administrator to enable packet capture and Windows Firewall enforcement."
    );
    app.quit();
    return;
  }

  const serverPath = getServerPath();

  if (!fs.existsSync(serverPath)) {
    showStartupError(`Missing server bundle: ${serverPath}`);
    return;
  }

  console.log(`[DESKTOP HOST] Starting background server: ${serverPath}`);
  serverProcess = fork(serverPath, [], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      // Required when the parent is Electron: run the child as plain Node.
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });

  serverProcess.stdout?.on("data", (chunk) => console.log(`[SERVER] ${chunk.toString().trim()}`));
  serverProcess.stderr?.on("data", (chunk) => console.error(`[SERVER] ${chunk.toString().trim()}`));
  serverProcess.on("error", (err) => console.error("[BACKGROUND SERVER FATAL]", err));
  serverProcess.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`[BACKGROUND SERVER] exited code=${code} signal=${signal}`);
    }
  });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    title: "NetGuard Diagnostics & Security Control Desk",
    backgroundColor: "#0b0c0f",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  try {
    await waitForServer();
    await mainWindow.loadURL(DASHBOARD_URL);
  } catch (err) {
    console.error("[DESKTOP HOST] Startup failed:", err);
    showStartupError(err instanceof Error ? err.message : String(err));
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow).catch((err) => {
    console.error("[DESKTOP HOST] Unhandled startup error:", err);
    showStartupError(err instanceof Error ? err.message : String(err));
  });
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    console.log("[DESKTOP HOST] Terminating background server.");
    serverProcess.kill();
    serverProcess = null;
  }
}

app.on("before-quit", stopServer);
app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
