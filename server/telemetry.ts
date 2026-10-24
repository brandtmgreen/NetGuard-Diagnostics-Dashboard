import os from "node:os";
import { HostInfo, NetworkInterfaceInfo } from "./types.js";
import { getConnections, getGateway, getIsAdmin, getNeighbors } from "./windows.js";
import { nowIso } from "./util.js";

export class Telemetry {
  private host: HostInfo;
  private interfaces: NetworkInterfaceInfo[] = [];
  private neighbors: Awaited<ReturnType<typeof getNeighbors>> = [];
  private connections: Awaited<ReturnType<typeof getConnections>> = [];
  private previousCpu = os.cpus();
  private timers: NodeJS.Timeout[] = [];
  private refreshing = false;

  constructor() {
    this.host = this.buildHost(0);
  }

  private buildHost(cpuPercent: number): HostInfo {
    const cpus = os.cpus();
    const total = os.totalmem();
    const free = os.freemem();
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptimeSeconds: Math.round(os.uptime()),
      cpuModel: cpus[0]?.model?.trim() || "Unknown CPU",
      cpuCount: cpus.length,
      cpuPercent,
      totalMemoryBytes: total,
      freeMemoryBytes: free,
      memoryPercent: total > 0 ? Math.round(((total - free) / total) * 1000) / 10 : 0,
      isAdmin: false,
      gateway: null,
      localAddresses: [],
      generatedAt: nowIso(),
    };
  }

  private readCpuPercent(): number {
    const current = os.cpus();
    let idleDelta = 0;
    let totalDelta = 0;
    for (let i = 0; i < Math.min(current.length, this.previousCpu.length); i += 1) {
      const prev = this.previousCpu[i].times;
      const next = current[i].times;
      const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
      const nextTotal = next.user + next.nice + next.sys + next.idle + next.irq;
      idleDelta += next.idle - prev.idle;
      totalDelta += nextTotal - prevTotal;
    }
    this.previousCpu = current;
    if (totalDelta <= 0) return 0;
    return Math.round(Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 1000))) / 10;
  }

  private readInterfaces(): NetworkInterfaceInfo[] {
    const result: NetworkInterfaceInfo[] = [];
    for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
      for (const address of addresses || []) {
        result.push({
          name,
          address: address.address,
          netmask: address.netmask,
          mac: address.mac || "",
          family: String(address.family),
          internal: address.internal,
        });
      }
    }
    return result.sort((a, b) => Number(a.internal) - Number(b.internal) || a.name.localeCompare(b.name));
  }

  async refreshHost(): Promise<void> {
    const cpuPercent = this.readCpuPercent();
    const [isAdmin, gateway] = await Promise.all([
      getIsAdmin().catch(() => false),
      getGateway().catch(() => null),
    ]);
    const interfaces = this.readInterfaces();
    const localAddresses = interfaces.filter((item) => !item.internal).map((item) => item.address);
    this.host = {
      ...this.buildHost(cpuPercent),
      isAdmin,
      gateway,
      localAddresses,
    };
    this.interfaces = interfaces;
  }

  async refreshNetwork(): Promise<void> {
    const [neighbors, connections] = await Promise.all([
      getNeighbors().catch(() => []),
      getConnections().catch(() => []),
    ]);
    this.neighbors = neighbors;
    this.connections = connections;
  }

  async refreshAll(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      await Promise.all([this.refreshHost(), this.refreshNetwork()]);
    } finally {
      this.refreshing = false;
    }
  }

  async start(): Promise<void> {
    // Never block startup on WMI/CIM. Windows `Get-NetTCPConnection` can take
    // minutes on a busy host, so the UI receives cached/live values as they land.
    void this.refreshHost();
    void this.refreshNetwork();
    this.timers.push(setInterval(() => void this.refreshHost(), 10000));
    this.timers.push(setInterval(() => void this.refreshNetwork(), 15000));
  }

  stop(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
  }

  getHost(): HostInfo {
    return { ...this.host };
  }

  getInterfaces(): NetworkInterfaceInfo[] {
    return this.interfaces.map((item) => ({ ...item }));
  }

  getNeighbors(): typeof this.neighbors {
    return this.neighbors.map((item) => ({ ...item }));
  }

  getConnections(): typeof this.connections {
    return this.connections.map((item) => ({ ...item }));
  }

  getLocalAddresses(): string[] {
    return this.host.localAddresses;
  }

  getGateway(): string | null {
    return this.host.gateway;
  }
}
