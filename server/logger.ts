import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LOG_DIR =
  process.env.NETGUARD_LOG_DIR ||
  (process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "NetGuard", "logs")
    : path.join(os.homedir(), ".netguard", "logs"));
const LOG_FILE = path.join(LOG_DIR, "netguard.log");
const MAX_BYTES = 5 * 1024 * 1024;

type Level = "info" | "warn" | "error" | "crash";

function ensureDir(): void {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function rotateIfNeeded(): void {
  try {
    const stats = fs.statSync(LOG_FILE);
    if (stats.size < MAX_BYTES) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.renameSync(LOG_FILE, path.join(LOG_DIR, `netguard-${stamp}.log`));
  } catch {
    /* no log yet */
  }
}

function write(level: Level, event: string, details: Record<string, unknown> = {}): void {
  try {
    ensureDir();
    rotateIfNeeded();
    const record = {
      timestamp: new Date().toISOString(),
      level,
      event,
      details,
      pid: process.pid,
    };
    fs.appendFileSync(LOG_FILE, `${JSON.stringify(record)}\n`, "utf8");
  } catch {
    /* logging must never take down the app */
  }
}

export const logger = {
  info: (event: string, details?: Record<string, unknown>) => write("info", event, details),
  warn: (event: string, details?: Record<string, unknown>) => write("warn", event, details),
  error: (event: string, details?: Record<string, unknown>) => write("error", event, details),
  crash: (event: string, error: unknown, details: Record<string, unknown> = {}) => {
    const err = error instanceof Error ? error : new Error(String(error));
    write("crash", event, {
      ...details,
      message: err.message,
      name: err.name,
      stack: err.stack?.split("\n").slice(0, 20).join("\n"),
    });
  },
};

export function getLogPath(): string {
  return LOG_FILE;
}

export function getLogInfo(): { path: string; exists: boolean; sizeBytes: number; updatedAt: string | null } {
  try {
    const stats = fs.statSync(LOG_FILE);
    return {
      path: LOG_FILE,
      exists: true,
      sizeBytes: stats.size,
      updatedAt: stats.mtime.toISOString(),
    };
  } catch {
    return { path: LOG_FILE, exists: false, sizeBytes: 0, updatedAt: null };
  }
}

export function getRecentLogs(limit = 80): Array<Record<string, unknown>> {
  try {
    const lines = fs.readFileSync(LOG_FILE, "utf8").trim().split("\n").filter(Boolean);
    return lines.slice(-Math.min(Math.max(limit, 1), 300)).map(line => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return { raw: line };
      }
    });
  } catch {
    return [];
  }
}
