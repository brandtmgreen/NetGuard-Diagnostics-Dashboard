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
import { Device, Process, ThreatLog, FirewallRule, TerminalLine, SystemAlert, PlannerTask, SuspiciousActivity } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [securityScore, setSecurityScore] = useState<number>(94);

  // 1. Devices state
  const [devices, setDevices] = useState<Device[]>([
    { ip: "192.168.1.1", name: "CoreRouter-RTX", type: "Router", status: "Online", ping: "1ms", cpu: 14, memory: 32, mac: "E0:D9:E3:42:11:0A" },
    { ip: "192.168.1.15", name: "Win11-Workstation", type: "Windows", status: "Online", ping: "12ms", cpu: 45, memory: 58, mac: "BC:23:4C:E3:78:F1" },
    { ip: "192.168.1.22", name: "Ubuntu-MicroServer", type: "Linux", status: "Online", ping: "8ms", cpu: 12, memory: 40, mac: "00:1A:2B:3C:4D:5E" },
    { ip: "192.168.1.44", name: "WinServer-AD01", type: "Windows", status: "Online", ping: "15ms", cpu: 82, memory: 88, mac: "11:22:33:44:55:66" },
    { ip: "192.168.1.102", name: "IoT-SecCamera01", type: "IoT", status: "Online", ping: "25ms", cpu: 5, memory: 18, mac: "AA:BB:CC:DD:EE:FF" },
    { ip: "192.168.1.120", name: "MacBook-Pro-CEO", type: "Mac", status: "Offline", ping: "---", cpu: 0, memory: 0, mac: "F4:0F:24:91:DE:3F" }
  ]);

  // 2. Task Manager Processes state
  const [processes, setProcesses] = useState<Process[]>([
    { pid: 0, name: "System Idle Process", cpu: 52.4, memory: 0, disk: 0, network: 0, status: "Running", publisher: "Microsoft Corporation" },
    { pid: 4, name: "System Kernel Task", cpu: 2.1, memory: 1, disk: 0.1, network: 0, status: "Running", publisher: "Microsoft Corporation", parentPid: 0 },
    { pid: 812, name: "svchost.exe (Local)", cpu: 0.4, memory: 34, disk: 0, network: 0, status: "Running", publisher: "Microsoft Corporation", parentPid: 4 },
    { pid: 2344, name: "explorer.exe", cpu: 1.5, memory: 112, disk: 0, network: 0, status: "Running", publisher: "Microsoft Corporation", parentPid: 4 },
    { pid: 4320, name: "chrome_isolated.exe", cpu: 18.1, memory: 1228, disk: 0.4, network: 2.1, status: "Running", publisher: "Google LLC", parentPid: 2344 },
    { pid: 3122, name: "docker_engine.service", cpu: 4.2, memory: 640, disk: 0.1, network: 0.1, status: "Running", publisher: "Docker Inc.", parentPid: 4 },
    { pid: 7812, name: "security_scan.bin", cpu: 0.8, memory: 14, disk: 0, network: 0, status: "Running", publisher: "NetGuard Corp.", parentPid: 4 },
    { pid: 8140, name: "node_runtime.exe", cpu: 1.1, memory: 212, disk: 0.2, network: 0.5, status: "Running", publisher: "Node.js Foundation", parentPid: 2344 }
  ]);

  // 3. Security Threat Logs state
  const [threatLogs, setThreatLogs] = useState<ThreatLog[]>([
    { id: "1", timestamp: "2026-07-07 07:10:12", severity: "Warning", host: "WinServer-AD01 (192.168.1.44)", message: "CPU load critical warning triggered (load peaked at 82%)", status: "Flagged" },
    { id: "2", timestamp: "2026-07-07 07:11:45", severity: "Info", host: "Gateway (192.168.1.1)", message: "Firewall rule 'Block WAN Inbound RDP' successfully deployed", status: "Resolved" },
    { id: "3", timestamp: "2026-07-07 07:12:01", severity: "Critical", host: "WAN Boundary", message: "Blocked malicious brute-force RDP scan from WAN IP 203.0.113.82 on Port 3389", status: "Blocked" },
    { id: "4", timestamp: "2026-07-07 07:20:02", severity: "Warning", host: "IoT-SecCamera01 (192.168.1.102)", message: "Device latency jitter exceeded 25ms SLA policy standard limit", status: "Flagged" }
  ]);

  // 4. Firewall Rules state
  const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([
    { id: "fw-1", name: "Block WAN Inbound RDP", port: "3389", protocol: "TCP", direction: "Inbound", action: "Block", enabled: true },
    { id: "fw-2", name: "Allow HTTPS Outbound", port: "443", protocol: "TCP", direction: "Outbound", action: "Allow", enabled: true },
    { id: "fw-3", name: "Drop Legacy Telnet", port: "23", protocol: "TCP", direction: "Inbound", action: "Block", enabled: true },
    { id: "fw-4", name: "SMB Protection Port 445", port: "445", protocol: "TCP", direction: "Inbound", action: "Block", enabled: false }
  ]);

  // 5. System alerts (real-time resource notifications)
  const [alerts, setAlerts] = useState<SystemAlert[]>([
    { id: "a-1", timestamp: "07:10:12", severity: "warning", message: "Host WinServer-AD01 memory usage threshold reached 88%", unread: true, deviceIp: "192.168.1.44" },
    { id: "a-2", timestamp: "07:20:02", severity: "critical", message: "IoT-SecCamera01 response latency spiked to 25ms", unread: true, deviceIp: "192.168.1.102" }
  ]);

  // 6. Interactive Terminal lines state
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    { text: "NetGuard Command Shell [Version 1.0.4]", type: "info", timestamp: "07:22:20" },
    { text: "Type 'help' to see diagnostic suite commands. Prefix with 'ai' for AI advisor.", type: "info", timestamp: "07:22:20" }
  ]);
  const [isTerminalLoading, setIsTerminalLoading] = useState(false);

  // 7. Security Scanning states
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // 8. Security Task Planner state
  const [plannerTasks, setPlannerTasks] = useState<PlannerTask[]>([
    {
      id: "tp-1",
      title: "Patch WinServer-AD01 System Files",
      description: "Apply security patch KB5014732 targeting legacy local directory services (AD) to defend against remote execution exploits.",
      dueDate: "2026-07-08",
      completed: false,
      priority: "High",
      assignedNode: "192.168.1.44",
      prerequisiteTaskId: "tp-2"
    },
    {
      id: "tp-2",
      title: "Rotate Router Administrator Passphrases",
      description: "Generate and apply complex passwords for the CoreRouter-RTX gateway management portal.",
      dueDate: "2026-07-10",
      completed: true,
      priority: "Medium",
      assignedNode: "192.168.1.1"
    },
    {
      id: "tp-3",
      title: "Audit IoT-SecCamera01 streaming protocols",
      description: "Check if local IoT CCTV endpoints are broadcasting unencrypted video streams. Terminate any exposed Telnet sockets immediately.",
      dueDate: "2026-07-09",
      completed: false,
      priority: "Critical",
      assignedNode: "192.168.1.102",
      prerequisiteTaskId: "tp-4"
    },
    {
      id: "tp-4",
      title: "Deploy Active Host Intrusion Shield (IDS)",
      description: "Arm intrusion filters across LAN segments to intercept and monitor real-time security threats.",
      dueDate: "2026-07-07",
      completed: false,
      priority: "High",
      assignedNode: "192.168.1.1"
    }
  ]);

  // 9. Real-time suspicious activities
  const [suspiciousActivities, setSuspiciousActivities] = useState<SuspiciousActivity[]>([
    {
      id: "act-1",
      timestamp: "07:12:01",
      srcIp: "185.122.204.45",
      destIp: "192.168.1.44",
      protocol: "TCP",
      destPort: "3389",
      type: "Brute Force",
      severity: "critical",
      packetSize: "512 KB",
      reason: "Received 42 invalid RDP handshake requests in 4.5 seconds from hostile foreign host.",
      status: "active"
    },
    {
      id: "act-2",
      timestamp: "07:22:10",
      srcIp: "192.168.1.102",
      destIp: "8.8.8.8",
      protocol: "UDP",
      destPort: "53",
      type: "Unusual Traffic Spike",
      severity: "medium",
      packetSize: "12.4 MB",
      reason: "Unusual continuous DNS query flood from local IoT surveillance node to external hosts.",
      status: "active"
    }
  ]);

  // 10. Intrusion Detection System configuration
  const [idsEnabled, setIdsEnabled] = useState<boolean>(true);
  const [idsThreshold, setIdsThreshold] = useState<number>(75);

  // Dynamic simulation loop for resource fluctuations and warnings
  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Randomly spike a device's CPU/latency to generate real-time alerts
      const onlineDevices = devices.filter(d => d.status === "Online" && d.ip !== "192.168.1.1");
      if (onlineDevices.length > 0 && Math.random() > 0.6) {
        const target = onlineDevices[Math.floor(Math.random() * onlineDevices.length)];
        const isCpuSpike = Math.random() > 0.5;
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        let alertMsg = "";
        let severity: "info" | "warning" | "critical" = "warning";
        
        if (isCpuSpike) {
          const spikedCpu = Math.floor(Math.random() * 20) + 80; // 80 - 100
          alertMsg = `Node ${target.name} CPU spiked unexpectedly to ${spikedCpu}%!`;
          severity = spikedCpu > 90 ? "critical" : "warning";
          
          // Apply to devices list
          setDevices(prev => prev.map(d => d.ip === target.ip ? { ...d, cpu: spikedCpu } : d));
        } else {
          const spikedPing = `${Math.floor(Math.random() * 45) + 30}ms`;
          alertMsg = `Node ${target.name} network ping jitter exceeded SLA standard: ${spikedPing}`;
          severity = "warning";
          
          // Apply to devices list
          setDevices(prev => prev.map(d => d.ip === target.ip ? { ...d, ping: spikedPing } : d));
        }

        const newAlert: SystemAlert = {
          id: `a-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          timestamp: nowStr,
          severity,
          message: alertMsg,
          unread: true,
          deviceIp: target.ip
        };

        setAlerts(prev => [newAlert, ...prev.slice(0, 7)]); // Keep max 8 in history

        // Also append as threat log occasionally
        if (Math.random() > 0.7) {
          const dateStr = new Date().toISOString().slice(0, 10) + " " + nowStr;
          const newThreat: ThreatLog = {
            id: `t-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
            timestamp: dateStr,
            severity: severity === "critical" ? "Critical" : "Warning",
            host: `${target.name} (${target.ip})`,
            message: alertMsg,
            status: "Flagged"
          };
          setThreatLogs(prev => [newThreat, ...prev]);
        }
      }

      // 2. Fluctuate system thread counts & loads
      setProcesses(prev => prev.map(p => {
        if (p.pid === 0) return p; // System idle is managed
        const cpuOffset = Math.floor(Math.random() * 5) - 2; // -2 to +2
        return {
          ...p,
          cpu: Math.max(0.1, Math.min(95, parseFloat((p.cpu + cpuOffset).toFixed(1))))
        };
      }));

      // 3. Simulate IDS Security Anomalies
      if (idsEnabled && Math.random() > 0.4) {
        const anomalies: Array<{
          type: "Port Scan" | "Brute Force" | "Unusual Traffic Spike" | "Potential Intrusion" | "DDoS Pattern";
          severity: "low" | "medium" | "high" | "critical";
          srcIp: string;
          destIp: string;
          protocol: "TCP" | "UDP" | "ICMP" | "HTTP";
          destPort: string;
          packetSize: string;
          reason: string;
        }> = [
          {
            type: "Port Scan",
            severity: "medium",
            srcIp: "198.51.100.12",
            destIp: "192.168.1.15",
            protocol: "TCP",
            destPort: "Multiple",
            packetSize: "4 KB",
            reason: "Sequential SYN scanning across ports 1-1024 from external network."
          },
          {
            type: "DDoS Pattern",
            severity: "critical",
            srcIp: "103.22.41.99",
            destIp: "192.168.1.1",
            protocol: "ICMP",
            destPort: "0",
            packetSize: `${idsThreshold + Math.floor(Math.random() * 30)} MB`,
            reason: "High volume ICMP echo request flood exceeding local threshold limits."
          },
          {
            type: "Potential Intrusion",
            severity: "high",
            srcIp: "192.168.1.102",
            destIp: "192.168.1.22",
            protocol: "HTTP",
            destPort: "80",
            packetSize: "240 KB",
            reason: "Detected Directory Traversal query string in URI parameters on local microserver."
          },
          {
            type: "Unusual Traffic Spike",
            severity: "low",
            srcIp: "192.168.1.15",
            destIp: "172.217.164.110",
            protocol: "TCP",
            destPort: "443",
            packetSize: "4.8 MB",
            reason: "Continuous outbound HTTPS data transmission chunk exceeding standard baseline sizes."
          }
        ];

        const targetAnomaly = anomalies[Math.floor(Math.random() * anomalies.length)];
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const newActivity: SuspiciousActivity = {
          id: `act-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          timestamp: nowStr,
          status: "active",
          ...targetAnomaly
        };

        setSuspiciousActivities(prev => [newActivity, ...prev.slice(0, 9)]);

        // Push a warning to system alerts as well!
        const newAlert: SystemAlert = {
          id: `a-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          timestamp: nowStr,
          severity: targetAnomaly.severity === "critical" || targetAnomaly.severity === "high" ? "critical" : "warning",
          message: `[IDS DETECTED] ${targetAnomaly.type} threat signature flagged from ${targetAnomaly.srcIp}!`,
          unread: true,
          deviceIp: targetAnomaly.destIp
        };
        setAlerts(prev => [newAlert, ...prev.slice(0, 7)]);
      }

    }, 6000);

    return () => clearInterval(interval);
  }, [devices, idsEnabled, idsThreshold]);

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
  const handleEndTask = (pid: number) => {
    const p = processes.find(proc => proc.pid === pid);
    setProcesses(prev => prev.filter(proc => proc.pid !== pid));
    
    // Add terminal line log
    setTerminalLines(prev => [...prev, {
      text: `[INFO] SIGKILL signal sent successfully to PID ${pid} (${p?.name || "UnknownProcess"}).`,
      type: "info",
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const handleSpawnTask = (parentPid?: number) => {
    const newPids = [9012, 4512, 6721, 3144, 8820, 1140];
    const newNames = ["discord_rpc.exe", "msedge_isolated.exe", "npm_watch.exe", "powershell_ssh.exe", "spotify_agent.exe"];
    const publishers = ["Discord Inc.", "Microsoft Corporation", "npm Inc.", "Microsoft Corporation", "Spotify AB"];
    
    const idx = Math.floor(Math.random() * newNames.length);
    const pid = newPids[Math.floor(Math.random() * newPids.length)] + Math.floor(Math.random() * 100);

    const actualParentPid = parentPid !== undefined ? parentPid : 2344; // Default to explorer.exe

    const newProc: Process = {
      pid,
      name: newNames[idx],
      cpu: Math.floor(Math.random() * 15) + 2,
      memory: Math.floor(Math.random() * 250) + 40,
      disk: parseFloat((Math.random() * 1.5).toFixed(1)),
      network: parseFloat((Math.random() * 5).toFixed(1)),
      status: "Running",
      publisher: publishers[idx],
      parentPid: actualParentPid
    };

    setProcesses(prev => [newProc, ...prev]);
    setTerminalLines(prev => [...prev, {
      text: `[INFO] Successfully spawned new process thread: ${newProc.name} (PID ${pid}) under Parent PID ${actualParentPid}.`,
      type: "info",
      timestamp: new Date().toLocaleTimeString()
    }]);
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
    setFirewallRules(prev => [blockRule, ...prev]);

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

  // Security tab rules and controls
  const handleToggleFirewallRule = (id: string) => {
    setFirewallRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    
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

  const handleRunSecurityScan = () => {
    setIsScanning(true);
    setScanResult(null);

    setTimeout(() => {
      setIsScanning(false);
      setScanResult(`[NetGuard Security Shield - System Scan Report]
Timestamp: ${new Date().toLocaleString()}
Scan Mode: Full Host Integrity & Registry Swarm Scan

1. Malware Signature Database Match... Clean
2. Local Executable Memory Signatures... Warn
   -> Anomaly detected on PID 4320 (chrome_isolated.exe socket listener)
   -> Sockets mapped to remote host 172.217.164.110 (Port 443 - HTTPS)
3. Windows Firewall Dynamic Ruleset... Fully armed (12 rules parsed)

Advice: Run 'ai explain how to audit anomalous socket connections' to request step-by-step mitigation advice.`);
      
      // Update score slightly
      setSecurityScore(97);

      // Append scan line to terminal log
      setTerminalLines(prev => [...prev, {
        text: `[INFO] Dynamic Host Security Scan completed. Diagnostic output printed to Security Center panel.`,
        type: "info",
        timestamp: new Date().toLocaleTimeString()
      }]);
    }, 1800);
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
    setFirewallRules(prev => [newRule, ...prev]);
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
            <span>GATEWAY: 192.168.1.1</span>
            <span>•</span>
            <span>Active Clients: {devices.filter(d => d.status === "Online").length} Online</span>
            <span>•</span>
            <span>Core Load: 38%</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex gap-2.5 items-center">
            <div className="text-right">
              <div className="text-[9px] uppercase leading-none opacity-50 font-mono">Host Load</div>
              <div className="text-xs font-mono text-[#bb9af7] font-bold">24.2%</div>
            </div>
            <div className="w-16 h-2 bg-[#1a1b26] rounded-full overflow-hidden border border-[#24283b]">
              <div className="h-full bg-[#7aa2f7]" style={{ width: "24.2%" }}></div>
            </div>
          </div>
          <div className="text-xs font-mono hidden sm:block text-[#565f89] font-semibold">2026-07-07 07:22:20</div>
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
        />

        {/* Right Hand side content window area */}
        <main className="flex-1 bg-[#0b0c0f] overflow-hidden relative">
          
          {activeTab === "dashboard" && (
            <DashboardOverview 
              devices={devices} 
              threatLogs={threatLogs} 
              alerts={alerts} 
              securityScore={securityScore} 
              onClearAlerts={handleClearAlerts} 
              onSelectTab={setActiveTab} 
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

        </main>
      </div>

      {/* Footer System Tray info */}
      <footer className="h-6 bg-[#16161e] border-t border-[#24283b] flex items-center px-4 justify-between text-[10px] font-bold text-[#565f89] uppercase tracking-wider shrink-0 font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#9ece6a] block animate-pulse"></span>
          <span>System Integrity: SECURE</span>
        </div>
        <div className="flex gap-6">
          <span>Ping Latency: 12ms</span>
          <span>Packet Loss: 0.00%</span>
          <span>Threat Level: <span className="text-[#9ece6a]">LOW</span></span>
        </div>
      </footer>
    </div>
  );
}
