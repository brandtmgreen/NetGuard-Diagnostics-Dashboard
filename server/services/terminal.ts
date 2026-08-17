import { run } from "../lib/exec";
import { getGeminiClient } from "../lib/gemini";
import { getStore } from "./store";
import { getBandwidth, getProcesses, getSystemStatus } from "./system";

const HOST_BLOCKLIST = ["", "localhost", "127.0.0.1"];

function safeHostArg(arg: string): string {
  return arg.trim().slice(0, 255);
}

async function runPing(arg: string): Promise<string> {
  const host = safeHostArg(arg);
  if (!host) return "Usage: ping <ip_address_or_host>";
  const res = await run("/sbin/ping", ["-c", "4", "-n", "-W", "3000", host], {
    timeout: 20000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (res.ok) return res.stdout.trim();
  if (res.timedOut) return "[TIMEOUT] Ping command exceeded its time limit. The host may be unreachable or firewalled.";
  return res.stdout.trim() || res.stderr.trim() || `Ping to '${host}' failed.`;
}

async function runTraceroute(arg: string): Promise<string> {
  const host = safeHostArg(arg);
  if (!host) return "Usage: tracert <ip_address_or_host>";
  const res = await run("/usr/sbin/traceroute", ["-n", "-m", "30", "-w", "2", host], {
    timeout: 45000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (res.ok) return res.stdout.trim();
  if (res.timedOut) return "[TIMEOUT] Traceroute exceeded 45s. Partial path shown above is unavailable in one-shot mode.";
  return res.stdout.trim() || res.stderr.trim() || `Traceroute to '${host}' failed.`;
}

async function runNetstat(): Promise<string> {
  const res = await run("/usr/sbin/netstat", ["-an"], {
    timeout: 12000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const output = (res.ok ? res.stdout : res.stderr) || "netstat failed.";
  return "Active Internet Connections (real, from this host)\n\n" + output.trim();
}

async function runTasklist(): Promise<string> {
  const procs = await getProcesses(80);
  const lines = ["Image Name                          PID    PPID    %CPU  %MEM", "=================================  ======  ======  =====  ====="];
  for (const p of procs) {
    const name = p.name.length > 34 ? p.name.slice(-34) : p.name;
    lines.push(
      `${name.padEnd(35)} ${String(p.pid).padStart(6)} ${String(p.ppid).padStart(6)} ${p.cpu.toFixed(1).padStart(5)} ${p.memory.toFixed(0).padStart(5)}`
    );
  }
  lines.push(`\nTotal processes: ${procs.length}`);
  return lines.join("\n");
}

async function runTaskkill(arg: string): Promise<string> {
  const m = arg.match(/\/pid\s+(\d+)/i) || arg.match(/^(\d+)$/);
  if (!m) return "Usage: taskkill /PID <pid_number>";
  const pid = parseInt(m[1], 10);
  if (Number.isNaN(pid) || pid <= 100) {
    return `[SAFETY] Refusing to kill PID ${pid}. NetGuard only permits terminating user processes (PID > 100) to protect the system.`;
  }
  const res = await run("/bin/kill", ["-TERM", String(pid)], { timeout: 5000 });
  if (res.ok) return `SUCCESS: Sent SIGTERM to process with PID ${pid}.`;
  if (res.code === 1 && res.stderr.includes("such process")) return `Error: No process with PID ${pid} exists.`;
  return `Error: Failed to terminate PID ${pid}. ${res.stderr.trim()}`;
}

async function runSecurityScan(): Promise<string> {
  const [listening, netstatRes, procs, status] = await Promise.all([
    run("/usr/sbin/lsof", ["-iTCP", "-sTCP:LISTEN", "-n", "-P"], { timeout: 8000, maxBuffer: 8 * 1024 * 1024 }),
    run("/usr/sbin/netstat", ["-an"], { timeout: 8000, maxBuffer: 8 * 1024 * 1024 }),
    getProcesses(10),
    getSystemStatus(),
  ]);

  const listeningPorts = new Set<string>();
  for (const line of (listening.stdout || "").split("\n")) {
    const m = line.match(/(TCP|UDP)\s+.*:(\d+)\s+\(LISTEN\)/);
    if (m) listeningPorts.add(`${m[1]} ${m[2]}`);
  }

  const established = (netstatRes.stdout.match(/ESTABLISHED/g) || []).length;
  const totalPorts = listeningPorts.size;

  const lines: string[] = [];
  lines.push("[NetGuard Security Shield - Live Local Scan Engine]");
  lines.push(`Scan target: ${status.hostname} (${status.platform} ${status.release})`);
  lines.push(`System load: ${status.loadAvg.map((n) => n.toFixed(2)).join(" / ")}  |  Memory: ${status.usedMemPercent}%`);
  lines.push("");
  lines.push("[1/4] Scanning listening sockets...");
  lines.push(`      Found ${totalPorts} services listening.`);
  for (const p of Array.from(listeningPorts).sort().slice(0, 20)) {
    lines.push(`      - ${p}`);
  }
  if (listeningPorts.has("TCP 445")) lines.push("      WARNING: Port 445 (SMB) is listening on this host.");
  lines.push(`[2/4] Scanning active connections... ${established} established sessions.`);
  lines.push(`[3/4] Scanning process tree... top consumer: ${procs[0]?.name || "none"} at ${procs[0]?.cpu.toFixed(1) || "0"}% CPU.`);
  lines.push("[4/4] Host telemetry: " + (status.usedMemPercent > 85 ? "HIGH MEMORY PRESSURE" : "Nominal."));
  lines.push("");
  lines.push(`Scan complete. Real-time data captured from this machine.`);
  return lines.join("\n");
}

async function runAlertLog(): Promise<string> {
  const { alerts, threatLogs } = getStore();
  const lines: string[] = [];
  for (const a of [...alerts].reverse().slice(0, 40)) {
    lines.push(`[${a.timestamp}] [${a.severity.toUpperCase()}] ${a.message} (${a.deviceIp})`);
  }
  for (const l of [...threatLogs].reverse().slice(0, 40)) {
    lines.push(`[${l.timestamp}] [${l.severity.toUpperCase()}] ${l.message} (${l.host})`);
  }
  if (lines.length === 0) lines.push("Alert log is empty. No security events recorded yet.");
  return lines.join("\n");
}

async function runSystemCommand(cmd: string, args: string[]): Promise<string> {
  const res = await run(cmd, args, { timeout: 10000, maxBuffer: 8 * 1024 * 1024 });
  if (res.ok) return res.stdout.trim();
  return res.stdout.trim() || res.stderr.trim() || `Command '${cmd}' failed.`;
}

async function aiQuery(query: string): Promise<string> {
  const ai = getGeminiClient();
  if (ai) {
    try {
      const prompt = `You are a Windows Cybersecurity & Network Diagnostics command-line advisor integrated into a professional NetGuard console.
The user is querying the terminal with: "${query}".
Provide a concise, detailed technical analysis, insight, or step-by-step advisory.

Strict formatting rules:
1. DO NOT use any Markdown elements whatsoever. NO double-asterisks (**), asterisks (*), hashtags (#), or backticks.
2. Keep the entire response under 6-8 lines of pure monospaced CLI-formatted text.
3. Start directly with the response; do not say "Here is..." or "As an AI...".
4. Format lists with simple dashes or indentations.
5. Emulate an expert system terminal utility output (use terms like [INFO], [WARN], [ADVISORY], or [RECOMMENDED ACTION]).`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      return response.text || "Error: No response generated from AI model.";
    } catch (err: any) {
      console.error("Gemini call failed:", err);
      return `[ERROR] AI Advisor unavailable. Reason: ${err.message || err}\nFalling back to system logs.`;
    }
  }

  const q = query.toLowerCase();
  if (q.includes("port 445") || q.includes("smb")) {
    return `[ADVISORY] SMB v1/v2 Vulnerability Scan (Port 445)\n- Status: Check local listening sockets with 'security-scan'\n- Risk: High (potentially vulnerable to EternalBlue/WannaCry if unpatched)\n- Action Required:\n  1. Block port 445 at firewall boundary\n  2. Disable SMBv1 support on Windows hosts\n  3. Apply security rollups KB4013389 immediately.`;
  }
  if (q.includes("eternalblue") || q.includes("wannacry")) {
    return `[THREAT BRIEF] EternalBlue (MS17-010)\n- Mechanism: Remote Code Execution via buffer overflow in Microsoft SMBv1\n- Recommended Defenses:\n  - Apply patch MS17-010\n  - Implement network segmentation for legacy Windows machines\n  - Deploy endpoint EDR signatures.`;
  }
  return `[INFO] AI Advisor is not configured (set GEMINI_API_KEY in .env).\n- Received query: "${query}"\n- Advisory: Run 'security-scan', 'netstat', and 'ai <question>' after configuring your key for live AI analysis.`;
}

export async function runTerminalCommand(command: string): Promise<string> {
  const trimmed = command.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith("ai ") || lower === "ai") {
    const query = trimmed.substring(3).trim();
    if (!query) {
      return "NetGuard Intelligent Assistant CLI\nUsage: ai <your diagnostic, security, or network question>\nExample: ai explain port 445 vulnerability";
    }
    return aiQuery(query);
  }

  if (lower === "help") {
    return `NetGuard Diagnostic & Security Tools [Version 2.0 - REAL DATA MODE]
(c) 2026 NetGuard Corporation. All rights reserved.

Available Commands:
  help                     Displays this help command glossary.
  ping <ip_or_host>        Pings a target and returns real ICMP results.
  tracert <ip_or_host>     Real multi-hop traceroute to a target.
  netstat                  Live active network sockets on this host.
  tasklist                 Real running processes (ps equivalent).
  taskkill /PID <pid>      Terminates a user process (PID > 100) with SIGTERM.
  security-scan            Live scan of listening sockets + system health.
  alert-log                Security events recorded by NetGuard.
  ifconfig / ipconfig      Real interface configuration.
  whoami | hostname | uptime   Real system identity and uptime.
  ai <question>            Queries the server-side AI Cybersecurity engine.
  cls                      Clears the terminal window screen.`;
  }

  if (lower.startsWith("ping ")) return runPing(trimmed.substring(5));
  if (lower.startsWith("tracert ")) return runTraceroute(trimmed.substring(8));
  if (lower === "traceroute") return runTraceroute("");
  if (lower.startsWith("traceroute ")) return runTraceroute(trimmed.substring(11));
  if (lower === "netstat") return runNetstat();
  if (lower === "tasklist") return runTasklist();
  if (lower.startsWith("taskkill")) return runTaskkill(trimmed.substring(9));
  if (lower === "security-scan") return runSecurityScan();
  if (lower === "alert-log") return runAlertLog();
  if (lower === "ifconfig" || lower === "ipconfig") return runSystemCommand("/usr/sbin/ifconfig", []);
  if (lower === "whoami") return runSystemCommand("/usr/bin/whoami", []);
  if (lower === "hostname") return runSystemCommand("/bin/hostname", []);
  if (lower === "uptime") return runSystemCommand("/usr/bin/uptime", []);
  if (lower === "df" || lower === "df -h") return runSystemCommand("/bin/df", ["-h"]);
  if (lower === "bandwidth") {
    const bw = await getBandwidth(1500);
    return `Live bandwidth on ${bw.interface}: RX ${bw.rxMbps} Mbps | TX ${bw.txMbps} Mbps | Total ${bw.totalMbps} Mbps`;
  }
  if (lower === "sysinfo") {
    const s = await getSystemStatus();
    return [
      `Host:     ${s.hostname}`,
      `Platform: ${s.platform} ${s.release} (${s.arch})`,
      `CPU:      ${s.cpuCount}x ${s.cpuModel}`,
      `Uptime:   ${Math.floor(s.uptime / 3600)}h ${Math.floor((s.uptime % 3600) / 60)}m`,
      `Load:     ${s.loadAvg.map((n) => n.toFixed(2)).join(" / ")}`,
      `Memory:   ${s.usedMemPercent}% used`,
      `Disk:     ${s.diskUsedPercent}% used`,
    ].join("\n");
  }

  if (HOST_BLOCKLIST.includes(lower)) {
    return `'${trimmed}' is not recognized as an internal or external command, operable program or batch file.\nType 'help' to see available diagnostics utilities.`;
  }

  return `'${trimmed}' is not recognized as an internal or external command, operable program or batch file.\nType 'help' to see available diagnostics utilities, or 'ai <question>' to query the assistant.`;
}
