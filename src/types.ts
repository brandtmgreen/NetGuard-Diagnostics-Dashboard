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

export interface AiStatus {
  configured: boolean;
  model: string;
  message: string;
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

export interface AppState {
  host: HostInfo;
  interfaces: NetworkInterfaceInfo[];
  neighbors: Neighbor[];
  connections: Connection[];
  alerts: Alert[];
  firewallRules: FirewallRuleInfo[];
  capture: CaptureStatus;
  settings: Settings;
  securityScore: number;
  nmapAvailable: boolean;
  tsharkAvailable: boolean;
  ai: AiStatus;
  events: WindowsEventInfo[];
  generatedAt: string;
}

export interface Diagnostics {
  version: string;
  uptimeSeconds: number;
  node: string;
  platform: string;
  arch: string;
  pid: number;
  memory: { rssMb: number; heapUsedMb: number };
  log: { path: string; exists: boolean; sizeBytes: number; updatedAt: string | null };
  recent: Array<Record<string, unknown>>;
  admin: boolean;
  capture: CaptureStatus;
}

export type AuditStatus = "OK" | "SUGGESTION" | "WARNING" | "CRITICAL";

export interface AuditCheck {
  id: string;
  category: "Kernel & Boot" | "Authentication & Access" | "Network & Firewall" | "Services & Exposure" | "Logging & Updates";
  title: string;
  status: AuditStatus;
  currentValue: string;
  expectedValue: string;
  humanExplanation: string;
  remediationCommand?: string;
  riskImpact: "Low" | "Medium" | "High";
}

export interface SecurityAuditReport {
  auditId: string;
  timestamp: string;
  hostname: string;
  platform: string;
  score: number;
  totalChecks: number;
  okCount: number;
  suggestionCount: number;
  warningCount: number;
  criticalCount: number;
  checks: AuditCheck[];
}

export interface ProcessInfo {
  pid: number;
  parentPid: number | null;
  name: string;
  cpuSeconds: number;
  memoryMb: number;
  threads: number;
  status: string;
  path: string;
  commandLine: string;
}

export interface PlannerTask {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  completed: boolean;
  createdAt: string;
  assignedNode?: string;
  prerequisiteTaskId?: string;
}

export interface CaptureInterface {
  path: string;
  name: string;
}
