import fs from "node:fs";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { CaptureStatus, Packet } from "./types.js";
import { nowIso, parseCsvLine, sanitizeText } from "./util.js";

const DEFAULT_TSHARK = "C:\\Program Files\\Wireshark\\tshark.exe";

export interface CaptureInterface {
  path: string;
  name: string;
}

export class CaptureService extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private packets: Packet[] = [];
  private status: CaptureStatus = {
    running: false,
    interfacePath: null,
    interfaceName: null,
    startedAt: null,
    packets: 0,
    error: null,
    tsharkPath: this.resolveTshark(),
  };
  private buffer = "";

  private resolveTshark(): string | null {
    const configured = process.env.TSHARK_PATH;
    if (configured && fs.existsSync(configured)) return configured;
    if (fs.existsSync(DEFAULT_TSHARK)) return DEFAULT_TSHARK;
    return null;
  }

  async listInterfaces(): Promise<CaptureInterface[]> {
    const tshark = this.resolveTshark();
    if (!tshark) return [];
    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(tshark, ["-D"], { windowsHide: true });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
      child.on("error", reject);
      child.on("close", () => resolve({ stdout, stderr }));
    });
    const interfaces: CaptureInterface[] = [];
    for (const line of result.stdout.split(/\r?\n/)) {
      const match = line.match(/^\s*\d+\.\s+(.+?)(?:\s+\((.*)\))?\s*$/);
      if (!match) continue;
      const path = match[1].trim();
      if (!path.startsWith("\\Device\\NPF_") && !path.startsWith("\\\\.\\USBPcap")) continue;
      interfaces.push({ path, name: (match[2] || path).trim() });
    }
    return interfaces.sort((a, b) => {
      const rank = (name: string): number => {
        if (/^Ethernet$/i.test(name)) return 0;
        if (/^Wi-?Fi$/i.test(name)) return 1;
        if (/^Local Area Connection\*?/i.test(name)) return 3;
        if (/Loopback/i.test(name)) return 4;
        return 2;
      };
      return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);
    });
  }

  getStatus(): CaptureStatus {
    return { ...this.status };
  }

  getPackets(limit = 500): Packet[] {
    return this.packets.slice(-Math.max(1, Math.min(limit, 1000))).map((packet) => ({ ...packet }));
  }

  start(interfacePath: string, filter: string): CaptureStatus {
    if (!this.status.tsharkPath) throw new Error("tshark was not found. Install Wireshark or set TSHARK_PATH.");
    if (!/^\\Device\\NPF_|^\\\\.\\USBPcap/.test(interfacePath)) {
      throw new Error("Invalid capture interface.");
    }
    const safeFilter = sanitizeText(filter, 240).replace(/[\r\n]/g, "");
    if (this.child) this.stop();

    const args = [
      "-i",
      interfacePath,
      "-l",
      "-n",
      "-T",
      "fields",
      "-E",
      "separator=/t",
      "-E",
      "quote=d",
      "-e",
      "frame.number",
      "-e",
      "frame.time_epoch",
      "-e",
      "frame.len",
      "-e",
      "ip.src",
      "-e",
      "ip.dst",
      "-e",
      "ipv6.src",
      "-e",
      "ipv6.dst",
      "-e",
      "_ws.col.Protocol",
      "-e",
      "tcp.srcport",
      "-e",
      "tcp.dstport",
      "-e",
      "udp.srcport",
      "-e",
      "udp.dstport",
      "-e",
      "tcp.flags",
      "-e",
      "tcp.flags.str",
      "-e",
      "_ws.col.Info",
    ];
    if (safeFilter) args.push("-f", safeFilter);

    const child = spawn(this.status.tsharkPath, args, { windowsHide: true });
    this.child = child;
    this.packets = [];
    this.buffer = "";
    this.status = {
      ...this.status,
      running: true,
      interfacePath,
      interfaceName: interfacePath,
      startedAt: nowIso(),
      packets: 0,
      error: null,
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      this.buffer += chunk;
      const lines = this.buffer.split(/\r?\n/);
      this.buffer = lines.pop() || "";
      for (const line of lines) this.handleLine(line);
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      const text = chunk.toString().trim();
      if (text && !/^Capturing on/i.test(text)) {
        this.status.error = sanitizeText(text, 500);
      }
    });

    child.on("error", (error) => {
      this.status.running = false;
      this.status.error = error.message;
      this.child = null;
    });

    child.on("close", (code) => {
      this.status.running = false;
      if (code && code !== 0 && !this.status.error) {
        this.status.error = `tshark exited with code ${code}`;
      }
      this.child = null;
    });

    return this.getStatus();
  }

  stop(): CaptureStatus {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
    this.status.running = false;
    return this.getStatus();
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;
    const fields = parseCsvLine(line, "\t");
    if (fields.length < 15) return;
    const [, epoch, length, ipSrc, ipDst, ipv6Src, ipv6Dst, protocol, tcpSrc, tcpDst, udpSrc, udpDst, flagsNum, flagsStr, info] = fields;
    const source = ipSrc || ipv6Src || "";
    const destination = ipDst || ipv6Dst || "";
    if (!source && !destination) return;
    const id = Number(fields[0]) || this.packets.length + 1;
    const packet: Packet = {
      id,
      timestamp: epoch ? new Date(Number(epoch) * 1000).toISOString() : nowIso(),
      source,
      destination,
      srcPort: Number(tcpSrc || udpSrc || 0) || null,
      dstPort: Number(tcpDst || udpDst || 0) || null,
      protocol: protocol || "Unknown",
      length: Number(length || 0),
      flags: [flagsNum, flagsStr].filter(Boolean).join(" "),
      info: sanitizeText(info || "", 500),
    };
    this.packets.push(packet);
    if (this.packets.length > 1000) this.packets = this.packets.slice(-1000);
    this.status.packets += 1;
    this.emit("packet", packet);
  }
}
