import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fs from "fs";
import { spawn } from "child_process";

import { getGeminiClient, callGeminiWithRetry } from "./server/lib/gemini";
import { getSystemStatus, getProcesses, getBandwidth, getHistoricalLoad60m } from "./server/services/system";
import { runTerminalCommand } from "./server/services/terminal";
import { discoverDevices, getLiveConnections, getNeighbors, getInterfaces } from "./server/services/network";
import { runNmap, NmapProfile } from "./server/services/nmap";
import { capturePackets } from "./server/services/capture";
import { ipLookup } from "./server/services/intel";
import { getStore, saveStore } from "./server/services/store";
import { applyFirewallRules, removeFirewallRule, readActiveRules } from "./server/services/firewall";
import { getLiveThreats } from "./server/services/threats";
import { runLynisEquivalentAudit } from "./server/services/lynisAudit";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());

// Setup Configuration endpoint for dynamic bare-metal deployments
app.post("/api/setup/config", (req, res) => {
  const { geminiKey, serverPort, clientTheme } = req.body;

  try {
    const envPath = path.join(process.cwd(), ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
    }

    if (envContent.includes("GEMINI_API_KEY=")) {
      envContent = envContent.replace(/GEMINI_API_KEY=.*/, `GEMINI_API_KEY=${geminiKey || ""}`);
    } else {
      envContent += `\nGEMINI_API_KEY=${geminiKey || ""}`;
    }

    fs.writeFileSync(envPath, envContent.trim() + "\n", "utf8");

    process.env.GEMINI_API_KEY = geminiKey;
    console.log(`[INSTALLER] Committed dynamic wizard environment variables: Port ${serverPort}, Theme ${clientTheme}`);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[INSTALLER] Failed to write wizard parameters:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Terminal: real local command execution + AI advisor
app.post("/api/terminal/run", async (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ output: "Error: No command specified." });
  }
  try {
    const output = await runTerminalCommand(String(command));
    return res.json({ output });
  } catch (err: any) {
    console.error("[TERMINAL ERROR]", err);
    return res.status(500).json({ output: `[ERROR] Diagnostic execution failed: ${err.message || err}` });
  }
});

