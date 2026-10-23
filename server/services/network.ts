import os from "os";
import fs from "fs";
import dns from "dns";
import { isPrivateIp, run } from "../lib/exec";

export interface InterfaceInfo {
  interfaceName: string;
  address: string;
  netmask: string;
  family: string;
  mac: string;
  cidr: string;
  internal: boolean;
}

export interface DiscoveredDevice {
  ip: string;
  name: string;
  type: "Windows" | "Linux" | "Mac" | "Router" | "IoT" | "Other";
  status: "Online" | "Offline";
  ping: string;
  mac: string;
  vendor: string;
  hostname: string;
}

export interface LiveConnection {
  ip: string;
  port: number;
  proto: string;
  process: string;
  state: string;
  direction: "outbound" | "inbound";
  count: number;
}

const OUI_MAP: Record<string, string> = {
  "E0:D9:E3": "Ubiquiti Networks",
  "BC:23:4C": "Intel Corporate",
  "00:1A:2B": "Dell Inc.",
  "11:22:33": "Hewlett Packard Enterprise",
  "AA:BB:CC": "Hikvision Digital Technology",
  "F4:0F:24": "Apple Inc.",
  "30:8D:99": "Hewlett-Packard",
  "B8:27:EB": "Raspberry Pi Foundation",
  "FC:F8:AE": "Google LLC",
  "A4:D1:D2": "Apple Inc.",
  "00:11:32": "Synology Incorporated",
  "3C:22:FB": "Raspberry Pi Foundation",
  "DC:A6:32": "Raspberry Pi Trading",
  "B8:27:00": "Raspberry Pi Foundation",
  "00:0C:29": "VMware Inc.",
  "00:50:56": "VMware Inc.",
  "F0:18:98": "NETGEAR Inc.",
  "D0:E5:4B": "ASUSTek Computer Inc.",
  "48:5B:39": "ASUSTek Computer Inc.",
  "AC:84:C6": "TP-LINK Technologies",
  "50:C7:BF": "TP-LINK Technologies",
  "F4:F2:6D": "TP-LINK Technologies",
  "00:1D:0F": "Cisco Systems",
  "00:00:0C": "Cisco Systems",
  "00:05:73": "Cisco Systems",
  "00:12:F2": "Linksys",
  "00:18:F8": "Intel Corporate",
  "00:1B:63": "Intel Corporate",
  "EC:8E:B5": "Intel Corporate",
  "88:3A:30": "Huawei Technologies",
  "98:01:A7": "Samsung Electronics",
  "58:B0:35": "Samsung Electronics",
  "CC:2D:8C": "Samsung Electronics",
  "E8:50:8B": "Cisco Systems",
  "70:3A:CB": "Hon Hai / Foxconn",
  "34:12:98": "Apple Inc.",
  "DC:2B:2A": "Apple Inc.",
  "A8:5C:2C": "Apple Inc.",
  "B0:65:BD": "Apple Inc.",
  "60:F8:1D": "Dell Inc.",
  "5C:F9:DD": "Dell Inc.",
  "00:1A:64": "Microsoft",
  "D8:5D:4C": "Giga-Byte Tech",
  "74:27:EA": "ASRock Incorporation",
};

function normalizeMac(mac: string): string {
  return mac.toUpperCase().replace(/[^0-9A-F]/g, "");
}

function lookupOui(mac: string): string {
  const clean = normalizeMac(mac);
  if (clean.length < 6) return "";
  const key = clean.slice(0, 2) + ":" + clean.slice(2, 4) + ":" + clean.slice(4, 6);
  return OUI_MAP[key] || "";
}

const vendorCache = new Map<string, string | null>();

async function lookupVendorOnline(mac: string): Promise<string | null> {
  const clean = normalizeMac(mac);
  if (clean.length < 12) return null;
  if (vendorCache.has(clean)) return vendorCache.get(clean)!;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://api.maclookup.app/v2/macs/${clean}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      vendorCache.set(clean, null);
      return null;
    }
    const data = (await res.json()) as { vendor?: string; company?: string; isRand?: boolean; found?: boolean };
    const vendor = data.vendor || (data.found === false ? "" : data.company) || "";
    const result = vendor || null;
    vendorCache.set(clean, result);
    return result;
  } catch {
    vendorCache.set(clean, null);
    return null;
  }
}

function isLocalMac(mac: string): boolean {
  const clean = normalizeMac(mac);
  if (clean.length < 2) return false;
  const firstByte = parseInt(clean.slice(0, 2), 16);
  return (firstByte & 0x02) !== 0;
}

