import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini client to avoid crashes if the key is missing on startup
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("GEMINI_API_KEY is missing. AI commands will fall back to simulated expert answers.");
      return null;
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Simulated network devices & state
const simulatedDevices = [
  { ip: "192.168.1.1", name: "CoreRouter-RTX", type: "Router", status: "Online", ping: "1ms", cpu: 14, memory: 32 },
  { ip: "192.168.1.15", name: "Win11-Workstation", type: "Windows", status: "Online", ping: "12ms", cpu: 45, memory: 58 },
  { ip: "192.168.1.22", name: "Ubuntu-MicroServer", type: "Linux", status: "Online", ping: "8ms", cpu: 12, memory: 40 },
  { ip: "192.168.1.44", name: "WinServer-AD01", type: "Windows", status: "Online", ping: "15ms", cpu: 82, memory: 88 },
  { ip: "192.168.1.102", name: "IoT-SecCamera01", type: "IoT", status: "Online", ping: "25ms", cpu: 5, memory: 18 },
  { ip: "192.168.1.120", name: "MacBook-Pro-CEO", type: "Mac", status: "Offline", ping: "---", cpu: 0, memory: 0 }
];

// API endpoint for terminal commands (Standard + AI analysis)
app.post("/api/terminal/run", async (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ output: "Error: No command specified." });
  }

  const trimmed = command.trim();
  const lower = trimmed.toLowerCase();

  // Helper for generating simulated device-specific diagnostics
  const getDeviceIP = (arg: string) => {
    const matched = simulatedDevices.find(d => d.ip === arg || d.name.toLowerCase() === arg.toLowerCase());
    return matched ? matched.ip : arg;
  };

  // 1. Check if AI command
  if (lower.startsWith("ai ") || lower === "ai") {
    const query = trimmed.substring(3).trim();
    if (!query) {
      return res.json({
        output: "NetGuard Intelligent Assistant CLI\nUsage: ai <your diagnostic, security, or network question>\nExample: ai explain port 445 vulnerability"
      });
    }

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

        const outputText = response.text || "Error: No response generated from AI model.";
        return res.json({ output: outputText });
      } catch (err: any) {
        console.error("Gemini call failed:", err);
        return res.json({
          output: `[ERROR] AI Advisor unavailable. Reason: ${err.message || err}\nFalling back to system logs.`
        });
      }
    } else {
      // Fallback response generator if Gemini key is missing
      const queryLower = query.toLowerCase();
      let fallbackText = "";
      if (queryLower.includes("port 445") || queryLower.includes("smb")) {
        fallbackText = `[ADVISORY] SMB v1/v2 Vulnerability Scan (Port 445)\n- Status: EXPOSED on 192.168.1.44\n- Risk: High (Potentially vulnerable to EternalBlue/WannaCry if unpatched)\n- Action Required:\n  1. Block port 445 at firewall boundary\n  2. Disable SMBv1 feature via PowerShell:\n     Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol\n  3. Install security rollups KB4013389 immediately.`;
      } else if (queryLower.includes("eternalblue") || queryLower.includes("wannacry")) {
        fallbackText = `[THREAT BRIEF] EternalBlue (MS17-010)\n- Mechanism: Remote Code Execution via buffer overflow in Microsoft Server Message Block 1.0 (SMBv1)\n- Current Status: Controlled\n- Recommended Defenses:\n  - Apply patch MS17-010\n  - Implement network segmentation for legacy Windows machines\n  - Deploy endpoint EDR signatures.`;
      } else if (queryLower.includes("unusual connection") || queryLower.includes("pid 3444")) {
        fallbackText = `[ANALYSIS] Security anomaly detected on LocalHost PID 3444\n- Host: Win11-Workstation\n- Socket: Local 192.168.1.15:51221 -> Remote 172.217.164.110:443 (HTTPS)\n- Verdict: High probability of background browser telemetry or Google services.\n- Suggested Audit:\n  - Run 'tasklist' to check parent processes\n  - Check file hash: C:\\Windows\\System32\\svchost.exe\n  - Scan memory space with 'security-scan'`;
      } else {
        fallbackText = `[INFO] Simulated AI Advisor (GEMINI_API_KEY is not configured)\n- Received query: "${query}"\n- Advisory: Verify connection endpoints, inspect system logfiles, and run security audits.\n- Tip: Set up your GEMINI_API_KEY in the Secrets panel to activate the advanced Live AI analyst.`;
      }
      return res.json({ output: fallbackText });
    }
  }

  // 2. Standard mock CMD / PowerShell commands
  if (lower === "help") {
    const helpOutput = `NetGuard Diagnostic & Security Tools [Version 1.0.4]
(c) 2026 NetGuard Corporation. All rights reserved.

Available Commands:
  help                     Displays this help command glossary.
  ping <ip_or_host>        Pings a connected local network device.
  tracert <ip_or_host>     Traces the hops to a connected local device.
  netstat                  Displays active network socket connections on this host.
  tasklist                 Lists active processes and memory footprints.
  taskkill /PID <pid>      Kills a process with the specified Process ID (PID).
  security-scan            Initiates a quick local host vulnerability and file scanner.
  alert-log                Prints the active security and system event logger.
  ai <question>            Queries the server-side AI Cybersecurity & Diagnostics engine.
  cls                      Clears the terminal window screen.`;
    return res.json({ output: helpOutput });
  }

  if (lower.startsWith("ping ")) {
    const arg = trimmed.substring(5).trim();
    if (!arg) {
      return res.json({ output: "Usage: ping <ip_address_or_host>" });
    }
    const ip = getDeviceIP(arg);
    const device = simulatedDevices.find(d => d.ip === ip);
    const ms = device && device.status === "Online" ? device.ping : null;

    if (ms) {
      const pingOutput = `Pinging ${device.name} [${ip}] with 32 bytes of data:
Reply from ${ip}: bytes=32 time=${ms} TTL=128
Reply from ${ip}: bytes=32 time=${parseInt(ms) + 2}ms TTL=128
Reply from ${ip}: bytes=32 time=${Math.max(1, parseInt(ms) - 3)}ms TTL=128
Reply from ${ip}: bytes=32 time=${parseInt(ms) + 1}ms TTL=128

Ping statistics for ${ip}:
    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),
Approximate round trip times in milli-seconds:
    Minimum = ${Math.max(1, parseInt(ms) - 3)}ms, Maximum = ${parseInt(ms) + 2}ms, Average = ${parseInt(ms)}ms`;
      return res.json({ output: pingOutput });
    } else {
      const pingFailed = `Pinging ${arg} [${ip}] with 32 bytes of data:
Request timed out.
Request timed out.
Request timed out.
Request timed out.

Ping statistics for ${ip}:
    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)`;
      return res.json({ output: pingFailed });
    }
  }

  if (lower.startsWith("tracert ")) {
    const arg = trimmed.substring(8).trim();
    if (!arg) {
      return res.json({ output: "Usage: tracert <ip_address_or_host>" });
    }
    const ip = getDeviceIP(arg);
    const device = simulatedDevices.find(d => d.ip === ip);

    if (device && device.status === "Online") {
      const traceOutput = `Tracing route to ${device.name} [${ip}] over a maximum of 30 hops:

  1    <1 ms    <1 ms    <1 ms  192.168.1.1 (Gateway)
  2     2 ms     1 ms     2 ms  192.168.1.10
  3    ${device.ping}    ${parseInt(device.ping) - 1}ms    ${parseInt(device.ping) + 1}ms  ${ip}

Trace complete.`;
      return res.json({ output: traceOutput });
    } else {
      const traceFailed = `Tracing route to ${arg} [${ip}] over a maximum of 30 hops:

  1    <1 ms    <1 ms    <1 ms  192.168.1.1 (Gateway)
  2     *        *        *     Request timed out.
  3     *        *        *     Request timed out.
  4     *        *        *     Destination host unreachable.

Trace complete.`;
      return res.json({ output: traceFailed });
    }
  }

  if (lower === "netstat") {
    const netstatOutput = `Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       904
  TCP    0.0.0.0:445            0.0.0.0:0              LISTENING       4
  TCP    192.168.1.15:51221     172.217.164.110:443    ESTABLISHED     3444
  TCP    192.168.1.15:51222     13.107.4.52:443        ESTABLISHED     8212
  TCP    192.168.1.15:51405     192.168.1.44:445       ESTABLISHED     2120
  UDP    0.0.0.0:5353           *:*                                    312`;
    return res.json({ output: netstatOutput });
  }

  if (lower === "tasklist") {
    const tasklistOutput = `Image Name                     PID Session Name        Session#    Mem Usage
========================= ======== ================ =========== ============
System Idle Process              0 Services                   0          8 K
System                           4 Services                   0        124 K
smss.exe                       312 Services                   0        432 K
csrss.exe                      512 Services                   0      2,120 K
wininit.exe                    588 Services                   0      1,440 K
services.exe                   664 Services                   0      8,452 K
lsass.exe                      680 Services                   0     12,140 K
svchost.exe                    812 Services                   0     34,512 K
explorer.exe                  2344 Console                    1    112,412 K
chrome.exe                    4320 Console                    1    245,120 K
NetGuardAgent.exe             7812 Console                    1     45,210 K`;
    return res.json({ output: tasklistOutput });
  }

  if (lower.startsWith("taskkill ")) {
    const arg = trimmed.substring(9).trim();
    if (!arg) {
      return res.json({ output: "Usage: taskkill /PID <pid_number>" });
    }
    const pidMatch = arg.match(/\/pid\s+(\d+)/i) || arg.match(/(\d+)/);
    if (!pidMatch) {
      return res.json({ output: "Error: Invalid process or syntax. Use 'taskkill /PID <pid_number>'." });
    }
    const pid = pidMatch[1];
    return res.json({ output: `SUCCESS: Sent termination signal to process with PID ${pid}.` });
  }

  if (lower === "security-scan") {
    const scanOutput = `[NetGuard Security Shield - Core Scan Engine]
Version: 4.8.12-WS
Database signatures: 2026-07-07-v12

[1/4] Scanning registry hives... Clean
[2/4] Scanning system memory threads... Clean
[3/4] Scanning active network connection sockets...
      WARNING: Unusual outbound connection detected on PID 3444 (Unknown Executable)
[4/4] Scanning Windows Defender alert status... Enabled

Scan complete. 1 warning found.
Type 'ai analyze anomaly pid 3444' for suggestions on dealing with this socket.`;
    return res.json({ output: scanOutput });
  }

  if (lower === "alert-log") {
    const alertOutput = `[2026-07-07 07:10:12] [WARN] Host WinServer-AD01 (192.168.1.44) CPU load spike: 82%
[2026-07-07 07:11:45] [INFO] Firewall rule successfully re-applied: Block WAN Inbound RDP
[2026-07-07 07:12:01] [CRIT] Intrusion Prevention System: Blocked brute-force attempt from IP 203.0.113.82 on Port 3389
[2026-07-07 07:15:30] [INFO] Anti-Virus engine signature update completed.
[2026-07-07 07:20:02] [WARN] IoT Device IoT-SecCamera01 (192.168.1.102) ping response jitter exceeded 25ms`;
    return res.json({ output: alertOutput });
  }

  // Unrecognized command
  return res.json({
    output: `'${trimmed}' is not recognized as an internal or external command, operable program or batch file.\nType 'help' to see available diagnostics utilities, or 'ai <question>' to query the assistant.`
  });
});

