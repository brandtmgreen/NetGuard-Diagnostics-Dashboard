import express, { NextFunction, Request, Response, Router } from "express";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import os from "node:os";
import { AiService } from "./ai.js";
import { CaptureService } from "./capture.js";
import { DetectionEngine } from "./detection.js";
import { findNmap, runNmap } from "./nmap.js";
import { PreventionService } from "./prevention.js";
import { Store } from "./store.js";
import { Telemetry } from "./telemetry.js";
import { Settings, WindowsEventInfo } from "./types.js";
import { isValidIpOrHostname, nowIso, sanitizeText } from "./util.js";
import { getLogInfo, getRecentLogs, logger } from "./logger.js";

export interface ApiContext {
  store: Store;
  telemetry: Telemetry;
  capture: CaptureService;
  detector: DetectionEngine;
  prevention: PreventionService;
  ai: AiService;
  events: () => WindowsEventInfo[];
}

const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:3000",
  "http://localhost:3000",
]);

function isLoopback(req: Request): boolean {
  const address = req.socket.remoteAddress || "";
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function requireLocal(req: Request, res: Response, next: NextFunction): void {
  if (!isLoopback(req)) {
    res.status(403).json({ error: "This control plane is bound to localhost only." });
    return;
  }
  const expectedToken = process.env.NETGUARD_API_TOKEN;
  const suppliedToken = req.header("x-netguard-token") || String(req.query.token || "");
  if (expectedToken && req.path !== "/health" && suppliedToken !== expectedToken) {
    res.status(401).json({ error: "Invalid local API token." });
    return;
  }
  next();
}

function requireMutation(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD") {
    next();
    return;
  }
  if ((req.method === "POST" || req.method === "PUT" || req.method === "PATCH") && !req.is("application/json")) {
    res.status(415).json({ error: "Content-Type must be application/json." });
    return;
  }
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    res.status(403).json({ error: "Untrusted origin." });
    return;
  }
  next();
}

function rateLimit() {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((time) => now - time < 60_000);
    recent.push(now);
    hits.set(key, recent);
    if (recent.length > 600) {
      res.status(429).json({ error: "Too many requests. Slow down." });
      return;
    }
    next();
  };
}

function numberInRange(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function sanitizeSettings(input: Record<string, unknown>): Partial<Settings> {
  const patch: Partial<Settings> = {};
  if (typeof input.captureInterface === "string") patch.captureInterface = input.captureInterface.slice(0, 300);
  if (typeof input.captureFilter === "string") patch.captureFilter = input.captureFilter.slice(0, 240);
  if (input.preventionMode === "monitor" || input.preventionMode === "prevent") {
    patch.preventionMode = input.preventionMode;
  }
  if (typeof input.autoBlock === "boolean") patch.autoBlock = input.autoBlock;
  if (input.blockDurationMinutes !== undefined) {
    patch.blockDurationMinutes = numberInRange(input.blockDurationMinutes, 1, 1440, 15);
  }
  if (typeof input.allowPublicScan === "boolean") patch.allowPublicScan = input.allowPublicScan;
  if (typeof input.geminiModel === "string") patch.geminiModel = input.geminiModel.slice(0, 100);
  if (Array.isArray(input.allowedRemoteIps)) {
    patch.allowedRemoteIps = input.allowedRemoteIps
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 100);
  }
  return patch;
}

async function runTerminal(command: string): Promise<string> {
  const trimmed = command.trim();
  const [verb, ...args] = trimmed.split(/\s+/);
  if (!verb) return "";
  const target = args[0] || "";
  const requireTarget = (): string => {
    if (!isValidIpOrHostname(target)) throw new Error("Invalid target.");
    return target;
  };

  let file = "";
  let argv: string[] = [];
  switch (verb.toLowerCase()) {
    case "help":
      return [
        "NetGuard terminal — read-only diagnostic commands only.",
        "  ping <ip_or_host>       ICMP reachability test (4 probes)",
        "  tracert <ip_or_host>    Route trace (8 hops, no name lookup)",
        "  netstat                 Active TCP connections with process IDs",
        "  ipconfig                Full adapter configuration",
        "  nslookup <ip_or_host>   DNS resolution",
        "  arp                     Neighbor cache",
        "Use the Capture screen for live packet analysis; use Detections for real alerts.",
      ].join("\n");
    case "ping":
      file = "ping.exe";
      argv = ["-n", "4", requireTarget()];
      break;
    case "tracert":
      file = "tracert.exe";
      argv = ["-d", "-h", "8", requireTarget()];
      break;
    case "netstat":
      file = "netstat.exe";
      argv = ["-ano"];
      break;
    case "ipconfig":
      file = "ipconfig.exe";
      argv = ["/all"];
      break;
    case "nslookup":
      file = "nslookup.exe";
      argv = [requireTarget()];
      break;
    case "arp":
      file = "arp.exe";
      argv = ["-a"];
      break;
    default:
      throw new Error("Command not allowed. Type 'help' for the read-only command list.");
  }

  return new Promise<string>((resolve, reject) => {
    const child = spawn(file, argv, { windowsHide: true });
    let output = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Command timed out after 15 seconds."));
    }, 15000);
    child.stdout.on("data", (chunk) => (output += chunk.toString()));
    child.stderr.on("data", (chunk) => (output += chunk.toString()));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", () => {
      clearTimeout(timeout);
      resolve(sanitizeText(output, 30000));
    });
  });
}