function inferType(vendor: string, hostname: string, name: string): DiscoveredDevice["type"] {
  const text = `${vendor} ${hostname} ${name}`.toLowerCase();
  if (text.includes("apple") || text.includes("iphone") || text.includes("macbook")) return "Mac";
  if (text.includes("ubiquiti") || text.includes("cisco") || text.includes("tplink") || text.includes("asus") || text.includes("netgear") || text.includes("router") || text.includes("linksys") || text.includes("askey") || text.includes("zte") || text.includes("huawei") || text.includes("broadcom") || text.includes("qualcomm")) return "Router";
  if (text.includes("raspberry") || text.includes("hikvision") || text.includes("google nest") || text.includes("ring") || text.includes("esp") || text.includes("camera") || text.includes("printer") || text.includes("tp-link") || text.includes("xiaomi") || text.includes("sonos")) return "IoT";
  if (text.includes("microsoft") || text.includes("surface")) return "Windows";
  if (text.includes("synology") || text.includes("linux") || text.includes("qnap")) return "Linux";
  if (text.includes("dell") || text.includes("hewlett") || text.includes("lenovo") || text.includes("intel")) return "Linux";
  return "Other";
}

export function getInterfaces(): InterfaceInfo[] {
  const nets = os.networkInterfaces();
  const out: InterfaceInfo[] = [];
  for (const name of Object.keys(nets)) {
    const list = nets[name];
    if (!list) continue;
    for (const net of list) {
      if (net.family !== "IPv4") continue;
      out.push({
        interfaceName: name,
        address: net.address,
        netmask: net.netmask,
        family: net.family,
        mac: net.mac,
        cidr: net.cidr || "",
        internal: net.internal,
      });
    }
  }
  return out;
}

export function getDefaultInterface(): string {
  const candidates = getInterfaces().filter((i) => !i.internal);
  if (candidates.length === 0) return "en0";
  const hasGateway = candidates.find((i) => /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(i.address));
  return (hasGateway || candidates[0]).interfaceName;
}

function netmaskToPrefix(netmask: string): number {
  const octets = netmask.split(".").map(Number);
  let bits = 0;
  for (const octet of octets) {
    for (let b = 7; b >= 0; b--) {
      if (octet & (1 << b)) bits++;
      else if (bits % 8 !== 0) return bits;
    }
  }
  return bits;
}

function getPrimarySubnet(): { base: string; prefix: number; interfaceName: string } | null {
  const candidates = getInterfaces().filter((i) => !i.internal);
  for (const iface of candidates) {
    if (/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(iface.address)) {
      const prefix = netmaskToPrefix(iface.netmask);
      return { base: iface.address, prefix, interfaceName: iface.interfaceName };
    }
  }
  return null;
}

async function reverseLookup(ip: string): Promise<string | null> {
  try {
    const hosts = await dns.promises.reverse(ip);
    return hosts[0] || null;
  } catch {
    return null;
  }
}

function parseArpTable(output: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const raw of output.split(/\r?\n/)) {
    // Unix format: ? (192.168.1.1) at 00:11:22:33:44:55 on en0
    const mUnix = raw.match(/^\s*\S*\s*\(([\d.]+)\)\s+at\s+([0-9a-fA-F:-]+)/);
    if (mUnix) {
      map.set(mUnix[1], mUnix[2].toUpperCase().replace(/-/g, ":"));
      continue;
    }
    // Windows format: 192.168.1.1   00-11-22-33-44-55   dynamic
    const mWin = raw.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\s+([0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2})/);
    if (mWin) {
      map.set(mWin[1], mWin[2].toUpperCase().replace(/-/g, ":"));
    }
  }
  return map;
}

async function pingSweep(baseIp: string, prefix: number): Promise<string[]> {
  if (prefix > 24) return [baseIp];
  const octets = baseIp.split(".").map(Number);
  const hosts: string[] = [];
  const hostBits = 32 - prefix;
  const maxHosts = Math.min(2 ** hostBits - 2, 254);

  for (let i = 1; i <= maxHosts; i++) {
    hosts.push(`${octets[0]}.${octets[1]}.${octets[2]}.${i}`);
  }

  const responded: string[] = [];
  const CONCURRENCY = 32;
  let idx = 0;

  async function worker() {
    while (idx < hosts.length) {
      const ip = hosts[idx++];
      const pingArgs = process.platform === "win32"
        ? ["-n", "1", "-w", "450", ip]
        : ["-c", "1", "-W", "1", "-t", "64", "-q", ip];
      const res = await run("ping", pingArgs, {
        timeout: 1500,
      });
      if (res.ok || res.stdout.includes("1 packets received") || res.stdout.includes("Received = 1")) {
        responded.push(ip);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, hosts.length) }, worker));
  return responded;
}

