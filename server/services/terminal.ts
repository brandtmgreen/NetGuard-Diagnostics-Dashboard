import { exec } from "child_process";
import { run } from "../lib/exec";
import { getGeminiClient, callGeminiWithRetry } from "../lib/gemini";
import { getStore } from "./store";
import { getBandwidth, getProcesses, getSystemStatus } from "./system";
import { runLynisEquivalentAudit } from "./lynisAudit";

const HOST_BLOCKLIST = ["", "localhost", "127.0.0.1"];

function safeHostArg(arg: string): string {
  return arg.trim().slice(0, 255);
}

async function runPing(arg: string): Promise<string> {
  const host = safeHostArg(arg);
  if (!host) return "Usage: ping <ip_address_or_host>";
  const res = await run("ping", ["-c", "4", "-n", "-W", "3000", host], {
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
  const res = await run("tracert", ["-n", "-m", "30", "-w", "2", host], {
    timeout: 45000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (res.ok) return res.stdout.trim();
  if (res.timedOut) return "[TIMEOUT] Traceroute exceeded 45s. Partial path shown above is unavailable in one-shot mode.";
  return res.stdout.trim() || res.stderr.trim() || `Traceroute to '${host}' failed.`;
}

async function runNetstat(): Promise<string> {
  const res = await run("netstat", ["-an"], {
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
  const res = await run("kill", ["-TERM", String(pid)], { timeout: 5000 });
  if (res.ok) return `SUCCESS: Sent SIGTERM to process with PID ${pid}.`;
  if (res.code === 1 && res.stderr.includes("such process")) return `Error: No process with PID ${pid} exists.`;
  return `Error: Failed to terminate PID ${pid}. ${res.stderr.trim()}`;
}

async function runSecurityScan(): Promise<string> {
  const [listening, netstatRes, procs, status] = await Promise.all([
    run("lsof", ["-iTCP", "-sTCP:LISTEN", "-n", "-P"], { timeout: 8000, maxBuffer: 8 * 1024 * 1024 }),
    run("netstat", ["-an"], { timeout: 8000, maxBuffer: 8 * 1024 * 1024 }),
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
  if (!ai) {
    return `[ERROR] Live AI Advisor unavailable: GEMINI_API_KEY is not configured in Settings > Secrets.`;
  }

  const status = await getSystemStatus();
  const prompt = `You are a Windows Cybersecurity & Network Diagnostics command-line advisor integrated into a professional NetGuard console.
Host context: ${status.hostname} (${status.platform} ${status.release}, CPU cores: ${status.cpuCount}, Memory used: ${status.usedMemPercent}%).
The user is querying the terminal with: "${query}".
Provide a concise, detailed technical analysis, insight, or step-by-step advisory.

Strict formatting rules:
1. DO NOT use any Markdown elements whatsoever. NO double-asterisks (**), asterisks (*), hashtags (#), or backticks.
2. Keep the entire response under 6-8 lines of pure monospaced CLI-formatted text.
3. Start directly with the response; do not say "Here is..." or "As an AI...".
4. Format lists with simple dashes or indentations.
5. Emulate an expert system terminal utility output (use terms like [INFO], [WARN], [ADVISORY], or [RECOMMENDED ACTION]).`;

  const res = await callGeminiWithRetry({ prompt, useSearch: true });
  if (res.text) {
    return res.text;
  }
  if (res.quotaExhausted) {
    return `[ADVISORY] Gemini API free-tier quota (429 RESOURCE_EXHAUSTED) has been reached.\n[RECOMMENDED ACTION] Upgrading to a paid tier increases your quota. You can select a billing-enabled API key in the Settings > Secrets panel.\n[HOST TELEMETRY] ${status.hostname} (${status.platform} ${status.release}) | CPU Cores: ${status.cpuCount} | Memory Used: ${status.usedMemPercent}% | Disk Used: ${status.diskUsedPercent}%`;
  }
  return `[WARN] AI Advisor unavailable: ${res.errorMessage || "No response returned"}`;
}

async function executeRawShell(commandText: string): Promise<string> {
  const isWin = process.platform === "win32";
  const trimmed = commandText.trim();
  if (!trimmed) return "";

  if (isWin) {
    return new Promise((resolve) => {
      // Execute through PowerShell to support both Windows commands and bash aliases
      exec(trimmed, {
        shell: "powershell.exe",
        timeout: 30000,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      }, (err, stdout, stderr) => {
        const out = stdout ? stdout.trim() : "";
        const errOut = stderr ? stderr.trim() : "";
        if (err && !out && !errOut) {
          resolve(`[ERROR] Command execution failed: ${err.message}`);
          return;
        }
        resolve(out || errOut || `[Process completed with exit code ${err?.code ?? 0}]`);
      });
    });
  } else {
    // Non-Windows environment: map common Windows commands to bash equivalents if needed
    let cmdToRun = trimmed;
    const lower = trimmed.toLowerCase();
    if (lower === "dir" || lower.startsWith("dir ")) {
      cmdToRun = trimmed.replace(/^dir\b/i, "ls -la");
    } else if (lower === "ipconfig" || lower.startsWith("ipconfig ")) {
      cmdToRun = "ip -brief addr 2>/dev/null || ifconfig";
    } else if (lower === "tasklist" || lower.startsWith("tasklist ")) {
      cmdToRun = "ps -axo pid,ppid,%cpu,%mem,comm";
    } else if (lower === "systeminfo") {
      cmdToRun = "uname -a && cat /etc/os-release 2>/dev/null || true";
    } else if (lower === "ver") {
      cmdToRun = "uname -srm";
    } else if (lower.startsWith("findstr ")) {
      cmdToRun = trimmed.replace(/^findstr\b/i, "grep");
    } else if (lower.startsWith("type ")) {
      cmdToRun = trimmed.replace(/^type\b/i, "cat");
    }

    return new Promise((resolve) => {
      exec(cmdToRun, {
        shell: "/bin/bash",
        timeout: 30000,
        maxBuffer: 16 * 1024 * 1024,
      }, (err, stdout, stderr) => {
        const out = stdout ? stdout.trim() : "";
        const errOut = stderr ? stderr.trim() : "";
        if (err && !out && !errOut) {
          resolve(`[ERROR] ${err.message}`);
          return;
        }
        resolve(out || errOut || `[Process completed with exit code ${err?.code ?? 0}]`);
      });
    });
  }
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
    return `NetGuard Hybrid Terminal Suite [Windows PowerShell / CMD / Bash Console]
(c) 2026 NetGuard Corporation. All rights reserved.

FULL SHELL PASS-THROUGH ACTIVE:
  All Windows commands and Bash shell commands execute directly on the host machine.

Special Built-in Diagnostic Routines:
  lynis                    Run Lynis-equivalent system hardening & compliance audit.
  security-scan            Live scan of listening sockets, memory, and attack surfaces.
  alert-log                Security events & alerts recorded by NetGuard.
  bandwidth                Live real-time adapter throughput meter.
  sysinfo                  Formatted host hardware & kernel diagnostics.
  ai <question>            Consult the built-in Gemini Security Advisory Engine.
  cls / clear              Clears the console viewport.

Supported Commands (Examples):
  Windows:  dir, ipconfig, netstat -ano, tasklist, taskkill, systeminfo, netsh, tracert, ping, whoami, tree, reg, get-process
  Bash:     ls -la, ifconfig, ps aux, pwd, cat, grep, curl, uname -a, free, df -h, head, tail, echo, which`;
  }

  // NetGuard built-ins
  if (lower === "lynis" || lower === "lynis audit system") {
    const rep = await runLynisEquivalentAudit(false);
    const outLines: string[] = [
      `[Lynis System Hardening & Compliance Audit - Host: ${rep.hostname} (${rep.kernelVersion})]`,
      `Hardening Index : ${rep.hardeningIndex}/100  (${rep.okCount} OK | ${rep.suggestionCount} Suggestions | ${rep.warningCount} Warnings | ${rep.criticalCount} Critical)`,
      `========================================================================================`,
    ];
    for (const c of rep.checks) {
      outLines.push(`[${c.status.padEnd(10)}] ${c.id.padEnd(10)} ${c.title}`);
      outLines.push(`             Current: ${c.currentValue} | Target: ${c.expectedValue}`);
      outLines.push(`             Summary: ${c.humanExplanation}`);
      if (c.remediationCommand) {
        outLines.push(`             Remediate (Requires Permission in Lynis Auditor tab): ${c.remediationCommand}`);
      }
    }
    return outLines.join("\n");
  }
  if (lower === "security-scan") return runSecurityScan();
  if (lower === "alert-log") return runAlertLog();
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

  // Execute ANY native Windows shell or Bash command directly
  return executeRawShell(trimmed);
}
