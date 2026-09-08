// Preload script for secure IPC between frontend and Electron backend
// Exposes only safe APIs to the renderer process (frontend)

const { contextBridge, ipcMain } = require("electron");

// Expose limited IPC API to frontend
contextBridge.exposeInMainWorld("electronAPI", {
  // Listen for server crash events
  onServerCrashed: (callback) => {
    const channel = "server-crashed";
    ipcMain.on(channel, (event, data) => callback(data));
    return () => ipcMain.removeAllListeners(channel);
  },

  // Get app version
  getAppVersion: () => require("../package.json").version,

  // Platform info
  getPlatform: () => process.platform,
});

console.log("[PRELOAD] Security context initialized");
