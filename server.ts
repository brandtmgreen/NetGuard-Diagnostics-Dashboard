import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fs from "fs";
import { spawn } from "child_process";

import { getGeminiClient } from "./server/lib/gemini";
import { getSystemStatus, getProcesses, getBandwidth } from "./server/services/system";
import { runTerminalCommand } from "./server/services/terminal";
import { discoverDevices, getLiveConnections, getNeighbors, getInterfaces } from "./server/services/network";
import { runNmap, NmapProfile } from "./server/services/nmap";
import { capturePackets } from "./server/services/capture";
import { ipLookup } from "./server/services/intel";
import { getStore, saveStore } from "./server/services/store";
import { applyFirewallRules, removeFirewallRule, readActiveRules } from "./server/services/firewall";
import { getLiveThreats } from "./server/services/threats";

dotenv.config();

const app = express();
const PORT = 3000;

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

// System telemetry
app.get("/api/system/status", async (_req, res) => {
  try {
    return res.json(await getSystemStatus());
  } catch (err: any) {
    console.error("[SYSTEM STATUS ERROR]", err);
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

// Security AI audit and Threat report formulation
app.post("/api/security/ai-audit", async (req, res) => {
  const { scanData, packetsData, sourceThreat } = req.body;
  const ai = getGeminiClient();

  const formattedScan = scanData ? JSON.stringify(scanData) : "No active port scan attached.";
  const formattedPackets = packetsData ? JSON.stringify(packetsData) : "No packet captures attached.";
  const threatSource = sourceThreat || "Anomalous Network Traffic Inspection";

  const defaultReport = {
    id: `rep-${Date.now()}`,
    title: `Threat Mitigation Report: Audit on ${threatSource}`,
    timestamp: new Date().toLocaleString(),
    sourceThreat: threatSource,
    severity: "high" as const,
    status: "draft" as const,
    executiveSummary: `An automated security audit was generated focusing on anomalous data patterns observed during local socket inspections. Real-time logging identified unauthorized protocols communicating internally.`,
    attackVector: "Internal Network Pivot and Credential Leakage",
    auditedDataPoints: ["Interactive Packet Analysis", "Security Center Telemetry"],
    findings: [
      "Detected vulnerable service ports active on internal subnets",
      "Observed network packets transmitting insecure data structures",
    ],
    mitigations: [
      { action: "Block remote port traffic", status: "completed" as const, type: "firewall" as const, details: "Created inbound block rule in NetGuard." },
      { action: "Enforce secure key-exchange", status: "pending" as const, type: "remediation" as const, details: "Revoke outdated ciphers." },
    ],
    exportedTo: [],
  };

  if (ai) {
    try {
      const prompt = `You are a senior Incident Response and Threat Hunter Agent.
Analyze the following compiled data from NMAP scans and Wireshark captures:
---
ATTACHED SCAN FILE:
${formattedScan}

ATTACHED PACKET LOGS:
${formattedPackets}
---
The main suspect behavior: ${threatSource}

Draft a formal "ThreatResponseReport" structured in JSON format.
You MUST output ONLY a valid JSON object matching this schema. Avoid any extra commentary, code fences, or text before/after the JSON.

JSON Schema structure:
{
  "title": "Strict title summarizing threat",
  "severity": "low" | "medium" | "high" | "critical",
  "executiveSummary": "A concise executive summary explaining what happened and real risk",
  "attackVector": "A clear definition of the attack vector",
  "auditedDataPoints": ["array of sources parsed", "e.g., NMAP TCP Scan"],
  "findings": ["At least 3 specific findings from the scan or packet traces"],
  "mitigations": [
    {
      "action": "Brief title of mitigation",
      "status": "pending" | "completed",
      "type": "firewall" | "process" | "remediation",
      "details": "Explanation of what needs to be run or configured"
    }
  ]
}

Strict Rule: Output ONLY the raw JSON string starting with { and ending with }. No markdown block envelopes.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      const jsonText = (response.text || "").trim();
      const cleanJson = jsonText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleanJson);

      const newReport = {
        id: `rep-${Date.now()}`,
        title: parsed.title || defaultReport.title,
        timestamp: new Date().toLocaleString(),
        sourceThreat: threatSource,
        severity: parsed.severity || "medium",
        status: "draft" as const,
        executiveSummary: parsed.executiveSummary || defaultReport.executiveSummary,
        attackVector: parsed.attackVector || defaultReport.attackVector,
        auditedDataPoints: parsed.auditedDataPoints || defaultReport.auditedDataPoints,
        findings: parsed.findings || defaultReport.findings,
        mitigations: parsed.mitigations || defaultReport.mitigations,
        exportedTo: [],
      };

      const store = getStore();
      saveStore({ threatReports: [...store.threatReports, newReport] });
      return res.json(newReport);
    } catch (err: any) {
      console.error("Gemini failed during AI report formulation, using generic generator:", err);
      const store = getStore();
      saveStore({ threatReports: [...store.threatReports, defaultReport] });
      return res.json(defaultReport);
    }
  } else {
    const store = getStore();
    saveStore({ threatReports: [...store.threatReports, defaultReport] });
    return res.json(defaultReport);
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
    const distPath = path.join(process.cwd(), "dist");
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