function scoreFor(alerts: ReturnType<Store["getAlerts"]>, hostAdmin: boolean, captureRunning: boolean): number {
  const open = alerts.filter((alert) => alert.status === "open");
  const critical = open.filter((alert) => alert.severity === "critical").length;
  const high = open.filter((alert) => alert.severity === "high").length;
  const penalty = Math.min(70, critical * 12 + high * 6 + Math.max(0, open.length - critical - high) * 2);
  return Math.max(0, 100 - penalty - (hostAdmin ? 0 : 10) - (captureRunning ? 0 : 5));
}

export function createApi(context: ApiContext): Router {
  const router = Router();
  const { store, telemetry, capture, detector, prevention, ai } = context;

  router.use(requireLocal, rateLimit(), requireMutation);

  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      version: "1.0.5",
      admin: telemetry.getHost().isAdmin,
      capture: capture.getStatus(),
      nmap: Boolean(findNmap()),
      tshark: Boolean(capture.getStatus().tsharkPath),
      ai: ai.getStatus(),
      timestamp: nowIso(),
    });
  });

  router.get("/diagnostics", (_req, res) => {
    const memory = process.memoryUsage();
    res.json({
      version: "1.0.5",
      uptimeSeconds: Math.round(process.uptime()),
      node: process.version,
      platform: `${os.platform()} ${os.release()}`,
      arch: process.arch,
      pid: process.pid,
      memory: {
        rssMb: Math.round(memory.rss / 1048576),
        heapUsedMb: Math.round(memory.heapUsed / 1048576),
      },
      log: getLogInfo(),
      recent: getRecentLogs(80),
      admin: telemetry.getHost().isAdmin,
      capture: capture.getStatus(),
    });
  });

  router.get("/state", async (_req, res, next) => {
    try {
      const alerts = store.getAlerts();
      const host = telemetry.getHost();
      const captureStatus = capture.getStatus();
      res.json({
        host,
        interfaces: telemetry.getInterfaces(),
        neighbors: telemetry.getNeighbors(),
        connections: telemetry.getConnections(),
        alerts,
        firewallRules: prevention.getCachedRules(),
        capture: captureStatus,
        settings: store.getSettings(),
        securityScore: scoreFor(alerts, host.isAdmin, captureStatus.running),
        nmapAvailable: Boolean(findNmap()),
        tsharkAvailable: Boolean(captureStatus.tsharkPath),
        ai: ai.getStatus(),
        events: context.events(),
        generatedAt: nowIso(),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/alerts", (_req, res) => res.json(store.getAlerts()));

  router.get("/settings", (_req, res) => res.json(store.getSettings()));

  router.put("/settings", (req, res) => {
    const patch = sanitizeSettings(req.body || {});
    if (patch.preventionMode === "prevent" && patch.autoBlock && !telemetry.getHost().isAdmin) {
      return res.status(403).json({ error: "Administrator privileges are required for automatic prevention." });
    }
    const settings = store.updateSettings(patch);
    ai.setModel(settings.geminiModel);
    store.audit("settings.update", patch as Record<string, unknown>);
    return res.json(settings);
  });

  router.post("/alerts/:id/ack", (req, res) => {
    const updated = store.updateAlert(req.params.id, { status: "acknowledged" });
    if (!updated) return res.status(404).json({ error: "Alert not found." });
    store.audit("alert.acknowledge", { id: req.params.id });
    return res.json(updated);
  });

  router.post("/alerts/:id/ignore", (req, res) => {
    const updated = store.updateAlert(req.params.id, { status: "ignored" });
    if (!updated) return res.status(404).json({ error: "Alert not found." });
    store.audit("alert.ignore", { id: req.params.id });
    return res.json(updated);
  });

  router.get("/firewall/rules", async (_req, res, next) => {
    try {
      res.json(await prevention.listRules());
    } catch (error) {
      next(error);
    }
  });

  router.post("/firewall/block", async (req, res, next) => {
    try {
      if (req.body?.confirm !== true) {
        return res.status(400).json({ error: "Blocking requires confirm: true." });
      }
      const ip = String(req.body?.ip || "").trim();
      const direction = req.body?.direction === "Inbound" || req.body?.direction === "Outbound"
        ? req.body.direction
        : "Both";
      if (!isValidIpOrHostname(ip)) return res.status(400).json({ error: "Invalid IP address." });
      const duration = numberInRange(req.body?.durationMinutes, 1, 1440, store.getSettings().blockDurationMinutes);
      const result = await prevention.block(ip, direction, duration);
      void prevention.listRules().catch(() => undefined);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/firewall/rules/:name", async (req, res, next) => {
    try {
      await prevention.unblock(decodeURIComponent(req.params.name));
      void prevention.listRules().catch(() => undefined);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/capture/interfaces", async (_req, res, next) => {
    try {
      res.json(await capture.listInterfaces());
    } catch (error) {
      next(error);
    }
  });

  router.post("/capture/start", (req, res) => {
    try {
      const interfacePath = String(req.body?.interface || "").trim();
      const filter = String(req.body?.filter || store.getSettings().captureFilter || "").trim();
      const status = capture.start(interfacePath, filter);
      store.updateSettings({ captureInterface: interfacePath, captureFilter: filter });
      store.audit("capture.start", { interfacePath, filter });
      res.json(status);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post("/capture/stop", (_req, res) => {
    const status = capture.stop();
    store.audit("capture.stop", {});
    res.json(status);
  });

  router.get("/capture/packets", (req, res) => {
    const limit = numberInRange(req.query.limit, 1, 1000, 300);
    res.json({ packets: capture.getPackets(limit), status: capture.getStatus() });
  });

  router.post("/scan", async (req, res, next) => {
    try {
      const target = String(req.body?.target || "").trim();
      const profile = String(req.body?.profile || "quick");
      if (!isValidIpOrHostname(target)) return res.status(400).json({ error: "Invalid target." });
      const result = await runNmap(target, profile, store.getSettings().allowPublicScan);
      store.audit("nmap.scan", { target, profile, status: result.status, ports: result.ports.length });
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/terminal", async (req, res, next) => {
    try {
      const command = sanitizeText(req.body?.command, 500);
      const output = await runTerminal(command);
      store.audit("terminal.command", { command: command.split(/\s+/)[0] || "" });
      res.json({ output });
    } catch (error) {
      next(error);
    }
  });

  router.post("/ai/analyze", async (req, res, next) => {
    try {
      const prompt = sanitizeText(req.body?.prompt, 4000);
      const state = {
        host: telemetry.getHost(),
        alerts: store.getAlerts().slice(0, 20),
        connections: telemetry.getConnections().slice(0, 100),
        firewallRules: await prevention.listRules(),
        capture: capture.getStatus(),
      };
      const text = await ai.analyze(prompt, JSON.stringify(state));
      res.json({ text, model: ai.getStatus().model });
    } catch (error) {
      next(error);
    }
  });

  router.get("/reports", (_req, res) => res.json(store.getReports()));

  router.post("/reports/generate", async (_req, res, next) => {
    try {
      const alerts = store.getAlerts().filter((alert) => alert.status !== "ignored");
      const host = telemetry.getHost();
      const severity = alerts.some((alert) => alert.severity === "critical")
        ? "critical"
        : alerts.some((alert) => alert.severity === "high")
          ? "high"
          : alerts.some((alert) => alert.severity === "medium")
            ? "medium"
            : "info";
      const report = {
        id: randomUUID(),
        createdAt: nowIso(),
        title: `NetGuard incident report — ${new Date().toLocaleString()}`,
        severity: severity as "info" | "low" | "medium" | "high" | "critical",
        summary: alerts.length
          ? `${alerts.length} detection event(s) are in the local audit history. ${alerts.filter((alert) => alert.status === "blocked").length} were blocked by NetGuard.`
          : "No detection events are currently recorded.",
        alerts,
        host,
        recommendations: alerts.slice(0, 10).map((alert) => `${alert.message} — verify the endpoint and keep prevention in monitor mode until the rule is validated.`),
      };
      store.addReport(report);
      store.audit("report.generate", { id: report.id, alerts: alerts.length });
      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function apiErrorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  const message = error instanceof Error ? error.message : String(error);
  const status = /admin|privilege/i.test(message)
    ? 403
    : /not found/i.test(message)
      ? 404
    : /invalid|required|refusing|disabled|not allowed/i.test(message)
        ? 400
        : 500;
  logger.error("api.error", {
    method: req.method,
    path: req.path,
    status,
    message: message.slice(0, 500),
  });
  res.status(status).json({ error: sanitizeText(message, 1000) });
}