// Mock database for threat reports
const threatReports: any[] = [
  {
    id: "rep-101",
    title: "Unauthorized SMB Port 445 Exposure on WinServer-AD01",
    timestamp: "2026-07-07 07:22:15",
    sourceThreat: "MS17-010 Vulnerability Scan",
    severity: "high",
    status: "exported",
    executiveSummary: "An NMAP vulnerability scan identified that Port 445 (SMB) on WinServer-AD01 (192.168.1.44) is actively listening and running a deprecated SMBv1 protocol configuration. This configuration is highly susceptible to remote code execution vulnerability exploits such as EternalBlue.",
    attackVector: "Internal Network SMBv1 Remote Code Execution (MS17-010)",
    auditedDataPoints: ["NMAP TCP Port Scan", "Host Telemetry Registry Check", "Active Connection Socket Map"],
    findings: [
      "TCP Port 445 is OPEN on 192.168.1.44",
      "SMBv1 dialect is negotiated with anonymous access enabled",
      "No security endpoints are blocking remote pipe traversal over IPC$"
    ],
    mitigations: [
      { action: "Block Port 445 Inbound", status: "completed", type: "firewall", details: "Created inbound block rule in NetGuard Firewall Manager." },
      { action: "Disable SMBv1 Support", status: "pending", type: "remediation", details: "Run PowerShell cmdlet to disable the SMB1Protocol optional feature." },
      { action: "Apply KB4013389 MS17-010 security patches", status: "pending", type: "remediation", details: "Queue system update cycle on node." }
    ],
    exportedTo: ["SIEM Dashboard", "Windows Domain Admin Console"]
  }
];

