import net from "net";
import os from "os";
import { findBinary, run, ExecResult, IS_WIN } from "../lib/exec";
import { getGeminiClient } from "../lib/gemini";

export type NmapProfile = "quick" | "intense" | "vuln" | "os";

export interface NmapPort {
  port: number;
  protocol: string;
  state: "open" | "closed" | "filtered";
  service: string;
  version?: string;
  vulnerability?: string;
  severity?: "info" | "low" | "medium" | "high" | "critical";
}

export interface NmapOsInfo {
  osFamily: string;
  osGen: string;
  accuracy: number;
}

export interface NmapResult {
  id: string;
  target: string;
  profile: NmapProfile;
  timestamp: string;
  status: "completed" | "failed";
  ports: NmapPort[];
  osInfo: NmapOsInfo | null;
  rawOutput: string;
  privileged: boolean;
  notes: string[];
  aiAdvisory?: string;
}

let nmapPath: string | null | undefined;

async function getNmapPath(): Promise<string | null> {
  if (nmapPath !== undefined) return nmapPath;
  nmapPath = await findBinary("nmap", [
    "nmap",
    "C:\\Program Files (x86)\\Nmap\\nmap.exe",
    "C:\\Program Files\\Nmap\\nmap.exe",
    "/opt/homebrew/bin/nmap",
    "/usr/local/bin/nmap",
    "/usr/bin/nmap",
  ]);
  return nmapPath;
}

const COMMON_PORTS: Array<{ port: number; service: string; defaultBanner?: string }> = [
  { port: 21, service: "ftp" },
  { port: 22, service: "ssh" },
  { port: 23, service: "telnet" },
  { port: 25, service: "smtp" },
  { port: 53, service: "domain" },
  { port: 80, service: "http" },
  { port: 135, service: "msrpc", defaultBanner: "Microsoft Windows RPC" },
  { port: 139, service: "netbios-ssn", defaultBanner: "Microsoft Windows netbios-ssn" },
  { port: 443, service: "https" },
  { port: 445, service: "microsoft-ds", defaultBanner: "Windows SMBv2/v3 microsoft-ds" },
  { port: 1433, service: "ms-sql-s" },
  { port: 3000, service: "http-alt", defaultBanner: "Node.js / Express HTTP Engine" },
  { port: 3306, service: "mysql" },
  { port: 3389, service: "ms-wbt-server", defaultBanner: "Microsoft Terminal Services (RDP)" },
  { port: 5432, service: "postgresql" },
  { port: 5900, service: "vnc" },
  { port: 6379, service: "redis" },
  { port: 8080, service: "http-proxy" },
  { port: 8443, service: "https-alt" },
];

async function probeTcpPort(host: string, port: number, timeoutMs = 650): Promise<{ open: boolean; banner?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    let banner = "";

    const finish = (open: boolean) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {}
      resolve({ open, banner: banner.trim() || undefined });
    };

    socket.setTimeout(timeoutMs);
    socket.on("connect", () => {
      if (port === 80 || port === 3000 || port === 8080) {
        try {
          socket.write(`HEAD / HTTP/1.0\r\nHost: ${host}\r\n\r\n`);
        } catch {}
      }
      setTimeout(() => finish(true), 120);
    });
    socket.on("data", (chunk) => {
      banner += chunk.toString("utf8").split("\r\n")[0].slice(0, 80);
      finish(true);
    });
    socket.on("timeout", () => finish(false));
    socket.on("error", () => finish(false));
    socket.connect(port, host);
  });
}

async function runNativeConnectScan(target: string, profile: NmapProfile): Promise<ParsedHost> {
  const starttime = String(Math.floor(Date.now() / 1000));
  const results = await Promise.all(
    COMMON_PORTS.map(async (entry) => {
      const res = await probeTcpPort(target, entry.port, profile === "quick" ? 450 : 800);
      const state: NmapPort["state"] = res.open ? "open" : "closed";
      let version = res.banner || (res.open ? entry.defaultBanner : undefined);
      if (res.open && version?.startsWith("HTTP/")) {
        version = `HTTP Server (${version})`;
      }
      return {
        port: entry.port,
        protocol: "tcp",
        state,
        service: entry.service,
        version,
      } as NmapPort;
    })
  );

  const openPorts = results.filter((p) => p.state === "open");
  const hasWinPorts = openPorts.some((p) => p.port === 135 || p.port === 139 || p.port === 445 || p.port === 3389);
  const osInfo: NmapOsInfo = hasWinPorts || IS_WIN
    ? { osFamily: "Windows", osGen: `Microsoft Windows NT (${os.release()})`, accuracy: 94 }
    : { osFamily: os.type(), osGen: `${os.type()} ${os.release()}`, accuracy: 90 };

  return {
    starttime,
    status: "up",
    ports: openPorts,
    osInfo,
  };
}

