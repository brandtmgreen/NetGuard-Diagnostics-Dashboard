import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import DashboardOverview from "./components/DashboardOverview";
import TaskManager from "./components/TaskManager";
import TaskPlanner from "./components/TaskPlanner";
import NetworkDiagnostics from "./components/NetworkDiagnostics";
import SecurityCenter from "./components/SecurityCenter";
import TerminalConsole from "./components/TerminalConsole";
import NmapScanner from "./components/NmapScanner";
import WiresharkConsole from "./components/WiresharkConsole";
import InstallationWizard from "./components/InstallationWizard";
import AppConfiguration from "./components/AppConfiguration";
import { Device, Process, ThreatLog, FirewallRule, TerminalLine, SystemAlert, PlannerTask, SuspiciousActivity, ThemeMode, AppConfig } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [securityScore, setSecurityScore] = useState<number>(94);

  // App Configuration & Theme State
  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem("netguard_app_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      theme: "dark",
      autoRefreshInterval: 3,
      soundEffects: true,
      retroFontEnabled: false,
      scanSubnetRange: "192.168.1.0/24",
      enableAiAdvisories: true,
      maxPacketCapture: 500
    };
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", appConfig.theme);
    localStorage.setItem("netguard_app_config", JSON.stringify(appConfig));
  }, [appConfig]);

  const handleUpdateConfig = (newConfig: Partial<AppConfig>) => {
    setAppConfig(prev => ({ ...prev, ...newConfig }));
  };

  const handleSelectTheme = (theme: ThemeMode) => {
    setAppConfig(prev => ({ ...prev, theme }));
  };

  const handleResetConfigDefaults = () => {
    const defaultConfig: AppConfig = {
      theme: "dark",
      autoRefreshInterval: 3,
      soundEffects: true,
      retroFontEnabled: false,
      scanSubnetRange: "192.168.1.0/24",
      enableAiAdvisories: true,
      maxPacketCapture: 500
    };
    setAppConfig(defaultConfig);
  };

  // 1. Devices state (populated from real ARP/discovery APIs)
  const [devices, setDevices] = useState<Device[]>([]);

  // 2. Task Manager Processes state (populated from real /api/system/processes)
  const [processes, setProcesses] = useState<Process[]>([]);

  // 3. Security Threat Logs state (derived from real telemetry)
  const [threatLogs, setThreatLogs] = useState<ThreatLog[]>([]);

  // 4. Firewall Rules state (loaded + persisted via real pf endpoint)
  const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([]);

  // 5. System alerts (derived from real resource/threat telemetry)
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);

  // 6. Interactive Terminal lines state
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    { text: "NetGuard Command Shell [Version 1.0.4]", type: "info", timestamp: "07:22:20" },
    { text: "Type 'help' to see diagnostic suite commands. Prefix with 'ai' for AI advisor.", type: "info", timestamp: "07:22:20" }
  ]);
  const [isTerminalLoading, setIsTerminalLoading] = useState(false);

  // 7. Security Scanning states
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // 8. Security Task Planner state (loaded + persisted via /api/tasks)
  const [plannerTasks, setPlannerTasks] = useState<PlannerTask[]>([]);

  // 9. Real-time suspicious activities (from /api/security/live-threats)
  const [suspiciousActivities, setSuspiciousActivities] = useState<SuspiciousActivity[]>([]);

  // 10. Intrusion Detection System configuration
  const [idsEnabled, setIdsEnabled] = useState<boolean>(true);
  const [idsThreshold, setIdsThreshold] = useState<number>(75);

  // Real host telemetry (from /api/system/status + /api/system/traffic)
  const [hostStatus, setHostStatus] = useState<any>(null);
  const [trafficMbps, setTrafficMbps] = useState<number>(0);
  const [clockNow, setClockNow] = useState<string>(new Date().toLocaleTimeString());

  // 1-second clock for header/timestamps
  useEffect(() => {
    const id = setInterval(() => setClockNow(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  const mapSystemProcess = (p: any): Process => ({
    pid: p.pid,
    name: p.name,
    cpu: p.cpu,
    memory: p.memory,
    disk: p.disk ?? 0,
    network: p.network ?? 0,
    status: p.status === "Running" || p.status === "Suspended" || p.status === "Stopped" ? p.status : "Running",
    publisher: p.publisher || "",
    parentPid: p.ppid ?? undefined
  });

  const refreshSystem = async () => {
    try {
      const res = await fetch("/api/system/status");
      const data = await res.json();
      if (data && data.hostname) setHostStatus(data);
    } catch (err) { console.error("Failed to refresh system status:", err); }
  };

  const refreshProcesses = async () => {
    try {
      const res = await fetch("/api/system/processes?limit=2000");
      const data = await res.json();
      if (Array.isArray(data.processes)) setProcesses(data.processes.map(mapSystemProcess));
    } catch (err) { console.error("Failed to refresh processes:", err); }
  };

  const refreshThreats = async () => {
    try {
      const res = await fetch("/api/security/live-threats");
      const data = await res.json();
      if (Array.isArray(data.threats)) {
        setSuspiciousActivities(data.threats.map((t: any) => ({
          id: t.id,
          timestamp: t.timestamp,
          srcIp: t.srcIp,
          destIp: t.destIp,
          protocol: t.protocol,
          destPort: t.destPort,
          type: t.type,
          severity: t.severity,
          packetSize: t.packetSize,
          reason: t.reason,
          status: t.status,
          process: t.process,
          geo: t.geo
        })));
      }
    } catch (err) { console.error("Failed to refresh live threats:", err); }
  };

  const refreshTraffic = async () => {
    try {
      const res = await fetch("/api/system/traffic?sample=1000");
      const data = await res.json();
      if (typeof data?.totalMbps === "number") {
        setTrafficMbps(data.totalMbps);
      }
    } catch (err) { console.error("Failed to refresh traffic:", err); }
  };

  // Poll real telemetry on the configured refresh cadence (min 2s)
  const refreshAll = () => {
    refreshSystem();
    refreshProcesses();
    refreshThreats();
    refreshTraffic();
  };

  useEffect(() => {
    const intervalMs = Math.max(2000, (appConfig.autoRefreshInterval || 3) * 1000);
    refreshAll();
    const id = setInterval(refreshAll, intervalMs);
    return () => clearInterval(id);
  }, [appConfig.autoRefreshInterval]);

  // Mount: load persisted data (firewall rules, planner tasks, alerts) + ARP neighbors
  useEffect(() => {
    (async () => {
      try {
        const [rulesRes, tasksRes, alertsRes, neighborsRes] = await Promise.all([
          fetch("/api/security/firewall/rules"),
          fetch("/api/tasks"),
          fetch("/api/alerts"),
          fetch("/api/network/neighbors")
        ]);
        const rules = await rulesRes.json();
        if (Array.isArray(rules)) setFirewallRules(rules);
        const tasks = await tasksRes.json();
        if (Array.isArray(tasks)) setPlannerTasks(tasks);
        const storedAlerts = await alertsRes.json();
        if (Array.isArray(storedAlerts) && storedAlerts.length > 0) setAlerts(storedAlerts);
        const neighbors = await neighborsRes.json();
        if (neighbors?.success && Array.isArray(neighbors.devices)) {
          const mapped = neighbors.devices.map((d: any) => ({
            ip: d.ip,
            name: d.name,
            type: d.type,
            status: d.status,
            ping: d.ping,
            cpu: 0,
            memory: 0,
            mac: d.mac
          }));
          setDevices(mapped);
        }
      } catch (err) { console.error("Failed to hydrate persisted state:", err); }
    })();
  }, []);

  // Derive security score from real telemetry + live threat pressure
  useEffect(() => {
    let score = 100;
    if (hostStatus) {
      if (hostStatus.usedMemPercent > 75) score -= Math.min(12, hostStatus.usedMemPercent - 70);
      if (hostStatus.diskUsedPercent > 85) score -= Math.min(8, hostStatus.diskUsedPercent - 80);
      const loadPct = hostStatus.cpuCount ? (hostStatus.loadAvg?.[0] ?? 0) / hostStatus.cpuCount : 0;
      if (loadPct > 0.8) score -= Math.min(8, Math.round((loadPct - 0.75) * 10));
    }
    const hostile = suspiciousActivities.filter(a => a.status === "active" && a.srcIp !== "0.0.0.0");
    const severe = hostile.filter(t => t.severity === "critical" || t.severity === "high").length;
    score -= Math.min(25, severe * 6);
    setSecurityScore(Math.max(1, Math.round(score)));
  }, [hostStatus, suspiciousActivities]);

  const stableAlertId = (msg: string) => `al-${msg.replace(/[^a-zA-Z0-9]/g, "").slice(-32)}`;

  // Derive alerts from resource pressure + hostile live threats
  useEffect(() => {
    if (!hostStatus) return;
    const ts = clockNow;
    const items: SystemAlert[] = [];
    if (hostStatus.usedMemPercent > 85) {
      items.push({ id: stableAlertId(`mem-${hostStatus.hostname}`), timestamp: ts, severity: "warning", message: `Host memory pressure at ${hostStatus.usedMemPercent}% on ${hostStatus.hostname}`, unread: true, deviceIp: hostStatus.hostname });
    }
    if (hostStatus.diskUsedPercent > 90) {
      items.push({ id: stableAlertId(`disk-${hostStatus.hostname}`), timestamp: ts, severity: "warning", message: `Disk usage critical at ${hostStatus.diskUsedPercent}%`, unread: true, deviceIp: hostStatus.hostname });
    }
    suspiciousActivities
      .filter(a => a.status === "active" && (a.severity === "high" || a.severity === "critical"))
      .forEach(a => {
        items.push({ id: stableAlertId(`ids-${a.srcIp}-${a.destPort}`), timestamp: a.timestamp, severity: a.severity === "critical" ? "critical" : "warning", message: `[IDS] ${a.type} flagged from ${a.srcIp} on port ${a.destPort}`, unread: true, deviceIp: a.destIp });
      });
    setAlerts(items.slice(0, 10));
  }, [hostStatus, suspiciousActivities, clockNow]);

  // Derive threat log feed from real telemetry
  useEffect(() => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const logs: ThreatLog[] = [];
    suspiciousActivities
      .filter(a => a.status === "active" && (a.severity === "high" || a.severity === "critical"))
      .forEach(a => {
        logs.push({
          id: `tl-${a.id}`,
          timestamp: `${dateStr} ${a.timestamp}`,
          severity: a.severity === "critical" ? "Critical" : "Warning",
          host: `${a.srcIp} (${a.process || "external"})`,
          message: a.reason,
          status: "Flagged"
        });
      });
    if (hostStatus) {
      if (hostStatus.usedMemPercent > 85) {
        logs.push({ id: "tl-mem", timestamp: `${dateStr} ${clockNow}`, severity: "Warning", host: hostStatus.hostname, message: `Host memory pressure exceeded 85% threshold (${hostStatus.usedMemPercent}%)`, status: "Flagged" });
      }
      if (hostStatus.diskUsedPercent > 90) {
        logs.push({ id: "tl-disk", timestamp: `${dateStr} ${clockNow}`, severity: "Warning", host: hostStatus.hostname, message: `Disk utilization at critical level (${hostStatus.diskUsedPercent}%)`, status: "Flagged" });
      }
    }
    setThreatLogs(logs.slice(0, 12));
  }, [suspiciousActivities, hostStatus, clockNow]);

  // Persist planner tasks + derived alerts to the store
  useEffect(() => {
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks: plannerTasks })
    }).catch(() => {});
  }, [plannerTasks]);

  useEffect(() => {
    fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alerts })
    }).catch(() => {});
  }, [alerts]);

  // Command running API dispatcher
  const handleRunCommand = async (commandText: string) => {
    const formattedCmd = commandText.trim();
    if (!formattedCmd) return;

    // Append to lines
    setTerminalLines(prev => [...prev, { text: formattedCmd, type: "input", timestamp: new Date().toLocaleTimeString() }]);
    setIsTerminalLoading(true);

    if (formattedCmd.toLowerCase() === "cls") {
      setTerminalLines([]);
      setIsTerminalLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/terminal/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: formattedCmd })
      });

      const data = await response.json();
      const outputType = formattedCmd.toLowerCase().startsWith("ai ") || formattedCmd.toLowerCase() === "ai" ? "ai" : "output";

      setTerminalLines(prev => [...prev, {
        text: data.output || "No stdout printed.",
        type: outputType,
        timestamp: new Date().toLocaleTimeString()
      }]);
    } catch (err: any) {
      console.error("Failed to run CLI instruction:", err);
      setTerminalLines(prev => [...prev, {
        text: `SYSTEM ERR: Failed to establish channel to local diagnostic node server. Details: ${err.message || err}`,
        type: "error",
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsTerminalLoading(false);
    }
  };

  // Callback to clear all notifications/alarms
  const handleClearAlerts = () => {
    setAlerts([]);
  };

  // Task manager actions
  const handleEndTask = async (pid: number) => {
    await handleRunCommand(`taskkill /PID ${pid}`);
    refreshProcesses();
  };

  const handleSpawnTask = async (parentPid?: number) => {
    try {
      const res = await fetch("/api/system/spawn", { method: "POST" });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "spawn failed");
      setTerminalLines(prev => [...prev, {
        text: `[INFO] Spawned real background process: ${data.name} (PID ${data.pid}, duration ${data.args?.[0] ?? "?"}s)${parentPid ? ` under Parent PID ${parentPid}` : ""}.`,
        type: "info",
        timestamp: new Date().toLocaleTimeString()
      }]);
      refreshProcesses();
    } catch (err: any) {
      console.error("Failed to spawn background process:", err);
      setTerminalLines(prev => [...prev, {
        text: `[ERROR] Failed to spawn background process: ${err?.message || err}`,
        type: "error",
        timestamp: new Date().toLocaleTimeString()
      }]);
    }
  };

  // Security Task Planner actions
  const handleAddTask = (taskData: Omit<PlannerTask, "id">) => {
    const newTask: PlannerTask = {
      id: `tp-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      ...taskData
    };
    setPlannerTasks(prev => [newTask, ...prev]);
    setTerminalLines(prev => [...prev, {
      text: `[PLANNER] Action item successfully scheduled: "${newTask.title}" (Due: ${newTask.dueDate}).`,
      type: "info",
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const handleUpdateTask = (updatedTask: PlannerTask) => {
    setPlannerTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    setTerminalLines(prev => [...prev, {
      text: `[PLANNER] Task "${updatedTask.title}" metadata modified. Progress: ${updatedTask.completed ? "MITIGATED" : "ACTIVE"}.`,
      type: "info",
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const handleDeleteTask = (id: string) => {
    const deleted = plannerTasks.find(t => t.id === id);
    setPlannerTasks(prev => prev.filter(t => t.id !== id));
    if (deleted) {
      setTerminalLines(prev => [...prev, {
        text: `[PLANNER] Task "${deleted.title}" deleted from deployment logs.`,
        type: "info",
        timestamp: new Date().toLocaleTimeString()
      }]);
    }
  };

  const handleSaveConfig = (apiKey: string, port: string, theme: string) => {
    setTerminalLines(prev => [...prev, {
      text: `[SYSTEM CONFIG] Global environment parameters applied. Port: ${port}, Theme: ${theme}, Gemini API: ${apiKey ? "SPECIFIED (ARMED)" : "NOT SPECIFIED"}`,
      type: "info",
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  // Live IDS Anomaly Mitigations
  const handleMitigateActivity = (id: string) => {
    const act = suspiciousActivities.find(a => a.id === id);
    if (!act) return;

    // 1. Mark as mitigated
    setSuspiciousActivities(prev => prev.map(a => a.id === id ? { ...a, status: "mitigated" } : a));

    // 2. Auto-generate Firewall rule to drop packets
    const blockRule: FirewallRule = {
      id: `fw-gen-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      name: `IDS AutoBlock - Host ${act.srcIp}`,
      port: act.destPort === "0" || act.destPort === "Multiple" ? "All" : act.destPort,
      protocol: act.protocol === "HTTP" ? "TCP" : act.protocol,
      direction: "Inbound",
      action: "Block",
      enabled: true
    };
    setFirewallRules(prev => {
      const next = [blockRule, ...prev];
      persistFirewall(next);
      return next;
    });

    // 3. Log alert
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newAlert: SystemAlert = {
      id: `a-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      timestamp: nowStr,
      severity: "info",
      message: `IDS automated firewall active block deployed targeting src host ${act.srcIp}!`,
      unread: true,
      deviceIp: act.destIp
    };
    setAlerts(prev => [newAlert, ...prev.slice(0, 7)]);

    // 4. Print terminal confirmation
    setTerminalLines(prev => [...prev, {
      text: `[IDS DEFENSE] Intrusion mitigated successfully. Automated PowerShell command deployed: \nNew-NetFirewallRule -Name "IDS_AutoBlock_${act.srcIp}" -DisplayName "IDS AutoBlock: ${act.srcIp}" -Direction Inbound -Action Block -RemoteAddress "${act.srcIp}"`,
      type: "info",
      timestamp: nowStr
    }]);
  };

  const handleIgnoreActivity = (id: string) => {
    setSuspiciousActivities(prev => prev.map(a => a.id === id ? { ...a, status: "ignored" } : a));
    setTerminalLines(prev => [...prev, {
      text: `[IDS MONITOR] Security alert muted for source endpoint. Continuous packet inspection remains active.`,
      type: "info",
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const handleAnalyzeActivityAI = async (activity: SuspiciousActivity) => {
    setActiveTab("terminal");
    await handleRunCommand(`ai explain security risk of ${activity.type} packet: Protocol ${activity.protocol}, Destination Port ${activity.destPort}, Reason: ${activity.reason}`);
  };

  // Network tab handlers (triggers CLI executions automatically on click)
  const handlePingDevice = async (ip: string) => {
    setActiveTab("terminal");
    await handleRunCommand(`ping ${ip}`);
  };

  const handleScanDevice = async (ip: string) => {
    setActiveTab("terminal");
    await handleRunCommand(`ai explain security vulnerabilities on ${ip}`);
  };

  const handleToggleDeviceStatus = (ip: string) => {
    setDevices(prev => prev.map(d => {
      if (d.ip === ip) {
        const nextStatus = d.status === "Online" ? "Offline" : "Online";
        return {
          ...d,
          status: nextStatus,
          cpu: nextStatus === "Online" ? 15 : 0,
          memory: nextStatus === "Online" ? 25 : 0,
          ping: nextStatus === "Online" ? "10ms" : "---"
        };
      }
      return d;
    }));
  };

  const handleImportDevices = (newDevices: Device[]) => {
    setDevices(prev => {
      const existingIps = new Set(prev.map(d => d.ip));
      const filteredNew = newDevices.filter(d => !existingIps.has(d.ip));
      
      if (filteredNew.length === 0) return prev;
      
      const importedNames = filteredNew.map(d => `${d.name} (${d.ip})`).join(", ");
      setTerminalLines(p => [...p, {
        text: `[NET DISCOVERY] Registered ${filteredNew.length} newly discovered network nodes: ${importedNames}. Added to active topology maps.`,
        type: "info",
        timestamp: new Date().toLocaleTimeString()
      }]);

      return [...prev, ...filteredNew];
    });
  };

  // Security tab rules and controls
  const handleToggleFirewallRule = (id: string) => {
    const nextRules = firewallRules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    setFirewallRules(nextRules);
    persistFirewall(nextRules);

    const r = firewallRules.find(rule => rule.id === id);
    if (r) {
      const stateStr = !r.enabled ? "ENABLED / ARMED" : "DISABLED / BYPASSED";
      setTerminalLines(prev => [...prev, {
        text: `[SYSTEM POLICY] Firewall rule '${r.name}' status committed as: ${stateStr}.`,
        type: "info",
        timestamp: new Date().toLocaleTimeString()
      }]);
    }
  };

  const handleRunSecurityScan = async () => {
    setIsScanning(true);
    setScanResult(null);

    try {
      const [threatsRes, statusRes] = await Promise.all([
        fetch("/api/security/live-threats"),
        fetch("/api/system/status")
      ]);
      const threats = await threatsRes.json();
      const status = await statusRes.json();
      const active = Array.isArray(threats.threats) ? threats.threats.filter((t: any) => t.status === "active") : [];
      const critical = active.filter((t: any) => t.severity === "critical" || t.severity === "high").length;
      const medium = active.filter((t: any) => t.severity === "medium").length;

      setScanResult(`[NetGuard Security Shield - Live Host Scan Report]
Timestamp: ${new Date().toLocaleString()}
Scan Mode: Live telemetry (host ${status.hostname || "unknown"})

1. Memory Pressure............ ${status.usedMemPercent ?? 0}% ${(status.usedMemPercent ?? 0) > 85 ? "WARN" : "CLEAN"}
2. Disk Utilization........... ${status.diskUsedPercent ?? 0}% ${(status.diskUsedPercent ?? 0) > 90 ? "WARN" : "CLEAN"}
3. Live Threat Signatures..... ${critical} critical/high, ${medium} medium over ${active.length} active connection(s)
4. Firewall Ruleset........... ${firewallRules.filter(r => r.enabled).length} rules armed (${firewallRules.length} total)

Advice: Run 'ai explain how to audit anomalous socket connections' to request step-by-step mitigation advice.`);

      setSecurityScore(prev => Math.max(40, prev - critical * 3));
    } catch (err: any) {
      setScanResult(`[NetGuard Security Shield - Scan FAILED]
Could not reach diagnostic daemon. Details: ${err?.message || err}`);
    } finally {
      setIsScanning(false);
    }

    // Append scan line to terminal log
    setTerminalLines(prev => [...prev, {
      text: `[INFO] Dynamic Host Security Scan completed. Diagnostic output printed to Security Center panel.`,
      type: "info",
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const handleAddFirewallRule = (rule: Partial<FirewallRule>) => {
    const newRule: FirewallRule = {
      id: `fw-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      name: rule.name || "Custom Firewall Block",
      port: rule.port || "80",
      protocol: rule.protocol || "TCP",
      direction: rule.direction || "Inbound",
      action: rule.action || "Block",
      enabled: rule.enabled ?? true
    };
    const nextRules = [newRule, ...firewallRules];
    setFirewallRules(nextRules);
    persistFirewall(nextRules);
    setTerminalLines(prev => [...prev, {
      text: `[SYSTEM POLICY] Successfully created new live firewall rule: '${newRule.name}' on Port ${newRule.port}.`,
      type: "info",
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const [refreshReportsTrigger, setRefreshReportsTrigger] = useState<number>(0);

  const handleAddPlannerTaskFromNmap = (task: { title: string; description: string; priority: "High" | "Critical"; assignedNode: string }) => {
    handleAddTask({
      title: task.title,
      description: task.description,
      priority: task.priority,
      assignedNode: task.assignedNode,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString(), // 2 days
      completed: false
    });
  };

  const handleGenerateThreatReport = (report: { scanData: any; packetsData: any; sourceThreat: string }) => {
    setRefreshReportsTrigger(prev => prev + 1);
  };

  // Persist firewall rules to the real pf anchor via the apply endpoint
  const persistFirewall = (rules: FirewallRule[]) => {
    fetch("/api/security/firewall/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules })
    })
      .then(r => r.json())
      .then((res: any) => {
        setTerminalLines(prev => [...prev, {
          text: `[PFCTL] ${res?.message || "Firewall ruleset synced."}${res?.error ? ` (${res.error})` : ""}`,
          type: res?.success ? "info" : "error",
          timestamp: new Date().toLocaleTimeString()
        }]);
      })
      .catch(() => {});
  };

  // Derived header/footer telemetry
  const loadPercent = hostStatus?.cpuCount
    ? Math.min(100, Math.max(0, Math.round(((hostStatus.loadAvg?.[0] ?? 0) / hostStatus.cpuCount) * 100)))
    : 0;
  const threatLevel = (() => {
    const crit = suspiciousActivities.filter(a => a.status === "active" && (a.severity === "critical" || a.severity === "high")).length;
    if (crit >= 3) return { label: "CRITICAL", color: "#f7768e" };
    if (crit >= 1) return { label: "HIGH", color: "#e0af68" };
    const med = suspiciousActivities.filter(a => a.status === "active" && a.severity === "medium").length;
    if (med >= 3) return { label: "MEDIUM", color: "#e0af68" };
    return { label: "LOW", color: "#9ece6a" };
  })();
  const pingValues = devices.filter(d => d.status === "Online").map(d => parseInt(d.ping)).filter(n => !isNaN(n));
  const avgPing = pingValues.length ? Math.round(pingValues.reduce((a, b) => a + b, 0) / pingValues.length) : null;

  return (
    <div className="bg-[#0b0c0f] text-[#a9b1d6] font-sans h-screen w-screen flex flex-col overflow-hidden select-none border border-[#1a1b26]">
      {/* Top Window Chrome Header */}
      <header className="h-10 bg-[#16161e] border-b border-[#24283b] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#f7768e] border border-[#f7768e]/30"></div>
            <div className="w-3 h-3 rounded-full bg-[#e0af68] border border-[#e0af68]/30"></div>
            <div className="w-3 h-3 rounded-full bg-[#9ece6a] border border-[#9ece6a]/30"></div>
          </div>
          <span className="font-extrabold text-[#7aa2f7] tracking-tight text-xs uppercase flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7aa2f7] animate-pulse"></span>
            NetGuard OmniView v1.0.4
          </span>
          <div className="h-4 w-px bg-[#24283b]"></div>
          <div className="hidden md:flex gap-3 text-[10px] uppercase font-bold text-[#565f89] font-mono">
            <span>HOST: {(hostStatus?.hostname || "local").toUpperCase()}</span>
            <span>•</span>
            <span>Active Clients: {devices.filter(d => d.status === "Online").length} Online</span>
            <span>•</span>
            <span>Core Load: {loadPercent}%</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex gap-2.5 items-center">
            <div className="text-right">
              <div className="text-[9px] uppercase leading-none opacity-50 font-mono">Host Load</div>
              <div className="text-xs font-mono text-[#bb9af7] font-bold">{loadPercent}%</div>
            </div>
            <div className="w-16 h-2 bg-[#1a1b26] rounded-full overflow-hidden border border-[#24283b]">
              <div className="h-full bg-[#7aa2f7]" style={{ width: `${loadPercent}%` }}></div>
            </div>
          </div>
          <div className="text-xs font-mono hidden sm:block text-[#565f89] font-semibold">{clockNow}</div>
        </div>
      </header>

      {/* Main Grid content with Sidebar and tab switches */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Hand side Navigation menu */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          alertCount={alerts.length} 
          threatCount={threatLogs.filter(t => t.status === "Flagged").length + suspiciousActivities.filter(a => a.status === "active").length} 
          currentTheme={appConfig.theme}
          onSelectTheme={handleSelectTheme}
        />

        {/* Right Hand side content window area */}
        <main className="flex-1 bg-[#0b0c0f] overflow-hidden relative flex flex-col">
          
          {/* Retro Theme Overlay Banners */}
          {appConfig.theme === "win31" && (
            <div className="bg-[#000080] text-white px-3 py-1 flex items-center justify-between text-xs font-bold border-b-2 border-black font-sans shrink-0">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.2 bg-white text-black text-[10px] border border-black font-mono">[-]</span>
                <span>Program Manager - NetGuard Omni-Diagnostic Suite [1992]</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[11px]">
                <span className="px-1 py-0.2 bg-[#c0c0c0] text-black border border-black cursor-pointer">[▲]</span>
                <span className="px-1 py-0.2 bg-[#c0c0c0] text-black border border-black cursor-pointer">[▼]</span>
              </div>
            </div>
          )}

          {appConfig.theme === "mario" && (
            <div className="bg-[#000000] text-[#ffffff] px-4 py-1.5 flex items-center justify-between text-[10px] font-mono border-b-2 border-[#f8b800] shrink-0">
              <div className="flex items-center gap-4">
                <span className="text-[#e52521] font-bold">MARIO</span>
                <span className="text-[#f8b800]">003820</span>
                <span className="text-[#f8b800]">🪙 x99</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[#00a800]">WORLD 1-1</span>
                <span className="text-[#fc9838]">TIME 350</span>
              </div>
            </div>
          )}

          {appConfig.theme === "johnny5" && (
            <div className="bg-[#121922] text-[#ff9900] px-4 py-1 flex items-center justify-between text-[10px] font-mono border-b border-[#ff9900] shrink-0 shadow">
              <div className="flex items-center gap-3">
                <span className="font-bold bg-[#ff9900] text-slate-950 px-1.5 py-0.2 rounded text-[9px]">S.A.I.N.T. #5</span>
                <span>STATUS: ALIVE!</span>
                <span className="text-[#00ffcc]">INPUT: NEED INPUT!</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#ff3330]">DISASSEMBLE: FALSE</span>
                <span className="text-[#00d2ff]">OPTIC LASER: READY</span>
              </div>
            </div>
          )}

          {activeTab === "dashboard" && (
            <DashboardOverview 
              devices={devices} 
              threatLogs={threatLogs} 
              alerts={alerts} 
              securityScore={securityScore} 
              onClearAlerts={handleClearAlerts} 
              onSelectTab={setActiveTab} 
              trafficMbps={trafficMbps}
              loadPercent={loadPercent}
              hostname={hostStatus?.hostname || ""}
              onRefresh={refreshAll}
            />
          )}

          {activeTab === "tasks" && (
            <TaskManager 
              processes={processes} 
              onEndTask={handleEndTask} 
              onSpawnTask={handleSpawnTask} 
            />
          )}

          {activeTab === "planner" && (
            <TaskPlanner 
              tasks={plannerTasks}
              devices={devices}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {activeTab === "network" && (
            <NetworkDiagnostics 
              devices={devices} 
              onPingDevice={handlePingDevice} 
              onScanDevice={handleScanDevice} 
              onToggleStatus={handleToggleDeviceStatus} 
              onImportDevices={handleImportDevices}
            />
          )}

          {activeTab === "nmap" && (
            <NmapScanner 
              devices={devices}
              onAddFirewallRule={handleAddFirewallRule}
              onAddPlannerTask={handleAddPlannerTaskFromNmap}
            />
          )}

          {activeTab === "wireshark" && (
            <WiresharkConsole 
              onAddFirewallRule={handleAddFirewallRule}
              onGenerateThreatReport={handleGenerateThreatReport}
            />
          )}

          {activeTab === "security" && (
            <SecurityCenter 
              threatLogs={threatLogs} 
              firewallRules={firewallRules} 
              securityScore={securityScore} 
              suspiciousActivities={suspiciousActivities}
              idsEnabled={idsEnabled}
              onToggleIds={() => setIdsEnabled(!idsEnabled)}
              idsThreshold={idsThreshold}
              onChangeIdsThreshold={setIdsThreshold}
              onMitigateActivity={handleMitigateActivity}
              onIgnoreActivity={handleIgnoreActivity}
              onToggleFirewallRule={handleToggleFirewallRule} 
              onRunSecurityScan={handleRunSecurityScan} 
              onAddFirewallRule={handleAddFirewallRule} 
              onAnalyzeActivityAI={handleAnalyzeActivityAI}
              isScanning={isScanning} 
              scanResult={scanResult} 
              onRefreshReportsTrigger={refreshReportsTrigger}
            />
          )}

          {activeTab === "terminal" && (
            <TerminalConsole 
              terminalLines={terminalLines} 
              onRunCommand={handleRunCommand} 
              onClearTerminal={() => setTerminalLines([])} 
              isLoading={isTerminalLoading} 
            />
          )}

          {activeTab === "wizard" && (
            <InstallationWizard 
              onSaveConfig={handleSaveConfig}
            />
          )}

          {activeTab === "config" && (
            <AppConfiguration 
              config={appConfig}
              onUpdateConfig={handleUpdateConfig}
              onResetDefaults={handleResetConfigDefaults}
            />
          )}

        </main>
      </div>

      {/* Footer System Tray info */}
      <footer className="h-6 bg-[#16161e] border-t border-[#24283b] flex items-center px-4 justify-between text-[10px] font-bold text-[#565f89] uppercase tracking-wider shrink-0 font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#9ece6a] block animate-pulse"></span>
          <span>System Integrity: SECURE</span>
        </div>
        <div className="flex gap-6">
          <span>Ping Latency: {avgPing !== null ? `${avgPing}ms` : "---"}</span>
          <span>Net Throughput: {trafficMbps.toFixed(1)} Mb/s</span>
          <span>Threat Level: <span style={{ color: threatLevel.color }}>{threatLevel.label}</span></span>
        </div>
      </footer>
    </div>
  );
}