async function resolveDevice(ip: string, mac: string | undefined): Promise<DiscoveredDevice> {
  const hostname = (await reverseLookup(ip)) || "";
  const vendor = mac
    ? lookupOui(mac) || (isLocalMac(mac) ? "Randomized / Local MAC" : (await lookupVendorOnline(mac)) || "Unknown")
    : "Unknown";
  const online = mac !== undefined;
  const shortName = hostname.split(".")[0] || `host-${ip}`;
  const type = inferType(vendor, hostname, shortName);

  return {
    ip,
    name: shortName,
    type,
    status: online ? "Online" : "Offline",
    ping: online ? "<5ms" : "---",
    mac: mac || "",
    vendor,
    hostname,
  };
}

function readLinuxProcArp(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    if (fs.existsSync("/proc/net/arp")) {
      const content = fs.readFileSync("/proc/net/arp", "utf8");
      for (const line of content.split(/\r?\n/).slice(1)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4 && /^\d+\.\d+\.\d+\.\d+$/.test(parts[0])) {
          const ip = parts[0];
          const mac = parts[3].toUpperCase();
          if (mac && mac !== "00:00:00:00:00:00") {
            map.set(ip, mac);
          }
        }
      }
    }
  } catch {}
  return map;
}

export async function discoverDevices(): Promise<{
  hostname: string;
  platform: string;
  release: string;
  interfaces: InterfaceInfo[];
  devices: DiscoveredDevice[];
  swept: boolean;
}> {
  const subnet = getPrimarySubnet();
  const sweptIps = new Set<string>();

  if (subnet) {
    const responded = await pingSweep(subnet.base, subnet.prefix);
    responded.forEach((ip) => sweptIps.add(ip));
  }

  const arpRes = await run("arp", ["-a"], { timeout: 8000 });
  const arpTable = parseArpTable(arpRes.stdout);
  for (const [ip, mac] of readLinuxProcArp()) {
    if (!arpTable.has(ip)) arpTable.set(ip, mac);
  }

  const seen = new Set<string>();
  const candidates: Array<{ ip: string; mac: string | undefined }> = [];

  for (const iface of getInterfaces()) {
    if (!iface.internal && iface.address && !seen.has(iface.address)) {
      seen.add(iface.address);
      candidates.push({ ip: iface.address, mac: iface.mac ? iface.mac.toUpperCase() : undefined });
    }
  }

  for (const ip of sweptIps) {
    if (seen.has(ip)) continue;
    seen.add(ip);
    candidates.push({ ip, mac: arpTable.get(ip) });
  }

  for (const [ip, mac] of arpTable) {
    if (seen.has(ip)) continue;
    const firstOctet = parseInt(ip.split(".")[0], 10);
    if (firstOctet >= 224 && firstOctet <= 239) continue; // multicast
    seen.add(ip);
    candidates.push({ ip, mac });
  }

  const devices = await Promise.all(candidates.map((c) => resolveDevice(c.ip, c.mac)));

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    interfaces: getInterfaces(),
    devices: devices.sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true })),
    swept: Boolean(subnet),
  };
}

