import { Alert, Connection, Packet, Severity, WindowsEventInfo } from "./types.js";
import { isPrivateIpv4, nowIso, sanitizeText } from "./util.js";

interface PortScanState {
  ports: Set<number>;
  first: number;
  last: number;
}

interface CounterState {
  count: number;
  first: number;
  last: number;
}

const SUSPICIOUS_PORTS = new Set([4444, 5555, 6667, 9001, 31337, 12345, 54321]);
const BRUTE_FORCE_PORTS = new Set([22, 23, 445, 1433, 3306, 3389, 5900]);

export class DetectionEngine {
  private alerts: Alert[] = [];
  private portScans = new Map<string, PortScanState>();
  private synCounters = new Map<string, CounterState>();
  private bruteForce = new Map<string, CounterState>();
  private icmpCounters = new Map<string, CounterState>();
  private logonFailures = new Map<string, CounterState>();
  private seenEvents = new Set<string>();
  private seenConnections = new Set<string>();
  private lastAlertKeys = new Map<string, number>();
  private localAddresses: string[] = [];
  private onAlert: (alert: Alert) => void;
  private cleanupTimer: NodeJS.Timeout;

  constructor(onAlert: (alert: Alert) => void) {
    this.onAlert = onAlert;
    this.cleanupTimer = setInterval(() => this.cleanup(), 5000);
  }

  setLocalAddresses(addresses: string[]): void {
    this.localAddresses = addresses;
  }

  getAlerts(): Alert[] {
    return this.alerts.map((alert) => ({ ...alert }));
  }

  acknowledge(id: string): Alert | null {
    const alert = this.alerts.find((item) => item.id === id);
    if (!alert) return null;
    alert.status = "acknowledged";
    return { ...alert };
  }

  ingestPacket(packet: Packet): void {
    const src = packet.source;
    const dst = packet.destination;
    if (!src || !dst) return;
    const proto = packet.protocol.toUpperCase();
    const now = Date.now();

    if (proto.includes("TCP")) {
      const flagMatch = packet.flags.match(/0x([0-9a-f]+)/i);
      const flagBits = flagMatch ? Number.parseInt(flagMatch[1], 16) : 0;
      const syn = /SYN/i.test(packet.flags) || (flagBits & 0x02) !== 0;
      if (syn && packet.dstPort && packet.dstPort > 0) {
        this.trackPortScan(src, packet.dstPort, now);
        this.trackCounter(this.synCounters, src, now, 100, 5000, () =>
          this.raise({
            kind: "syn-flood",
            severity: "high",
            sourceIp: src,
            destinationIp: dst,
            sourcePort: packet.srcPort,
            destinationPort: packet.dstPort,
            protocol: packet.protocol,
            count: 100,
            message: `SYN flood threshold reached from ${src}`,
            evidence: `At least 100 TCP SYN packets from ${src} in 5 seconds.`,
          })
        );
        if (BRUTE_FORCE_PORTS.has(packet.dstPort)) {
          const key = `${src}:${packet.dstPort}`;
          this.trackCounter(this.bruteForce, key, now, 10, 30000, () =>
            this.raise({
              kind: "brute-force",
              severity: "high",
              sourceIp: src,
              destinationIp: dst,
              sourcePort: packet.srcPort,
              destinationPort: packet.dstPort,
              protocol: packet.protocol,
              count: 10,
              message: `Repeated connection attempts to sensitive port ${packet.dstPort} from ${src}`,
              evidence: `At least 10 TCP SYN attempts to port ${packet.dstPort} in 30 seconds.`,
            })
          );
        }
      }
      if (packet.dstPort && SUSPICIOUS_PORTS.has(packet.dstPort)) {
        if (this.localAddresses.includes(src) && !isPrivateIpv4(dst)) {
          this.raise({
            kind: "suspicious-outbound",
            severity: "high",
            sourceIp: src,
            destinationIp: dst,
            sourcePort: packet.srcPort,
            destinationPort: packet.dstPort,
            protocol: packet.protocol,
            count: 1,
            message: `Outbound traffic to suspicious port ${packet.dstPort}`,
            evidence: `Local host ${src} connected to ${dst}:${packet.dstPort}.`,
          });
        }
      }
    }

    if (proto.includes("ICMP")) {
      this.trackCounter(this.icmpCounters, src, now, 50, 1000, () =>
        this.raise({
          kind: "icmp-flood",
          severity: "medium",
          sourceIp: src,
          destinationIp: dst,
          sourcePort: null,
          destinationPort: null,
          protocol: packet.protocol,
          count: 50,
          message: `ICMP flood threshold reached from ${src}`,
          evidence: `At least 50 ICMP packets from ${src} in 1 second.`,
        })
      );
    }
  }