// Helper to generate NMAP simulated output based on IP and scan profile
function generateSimulatedNmap(target: string, profile: string) {
  const dateStr = new Date().toUTCString();
  let rawOutput = `Starting Nmap 7.92 ( https://nmap.org ) at ${dateStr}\n`;
  rawOutput += `Nmap scan report for ${target}\n`;
  rawOutput += `Host is up (0.0042s latency).\n`;
  rawOutput += `Not shown: 994 closed tcp ports (reset)\n`;
  rawOutput += `PORT     STATE    SERVICE       VERSION\n`;

  const ports: any[] = [];
  let osInfo = { osFamily: "Unknown", osGen: "Unknown", accuracy: 50 };

  if (target === "192.168.1.1" || target.includes("router")) {
    ports.push({ port: 22, protocol: "tcp", state: "open", service: "ssh", version: "OpenSSH 8.2p1 Ubuntu 4ubuntu0.5", vulnerability: "None found in standard databases", severity: "info" });
    ports.push({ port: 53, protocol: "tcp", state: "open", service: "domain", version: "dnsmasq 2.80", vulnerability: "None", severity: "info" });
    ports.push({ port: 80, protocol: "tcp", state: "open", service: "http", version: "uHTTPd administrative console", vulnerability: "Cleartext login supported over HTTP", severity: "medium" });
    ports.push({ port: 443, protocol: "tcp", state: "open", service: "https", version: "uHTTPd HTTPS administrative console", vulnerability: "TLS 1.1 enabled (Legacy cipher suites)", severity: "low" });
    rawOutput += `22/tcp   open     ssh           OpenSSH 8.2p1 Ubuntu 4ubuntu0.5\n`;
    rawOutput += `53/tcp   open     domain        dnsmasq 2.80\n`;
    rawOutput += `80/tcp   open     http          uHTTPd admin console\n`;
    rawOutput += `443/tcp  open     https         uHTTPd secure admin console\n`;
    osInfo = { osFamily: "Linux / OpenWrt", osGen: "19.x", accuracy: 96 };
  } else if (target === "192.168.1.44" || target.includes("AD01") || target.includes(".44")) {
    ports.push({ port: 53, protocol: "tcp", state: "open", service: "domain", version: "Microsoft DNS Service 10.0.17763", vulnerability: "None", severity: "info" });
    ports.push({ port: 135, protocol: "tcp", state: "open", service: "msrpc", version: "Microsoft Windows RPC", vulnerability: "None", severity: "info" });
    ports.push({ port: 445, protocol: "tcp", state: "open", service: "microsoft-ds", version: "Windows Server 2016 SMBv1/v2", vulnerability: "Vulnerable to MS17-010 (EternalBlue) Remote Code Execution", severity: "critical" });
    ports.push({ port: 3389, protocol: "tcp", state: "open", service: "ms-wbt-server", version: "Microsoft Terminal Services RDP", vulnerability: "Weak session encryption negotiation enabled", severity: "medium" });
    rawOutput += `53/tcp   open     domain        Microsoft DNS Service\n`;
    rawOutput += `135/tcp  open     msrpc         Microsoft Windows RPC\n`;
    rawOutput += `445/tcp  open     microsoft-ds  Windows Server SMBv1/v2 (MS17-010 Vulnerable!)\n`;
    rawOutput += `3389/tcp open     ms-wbt-server Microsoft Terminal Services RDP\n`;
    osInfo = { osFamily: "Windows Server", osGen: "2016 / 2019", accuracy: 98 };
  } else if (target === "192.168.1.15" || target.includes(".15")) {
    ports.push({ port: 135, protocol: "tcp", state: "open", service: "msrpc", version: "Microsoft Windows RPC", vulnerability: "None", severity: "info" });
    ports.push({ port: 445, protocol: "tcp", state: "filtered", service: "microsoft-ds", version: "Windows 11 SMB", vulnerability: "None", severity: "info" });
    ports.push({ port: 8080, protocol: "tcp", state: "open", service: "http-proxy", version: "NodeJS HTTP Mock Broker", vulnerability: "Exposed local dev microservice gateway", severity: "medium" });
    rawOutput += `135/tcp  open     msrpc         Microsoft Windows RPC\n`;
    rawOutput += `445/tcp  filtered microsoft-ds  Windows 11 SMB\n`;
    rawOutput += `8080/tcp open     http-proxy    NodeJS HTTP Mock Broker\n`;
    osInfo = { osFamily: "Windows", osGen: "11 (Build 22621)", accuracy: 95 };
  } else if (target === "192.168.1.102" || target.includes("Camera") || target.includes(".102")) {
    ports.push({ port: 23, protocol: "tcp", state: "open", service: "telnet", version: "BusyBox telnetd 1.22.1", vulnerability: "Cleartext credentials sent over Telnet protocol", severity: "high" });
    ports.push({ port: 80, protocol: "tcp", state: "open", service: "http", version: "GoAhead Web Server", vulnerability: "Exposed web management interface with default credentials admin/admin", severity: "critical" });
    ports.push({ port: 554, protocol: "tcp", state: "open", service: "rtsp", version: "Live555 RTSP Streaming Server", vulnerability: "Unauthenticated video feed access bypass", severity: "high" });
    rawOutput += `23/tcp   open     telnet        BusyBox telnetd 1.22.1 (Exposed Credential Vulnerability!)\n`;
    rawOutput += `80/tcp   open     http          GoAhead Web Server (Exposed Admin Portal!)\n`;
    rawOutput += `554/tcp  open     rtsp          Live555 RTSP Streaming Server\n`;
    osInfo = { osFamily: "Embedded Linux", osGen: "BusyBox IoT Core", accuracy: 99 };
  } else {
    // Default generic host scan
    ports.push({ port: 22, protocol: "tcp", state: "open", service: "ssh", version: "OpenSSH 8.9p1", vulnerability: "None", severity: "info" });
    ports.push({ port: 80, protocol: "tcp", state: "closed", service: "http", version: "Apache httpd", vulnerability: "None", severity: "info" });
    ports.push({ port: 443, protocol: "tcp", state: "open", service: "https", version: "nginx 1.18.0", vulnerability: "None", severity: "info" });
    rawOutput += `22/tcp   open     ssh           OpenSSH 8.9p1\n`;
    rawOutput += `80/tcp   closed   http          Apache httpd\n`;
    rawOutput += `443/tcp  open     https         nginx 1.18.0\n`;
    osInfo = { osFamily: "Generic Linux", osGen: "Ubuntu / Debian", accuracy: 82 };
  }

  if (profile === "os") {
    rawOutput += `\nDevice Security Fingerprint:\n`;
    rawOutput += `OS Match: ${osInfo.osFamily} running version ${osInfo.osGen} (${osInfo.accuracy}% confidence)\n`;
    rawOutput += `Network Distance: 1 hop (Direct LAN attachment)\n`;
  }

  if (profile === "vuln") {
    rawOutput += `\nNmap Vulnerability Engine Scan Findings:\n`;
    ports.forEach(p => {
      if (p.severity && p.severity !== "info") {
        rawOutput += `|  vuln-finding on Port ${p.port}:\n`;
        rawOutput += `|    Threat Level: [${p.severity.toUpperCase()}]\n`;
        rawOutput += `|    Issue: ${p.vulnerability}\n`;
        rawOutput += `|_   Recommendation: Ensure latest package upgrades, limit local access lists, enforce SSL/TLS.\n`;
      }
    });
  }

  rawOutput += `\nNmap done: 1 IP address (1 host up) scanned in 0.54 seconds\n`;

  return { ports, osInfo, rawOutput };
}

