import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Zap, 
  FileText, 
  CheckCircle,
  AlertTriangle,
  Plus,
  Radio,
  Eye,
  Trash2,
  Sliders,
  ShieldAlert as ShieldAlertIcon
} from "lucide-react";
import { ThreatLog, FirewallRule, SuspiciousActivity } from "../types";
import SecurityReports from "./SecurityReports";
import SecurityHeatMap from "./SecurityHeatMap";

interface SecurityCenterProps {
  threatLogs: ThreatLog[];
  firewallRules: FirewallRule[];
  securityScore: number;
  suspiciousActivities: SuspiciousActivity[];
  idsEnabled: boolean;
  onToggleIds: () => void;
  idsThreshold: number;
  onChangeIdsThreshold: (val: number) => void;
  onMitigateActivity: (id: string) => void;
  onIgnoreActivity: (id: string) => void;
  onToggleFirewallRule: (id: string) => void;
  onRunSecurityScan: () => void;
  onAddFirewallRule: (rule: Partial<FirewallRule>) => void;
  onAnalyzeActivityAI: (activity: SuspiciousActivity) => void;
  isScanning: boolean;
  scanResult: string | null;
  onRefreshReportsTrigger?: number;
}

export default function SecurityCenter({
  threatLogs,
  firewallRules,
  securityScore,
  suspiciousActivities,
  idsEnabled,
  onToggleIds,
  idsThreshold,
  onChangeIdsThreshold,
  onMitigateActivity,
  onIgnoreActivity,
  onToggleFirewallRule,
  onRunSecurityScan,
  onAddFirewallRule,
  onAnalyzeActivityAI,
  isScanning,
  scanResult,
  onRefreshReportsTrigger
}: SecurityCenterProps) {
  const [newRuleName, setNewRuleName] = useState("");
  const [newRulePort, setNewRulePort] = useState("");
  const [newRuleProto, setNewRuleProto] = useState<"TCP" | "UDP" | "All">("TCP");
  const [newRuleDir, setNewRuleDir] = useState<"Inbound" | "Outbound">("Inbound");
  const [newRuleAction, setNewRuleAction] = useState<"Allow" | "Block">("Block");

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName || !newRulePort) return;
    onAddFirewallRule({
      name: newRuleName,
      port: newRulePort,
      protocol: newRuleProto,
      direction: newRuleDir,
      action: newRuleAction,
      enabled: true
    });
    setNewRuleName("");
    setNewRulePort("");
  };

  const getSeverityBadge = (sev: SuspiciousActivity["severity"]) => {
    switch (sev) {
      case "critical":
        return "bg-[#f7768e]/15 text-[#f7768e] border-[#f7768e]/30";
      case "high":
        return "bg-[#ff9e64]/15 text-[#ff9e64] border-[#ff9e64]/30";
      case "medium":
        return "bg-[#e0af68]/15 text-[#e0af68] border-[#e0af68]/30";
      case "low":
        return "bg-[#7aa2f7]/15 text-[#7aa2f7] border-[#7aa2f7]/30";
    }
  };

  return (
    <div className="p-4 overflow-y-auto h-full space-y-4 bg-[#0b0c0f] font-sans text-[#a9b1d6]">
      {/* Page Title */}
      <div className="border-b border-[#24283b] pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-100 uppercase tracking-tight">Security Command & Firewalls</h2>
          <p className="text-[#565f89] text-[11px]">Real-time host intrusion detection (IDS), active deep-packet telemetry monitors, and routing rules.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleIds}
            className={`text-[10px] border px-2.5 py-1 font-mono rounded flex items-center gap-1.5 font-bold transition cursor-pointer ${
              idsEnabled 
                ? "bg-[#9ece6a]/15 text-[#9ece6a] border-[#9ece6a]/30 animate-pulse" 
                : "bg-[#565f89]/10 text-[#565f89] border-[#24283b]"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${idsEnabled ? "bg-[#9ece6a]" : "bg-[#565f89]"}`}></span>
            IDS Shield: {idsEnabled ? "ACTIVE ARMED" : "BYPASSED"}
          </button>
        </div>
      </div>

      {/* Tactical Global Threat Origin Tracking & Forensics HUD */}
      <SecurityHeatMap suspiciousActivities={suspiciousActivities} idsEnabled={idsEnabled} />

      {/* Grid: Left Column (Real-time IDS & Audits), Right Column (Firewall configs) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        
        {/* Left Section (Intrusion Logs & Scanning - 7/12) */}
        <div className="lg:col-span-7 space-y-3 flex flex-col">
          
          {/* Real-time Suspicious Activities Monitoring Module (The new IDS block) */}
          <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#24283b]/60 pb-2.5">
              <div>
                <div className="flex items-center gap-1.5">
                  <Radio className={`w-3.5 h-3.5 text-[#f7768e] ${idsEnabled ? "animate-pulse" : ""}`} />
                  <h3 className="text-xs font-black text-slate-100 uppercase tracking-wider">Live Suspicious Socket Intrusion Feed</h3>
                </div>
                <p className="text-[#565f89] text-[10px]">Intercepting anomalous TCP handshake signatures, brute forcing, and network spikes.</p>
              </div>

              {/* Threshold Controls */}
              <div className="flex items-center gap-2 bg-[#16161e] border border-[#24283b] px-2 py-1 rounded">
                <Sliders className="w-3 h-3 text-[#7aa2f7]" />
                <span className="text-[9px] text-[#565f89] font-mono font-bold uppercase shrink-0">Sensitivity:</span>
                <input 
                  type="range" 
                  min="20" 
                  max="150" 
                  value={idsThreshold}
                  onChange={(e) => onChangeIdsThreshold(Number(e.target.value))}
                  className="w-16 h-1 bg-[#24283b] rounded-lg appearance-none cursor-pointer accent-[#7aa2f7]"
                  title="Lower thresholds trigger warnings on smaller packets / loads"
                />
                <span className="text-[10px] font-mono font-bold text-[#7aa2f7]">{idsThreshold}Mbps</span>
              </div>
            </div>

            {/* IDS Suspicious Actions List */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {!idsEnabled ? (
                <div className="py-6 text-center text-[#565f89] text-xs font-mono space-y-1 bg-[#16161e]/40 rounded border border-[#24283b]/50">
                  <Eye className="w-6 h-6 mx-auto text-[#565f89]/60" />
                  <p className="font-bold text-slate-400">IDS Network Guard Decoupled</p>
                  <p className="text-[10px] max-w-xs mx-auto leading-normal">Arm the IDS Shield to activate active thread surveillance and secure raw packet flows.</p>
                </div>
              ) : suspiciousActivities.filter(a => a.status === "active").length === 0 ? (
                <div className="py-8 text-center text-[#9ece6a] text-xs font-mono space-y-1.5 bg-[#16161e]/40 rounded border border-[#24283b]/30">
                  <CheckCircle className="w-6 h-6 mx-auto text-[#9ece6a]" />
                  <span className="font-bold uppercase tracking-wide">Threat Horizon Nominal</span>
                  <p className="text-[#565f89] text-[10px] max-w-xs mx-auto leading-normal">Deep-packet inspection module reporting clean local loopbacks. No alerts logged.</p>
                </div>
              ) : (
                suspiciousActivities.filter(a => a.status === "active").map((activity) => (
                  <div 
                    key={activity.id} 
                    className="p-2.5 bg-[#16161e] border border-[#24283b] rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs relative overflow-hidden"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-1 py-0.2 rounded text-[8.5px] font-black uppercase border ${getSeverityBadge(activity.severity)}`}>
                          {activity.type}
                        </span>
                        <span className="font-mono text-[#7aa2f7] font-bold">{activity.srcIp}</span>
                        <span className="text-[#565f89] font-mono">→</span>
                        <span className="font-mono text-[#bb9af7] font-bold">{activity.destIp}:{activity.destPort}</span>
                      </div>
                      
                      <p className="text-[#a9b1d6] leading-snug text-[11px] font-medium">
                        {activity.reason} <span className="text-[#565f89] font-mono">({activity.packetSize})</span>
                      </p>

                      <div className="text-[9px] text-[#565f89] font-mono flex items-center gap-2">
                        <span>Intercept: {activity.timestamp}</span>
                        <span>•</span>
                        <span className="uppercase text-[#ff9e64] font-bold">Proto: {activity.protocol}</span>
                      </div>
                    </div>

                    {/* Threat Mitigation Triggers */}
                    <div className="shrink-0 flex items-center gap-1.5 self-end sm:self-auto pt-2 sm:pt-0 border-t border-[#24283b]/40 sm:border-t-0">
                      <button
                        onClick={() => onAnalyzeActivityAI(activity)}
                        className="px-2 py-1 bg-[#7aa2f7]/10 hover:bg-[#7aa2f7]/20 border border-[#7aa2f7]/20 text-[#7aa2f7] text-[10.5px] font-bold rounded transition cursor-pointer"
                        title="Analyze with Gemini AI"
                      >
                        AI Analyze
                      </button>
                      <button
                        onClick={() => onMitigateActivity(activity.id)}
                        className="px-2 py-1 bg-[#f7768e]/10 hover:bg-[#f7768e]/25 border border-[#f7768e]/30 text-[#f7768e] text-[10.5px] font-bold rounded transition cursor-pointer"
                        title="Create Firewall rule to block this source IP"
                      >
                        Block IP
                      </button>
                      <button
                        onClick={() => onIgnoreActivity(activity.id)}
                        className="px-2 py-1 bg-[#565f89]/10 hover:bg-[#24283b] border border-[#24283b] text-[#565f89] hover:text-slate-200 text-[10.5px] font-bold rounded transition cursor-pointer"
                        title="Mute alert"
                      >
                        Mute
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Integrity Scanner */}
          <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Host Security Deep Integrity Scan</h3>
                <p className="text-[#565f89] text-[10px]">Inspects system files, running registry keys, and remote server connections.</p>
              </div>
              <button
                onClick={onRunSecurityScan}
                disabled={isScanning}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 text-slate-950 rounded text-[11px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Zap className="w-3 h-3 text-slate-950" />
                {isScanning ? "Scanning..." : "Execute Scan"}
              </button>
            </div>

            {isScanning ? (
              <div className="p-3 bg-[#16161e] border border-[#24283b] rounded text-xs font-mono text-[#7aa2f7] space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7aa2f7] animate-ping"></span>
                  <span>[SCANNING] Sweeping C:\Windows\System32 and registry hives...</span>
                </div>
                <div className="w-full bg-[#0b0c0f] h-1 rounded overflow-hidden mt-1">
                  <div className="bg-[#7aa2f7] h-full animate-pulse" style={{ width: "65%" }}></div>
                </div>
              </div>
            ) : scanResult ? (
              <div className="p-2.5 bg-[#16161e] border border-[#24283b] rounded text-xs font-mono space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#e0af68] font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Scan Completed - 1 Host Anomaly Detected</span>
                </div>
                <pre className="text-[10px] text-[#a9b1d6] leading-tight overflow-x-auto whitespace-pre-wrap">
                  {scanResult}
                </pre>
              </div>
            ) : (
              <div className="p-2.5 bg-[#16161e] border border-[#24283b]/60 rounded text-xs text-[#565f89] font-mono flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#9ece6a]" />
                <span>Last scan completed 15 minutes ago. No malware processes found.</span>
              </div>
            )}
          </div>

          {/* Active Intrusion/Threat Logs */}
          <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3 flex-1">
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider mb-2">Vulnerability & Intrusion Logs</h3>
            
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {threatLogs.map(log => (
                <div key={log.id} className="p-2 bg-[#16161e] border border-[#24283b] rounded flex items-start justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                        log.severity === "Critical" 
                          ? "bg-[#f7768e]/10 text-[#f7768e] border border-[#f7768e]/20" 
                          : "bg-[#e0af68]/10 text-[#e0af68] border border-[#e0af68]/20"
                      }`}>
                        {log.severity}
                      </span>
                      <span className="font-bold text-slate-200">{log.host}</span>
                    </div>
                    <p className="text-[#a9b1d6] leading-snug">{log.message}</p>
                    <div className="text-[9px] text-[#565f89] font-mono">
                      {log.timestamp}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1 text-[#9ece6a] font-bold text-[10px] font-mono uppercase bg-[#9ece6a]/10 border border-[#9ece6a]/20 px-1.5 py-0.5 rounded">
                    <CheckCircle className="w-3 h-3" />
                    {log.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Section (Dynamic Firewall Rules & Control Panel - 5/12) */}
        <div className="lg:col-span-5 space-y-3">
          
          {/* Active Firewall Rules */}
          <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3">
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider mb-1.5">Windows Firewall Port Matrix</h3>
            <p className="text-[#565f89] text-[10px] mb-3">Dynamically allow or drop packets traversing core system ports.</p>

            <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
              {firewallRules.map(rule => (
                <div key={rule.id} className="p-1.5 bg-[#16161e] border border-[#24283b] rounded flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => onToggleFirewallRule(rule.id)}
                      className="shrink-0 focus:outline-none"
                    >
                      {rule.enabled ? (
                        <div className="p-1 rounded bg-[#9ece6a]/10 text-[#9ece6a] border border-[#9ece6a]/20">
                          <Lock className="w-3 h-3" />
                        </div>
                      ) : (
                        <div className="p-1 rounded bg-[#565f89]/10 text-[#565f89] border border-[#24283b]">
                          <Unlock className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                    
                    <div className="truncate font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-200 text-[11px] truncate">{rule.name}</span>
                        <span className="text-[9px] bg-[#0b0c0f] border border-[#24283b] px-1 text-[#7aa2f7] rounded font-bold">
                          {rule.protocol} {rule.port}
                        </span>
                      </div>
                      <span className="text-[9px] text-[#565f89] uppercase">
                        {rule.direction} • {rule.enabled ? "ACTIVE" : "DISABLED"}
                      </span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                    rule.action === "Block" 
                      ? "bg-[#f7768e]/10 text-[#f7768e] border border-[#f7768e]/20" 
                      : "bg-[#9ece6a]/10 text-[#9ece6a] border border-[#9ece6a]/20"
                  }`}>
                    {rule.action}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Create Firewall Rule Form */}
          <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3">
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider mb-2">Create New Policy</h3>
            
            <form onSubmit={handleCreateRule} className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[9px] text-[#565f89] font-bold uppercase block mb-1">Rule Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Block Port 23"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    className="w-full bg-[#16161e] border border-[#24283b] rounded px-2 py-1 text-xs placeholder-[#565f89] text-[#a9b1d6] focus:outline-none focus:border-[#7aa2f7]"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-[#565f89] font-bold uppercase block mb-1">Port Range</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 23"
                    value={newRulePort}
                    onChange={(e) => setNewRulePort(e.target.value)}
                    className="w-full bg-[#16161e] border border-[#24283b] rounded px-2 py-1 text-xs placeholder-[#565f89] text-[#a9b1d6] focus:outline-none focus:border-[#7aa2f7] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <div>
                  <label className="text-[9px] text-[#565f89] font-bold uppercase block mb-1">Proto</label>
                  <select
                    value={newRuleProto}
                    onChange={(e) => setNewRuleProto(e.target.value as any)}
                    className="w-full bg-[#16161e] border border-[#24283b] rounded px-1.5 py-1 text-xs text-[#a9b1d6] focus:outline-none focus:border-[#7aa2f7]"
                  >
                    <option value="TCP">TCP</option>
                    <option value="UDP">UDP</option>
                    <option value="All">All</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-[#565f89] font-bold uppercase block mb-1">Dir</label>
                  <select
                    value={newRuleDir}
                    onChange={(e) => setNewRuleDir(e.target.value as any)}
                    className="w-full bg-[#16161e] border border-[#24283b] rounded px-1.5 py-1 text-xs text-[#a9b1d6] focus:outline-none focus:border-[#7aa2f7]"
                  >
                    <option value="Inbound">Inbound</option>
                    <option value="Outbound">Outbound</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-[#565f89] font-bold uppercase block mb-1">Action</label>
                  <select
                    value={newRuleAction}
                    onChange={(e) => setNewRuleAction(e.target.value as any)}
                    className="w-full bg-[#16161e] border border-[#24283b] rounded px-1.5 py-1 text-xs text-[#a9b1d6] focus:outline-none focus:border-[#7aa2f7]"
                  >
                    <option value="Block">Block</option>
                    <option value="Allow">Allow</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 text-slate-950 text-xs font-bold rounded transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-slate-950" />
                Commit Policy Rule
              </button>
            </form>
          </div>

        </div>

        {/* Global Threat Response & Vulnerability Files Cabinet */}
        <div className="lg:col-span-12 mt-4">
          <SecurityReports onAddFirewallRule={onAddFirewallRule} onRefreshReportsTrigger={onRefreshReportsTrigger} />
        </div>

      </div>
    </div>
  );
}
