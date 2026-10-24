import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Alert, AuditEvent, Report, Settings } from "./types.js";
import { nowIso } from "./util.js";

const DATA_DIR =
  process.env.NETGUARD_DATA_DIR ||
  (process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "NetGuard", "data")
    : path.join(os.homedir(), ".netguard"));

const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const ALERTS_FILE = path.join(DATA_DIR, "alerts.json");
const REPORTS_FILE = path.join(DATA_DIR, "reports.json");
const AUDIT_FILE = path.join(DATA_DIR, "audit.log");

export const DEFAULT_SETTINGS: Settings = {
  captureInterface: "",
  captureFilter: "not port 3000",
  preventionMode: "monitor",
  autoBlock: false,
  blockDurationMinutes: 15,
  allowPublicScan: false,
  geminiModel: "gemini-2.5-flash",
  allowedRemoteIps: [],
};

function ensureDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown): void {
  ensureDir();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

export class Store {
  private settings: Settings;
  private alerts: Alert[];
  private reports: Report[];

  constructor() {
    ensureDir();
    this.settings = { ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>(SETTINGS_FILE, {}) };
    this.alerts = readJson<Alert[]>(ALERTS_FILE, []).slice(0, 500);
    this.reports = readJson<Report[]>(REPORTS_FILE, []).slice(0, 100);
  }

  getSettings(): Settings {
    return { ...this.settings, allowedRemoteIps: [...this.settings.allowedRemoteIps] };
  }

  updateSettings(patch: Partial<Settings>): Settings {
    this.settings = {
      ...this.settings,
      ...patch,
      allowedRemoteIps: Array.isArray(patch.allowedRemoteIps)
        ? patch.allowedRemoteIps.filter((ip) => typeof ip === "string").slice(0, 100)
        : this.settings.allowedRemoteIps,
    };
    writeJson(SETTINGS_FILE, this.settings);
    return this.getSettings();
  }

  getAlerts(): Alert[] {
    return this.alerts.map((alert) => ({ ...alert }));
  }

  replaceAlerts(alerts: Alert[]): void {
    this.alerts = alerts.slice(0, 500);
    writeJson(ALERTS_FILE, this.alerts);
  }

  addAlert(alert: Alert): void {
    this.alerts = [alert, ...this.alerts].slice(0, 500);
    writeJson(ALERTS_FILE, this.alerts);
  }

  updateAlert(id: string, patch: Partial<Alert>): Alert | null {
    const index = this.alerts.findIndex((alert) => alert.id === id);
    if (index === -1) return null;
    this.alerts[index] = { ...this.alerts[index], ...patch };
    writeJson(ALERTS_FILE, this.alerts);
    return { ...this.alerts[index] };
  }

  getReports(): Report[] {
    return this.reports.map((report) => ({ ...report }));
  }

  addReport(report: Report): void {
    this.reports = [report, ...this.reports].slice(0, 100);
    writeJson(REPORTS_FILE, this.reports);
  }

  audit(action: string, details: Record<string, unknown> = {}, actor = "local-user"): void {
    const event: AuditEvent = {
      timestamp: nowIso(),
      actor,
      action,
      details,
    };
    ensureDir();
    fs.appendFileSync(AUDIT_FILE, `${JSON.stringify(event)}\n`, "utf8");
  }

  getAuditPath(): string {
    return AUDIT_FILE;
  }
}
