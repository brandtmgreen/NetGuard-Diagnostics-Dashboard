export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface HostInfo {
  hostname: string;
  platform: string;
  release: string;
  arch: string;
  uptimeSeconds: number;
  cpuModel: string;
  cpuCount: number;
  cpuPercent: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  memoryPercent: number;
  isAdmin: boolean;
  gateway: string | null;
  localAddresses: string[];
  generatedAt: string;
}

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  netmask: string;
  mac: string;
  family: string;
  internal: boolean;
}

export interface Neighbor {
  ip: string;
  mac: string;
  state: string;
  interfaceAlias: string;
}

export interface Connection {
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
  state: string;
  pid: number;
  processName: string;
}

export interface Packet {
  id: number;
  timestamp: string;
  source: string;
  destination: string;
  srcPort: number | null;
  dstPort: number | null;
  protocol: string;
  length: number;
  flags: string;
  info: string;
}

export interface Alert {
  id: string;
  timestamp: string;
  kind: "port-scan" | "brute-force" | "syn-flood" | "icmp-flood" | "suspicious-outbound" | "suspicious-connection" | "windows-event";
  severity: Severity;
  sourceIp: string;
  destinationIp: string;
  sourcePort: number | null;
  destinationPort: number | null;
  protocol: string;
  count: number;
  message: string;
  evidence: string;
  status: "open" | "acknowledged" | "blocked" | "ignored";
}

export interface FirewallRuleInfo {
  id: string;
  name: string;
  displayName: string;
  direction: string;
  action: string;
  enabled: boolean;
  remoteAddresses: string[];
  description?: string;
}

export interface CaptureStatus {
  running: boolean;
  interfacePath: string | null;
  interfaceName: string | null;
  startedAt: string | null;
  packets: number;
  error: string | null;
  tsharkPath: string | null;
}

export interface Settings {
  captureInterface: string;
  captureFilter: string;
  preventionMode: "monitor" | "prevent";
  autoBlock: boolean;
  blockDurationMinutes: number;
  allowPublicScan: boolean;
  geminiModel: string;
  allowedRemoteIps: string[];
}

export interface NmapPort {
  port: number;
  protocol: string;
  state: string;
  service: string;
  version: string;
}

export interface NmapResult {
  id: string;
  target: string;
  profile: string;
  timestamp: string;
  status: "completed" | "failed";
  ports: NmapPort[];
  rawOutput: string;
  error?: string;
}

export interface AuditEvent {
  timestamp: string;
  actor: string;
  action: string;
  details: Record<string, unknown>;
}

export interface Report {
  id: string;
  createdAt: string;
  title: string;
  severity: Severity;
  summary: string;
  alerts: Alert[];
  host: HostInfo;
  recommendations: string[];
}

export interface WindowsEventInfo {
  id: number;
  timestamp: string;
  provider: string;
  level: string;
  message: string;
}