// Generate high-fidelity Wireshark packets based on filter
function generateCapturedPackets(filterStr: string, count: number = 20): any[] {
  const filter = (filterStr || "").toLowerCase().trim();
  const baseTime = Date.now();
  const packets: any[] = [];

  const protocols: ("TCP" | "UDP" | "ICMP" | "DNS" | "HTTP" | "SMB" | "TLS")[] = ["TCP", "UDP", "ICMP", "DNS", "HTTP", "SMB", "TLS"];

  for (let i = 1; i <= count; i++) {
    const timeOffset = i * 240; // 240ms between packets
    const timestampStr = new Date(baseTime + timeOffset).toISOString().split("T")[1].replace("Z", "");
    
    let source = "192.168.1.15";
    let destination = "192.168.1.44";
    let proto: "TCP" | "UDP" | "ICMP" | "DNS" | "HTTP" | "SMB" | "TLS" = "TCP";
    let len = 64;
    let info = "";
    let hexDump = "";
    let asciiDump = "";
    let severity: "normal" | "warning" | "critical" = "normal";
    let payload: any = {};

    // Generate specific malicious or interesting packets based on filter matching
    if (filter.includes("445") || filter.includes("smb") || (!filter && i % 4 === 0)) {
      proto = "SMB";
      len = 142;
      destination = "192.168.1.44";
      source = "192.168.1.15";
      const smbTrans = i * 11 + 204;
      info = `Negotiate Protocol Request [MID=${smbTrans}]`;
      severity = "normal";

      if (i % 8 === 0) {
        info = `Session Setup Request - IPC$ Anonymous Connection Bypass Attempt`;
        severity = "warning";
        len = 256;
        hexDump = "00 00 00 9c ff 53 4d 42  73 00 00 00 00 08 01 c0\n00 00 00 00 00 00 00 00  00 00 00 00 00 00 c8 1e\n02 00 c8 1e 0d 0d 00 c8  00 00 01 00 00 00 00 00\n00 00 49 50 43 24 00 00  4e 54 20 4c 4d 20 30 2e";
        asciiDump = "....SMBs........\n................\n................\n..IPC$..NT LM 0.";
        payload = { smbCommand: "Session Setup", securityMode: "Anonymous", sharePath: "\\\\192.168.1.44\\IPC$" };
      } else if (i % 12 === 0) {
        info = `CRITICAL: Exploitation Payload SMB Transaction Trans2 MS17-010 Buffer Overflow Threat`;
        severity = "critical";
        len = 1024;
        hexDump = "00 00 04 00 ff 53 4d 42  32 00 00 00 00 08 01 c0\n90 90 90 90 90 90 90 90  90 90 90 90 90 90 c8 1e\n02 00 c8 1e 0d 0d 00 c8  90 90 90 90 90 90 90 90\ncc cc cc cc e8 22 00 00  00 4a 43 4a 43 4a 43 4a";
        asciiDump = ".....SMB2.......\n................\n................\n.....\"...JCJCJCJ";
        payload = { smbCommand: "Trans2 Request", bufferOverflow: "Detected", exploitSignature: "MS17-010.EternalBlue", action: "Flagged by IDS" };
      } else {
        hexDump = "00 00 00 54 ff 53 4d 42  72 00 00 00 00 18 01 c0\n00 00 00 00 00 00 00 00  00 00 00 00 00 00 c8 1e\n01 00 c8 1e 0c 00 02 00  01 00 03 00 00 00 00 00";
        asciiDump = "...SMr..........\n................\n................";
        payload = { smbCommand: "Negotiate Protocol", dialect: "NT LM 0.12" };
      }
    } else if (filter.includes("telnet") || filter.includes("23") || (!filter && i % 5 === 0)) {
      proto = "TCP";
      len = 60;
      source = "192.168.1.15";
      destination = "192.168.1.102";
      info = `Telnet Data: User typing character 'a' [Port 23]`;
      severity = "normal";

      if (i % 10 === 0) {
        len = 94;
        info = `Telnet Cleartext Credentials Intercepted: Login 'admin' Pass 'admin123'`;
        severity = "critical";
        hexDump = "4c 6f 67 69 6e 3a 20 61  64 6d 69 6e 0d 0a 50 61\n73 73 77 6f 72 64 3a 20  61 64 6d 69 6e 31 32 33\n0d 0a 41 63 63 65 73 73  20 47 72 61 6e 74 65 64\n3a 20 42 75 73 79 42 6f  78 20 53 68 65 6c 6c 20";
        asciiDump = "Login: admin..Pa\nssword: admin123\n..Access Granted\n: BusyBox Shell ";
        payload = { shellType: "BusyBox 1.22.1", authenticatedUser: "admin", transportEncryption: "None" };
      } else {
        hexDump = "45 00 00 3c 1a b2 40 00  40 06 b2 a1 c0 a8 01 0f\nc0 a8 01 66 0c 81 00 17  8a b2 12 c1 32 44 a1 02\n50 18 10 00 ad e2 00 00  61";
        asciiDump = "E..<..@.@.......\n...f........2D..\nP.......a";
        payload = { port: 23, characterSent: "a" };
      }
    } else if (filter.includes("dns") || filter.includes("udp") || (!filter && i % 6 === 0)) {
      proto = "DNS";
      len = 78;
      source = "192.168.1.15";
      destination = "192.168.1.1";
      const queryId = 0x2e42 + i;
      info = `Standard Query 0x${queryId.toString(16)} A update-services.domain.local`;
      payload = { queryId: `0x${queryId.toString(16)}`, recordType: "A", hostname: "update-services.domain.local" };
      
      if (i % 12 === 0) {
        destination = "203.0.113.82"; // Malicious outer node
        info = `SUSPICIOUS DNS Query 0x${queryId.toString(16)} TXT maldoc-payload-chunk-812.securitydns.su`;
        severity = "warning";
        len = 134;
        hexDump = "00 0d 3a e2 f3 b2 a1 c0  08 00 45 00 00 7c a2 b2\n00 00 40 11 e2 15 c0 a8  01 0f cb 00 71 52 00 35\n00 35 00 68 2e 42 01 00  00 01 00 00 00 00 00 00\n07 6d 61 6c 64 6f 63 2d  70 61 79 6c 6f 61 64 2d";
        asciiDump = "..:.......E..|..\n..@.........qR.5\n.5.h.B..........\n.maldoc-payload-";
        payload = { queryId: `0x${queryId.toString(16)}`, recordType: "TXT", maliciousHostname: "maldoc-payload-chunk-812.securitydns.su", alertReason: "Potential DNS Tunneling / Exfiltration" };
      } else {
        hexDump = "00 0d 3a e2 f3 b2 a1 c0  08 00 45 00 00 44 a2 b2\n00 00 40 11 e2 15 c0 a8  01 0f c0 a8 01 01 00 35\n00 35 00 30 2e 42 01 00  00 01 00 00 00 00 00 00\n06 75 70 64 61 74 65 2d  73 65 72 76 69 63 65 73";
        asciiDump = "..:.......E..D..\n..@............5\n.5.0.B..........\n.update-services";
      }
    } else if (filter.includes("http") || (!filter && i % 7 === 0)) {
      proto = "HTTP";
      len = 210;
      source = "192.168.1.15";
      destination = "192.168.1.102";
      info = `GET /cgi-bin/device_status.sh HTTP/1.1`;
      
      if (i % 14 === 0) {
        info = `GET /login.cgi?user=admin&pass=admin123 HTTP/1.1 (Brute-force Exploit Attempt)`;
        severity = "critical";
        len = 345;
        hexDump = "47 45 54 20 2f 6c 6f 67  69 6e 2e 63 67 69 3f 75\n73 65 72 3d 61 64 6d 69  6e 26 70 61 73 73 3d 61\n64 6d 69 6e 31 32 33 20  48 54 54 50 2f 31 2e 31\n48 6f 73 74 3a 20 31 39  32 2e 31 36 38 2e 31 2e";
        asciiDump = "GET /login.cgi?u\nser=admin&pass=a\ndmin123 HTTP/1.1\nHost: 192.168.1.";
        payload = { url: "/login.cgi", method: "GET", queryParams: "user=admin&pass=admin123", vulnerability: "Exposed cleartext credentials in URI parameters" };
      } else {
        hexDump = "47 45 54 20 2f 63 67 69  2d 62 69 6e 2f 64 65 76\n69 63 65 5f 73 74 61 74  75 73 2e 73 68 20 48 54\n54 50 2f 31 2e 31 0d 0a  48 6f 73 74 3a 20 31 39\n32 2e 31 36 38 2e 31 2e  31 30 32 0d 0a 0d 0a 00";
        asciiDump = "GET /cgi-bin/dev\nice_status.sh HT\nTP/1.1..Host: 19\n2.168.1.102....";
        payload = { url: "/cgi-bin/device_status.sh", method: "GET" };
      }
    } else if (filter.includes("icmp") || (!filter && i % 8 === 0)) {
      proto = "ICMP";
      len = 74;
      source = "192.168.1.15";
      destination = "192.168.1.22";
      info = `Echo (ping) request  id=0x15a2, seq=1, ttl=64`;
      hexDump = "45 00 00 54 a2 b2 40 00  40 01 b2 c0 c0 a8 01 0f\nc0 a8 01 16 08 00 d2 e4  15 a2 00 01 d2 d1 d2 d1\n00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00";
      asciiDump = "E..T..@.@.......\n................\n................";
      payload = { icmpType: 8, icmpCode: 0, icmpSeq: 1, icmpId: "0x15a2" };
    } else {
      // Standard TCP Handshake or TLS traffic
      proto = "TLS";
      len = 1500;
      source = "192.168.1.15";
      destination = "172.217.164.110"; // Outer secure network (Google Services)
      info = `Application Data TLSv1.3 Encrypted Session (Length 1446)`;
      hexDump = "17 03 03 05 a1 00 00 00  00 00 00 00 01 a4 f5 b2\nd2 d2 40 f1 d2 f2 b2 12  c2 f2 d2 e2 f1 b2 12 b2\na1 b2 a3 d1 a2 c1 d4 a1  02 f5 b2 c2 e3 f5 a1 b2";
      asciiDump = "..........@.....\n................\n................";
      payload = { tlsVersion: "TLSv1.3", cipherSuite: "TLS_AES_256_GCM_SHA384" };
    }

    if (hexDump === "") {
      hexDump = "45 00 00 3c d4 f1 40 00  40 06 c0 a1 c0 a8 01 0f\nc0 a8 01 2c 05 a2 01 bd  8f a1 12 c1 32 44 a1 c2\n50 18 10 00 f2 d1 00 00";
      asciiDump = "E..<..@.@.......\n...,........2D..\nP.......";
    }

    packets.push({
      id: i,
      timestamp: timestampStr,
      source,
      destination,
      protocol: proto,
      length: len,
      info,
      hexDump,
      asciiDump,
      severity,
      payloadDetails: payload
    });
  }

  return packets;
}