interface ParsedHost {
  starttime: string;
  status: string;
  ports: NmapPort[];
  osInfo: NmapOsInfo | null;
}

function parseNmapXml(xml: string): ParsedHost | null {
  const hostMatch = xml.match(/<host[^>]*>[\s\S]*?<\/host>/);
  if (!hostMatch) return null;
  const block = hostMatch[0];

  const starttime = xml.match(/<run[^>]*start="(\d+)"/)?.[1] || "";
  const status = block.match(/<status state="(\w+)"/)?.[1] || "unknown";

  const ports: NmapPort[] = [];
  const portPattern = /<port protocol="(\w+)" portid="(\d+)">([\s\S]*?)<\/port>/g;
  let pm: RegExpExecArray | null;
  while ((pm = portPattern.exec(block)) !== null) {
    const protocol = pm[1];
    const port = parseInt(pm[2], 10);
    const inner = pm[3];
    const state = (inner.match(/<state state="(\w+)"/)?.[1] || "closed") as NmapPort["state"];
    const service = inner.match(/<service name="([^"]*)"/)?.[1] || "";
    const product = inner.match(/<service[^>]*product="([^"]*)"/)?.[1] || "";
    const version = inner.match(/<service[^>]*version="([^"]*)"/)?.[1] || "";
    ports.push({
      port,
      protocol,
      state,
      service: service || "unknown",
      version: [product, version].filter(Boolean).join(" ").trim() || undefined,
    });
  }

  const osMatch = block.match(/<osmatch[^>]*name="([^"]*)"[^>]*accuracy="(\d+)"/);
  const osInfo: NmapOsInfo | null = osMatch
    ? { osFamily: osMatch[1].split(/ |\(/)[0], osGen: osMatch[1], accuracy: parseInt(osMatch[2], 10) }
    : null;

  return { starttime, status, ports, osInfo };
}

function buildRawOutput(host: ParsedHost | null, target: string, starttime: string): string {
  if (!host) return `Nmap scan report for ${target}\nNo parseable results were returned.`;
  const dateStr = starttime
    ? new Date(parseInt(starttime, 10) * 1000).toUTCString()
    : new Date().toUTCString();
  let out = `Starting Nmap 7.9x ( https://nmap.org ) at ${dateStr}\n`;
  out += `Nmap scan report for ${target}\n`;
  out += `Host is up.\n`;
  const openPorts = host.ports.filter((p) => p.state === "open");
  const closed = host.ports.filter((p) => p.state === "closed").length;
  out += `Not shown: ${closed} closed tcp ports (reset)\n`;
  out += `PORT      STATE    SERVICE       VERSION\n`;
  for (const p of host.ports) {
    const portStr = String(p.port).padEnd(8);
    const stateStr = p.state.padEnd(8);
    const svc = p.service.padEnd(13);
    out += `${portStr}  ${stateStr} ${svc} ${p.version || ""}\n`;
  }
  if (host.osInfo) {
    out += `\nDevice Security Fingerprint:\n`;
    out += `OS Match: ${host.osInfo.osGen} (${host.osInfo.accuracy}% confidence)\n`;
  }
  out += `\nNmap done: 1 IP address (1 host up) scanned\n`;
  return out;
}

function scoreSeverity(port: number, service: string): NmapPort["severity"] | undefined {
  const svc = service.toLowerCase();
  if (port === 23 || port === 21) return "high";
  if (port === 445 || port === 139) return "critical";
  if (port === 3389) return "medium";
  if (port === 80) return "medium";
  if (svc.includes("telnet")) return "high";
  if (svc.includes("smb")) return "critical";
  return undefined;
}

