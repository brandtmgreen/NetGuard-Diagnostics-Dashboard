export type DeviceType = "Windows" | "Linux" | "Mac" | "Router" | "IoT";

export interface Device {
  ip: string;
  name: string;
  type: DeviceType;
  status: "Online" | "Offline";
  ping: string;
  cpu: number;
  memory: number;
  mac: string;
}

export interface Process {
  pid: number;
  name: string;
  cpu: number;
  memory: number; // in MB
  disk: number; // in MB/s
  network: number; // in Mbps
  status: "Running" | "Suspended" | "Stopped";
  publisher: string;
  parentPid?: number;
}

export interface ThreatLog {
  id: string;
  timestamp: string;
  severity: "Info" | "Warning" | "Critical";
  message: string;
  host: string;
  status: "Blocked" | "Flagged" | "Resolved";
}

export interface FirewallRule {
  id: string;
  name: string;
  port: string;
  protocol: "TCP" | "UDP" | "All";
  direction: "Inbound" | "Outbound";
  action: "Allow" | "Block";
  enabled: boolean;
}

export interface TerminalLine {
  text: string;
  type: "input" | "output" | "error" | "ai" | "info";
  timestamp: string;
}

export interface PlannerTask {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  completed: boolean;
  priority: "Low" | "Medium" | "High" | "Critical";
  assignedNode?: string;
  prerequisiteTaskId?: string;
}

export interface SuspiciousActivity {
  id: string;
  timestamp: string;
  srcIp: string;
  destIp: string;
  protocol: "TCP" | "UDP" | "ICMP" | "HTTP";
  destPort: string;
  type: "Port Scan" | "Brute Force" | "Unusual Traffic Spike" | "Potential Intrusion" | "DDoS Pattern";
  severity: "low" | "medium" | "high" | "critical";
  packetSize: string;
  reason: string;
  status: "active" | "mitigated" | "ignored";
  process?: string;
  geo?: {
    lat: number;
    lng: number;
    city: string;
    country: string;
    countryCode: string;
  };
}

export interface SystemAlert {
  id: string;
  timestamp: string;
  severity: "info" | "warning" | "critical";
  message: string;
  unread: boolean;
  deviceIp: string;
}

export interface NmapScanResult {
  id: string;
  target: string;
  profile: "quick" | "intense" | "vuln" | "os";
  timestamp: string;
  status: "completed" | "scanning" | "failed";
  ports: {
    port: number;
    protocol: string;
    state: "open" | "closed" | "filtered";
    service: string;
    version?: string;
    vulnerability?: string;
    severity?: "info" | "low" | "medium" | "high" | "critical";
  }[];
  osInfo?: {
    osFamily: string;
    osGen: string;
    accuracy: number;
  };
  rawOutput: string;
  aiAdvisory?: string;
}

export interface CapturedPacket {
  id: number;
  timestamp: string;
  source: string;
  destination: string;
  protocol: "TCP" | "UDP" | "ICMP" | "DNS" | "HTTP" | "SMB" | "TLS";
  length: number;
  info: string;
  hexDump: string;
  asciiDump: string;
  severity?: "normal" | "warning" | "critical";
  payloadDetails?: Record<string, any>;
}

export interface ThreatResponseReport {
  id: string;
  title: string;
  timestamp: string;
  sourceThreat: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "draft" | "exported" | "implemented";
  executiveSummary: string;
  attackVector: string;
  auditedDataPoints: string[];
  findings: string[];
  mitigations: {
    action: string;
    status: "pending" | "completed" | "failed";
    type: "firewall" | "process" | "remediation";
    details: string;
  }[];
  exportedTo: string[];
}

export type ThemeMode = "dark" | "high-contrast" | "win31" | "mario" | "johnny5";

export interface AppConfig {
  theme: ThemeMode;
  autoRefreshInterval: number;
  soundEffects: boolean;
  retroFontEnabled: boolean;
  scanSubnetRange: string;
  enableAiAdvisories: boolean;
  maxPacketCapture: number;
}

export type AuditCheckStatus = "OK" | "SUGGESTION" | "WARNING" | "CRITICAL";

export type AuditCategory =
  | "Kernel & Boot"
  | "Authentication & Access"
  | "Filesystem & Permissions"
  | "Network & Firewall"
  | "SSH & Services"
  | "Logging & Integrity";

export interface LynisAuditCheck {
  id: string;
  category: AuditCategory;
  title: string;
  status: AuditCheckStatus;
  currentValue: string;
  expectedValue: string;
  humanExplanation: string;
  remediationCommand?: string;
  rollbackCommand?: string;
  riskImpact: "Low" | "Medium" | "High";
}

export interface GroundingReference {
  title: string;
  uri: string;
}

export interface AiRemediationPlanItem {
  id: string;
  findingId: string;
  title: string;
  humanSummary: string;
  whyItMatters: string;
  command: string;
  rollbackCommand: string;
  riskLevel: "Low" | "Medium" | "High";
  requiresPrivilege: boolean;
}

export interface LynisAuditReport {
  auditId: string;
  timestamp: string;
  hostname: string;
  platform: string;
  kernelVersion: string;
  lynisBinaryDetected: boolean;
  hardeningIndex: number;
  totalChecks: number;
  okCount: number;
  suggestionCount: number;
  warningCount: number;
  criticalCount: number;
  checks: LynisAuditCheck[];
  aiAnalysis?: {
    executiveSummary: string;
    plainEnglishOverview: string;
    remediationPlan: AiRemediationPlanItem[];
    groundingSources: GroundingReference[];
    generatedAt: string;
  };
}

export interface HistoricalLoadBucket {
  minuteTimestamp: number; // start of minute (epoch ms)
  minutesAgo: number; // 59 down to 0
  label: string; // HH:MM
  cpuAvg: number; // 0-100%
  cpuPeak: number; // 0-100%
  ramAvg: number; // 0-100%
  ramPeak: number; // 0-100%
  loadAvg1m: number; // raw kernel 1m load average
  coreLoads: number[]; // per-core CPU %
  sampleCount: number;
  source: "live-sampler" | "kernel-telemetry";
}

export interface HistoricalLoadResponse {
  hostname: string;
  cpuCount: number;
  cpuModel: string;
  totalMemGb: number;
  uptimeSeconds: number;
  currentCpuPercent: number;
  currentRamPercent: number;
  loadAvg: number[];
  peakCpu60m: { value: number; label: string; minutesAgo: number };
  peakRam60m: { value: number; label: string; minutesAgo: number };
  spikeCount60m: number;
  buckets: HistoricalLoadBucket[];
}