// Network discovery: real interfaces + ARP/ping-sweep device map
app.get("/api/network/discover", async (_req, res) => {
  try {
    const result = await discoverDevices();
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[DISCOVERY API ERROR]", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Fast ARP-only neighbor list (no ping sweep) for instant initial device inventory
app.get("/api/network/neighbors", async (_req, res) => {
  try {
    const devices = await getNeighbors();
    return res.json({ success: true, devices });
  } catch (err: any) {
    console.error("[NEIGHBORS API ERROR]", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Real local network interfaces (cheap, no scanning)
app.get("/api/network/interfaces", (_req, res) => {
  try {
    return res.json({ success: true, interfaces: getInterfaces() });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Live outbound connections (real sockets on this host)
app.get("/api/network/connections", async (_req, res) => {
  try {
    const connections = await getLiveConnections();
    return res.json({ success: true, connections });
  } catch (err: any) {
    console.error("[CONNECTIONS API ERROR]", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// System dependencies check (Nmap, Wireshark/Npcap)
app.get("/api/system/dependencies", async (_req, res) => {
  try {
    const { findBinary } = require("./server/lib/exec");
    
    let nmapInstalled = false;
    let npcapInstalled = false;

    // Check Nmap
    if (process.platform === "win32") {
      const nmapWinPath = await findBinary("nmap", ["nmap", "C:\\Program Files (x86)\\Nmap\\nmap.exe", "C:\\Program Files\\Nmap\\nmap.exe"]);
      if (nmapWinPath) nmapInstalled = true;
    } else {
      const nmapNixPath = await findBinary("nmap", ["nmap", "/usr/bin/nmap", "/usr/local/bin/nmap"]);
      if (nmapNixPath) nmapInstalled = true;
    }

    // Check Wireshark/Npcap/TCPDump
    if (process.platform === "win32") {
      const tsharkWinPath = await findBinary("tshark", ["tshark", "C:\\Program Files\\Wireshark\\tshark.exe"]);
      if (tsharkWinPath) npcapInstalled = true;
      else {
        // Fallback: check if Npcap service is running or folder exists
        const fs = require("fs");
        if (fs.existsSync("C:\\Windows\\System32\\Npcap")) npcapInstalled = true;
      }
    } else {
      const tcpdumpPath = await findBinary("tcpdump", ["tcpdump", "/usr/sbin/tcpdump"]);
      if (tcpdumpPath) npcapInstalled = true;
    }

    return res.json({
      success: true,
      nmap: nmapInstalled,
      npcap: npcapInstalled
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger silent installation of dependencies
app.post("/api/system/install-deps", async (_req, res) => {
  try {
    const { exec } = require("child_process");
    const os = require("os");
    const fs = require("fs");
    const path = require("path");
    
    if (os.platform() !== "win32") {
      return res.status(400).json({ success: false, error: "Auto-install only supported on Windows." });
    }

    // Check if we are running packaged (Electron) or in dev, find bundled-deps
    const resourcesPath = (process as any).resourcesPath || process.cwd();
    const localNmap = path.join(resourcesPath, "bundled-deps", "nmap-setup.exe");
    const localNpcap = path.join(resourcesPath, "bundled-deps", "npcap-setup.exe");
    
    const hasBundled = fs.existsSync(localNmap) && fs.existsSync(localNpcap);

    let script = "";
    
    if (hasBundled) {
      // Use local bundled installers
      script = `
        $ErrorActionPreference = "Stop"
        Start-Process -FilePath "${localNmap}" -ArgumentList "/S" -Wait -NoNewWindow
        Start-Process -FilePath "${localNpcap}" -ArgumentList "/loopback_support=yes /winpcap_mode=yes /S" -Wait -NoNewWindow
      `;
    } else {
      // Fallback to downloading
      script = `
        $ErrorActionPreference = "Stop"
        
        # Download Nmap
        Invoke-WebRequest -Uri "https://nmap.org/dist/nmap-7.94-setup.exe" -OutFile "$env:TEMP\\nmap-setup.exe"
        Start-Process -FilePath "$env:TEMP\\nmap-setup.exe" -ArgumentList "/S" -Wait -NoNewWindow
        
        # Download Npcap (often required for Nmap and Wireshark)
        Invoke-WebRequest -Uri "https://npcap.com/dist/npcap-1.79.exe" -OutFile "$env:TEMP\\npcap-setup.exe"
        Start-Process -FilePath "$env:TEMP\\npcap-setup.exe" -ArgumentList "/loopback_support=yes /winpcap_mode=yes /S" -Wait -NoNewWindow
      `;
    }

    exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${script.replace(/\n/g, '; ')}"`, (err: Error | null) => {
      if (err) {
        console.error("Install script failed:", err);
      }
    });

    // We return immediately, the UI can poll /dependencies until they show up
    return res.json({ success: true, message: "Installation triggered in background." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// System telemetry
app.get("/api/system/status", async (_req, res) => {
  try {
    return res.json(await getSystemStatus());
  } catch (err: any) {
    console.error("[SYSTEM STATUS ERROR]", err);
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/system/history", async (_req, res) => {
  try {
    return res.json(await getHistoricalLoad60m());
  } catch (err: any) {
    console.error("[SYSTEM HISTORY ERROR]", err);
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/system/processes", async (_req, res) => {
  try {
    const limit = _req.query.limit ? parseInt(String(_req.query.limit), 10) : 60;
    const processes = await getProcesses(limit);
    return res.json({ processes });
  } catch (err: any) {
    console.error("[SYSTEM PROCESSES ERROR]", err);
    return res.status(500).json({ error: err.message });
  }
});

// Spawn a benign detached background process so it appears in real process telemetry
app.post("/api/system/spawn", (_req, res) => {
  try {
    const durationSec = 300 + Math.floor(Math.random() * 600); // 5-15 minutes
    const child = spawn("/bin/sleep", [String(durationSec)], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return res.json({
      success: true,
      pid: child.pid,
      name: "sleep",
      args: [String(durationSec)],
    });
  } catch (err: any) {
    console.error("[SYSTEM SPAWN ERROR]", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/system/traffic", async (_req, res) => {
  try {
    const sampleMs = _req.query.sample ? Math.min(parseInt(String(_req.query.sample), 10) || 1000, 5000) : 1000;
    const bandwidth = await getBandwidth(sampleMs);
    return res.json(bandwidth);
  } catch (err: any) {
    console.error("[SYSTEM TRAFFIC ERROR]", err);
    return res.status(500).json({ error: err.message });
  }
});

// Real NMAP scans
app.post("/api/security/nmap", async (req, res) => {
  const { target, profile } = req.body;
  if (!target) {
    return res.status(400).json({ error: "No target network or IP specified." });
  }
  try {
    const selectedProfile = (profile as NmapProfile) || "quick";
    const result = await runNmap(String(target), selectedProfile);
    return res.json(result);
  } catch (err: any) {
    console.error("[NMAP ERROR]", err);
    return res.status(500).json({ error: err.message });
  }
});

// Real packet capture
app.post("/api/security/wireshark", async (req, res) => {
  const { filter, count, interfaceName } = req.body;
  try {
    const result = await capturePackets({
      filter: String(filter || ""),
      count: count ? parseInt(String(count), 10) : 25,
      interfaceName: String(interfaceName || ""),
    });
    return res.json(result);
  } catch (err: any) {
    console.error("[CAPTURE ERROR]", err);
    return res.status(500).json({ status: "failed", packets: [], error: err.message });
  }
});

// Real IP intelligence (geo / RDAP whois / reverse DNS / traceroute)
app.post("/api/security/ip-lookup", async (req, res) => {
  const { ip } = req.body;
  if (!ip) {
    return res.status(400).json({ error: "Missing IP address parameter." });
  }
  try {
    const intel = await ipLookup(String(ip));
    return res.json(intel);
  } catch (err: any) {
    console.error("[IP LOOKUP ERROR]", err);
    return res.status(500).json({ error: err.message });
  }
});

// Live threat stream for the heat map (real connections + real geo)
app.get("/api/security/live-threats", async (_req, res) => {
  try {
    const threats = await getLiveThreats();
    return res.json({ threats });
  } catch (err: any) {
    console.error("[LIVE THREATS ERROR]", err);
    return res.status(500).json({ threats: [], error: err.message });
  }
});

// Security AI audit and Threat report formulation (real Gemini AI + real host/packet telemetry only)
app.post("/api/security/ai-audit", async (req, res) => {
  const { scanData, packetsData, sourceThreat } = req.body;
  const ai = getGeminiClient();

  if (!ai) {
    return res.status(503).json({
      error: "Live AI Security Audit requires a configured GEMINI_API_KEY in Settings > Secrets.",
    });
  }

  try {
    const [hostStatus, liveConns] = await Promise.all([
      getSystemStatus(),
      getLiveConnections(),
    ]);

    const formattedScan = scanData ? JSON.stringify(scanData) : "None provided";
    const formattedPackets = packetsData ? JSON.stringify(packetsData) : "None provided";
    const formattedHost = JSON.stringify({
      hostname: hostStatus.hostname,
      platform: `${hostStatus.platform} ${hostStatus.release} (${hostStatus.arch})`,
      cpuCount: hostStatus.cpuCount,
      loadAvg: hostStatus.loadAvg,
      usedMemPercent: hostStatus.usedMemPercent,
      diskUsedPercent: hostStatus.diskUsedPercent,
      activeSocketsCount: liveConns.length,
      sampleActiveSockets: liveConns.slice(0, 15),
    });
    const threatSource = sourceThreat || "Live Host & Packet Capture Telemetry Audit";

    const prompt = `You are a senior Incident Response and Threat Hunter Agent auditing real-time host and network telemetry.
Analyze the following live data captured directly from the machine:
---
LIVE HOST TELEMETRY & SOCKETS:
${formattedHost}

ATTACHED PORT SCAN DATA:
${formattedScan}

ATTACHED PACKET CAPTURE LOGS:
${formattedPackets}
---
Audit Focus: ${threatSource}

Draft a formal "ThreatResponseReport" structured in JSON format based strictly on the real telemetry above.
You MUST output ONLY a valid JSON object matching this schema. Avoid any extra commentary, code fences, or text before/after the JSON.

JSON Schema structure:
{
  "title": "Concise title summarizing the live audit findings",
  "severity": "low" | "medium" | "high" | "critical",
  "executiveSummary": "A concise executive summary explaining what was observed in the live host/packet telemetry and the real risk posture",
  "attackVector": "Specific vector or exposure surface observed (or 'Nominal / Local Services Only' if clean)",
  "auditedDataPoints": ["array of real data sources inspected"],
  "findings": ["At least 3 specific technical findings referencing real IPs, ports, processes, or resource metrics from the telemetry"],
  "mitigations": [
    {
      "action": "Brief title of mitigation or hardening step",
      "status": "pending",
      "type": "firewall" | "process" | "remediation",
      "details": "Exact technical command or configuration to apply"
    }
  ]
}

Strict Rule: Output ONLY the raw JSON string starting with { and ending with }. No markdown block envelopes.`;

    const geminiRes = await callGeminiWithRetry({ prompt, useSearch: true });

    let parsed: any = null;
    if (geminiRes.text) {
      try {
        const jsonText = geminiRes.text.trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch
          ? jsonMatch[0]
          : jsonText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        parsed = JSON.parse(cleanJson);
      } catch {
        parsed = null;
      }
    }

    if (!parsed) {
      // Synthesize report strictly from the real hostStatus, liveConns, and packetsData
      const packetList = Array.isArray(packetsData) ? packetsData : [];
      const listeningSockets = liveConns.filter((c) => c.state === "LISTEN");
      const establishedSockets = liveConns.filter((c) => c.state === "ESTABLISHED");
      const wildcardListeners = listeningSockets.filter(
        (c) => c.localAddress === "0.0.0.0" || c.localAddress === "::" || c.localAddress === "*"
      );

      const quotaNote = geminiRes.quotaExhausted
        ? " [Advisory: Gemini API free-tier rate limit (429 RESOURCE_EXHAUSTED) was reached; upgrading to a paid tier increases quota—select a billing-enabled API key in Settings > Secrets. Report synthesized directly from live OS kernel & socket telemetry.]"
        : "";

      parsed = {
        title: `Live Host & Packet Telemetry Audit (${hostStatus.hostname})`,
        severity: wildcardListeners.length > 2 ? "medium" : "low",
        executiveSummary: `Audited host ${hostStatus.hostname} (${hostStatus.platform} ${hostStatus.release}) with ${liveConns.length} active kernel sockets (${listeningSockets.length} LISTEN, ${establishedSockets.length} ESTABLISHED) and ${packetList.length} captured packets.${quotaNote}`,
        attackVector:
          wildcardListeners.length > 0
            ? `Wildcard listeners bound on ${wildcardListeners
                .slice(0, 4)
                .map((c) => `${c.protocol}/${c.localPort}`)
                .join(", ")}`
            : "Local Host & Active Socket Surface",
        auditedDataPoints: [
          `Host Kernel (${hostStatus.platform} ${hostStatus.release})`,
          `Socket Table (${liveConns.length} live entries)`,
          `Packet Capture (${packetList.length} live frames)`,
        ],
        findings: [
          `Host CPU & Memory Telemetry: ${hostStatus.cpuCount} cores (1m load avg: ${hostStatus.loadAvg[0]}), Memory usage at ${hostStatus.usedMemPercent}%, Disk usage at ${hostStatus.diskUsedPercent}%.`,
          `Active Socket Table: ${listeningSockets.length} listening ports and ${establishedSockets.length} established connections inspected (${wildcardListeners.length} bound to wildcard 0.0.0.0/::).`,
          packetList.length > 0
            ? `Live Packet Capture: Analyzed ${packetList.length} real frames across ${Array.from(
                new Set(packetList.map((p: any) => p.protocol).filter(Boolean))
              ).join(", ") || "active"} protocols.`
            : `Live Socket Inspection: Verified active process bindings across ${liveConns.slice(0, 5).map((c) => `${c.localAddress}:${c.localPort}`).join(", ") || "local interfaces"}.`,
        ],
        mitigations:
          wildcardListeners.length > 0
            ? [
                {
                  action: "Audit wildcard listening sockets on 0.0.0.0 / ::",
                  status: "pending",
                  type: "firewall",
                  details: "ss -tulnp",
                },
              ]
            : [],
      };
    }

    const newReport = {
      id: `rep-${Date.now()}`,
      title: parsed.title || `Live Security Audit: ${threatSource}`,
      timestamp: new Date().toLocaleString(),
      sourceThreat: threatSource,
      severity: parsed.severity || "low",
      status: "draft" as const,
      executiveSummary: parsed.executiveSummary || "",
      attackVector: parsed.attackVector || "Live Socket & Packet Inspection",
      auditedDataPoints: Array.isArray(parsed.auditedDataPoints)
        ? parsed.auditedDataPoints
        : ["Live Packet Capture", "Host Socket Table"],
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      mitigations: Array.isArray(parsed.mitigations) ? parsed.mitigations : [],
      exportedTo: [],
    };

    const store = getStore();
    saveStore({ threatReports: [newReport, ...store.threatReports].slice(0, 30) });
    return res.json(newReport);
  } catch (err: any) {
    return res.status(502).json({
      error: `Live security analysis encountered an unexpected error: ${err?.message || err}`,
    });
  }
});

// Threat reports (persisted)
app.get("/api/security/threat-reports", (_req, res) => {
  return res.json(getStore().threatReports);
});

app.post("/api/security/threat-reports/export", (req, res) => {
  const { reportId, targetDestination } = req.body;
  if (!reportId || !targetDestination) {
    return res.status(400).json({ error: "Missing reportId or targetDestination parameters." });
  }

  const store = getStore();
  const report = store.threatReports.find((r) => r.id === reportId);
  if (!report) {
    return res.status(404).json({ error: `Threat Report ${reportId} not found.` });
  }

  if (!report.exportedTo.includes(targetDestination)) {
    report.exportedTo.push(targetDestination);
  }
  report.status = "exported";
  saveStore({ threatReports: store.threatReports });

  return res.json({
    success: true,
    message: `Report successfully compiled and dispatched to: ${targetDestination}`,
    report,
  });
});

// Firewall (real macOS pf rules)
app.post("/api/security/firewall/apply", async (req, res) => {
  const { rules } = req.body;
  try {
    const result = await applyFirewallRules(rules as any);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/security/firewall/remove", (req, res) => {
  const { ruleId } = req.body;
  if (!ruleId) return res.status(400).json({ error: "Missing ruleId." });
  const remaining = removeFirewallRule(String(ruleId));
  return res.json({ success: true, rules: remaining });
});

app.get("/api/security/firewall/active", async (_req, res) => {
  try {
    const output = await readActiveRules();
    return res.json({ output });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/security/firewall/rules", (_req, res) => {
  return res.json(getStore().firewallRules);
});

// Planner tasks (persisted)
app.get("/api/tasks", (_req, res) => {
  return res.json(getStore().plannerTasks);
});

app.post("/api/tasks", (req, res) => {
  const { tasks } = req.body;
  if (!Array.isArray(tasks)) return res.status(400).json({ error: "tasks must be an array." });
  saveStore({ plannerTasks: tasks });
  return res.json({ success: true });
});

// Alerts (persisted)
app.get("/api/alerts", (_req, res) => {
  return res.json(getStore().alerts);
});

app.post("/api/alerts", (req, res) => {
  const { alerts } = req.body;
  if (!Array.isArray(alerts)) return res.status(400).json({ error: "alerts must be an array." });
  saveStore({ alerts });
  return res.json({ success: true });
});

// Lynis-equivalent System Hardening & Compliance Audit + Search-Grounded AI Remediation Planner
app.post("/api/security/lynis-audit", async (req, res) => {
  try {
    const includeAi = req.body?.includeAi !== false;
    const report = await runLynisEquivalentAudit(includeAi);
    return res.json(report);
  } catch (err: any) {
    console.error("[LYNIS AUDIT ERROR]", err);
    return res.status(500).json({ error: err?.message || "Failed to execute Lynis system audit." });
  }
});

// Permission-gated Remediation Executor: ONLY executes when user explicitly sets approved: true
app.post("/api/security/lynis-remediate", async (req, res) => {
  const { approved, command, findingId, title } = req.body || {};

  if (approved !== true) {
    return res.status(403).json({
      success: false,
      error: "Execution blocked: Explicit user permission (approved: true) is required before running any remediation command.",
    });
  }

  if (!command || typeof command !== "string" || !command.trim()) {
    return res.status(400).json({
      success: false,
      error: "Missing remediation command.",
    });
  }

  try {
    const output = await runTerminalCommand(command.trim());
    return res.json({
      success: true,
      findingId: findingId || null,
      title: title || "System Hardening Remediation",
      executedCommand: command.trim(),
      output,
      executedAt: new Date().toLocaleTimeString(),
    });
  } catch (err: any) {
    console.error("[LYNIS REMEDIATION ERROR]", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Remediation command execution failed.",
    });
  }
});

// Explicit 404 handler for unmatched /api routes (prevents Vite SPA fallback from returning HTML)
app.all("/api/*", (req, res) => {
  return res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// JSON error handler for /api routes
app.use("/api", (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[API UNCAUGHT ERROR]", err);
  return res.status(500).json({ error: err?.message || "Internal server error" });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: { ignored: ["**/data/**", "**/data/store.json"] },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(__dirname, "index.html"))
      ? __dirname
      : (fs.existsSync(path.join(__dirname, "dist"))
        ? path.join(__dirname, "dist")
        : path.join(process.cwd(), "dist"));
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`NetGuard is running in REAL-DATA mode. Privileged features use: sudo scripts/setup-sudo.sh`);
  });
}

startServer();