function parseLsofConnections(output: string): Map<string, LiveConnection> {
  const map = new Map<string, LiveConnection>();
  for (const raw of output.split("\n")) {
    const m = raw.match(/^(\S+)\s+(\d+)\s+\S+\s+\d+\w\s+\S+\s+\S+\s+\S+\s+(\w+)\s+(.*)$/);
    if (!m) continue;
    const name = m[1];
    const state = m[3];
    const address = m[4].trim();
    const arrowMatch = address.match(/^([\d.]+):(\d+)(?:->([\d.]+):(\d+))?/);
    if (!arrowMatch) continue;
    const proto = /^UDP/.test(raw) ? "UDP" : "TCP";
    const remote = arrowMatch[3] ? { ip: arrowMatch[3], port: parseInt(arrowMatch[4], 10) } : null;
    const direction: "outbound" | "inbound" = remote ? "outbound" : "inbound";
    const ip = remote ? remote.ip : arrowMatch[1];
    const port = remote ? remote.port : parseInt(arrowMatch[2], 10);

    const key = `${ip}:${port}:${proto}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      continue;
    }
    map.set(key, {
      ip,
      port,
      proto,
      process: name,
      state,
      direction,
      count: 1,
    });
  }
  return map;
}

function parseWindowsConnections(output: string): Map<string, LiveConnection> {
  const map = new Map<string, LiveConnection>();
  for (const raw of output.split(/\r?\n/)) {
    const parts = raw.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const proto = parts[0].toUpperCase();
    if (proto !== "TCP" && proto !== "UDP") continue;
    const localAddr = parts[1];
    const foreignAddr = parts[2];
    const state = proto === "TCP" ? (parts[3] || "ACTIVE") : "ACTIVE";
    const pid = proto === "TCP" ? (parts[4] || "0") : (parts[3] || "0");

    const useLocal = !foreignAddr || foreignAddr.startsWith("0.0.0.0") || foreignAddr.startsWith("*:") || foreignAddr.startsWith("[::]");
    const addrToParse = useLocal ? localAddr : foreignAddr;
    const colonIdx = addrToParse.lastIndexOf(":");
    if (colonIdx === -1) continue;
    const rawIp = addrToParse.substring(0, colonIdx).replace(/[\[\]]/g, "");
    const ip = rawIp === "0.0.0.0" || rawIp === "::" || rawIp === "*" ? "127.0.0.1" : rawIp;
    const port = parseInt(addrToParse.substring(colonIdx + 1), 10);
    if (!ip || Number.isNaN(port) || port === 0) continue;

    const key = `${ip}:${port}:${proto}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      continue;
    }
    map.set(key, {
      ip,
      port,
      proto,
      process: `PID:${pid}`,
      state,
      direction: useLocal || state === "LISTENING" ? "inbound" : "outbound",
      count: 1,
    });
  }
  return map;
}

export async function getNeighbors(): Promise<DiscoveredDevice[]> {
  const arpRes = await run("arp", ["-a"], { timeout: 8000 });
  const arpTable = parseArpTable(arpRes.stdout);
  for (const [ip, mac] of readLinuxProcArp()) {
    if (!arpTable.has(ip)) arpTable.set(ip, mac);
  }

  const seen = new Set<string>();
  const candidates: Array<{ ip: string; mac: string | undefined }> = [];

  for (const iface of getInterfaces()) {
    if (!iface.internal && iface.address && !seen.has(iface.address)) {
      seen.add(iface.address);
      candidates.push({ ip: iface.address, mac: iface.mac ? iface.mac.toUpperCase() : undefined });
    }
  }

  for (const [ip, mac] of arpTable) {
    if (seen.has(ip) || !isPrivateIp(ip)) continue;
    seen.add(ip);
    candidates.push({ ip, mac });
  }

  const devices = await Promise.all(candidates.map((c) => resolveDevice(c.ip, c.mac)));
  return devices.sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }));
}