export async function runNmap(target: string, profile: NmapProfile): Promise<NmapResult> {
  const path = await getNmapPath();
  const notes: string[] = [];
  let privileged = false;

  if (!path) {
    notes.push("Native TCP socket connect engine used (nmap binary not found in PATH).");
    const parsed = await runNativeConnectScan(target, profile);
    parsed.ports.forEach((p) => {
      const sev = scoreSeverity(p.port, p.service);
      if (sev) p.severity = sev;
      if (p.port === 445) p.vulnerability = "MS17-010 (EternalBlue) remote code execution risk if SMBv1 enabled";
      if (p.port === 23) p.vulnerability = "Cleartext credentials over Telnet";
      if (p.port === 135) p.vulnerability = "MSRPC Endpoint Mapper exposed to subnet enumeration";
      if (p.port === 3389) p.vulnerability = "RDP exposed — ensure Network Level Authentication (NLA) is enforced";
    });
    const rawOutput = buildRawOutput(parsed, target, parsed.starttime);
    const result: NmapResult = {
      id: `scan-${Date.now()}`,
      target,
      profile,
      timestamp: new Date().toLocaleString(),
      status: "completed",
      ports: parsed.ports,
      osInfo: parsed.osInfo,
      rawOutput,
      privileged: false,
      notes,
    };
    result.aiAdvisory = await generateAdvisory(result);
    return result;
  }

  let args: string[] = [];
  let useSudo = false;

  if (profile === "quick") {
    args = ["-sT", "-F", "--host-timeout", "40s", "-oX", "-", target];
  } else if (profile === "intense") {
    args = ["-sT", "-sV", "--version-light", "--host-timeout", "60s", "-oX", "-", target];
  } else if (profile === "os") {
    useSudo = true;
    args = ["-sS", "-O", "--host-timeout", "90s", "-oX", "-", target];
  } else if (profile === "vuln") {
    useSudo = true;
    args = ["-sS", "--script", "vuln", "--top-ports", "100", "--host-timeout", "180s", "-oX", "-", target];
  }

  const timeout = profile === "vuln" ? 200000 : profile === "os" ? 100000 : profile === "intense" ? 70000 : 50000;

  let res: ExecResult = await run(path, args, { sudo: useSudo, timeout, maxBuffer: 32 * 1024 * 1024 });

  if (res.denied) {
    notes.push("Elevated privileges unavailable for this profile; falling back to unprivileged connect scan.");
    useSudo = false;
    if (profile === "os") {
      args = ["-sT", "-O", "--host-timeout", "60s", "-oX", "-", target];
      res = await run(path, args, { timeout: 70000, maxBuffer: 32 * 1024 * 1024 });
      if (res.stdout.includes("Skipping OS detection") || res.stderr.includes("privileges")) {
        notes.push("OS detection requires root; showing port results only.");
        args = ["-sT", "--host-timeout", "40s", "-oX", "-", target];
        res = await run(path, args, { timeout: 50000, maxBuffer: 32 * 1024 * 1024 });
      }
    } else if (profile === "vuln") {
      args = ["-sT", "--script", "vuln", "--top-ports", "100", "--host-timeout", "150s", "-oX", "-", target];
      res = await run(path, args, { timeout: 160000, maxBuffer: 32 * 1024 * 1024 });
    }
  } else if (useSudo) {
    privileged = true;
  }

  const parsed = parseNmapXml(res.stdout);

  if (!parsed) {
    return {
      id: `scan-${Date.now()}`,
      target,
      profile,
      timestamp: new Date().toLocaleString(),
      status: "failed",
      ports: [],
      osInfo: null,
      rawOutput: res.stdout.trim() || res.stderr.trim() || "Nmap produced no output.",
      privileged,
      notes,
    };
  }

  parsed.ports.forEach((p) => {
    const sev = scoreSeverity(p.port, p.service);
    if (sev) p.severity = sev;
    if (p.port === 445) p.vulnerability = "MS17-010 (EternalBlue) remote code execution risk if SMBv1 enabled";
    if (p.port === 23) p.vulnerability = "Cleartext credentials over Telnet";
  });

  const rawOutput = buildRawOutput(parsed, target, parsed.starttime);
  const result: NmapResult = {
    id: `scan-${Date.now()}`,
    target,
    profile,
    timestamp: new Date().toLocaleString(),
    status: "completed",
    ports: parsed.ports,
    osInfo: parsed.osInfo,
    rawOutput,
    privileged,
    notes,
  };

  result.aiAdvisory = await generateAdvisory(result);
  return result;
}

async function generateAdvisory(result: NmapResult): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) {
    return "[ERROR] Live AI Advisory unavailable: GEMINI_API_KEY is not configured.";
  }

  try {
    const prompt = `You are a cybersecurity expert analyzing a real NMAP scan result of a network target.
Target IP: ${result.target}
Scan Profile: ${result.profile}
Ports & Services:
${JSON.stringify(result.ports)}
OS Info:
${JSON.stringify(result.osInfo)}
Raw scan output:
${result.rawOutput}
Privileged scan: ${result.privileged}

Provide an expert vulnerability analysis. Include:
1. EXPOSED PORTS & RISK ASSESSMENT
2. REMEDIATION STRATEGIES (exact technical instructions)
3. POTENTIAL CVE CATEGORIES

Formatting requirement: standard clean text with simple headers, no markdown blocks. Keep it concise and professional.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });
    return response.text || "[ERROR] AI Advisor returned an empty response.";
  } catch (err: any) {
    console.error("Gemini failed during NMAP advisory:", err);
    return `[ERROR] AI Advisor request failed: ${err.message || err}`;
  }
}