  ingestConnections(connections: Connection[]): void {
    const current = new Set<string>();
    for (const connection of connections) {
      const key = `${connection.remoteAddress}:${connection.remotePort}:${connection.pid}`;
      current.add(key);
      if (this.seenConnections.has(key)) continue;
      this.seenConnections.add(key);
      if (
        connection.remoteAddress &&
        !isPrivateIpv4(connection.remoteAddress) &&
        SUSPICIOUS_PORTS.has(connection.remotePort) &&
        connection.state !== "Listen"
      ) {
        this.raise({
          kind: "suspicious-connection",
          severity: "high",
          sourceIp: connection.localAddress,
          destinationIp: connection.remoteAddress,
          sourcePort: connection.localPort,
          destinationPort: connection.remotePort,
          protocol: "TCP",
          count: 1,
          message: `New connection from ${connection.processName || "unknown process"} to suspicious remote port ${connection.remotePort}`,
          evidence: `${connection.localAddress}:${connection.localPort} -> ${connection.remoteAddress}:${connection.remotePort} (${connection.state}, pid ${connection.pid}).`,
        });
      }
    }
    if (this.seenConnections.size > 5000) {
      this.seenConnections = current;
    }
  }

  ingestWindowsEvents(events: WindowsEventInfo[]): void {
    const now = Date.now();
    for (const event of events) {
      const key = `${event.id}|${event.timestamp}|${event.message.slice(0, 80)}`;
      if (this.seenEvents.has(key)) continue;
      this.seenEvents.add(key);
      if (event.id === 4625) {
        const source = event.message.match(/Source Network Address:\s*([0-9.]+)/i)?.[1] || "";
        if (source && /^\d{1,3}(\.\d{1,3}){3}$/.test(source) && !isPrivateIpv4(source)) {
          this.trackCounter(this.logonFailures, source, now, 5, 600000, () =>
            this.raise({
              kind: "brute-force",
              severity: "high",
              sourceIp: source,
              destinationIp: "",
              sourcePort: null,
              destinationPort: 3389,
              protocol: "Windows Security 4625",
              count: 5,
              message: `Windows logon failures from ${source}`,
              evidence: "Five Security 4625 failed-logon events from the same remote address within 10 minutes.",
            })
          );
        }
      } else if (event.id === 7045) {
        this.raise({
          kind: "windows-event",
          severity: "high",
          sourceIp: "",
          destinationIp: "",
          sourcePort: null,
          destinationPort: null,
          protocol: "Windows Security 7045",
          count: 1,
          message: "New Windows service installation recorded",
          evidence: event.message.replace(/\s+/g, " ").slice(0, 600),
        });
      }
    }
    if (this.seenEvents.size > 5000) this.seenEvents.clear();
  }

  private trackPortScan(src: string, dstPort: number, now: number): void {
    const state = this.portScans.get(src);
    if (!state || now - state.first > 10000) {
      this.portScans.set(src, { ports: new Set([dstPort]), first: now, last: now });
      return;
    }
    state.ports.add(dstPort);
    state.last = now;
    if (state.ports.size >= 20) {
      this.portScans.delete(src);
      this.raise({
        kind: "port-scan",
        severity: "high",
        sourceIp: src,
        destinationIp: "",
        sourcePort: null,
        destinationPort: null,
        protocol: "TCP",
        count: state.ports.size,
        message: `Port scan detected from ${src}`,
        evidence: `${state.ports.size} distinct destination ports contacted in under 10 seconds: ${Array.from(state.ports).slice(0, 30).join(", ")}`,
      });
    }
  }

  private trackCounter(
    map: Map<string, CounterState>,
    key: string,
    now: number,
    threshold: number,
    windowMs: number,
    onThreshold: () => void
  ): void {
    const state = map.get(key);
    if (!state || now - state.first > windowMs) {
      map.set(key, { count: 1, first: now, last: now });
      return;
    }
    state.count += 1;
    state.last = now;
    if (state.count === threshold) {
      onThreshold();
    }
  }

  private raise(alert: Omit<Alert, "id" | "timestamp" | "status">): void {
    const key = `${alert.kind}|${alert.sourceIp}|${alert.destinationIp}|${alert.destinationPort ?? ""}`;
    const last = this.lastAlertKeys.get(key) || 0;
    if (Date.now() - last < 30000) return;
    this.lastAlertKeys.set(key, Date.now());
    const full: Alert = {
      ...alert,
      id: `${alert.kind}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
      timestamp: nowIso(),
      status: "open",
    };
    full.message = sanitizeText(full.message, 300);
    full.evidence = sanitizeText(full.evidence, 1000);
    this.alerts = [full, ...this.alerts].slice(0, 500);
    this.onAlert(full);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, state] of this.portScans) {
      if (now - state.first > 15000) this.portScans.delete(key);
    }
    for (const map of [this.synCounters, this.bruteForce, this.icmpCounters, this.logonFailures]) {
      for (const [key, state] of map) {
        if (now - state.last > 60000) map.delete(key);
      }
    }
    for (const [key, at] of this.lastAlertKeys) {
      if (now - at > 120000) this.lastAlertKeys.delete(key);
    }
  }

  stop(): void {
    clearInterval(this.cleanupTimer);
  }
}
