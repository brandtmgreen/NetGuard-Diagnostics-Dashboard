import { run, ExecResult } from "../lib/exec";
import { getDefaultInterface } from "./network";

export interface CapturePacket {
  id: number;
  timestamp: string;
  source: string;
  destination: string;
  protocol: "TCP" | "UDP" | "ICMP" | "DNS" | "HTTP" | "SMB" | "TLS" | "ARP";
  length: number;
  info: string;
  hexDump: string;
  asciiDump: string;
  severity: "normal" | "warning" | "critical";
  payloadDetails?: Record<string, any>;
}

export interface CaptureResult {
  status: "completed" | "denied" | "failed";
  interface: string;
  filter: string;
  totalCaptured: number;
  timestamp: string;
  error?: string;
  packets: CapturePacket[];
}

const TCPDUMP = "/usr/sbin/tcpdump";

function translateFilter(filter: string): string {
  const f = (filter || "").toLowerCase();
  const parts: string[] = [];
  const rules: Array<[string, string]> = [
    ["smb", "port 445"],
    ["445", "port 445"],
    ["telnet", "port 23"],
    ["23", "port 23"],
    ["dns", "udp port 53"],
    ["http", "tcp port 80"],
    ["https", "tcp port 443"],
    ["icmp", "icmp"],
    ["udp", "udp"],
    ["tcp", "tcp"],
    ["rdp", "port 3389"],
    ["ssh", "port 22"],
  ];
  for (const [key, expr] of rules) {
    if (f.includes(key)) parts.push(expr);
  }
  return parts.filter((v, i, a) => a.indexOf(v) === i).join(" or ");
}

interface RawFrame {
  time: string;
  line: string;
  hexLines: string[];
}

function splitFrames(raw: string): RawFrame[] {
  const frames: RawFrame[] = [];
  let current: RawFrame | null = null;
  for (const rawLine of raw.split("\n")) {
    const headerMatch = rawLine.match(/^(\d\d:\d\d:\d\d\.\d+)\s+(.+)$/);
    const hexMatch = rawLine.match(/^\s*0x[0-9a-f]+:\s+(.+)$/);
    if (headerMatch) {
      current = { time: headerMatch[1], line: headerMatch[2], hexLines: [] };
      frames.push(current);
    } else if (hexMatch && current) {
      current.hexLines.push(hexMatch[1]);
    }
  }
  return frames;
}

function splitHexAscii(dumpLine: string): { hex: string; ascii: string } {
  const m = dumpLine.match(/^([\s\S]*?)\s{2,}(.*)$/);
  if (!m) return { hex: dumpLine, ascii: "" };
  return { hex: m[1].trim(), ascii: m[2].trim() };
}

function inferProtocol(line: string, filter: string): CapturePacket["protocol"] {
  const l = line.toLowerCase();
  if (l.includes("flags") || l.includes("seq") || /tcp\s*:/.test(l) || /\.\d+:\s*tcp/.test(l)) return "TCP";
  if (l.includes("icmp") || l.includes("echo")) return "ICMP";
  if (l.includes("arp")) return "ARP";
  if (l.includes("445") || l.includes("smb") || filter.includes("smb")) return "SMB";
  if (l.includes("dns") || l.includes("a?") || l.includes("p") || /udp/.test(l) || filter.includes("dns")) return "DNS";
  if (l.includes("http")) return "HTTP";
  if (l.includes("443") || l.includes("tls") || l.includes("hello")) return "TLS";
  return "TCP";
}

function parseFrame(frame: RawFrame, filter: string): CapturePacket {
  const addrMatch = frame.line.match(/([\d.]+)\.(\d+)\s*>\s*([\d.]+)\.(\d+):\s*(.*)/);
  let source = "";
  let destination = "";
  let info = frame.line;
  if (addrMatch) {
    source = `${addrMatch[1]}:${addrMatch[2]}`;
    destination = `${addrMatch[3]}:${addrMatch[4]}`;
    info = addrMatch[5];
  } else {
    const arrow = frame.line.split(/\s*>\s*/);
    if (arrow.length === 2) {
      source = arrow[0].replace(/^[\w]+\s+/, "");
      destination = arrow[1].split(":")[0];
      info = arrow[1].split(":").slice(1).join(":");
    }
  }

  let hexDump = "";
  let asciiDump = "";
  for (const dl of frame.hexLines) {
    const { hex, ascii } = splitHexAscii(dl);
    hexDump += (hexDump ? "\n" : "") + hex;
    asciiDump += (asciiDump ? "\n" : "") + ascii;
  }

  const lenMatch = info.match(/length\s+(\d+)/) || info.match(/\((\d+)\)\s*$/) || info.match(/len\s+(\d+)/);
  let length = 0;
  if (lenMatch) {
    length = parseInt(lenMatch[1], 10);
  } else {
    length = Math.round(hexDump.split(/\s+/).filter(Boolean).length);
  }

  const protocol = inferProtocol(frame.line, filter);
  const lower = (info + " " + frame.line).toLowerCase();
  const severity: CapturePacket["severity"] =
    /smb|anonymous|password|admin|login|445|brute|exploit/.test(lower)
      ? "warning"
      : "normal";

  return {
    id: 0,
    timestamp: frame.time,
    source,
    destination,
    protocol,
    length,
    info: info.trim().slice(0, 200),
    hexDump,
    asciiDump,
    severity,
    payloadDetails: { raw: info.trim().slice(0, 200) },
  };
}

export async function capturePackets(options: {
  filter?: string;
  count?: number;
  interfaceName?: string;
}): Promise<CaptureResult> {
  const filterVal = options.filter || "";
  const rawCount = options.count ?? 25;
  const count = Math.min(Math.max(parseInt(String(rawCount), 10) || 25, 1), 100);
  const iface = options.interfaceName || getDefaultInterface();
  const bpf = translateFilter(filterVal);

  const args = ["-i", iface, "-c", String(count), "-nn", "-X", "-l"];
  if (bpf) args.push(bpf);

  let res: ExecResult = await run(TCPDUMP, args, {
    sudo: true,
    timeout: 20000,
    maxBuffer: 64 * 1024 * 1024,
  });

  if (res.denied) {
    return {
      status: "denied",
      interface: iface,
      filter: filterVal,
      totalCaptured: 0,
      timestamp: new Date().toLocaleString(),
      error:
        "Packet capture requires elevated privileges. Grant NetGuard access once:\n" +
        "  sudo scripts/setup-sudo.sh\n" +
        "Then restart the server. Capturing is otherwise blocked by macOS.",
      packets: [],
    };
  }

  if (!res.ok && !res.timedOut) {
    return {
      status: "failed",
      interface: iface,
      filter: filterVal,
      totalCaptured: 0,
      timestamp: new Date().toLocaleString(),
      error: res.stderr.trim() || res.stdout.trim() || "tcpdump failed to capture.",
      packets: [],
    };
  }

  const raw = res.stdout;
  const frames = splitFrames(raw);
  const packets: CapturePacket[] = frames.map((f, i) => ({ ...parseFrame(f, filterVal), id: i + 1 }));

  return {
    status: "completed",
    interface: iface,
    filter: filterVal,
    totalCaptured: packets.length,
    timestamp: new Date().toLocaleString(),
    packets,
  };
}