// 1. API: Execute NMAP network scans
app.post("/api/security/nmap", async (req, res) => {
  const { target, profile } = req.body;
  if (!target) {
    return res.status(400).json({ error: "No target network or IP specified." });
  }

  const selectedProfile = profile || "quick";
  console.log(`Starting simulated NMAP scan on target ${target} with profile ${selectedProfile}`);

  const scanResult = generateSimulatedNmap(target, selectedProfile);

  // If Gemini client is online, enrich the scanning outcome with an AI vulnerability audit
  const ai = getGeminiClient();
  if (ai) {
    try {
      const prompt = `You are a cybersecurity expert analyzing an NMAP scan result of a network target.
Target IP: ${target}
Scan Profile: ${selectedProfile}
Ports Scanned & Identified Services:
${JSON.stringify(scanResult.ports)}

Operating System Info:
${JSON.stringify(scanResult.osInfo)}

NMAP CLI Console Output:
${scanResult.rawOutput}

Provide an expert vulnerability analysis of this target.
Include:
1. EXPOSED PORTS & RISK ASSESSMENT (Identify which services are dangerous, e.g., Telnet, unencrypted HTTP, or vulnerable SMBv1).
2. REMEDIATION STRATEGIES (Give exact technical instructions on securing these services - block ports, disable protocols, enforce SSL).
3. POTENTIAL CVE CATEGORIES (Acknowledge any matching vulnerabilities like MS17-010).

Formatting requirement: Use standard clean text with simple headers. Avoid markdown formatting blocks. Keep it concise, informative, and professional.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      return res.json({
        id: `scan-${Date.now()}`,
        target,
        profile: selectedProfile,
        timestamp: new Date().toLocaleString(),
        status: "completed",
        ports: scanResult.ports,
        osInfo: scanResult.osInfo,
        rawOutput: scanResult.rawOutput,
        aiAdvisory: response.text || "AI Advisor successfully processed the scan results, but returned an empty response."
      });
    } catch (err: any) {
      console.error("Gemini failed during NMAP advisory generation:", err);
      return res.json({
        id: `scan-${Date.now()}`,
        target,
        profile: selectedProfile,
        timestamp: new Date().toLocaleString(),
        status: "completed",
        ports: scanResult.ports,
        osInfo: scanResult.osInfo,
        rawOutput: scanResult.rawOutput,
        aiAdvisory: `[ERROR] Secure AI Advisor is temporarily offline. Reason: ${err.message || err}. Consider restricting access to ports: ${scanResult.ports.filter(p => p.state === "open").map(p => p.port).join(", ")} immediately.`
      });
    }
  } else {
    // Return standard analysis advisory with generic local expert recommendations
    let localAdvisory = `[SYSTEM ADVISORY] Local Static Threat Database Analysis\n\n`;
    const openPorts = scanResult.ports.filter(p => p.state === "open");
    
    if (openPorts.length === 0) {
      localAdvisory += `- Verdict: Low Vulnerability Risk. No exposed entryways found.\n`;
    } else {
      localAdvisory += `- Exposed ports detected: ${openPorts.map(p => p.port).join(", ")}\n`;
      openPorts.forEach(p => {
        if (p.port === 445) {
          localAdvisory += `\n[HIGH RISK] Port 445 Microsoft-DS SMB Service Exposed!\n- Vulnerability: MS17-010 EternalBlue remote code execution pattern.\n- Mitigation:\n  1. Close port 445 on external boundaries.\n  2. Disable SMBv1 support.\n  3. Install security patches.`;
        }
        if (p.port === 23) {
          localAdvisory += `\n[CRITICAL] Port 23 Telnet Daemon Active!\n- Vulnerability: Transmits passwords in cleartext over socket.\n- Mitigation:\n  1. Stop Telnet daemon service.\n  2. Enforce secure SSH (Port 22) logins.`;
        }
        if (p.port === 80) {
          localAdvisory += `\n[MEDIUM RISK] Port 80 HTTP Server Exposed.\n- Vulnerability: Administrative login credentials sent over HTTP cleartext.\n- Mitigation: Install TLS certificates and redirect traffic to HTTPS (Port 443).`;
        }
      });
    }

    return res.json({
      id: `scan-${Date.now()}`,
      target,
      profile: selectedProfile,
      timestamp: new Date().toLocaleString(),
      status: "completed",
      ports: scanResult.ports,
      osInfo: scanResult.osInfo,
      rawOutput: scanResult.rawOutput,
      aiAdvisory: localAdvisory
    });
  }
});

// 2. API: Wireshark Packet Capture stream simulation
app.post("/api/security/wireshark", async (req, res) => {
  const { filter, count, interfaceName } = req.body;
  const filterVal = filter || "";
  const packetCount = count ? parseInt(count) : 25;
  const iface = interfaceName || "eth0";

  console.log(`Triggered packet capture on interface ${iface} with filter '${filterVal}' capturing ${packetCount} frames.`);
  
  const packets = generateCapturedPackets(filterVal, packetCount);

  return res.json({
    status: "completed",
    interface: iface,
    filter: filterVal,
    totalCaptured: packets.length,
    timestamp: new Date().toLocaleString(),
    packets
  });
});

// 3. API: Security AI audit and Threat report formulation
app.post("/api/security/ai-audit", async (req, res) => {
  const { scanData, packetsData, sourceThreat } = req.body;
  const ai = getGeminiClient();

  let formattedScan = scanData ? JSON.stringify(scanData) : "No active port scan attached.";
  let formattedPackets = packetsData ? JSON.stringify(packetsData) : "No packet captures attached.";
  let threatSource = sourceThreat || "Anomalous Network Traffic Inspection";

  const defaultReport = {
    id: `rep-${Date.now()}`,
    title: `Threat Mitigation Report: Audit on ${threatSource}`,
    timestamp: new Date().toLocaleString(),
    sourceThreat: threatSource,
    severity: "high",
    status: "draft",
    executiveSummary: `An automated security audit was generated focusing on anomalous data patterns observed during local socket inspections. Real-time logging identified unauthorized protocols communicating internally.`,
    attackVector: "Internal Network Pivot and Credential Leakage",
    auditedDataPoints: ["Interactive Packet Analysis", "Security Center Telemetry"],
    findings: [
      "Detected vulnerable service ports active on internal subnets",
      "Observed network packets transmitting insecure data structures"
    ],
    mitigations: [
      { action: "Block remote port traffic", status: "completed", type: "firewall", details: "Created inbound block rule in NetGuard." },
      { action: "Enforce secure key-exchange", status: "pending", type: "remediation", details: "Revoke outdated ciphers." }
    ],
    exportedTo: []
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
      // Remove backticks if the model accidentally included them
      const cleanJson = jsonText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      
      const parsed = JSON.parse(cleanJson);
      
      const newReport = {
        id: `rep-${Date.now()}`,
        title: parsed.title || defaultReport.title,
        timestamp: new Date().toLocaleString(),
        sourceThreat: threatSource,
        severity: parsed.severity || "medium",
        status: "draft",
        executiveSummary: parsed.executiveSummary || defaultReport.executiveSummary,
        attackVector: parsed.attackVector || defaultReport.attackVector,
        auditedDataPoints: parsed.auditedDataPoints || defaultReport.auditedDataPoints,
        findings: parsed.findings || defaultReport.findings,
        mitigations: parsed.mitigations || defaultReport.mitigations,
        exportedTo: []
      };

      threatReports.push(newReport);
      return res.json(newReport);

    } catch (err: any) {
      console.error("Gemini failed during AI report formulation, using generic generator:", err);
      const rep = { ...defaultReport };
      threatReports.push(rep);
      return res.json(rep);
    }
  } else {
    const rep = { ...defaultReport };
    threatReports.push(rep);
    return res.json(rep);
  }
});

// 4. API: Retrieve, create or export Threat Response reports
app.get("/api/security/threat-reports", (req, res) => {
  return res.json(threatReports);
});

app.post("/api/security/threat-reports/export", (req, res) => {
  const { reportId, targetDestination } = req.body;
  if (!reportId || !targetDestination) {
    return res.status(400).json({ error: "Missing reportId or targetDestination parameters." });
  }

  const report = threatReports.find(r => r.id === reportId);
  if (!report) {
    return res.status(404).json({ error: `Threat Report ${reportId} not found.` });
  }

  if (!report.exportedTo.includes(targetDestination)) {
    report.exportedTo.push(targetDestination);
  }
  report.status = "exported";

  return res.json({
    success: true,
    message: `Report successfully compiled and dispatched to: ${targetDestination}`,
    report
  });
});

// Static database of known security threats for high-fidelity geolocations
const geoDb: Record<string, {
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lng: number;
  isp: string;
  asn: string;
  abuseScore: number;
  threatType: string;
  hostname: string;
}> = {
  "185.122.204.45": {
    country: "Russian Federation",
    countryCode: "RU",
    city: "Moscow",
    lat: 55.7558,
    lng: 37.6173,
    isp: "PJSC Rostelecom",
    asn: "AS12345",
    abuseScore: 92,
    threatType: "SSH/RDP Brute Force Botnet Node",
    hostname: "mow-b2-link.rostel.ru"
  },
  "103.22.41.99": {
    country: "China",
    countryCode: "CN",
    city: "Shenzhen",
    lat: 22.5431,
    lng: 114.0579,
    isp: "Chinanet Guangdong",
    asn: "AS4134",
    abuseScore: 88,
    threatType: "ICMP DDoS Reflector",
    hostname: "sz-core-gw.chinanet.cn"
  },
  "198.51.100.12": {
    country: "United States",
    countryCode: "US",
    city: "Chicago",
    lat: 41.8781,
    lng: -87.6298,
    isp: "Level 3 Parent LLC",
    asn: "AS3356",
    abuseScore: 45,
    threatType: "Sequential TCP Port Scanner",
    hostname: "chi-edge-03.level3.net"
  },
  "172.217.164.110": {
    country: "United States",
    countryCode: "US",
    city: "Mountain View",
    lat: 37.3861,
    lng: -122.0839,
    isp: "Google LLC",
    asn: "AS15169",
    abuseScore: 0,
    threatType: "Legitimate Corporate Service / Telemetry",
    hostname: "sfo03s18-in-f14.1e100.net"
  },
  "203.0.113.82": {
    country: "Netherlands",
    countryCode: "NL",
    city: "Amsterdam",
    lat: 52.3676,
    lng: 4.9041,
    isp: "BIT BV",
    asn: "AS12859",
    abuseScore: 78,
    threatType: "DNS Tunneling / SSH Probe",
    hostname: "ams-node-12.bit.nl"
  }
};

// 5. API: Automated Threat IP Intel Lookup (Reverse Hostname, WHOIS, Traceroute, and Security Reputation)
app.post("/api/security/ip-lookup", (req, res) => {
  const { ip } = req.body;
  if (!ip) {
    return res.status(400).json({ error: "Missing IP address parameter." });
  }

  const cleanIp = ip.trim();
  const octets = cleanIp.split(".").map(Number);

  // Check if it's in our static geo database
  let geo = geoDb[cleanIp];
  let isLocal = cleanIp.startsWith("192.168.") || cleanIp.startsWith("10.") || cleanIp.startsWith("172.16.") || cleanIp.startsWith("127.0.0.1") || cleanIp === "localhost";

  if (!geo) {
    if (isLocal) {
      geo = {
        country: "Internal Private Network",
        countryCode: "LAN",
        city: "Local Segment",
        lat: 38.9072,
        lng: -77.0369,
        isp: "LAN Intranet Controller",
        asn: "AS-PRIVATE",
        abuseScore: 0,
        threatType: "Internal Network Endpoint",
        hostname: cleanIp === "192.168.1.102" ? "iot-camera-01.local" : `${cleanIp.replace(/\./g, "-")}.local`
      };
    } else {
      // Procedurally generate a realistic coordinate and network details
      const index = octets.length === 4 && !isNaN(octets[0]) ? octets[0] % 6 : 0;
      const regions = [
        { country: "United Kingdom", countryCode: "GB", city: "London", lat: 51.5074, lng: -0.1278, isp: "British Telecommunications PLC", asn: "AS2856", abuseScore: 35, threatType: "Spam / Port Scan" },
        { country: "Germany", countryCode: "DE", city: "Frankfurt", lat: 50.1109, lng: 8.6821, isp: "Deutsche Telekom AG", asn: "AS3320", abuseScore: 60, threatType: "Vulnerability Scanning" },
        { country: "Japan", countryCode: "JP", city: "Tokyo", lat: 35.6762, lng: 139.6503, isp: "NTT Communications Corp.", asn: "AS2914", abuseScore: 20, threatType: "Malware CnC Callback" },
        { country: "Brazil", countryCode: "BR", city: "Sao Paulo", lat: -23.5505, lng: -46.6333, isp: "Telefonica Brasil S.A.", asn: "AS27699", abuseScore: 82, threatType: "Credential Harvesting / Botnet" },
        { country: "South Africa", countryCode: "ZA", city: "Johannesburg", lat: -26.2041, lng: 28.0473, isp: "Telkom SA SOC Ltd", asn: "AS10474", abuseScore: 55, threatType: "Brute Force Attack Node" },
        { country: "Australia", countryCode: "AU", city: "Sydney", lat: -33.8688, lng: 151.2093, isp: "Telstra Corporation Ltd", asn: "AS4608", abuseScore: 15, threatType: "SQL Injection Probe" }
      ];
      const matchedReg = regions[index];
      // Slighly offset lat/lng based on other octets to avoid completely overlapping circles
      const latOffset = (octets[1] || 0) % 20 / 40 - 0.25;
      const lngOffset = (octets[2] || 0) % 20 / 40 - 0.25;
      
      const ispName = matchedReg.isp;
      const asnStr = matchedReg.asn;
      const abScore = matchedReg.abuseScore;
      const tType = matchedReg.threatType;

      geo = {
        country: matchedReg.country,
        countryCode: matchedReg.countryCode,
        city: matchedReg.city,
        lat: matchedReg.lat + latOffset,
        lng: matchedReg.lng + lngOffset,
        isp: ispName,
        asn: asnStr,
        abuseScore: abScore,
        threatType: tType,
        hostname: `host-${cleanIp.replace(/\./g, "-")}.${ispName.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}.${matchedReg.countryCode.toLowerCase()}`
      };
    }
  }

  // Generate Traceroute hops
  const traceroute: any[] = [];
  const totalHops = isLocal ? 3 : 5 + (octets[3] ? octets[3] % 4 : 2);
  
  // Hop 1: Local router gateway
  traceroute.push({ hop: 1, ip: "192.168.1.1", host: "CoreRouter-RTX.local", rtt: "<1ms" });
  
  if (totalHops > 1) {
    if (isLocal) {
      traceroute.push({ hop: 2, ip: "192.168.1.10", host: "lan-switch-core.local", rtt: "1ms" });
      traceroute.push({ hop: 3, ip: cleanIp, host: geo.hostname, rtt: "8ms" });
    } else {
      // Outer hops
      traceroute.push({ hop: 2, ip: "10.0.0.1", host: "isp-subnet-gateway.net", rtt: "2ms" });
      traceroute.push({ hop: 3, ip: "68.86.12.93", host: "car-edge-router.net", rtt: "12ms" });
      
      if (totalHops > 4) {
        const trIp = `192.205.10.${(octets[1] || 12) % 254 + 1}`;
        traceroute.push({ hop: 4, ip: trIp, host: `backbone-node-${octets[1] || 12}.transit-carrier.net`, rtt: "28ms" });
      }
      
      if (totalHops > 5) {
        const destCarrierIp = `209.85.120.${(octets[2] || 45) % 254 + 1}`;
        traceroute.push({ hop: totalHops - 1, ip: destCarrierIp, host: `ingress-edge.${geo.countryCode.toLowerCase()}.carrier.com`, rtt: "65ms" });
      }
      
      const targetRtt = geo.abuseScore > 70 ? "118ms" : "44ms";
      traceroute.push({ hop: totalHops, ip: cleanIp, host: geo.hostname, rtt: targetRtt });
    }
  }

  // Generate WHOIS output
  const netHandle = isLocal ? "NET-LOCAL-PRIVATE" : `NET-${octets[0] || 100}-${octets[1] || 200}-ALLOCATED`;
  const range = isLocal ? "192.168.0.0/16" : `${octets[0] || 100}.${octets[1] || 0}.0.0/16`;
  const domain = isLocal ? "local-net.com" : `${geo.isp.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}.${geo.countryCode.toLowerCase()}`;
  
  const rawWhois = `% IANA Threat Intelligence WHOIS Registry v1.2
% Database queried: ${geo.countryCode === "US" ? "whois.arin.net" : geo.countryCode === "RU" || geo.countryCode === "DE" || geo.countryCode === "NL" || geo.countryCode === "GB" ? "whois.ripe.net" : "whois.apnic.net"}
% Query Timestamp: ${new Date().toUTCString()}

NetRange:       ${range}
CIDR:           ${range}
NetName:        ${geo.isp.toUpperCase().replace(/\s/g, "-")}
NetHandle:      ${netHandle}
Parent:         NET-GLOBAL-ROOT
NetType:        Direct Allocation
RegDate:        2015-06-12
Updated:        2026-01-05
Ref:            https://rdap.net/registry/ip/${cleanIp}

OrgName:        ${geo.isp}
OrgId:          ORG-${geo.asn}
Address:        Simulated Threat Intel Registry Area
City:           ${geo.city}
Country:        ${geo.countryCode}
PostalCode:     N/A

OrgAbuseHandle: ABUSE-${geo.asn}-INTEL
OrgAbuseName:   ${geo.isp} Abuse Response
OrgAbuseEmail:  abuse@${domain}
OrgAbusePhone:  +1-800-555-ABUSE

% --- THREAT INTELLIGENCE LEGAL DISCLOSURE ---
% Legally Permissible Diagnostic Capture: ACTIVE
% Reputation Score: ${geo.abuseScore}% Abuse Rating
% Active Signatures: ${geo.threatType}
% Mitigations Logged: NetGuard Active Block Recommendation (Port-Based)`;

  return res.json({
    ip: cleanIp,
    hostname: geo.hostname,
    geo: {
      country: geo.country,
      countryCode: geo.countryCode,
      city: geo.city,
      lat: geo.lat,
      lng: geo.lng
    },
    isp: geo.isp,
    asn: geo.asn,
    abuseScore: geo.abuseScore,
    threatType: geo.threatType,
    whois: rawWhois,
    traceroute
  });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
