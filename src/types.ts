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