function parseSsConnections(output: string): Map<string, LiveConnection> {
  const map = new Map<string, LiveConnection>();
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("Netid") || line.startsWith("State")) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 5) continue;
    const hasNetid = /^(tcp|udp)/i.test(parts[0]);
    const proto = hasNetid ? parts[0].toUpperCase() : "TCP";
    const state = hasNetid ? parts[1] : parts[0];
    const localAddr = hasNetid ? parts[4] : parts[3];
    const peerAddr = hasNetid ? parts[5] : parts[4];
    const procPart = parts.slice(hasNetid ? 6 : 5).join(" ");
    if (!peerAddr) continue;

    const targetAddr = peerAddr.includes("*") || peerAddr.startsWith("0.0.0.0") || peerAddr.startsWith("[::]") ? localAddr : peerAddr;
    if (!targetAddr) continue;
    const colonIdx = targetAddr.lastIndexOf(":");
    if (colonIdx === -1) continue;
    const ip = targetAddr.substring(0, colonIdx).replace(/[\[\]]/g, "") || "127.0.0.1";
    const port = parseInt(targetAddr.substring(colonIdx + 1), 10);
    if (Number.isNaN(port) || port === 0) continue;

    const procMatch = procPart.match(/"([^"]+)"/);
    const pidMatch = procPart.match(/pid=(\d+)/);
    const processName = procMatch ? procMatch[1] : pidMatch ? `PID:${pidMatch[1]}` : "kernel/socket";
    const direction: "outbound" | "inbound" = state === "LISTEN" ? "inbound" : "outbound";

    const key = `${ip}:${port}:${proto}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      continue;
    }
    map.set(key, {
      ip: ip === "*" || ip === "0.0.0.0" || ip === "::" ? "127.0.0.1" : ip,
      port,
      proto: proto.startsWith("UDP") ? "UDP" : "TCP",
      process: processName,
      state,
      direction,
      count: 1,
    });
  }
  return map;
}

const TCP_STATES: Record<string, string> = {
  "01": "ESTABLISHED",
  "02": "SYN_SENT",
  "03": "SYN_RECV",
  "04": "FIN_WAIT1",
  "05": "FIN_WAIT2",
  "06": "TIME_WAIT",
  "07": "CLOSE",
  "08": "CLOSE_WAIT",
  "09": "LAST_ACK",
  "0A": "LISTEN",
  "0B": "CLOSING",
};

function decodeHexIpPort(hexAddr: string): { ip: string; port: number } | null {
  const [ipHex, portHex] = hexAddr.split(":");
  if (!ipHex || !portHex || ipHex.length !== 8) return null;
  const port = parseInt(portHex, 16);
  if (Number.isNaN(port) || port === 0) return null;
  const b1 = parseInt(ipHex.slice(6, 8), 16);
  const b2 = parseInt(ipHex.slice(4, 6), 16);
  const b3 = parseInt(ipHex.slice(2, 4), 16);
  const b4 = parseInt(ipHex.slice(0, 2), 16);
  return { ip: `${b1}.${b2}.${b3}.${b4}`, port };
}

function readProcNetSockets(localIpFallback: string): LiveConnection[] {
  const map = new Map<string, LiveConnection>();
  const files: Array<{ path: string; proto: "TCP" | "UDP" }> = [
    { path: "/proc/net/tcp", proto: "TCP" },
    { path: "/proc/net/udp", proto: "UDP" },
  ];

  for (const f of files) {
    try {
      if (!fs.existsSync(f.path)) continue;
      const raw = fs.readFileSync(f.path, "utf8");
      for (const line of raw.split(/\r?\n/).slice(1)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 10) continue;
        const local = decodeHexIpPort(parts[1]);
        const remote = decodeHexIpPort(parts[2]);
        const stateHex = (parts[3] || "").toUpperCase();
        const uid = parts[7] || "0";
        const inode = parts[9] || "0";
        const state = TCP_STATES[stateHex] || "ACTIVE";

        const isRemoteActive = remote && remote.ip !== "0.0.0.0" && remote.port > 0;
        const endpoint = isRemoteActive ? remote! : local;
        if (!endpoint) continue;

        const resolvedIp = endpoint.ip === "0.0.0.0" ? localIpFallback : endpoint.ip;
        const direction: "outbound" | "inbound" = isRemoteActive && state !== "LISTEN" ? "outbound" : "inbound";
        const key = `${resolvedIp}:${endpoint.port}:${f.proto}`;
        const existing = map.get(key);
        if (existing) {
          existing.count++;
          continue;
        }
        map.set(key, {
          ip: resolvedIp,
          port: endpoint.port,
          proto: f.proto,
          process: `uid:${uid}/inode:${inode}`,
          state,
          direction,
          count: 1,
        });
      }
    } catch {}
  }

  return Array.from(map.values());
}

export async function getLiveConnections(): Promise<LiveConnection[]> {
  if (process.platform === "win32") {
    const res = await run("netstat", ["-ano"], {
      timeout: 8000,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (!res.ok) return [];
    const allConns = Array.from(parseWindowsConnections(res.stdout).values());
    const external = allConns.filter((c) => !isPrivateIp(c.ip));
    const selected = external.length > 0 ? [...external, ...allConns.filter((c) => isPrivateIp(c.ip))] : allConns;
    return selected
      .sort((a, b) => b.count - a.count)
      .slice(0, 120);
  }

  const res = await run("lsof", ["-i", "-n", "-P", "-l"], {
    timeout: 10000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (res.ok && res.stdout.trim()) {
    const allConns = Array.from(parseLsofConnections(res.stdout).values());
    const external = allConns.filter((c) => !isPrivateIp(c.ip) && c.ip !== "*");
    const selected = external.length > 0 ? [...external, ...allConns.filter((c) => isPrivateIp(c.ip) && c.ip !== "*")] : allConns.filter((c) => c.ip !== "*");
    if (selected.length > 0) {
      return selected.sort((a, b) => b.count - a.count).slice(0, 120);
    }
  }

  const ssRes = await run("ss", ["-tunap"], {
    timeout: 6000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (ssRes.ok && ssRes.stdout.trim()) {
    const conns = Array.from(parseSsConnections(ssRes.stdout).values());
    if (conns.length > 0) {
      return conns.sort((a, b) => b.count - a.count).slice(0, 120);
    }
  }

  const localIp = getInterfaces().find((i) => !i.internal)?.address || "127.0.0.1";
  const procConns = readProcNetSockets(localIp);
  if (procConns.length > 0) {
    return procConns.sort((a, b) => b.count - a.count).slice(0, 120);
  }

  return [];
}

export const listLiveConnections = getLiveConnections;


