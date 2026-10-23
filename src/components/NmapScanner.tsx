import React, { useState } from "react";
import { 
  ShieldAlert, 
  Terminal, 
  Search, 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  Sparkles, 
  Cpu, 
  HelpCircle,
  Network,
  Zap,
  Play,
  Check,
  X
} from "lucide-react";
import { Device, NmapScanResult } from "../types";

interface NmapScannerProps {
  devices: Device[];
  onAddFirewallRule: (rule: { name: string; port: string; protocol: "TCP" | "UDP" | "All"; direction: "Inbound"; action: "Block" }) => void;
  onAddPlannerTask: (task: { title: string; description: string; priority: "High" | "Critical"; assignedNode: string }) => void;
}

export default function NmapScanner({ devices, onAddFirewallRule, onAddPlannerTask }: NmapScannerProps) {
  const [targetIp, setTargetIp] = useState("192.168.1.44");
  const [profile, setProfile] = useState<"quick" | "intense" | "vuln" | "os">("vuln");
  const [isLoading, setIsLoading] = useState(false);
  const [scanResult, setScanResult] = useState<NmapScanResult | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"result" | "raw" | "ai">("result");
  const [notifiedActions, setNotifiedActions] = useState<Record<string, boolean>>({});

  const profiles = [
    { id: "quick", label: "Quick Scan", desc: "-T4 -F (Fast common port check)" },
    { id: "intense", label: "Intense Scan", desc: "-T4 -A -v (In-depth analysis)" },
    { id: "vuln", label: "Vulnerability Audit", desc: "--script vuln (Find exploit CVEs)" },
    { id: "os", label: "OS Fingerprinting", desc: "-O --osscan-guess (Identify OS version)" }
  ];

  const handleRunNmap = async () => {
    setIsLoading(true);
    setTerminalOutput(`Initializing NetGuard Virtual NMAP Scan Engine...\n`);
    
    // Simulate real terminal typing/initializing delay
    await new Promise(r => setTimeout(r, 600));
    setTerminalOutput(prev => prev + `Nmap executable mapped to host interface eth0...\n`);
    setTerminalOutput(prev => prev + `Command: nmap -T4 ${profile === "quick" ? "-F" : profile === "intense" ? "-A -v" : profile === "vuln" ? "--script vuln" : "-O"} ${targetIp}\n`);
    setTerminalOutput(prev => prev + `Scanning target host ${targetIp} for open ports...\n`);
    
    try {
      const response = await fetch("/api/security/nmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: targetIp, profile })
      });
      const data = await response.json();
      
      // Simulate gradual port-finding prints
      await new Promise(r => setTimeout(r, 600));
      setTerminalOutput(prev => prev + `Host resolved: ${targetIp} is up (RTT <10ms)\n`);
      setTerminalOutput(prev => prev + `Discovered open ports on target:\n`);
      
      data.ports.forEach((p: any) => {
        setTerminalOutput(prev => prev + `  -> Port ${p.port}/${p.protocol}: ${p.state.toUpperCase()} [${p.service}]\n`);
      });

      await new Promise(r => setTimeout(r, 500));
      setTerminalOutput(prev => prev + `Analyzing signatures with local database signatures...\n`);
      setTerminalOutput(prev => prev + `Task completed. Structured reports generated.\n`);
      
      setScanResult(data);
      setIsLoading(false);
      setActiveTab("result");
    } catch (err: any) {
      setTerminalOutput(prev => prev + `[ERROR] Scan execution aborted: ${err.message || err}\n`);
      setIsLoading(false);
    }
  };

  const handleApplyFirewallMitigation = (port: number, service: string) => {
    onAddFirewallRule({
      name: `Block Remote Exploitation Port ${port} (${service})`,
      port: String(port),
      protocol: "TCP",
      direction: "Inbound",
      action: "Block"
    });
    setNotifiedActions(prev => ({ ...prev, [`fw-${port}`]: true }));
  };

  const handleSchedulePatchTask = (port: number, service: string, vuln: string) => {
    onAddPlannerTask({
      title: `Remediate Port ${port} (${service}) vulnerability`,
      description: `Targeting: ${vuln}. Issue identified on host ${targetIp} during NMAP vulnerability scanner audit. Restrict access lists, apply security patches, and disable legacy configuration.`,
      priority: "High",
      assignedNode: targetIp
    });
    setNotifiedActions(prev => ({ ...prev, [`task-${port}`]: true }));
  };

  return (
    <div className="p-4 bg-[#0b0c0f] text-[#a9b1d6] h-full flex flex-col space-y-4 overflow-y-auto">
      {/* Header Panel */}
      <div className="border-b border-[#24283b] pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <span className="p-1 rounded bg-[#7aa2f7]/10 text-[#7aa2f7] border border-[#7aa2f7]/20">
              <Network className="w-4 h-4" />
            </span>
            NMAP Network Scanner
          </h2>
          <p className="text-[#565f89] text-[11px]">Deploy automated port discovery, service banner inspections, OS fingerprints, and vulnerability script scans.</p>
        </div>
        <div className="text-[10px] bg-[#16161e] border border-[#24283b] px-2.5 py-1 text-[#565f89] font-mono rounded">
          ENGINE: <span className="text-[#9ece6a] font-bold font-mono">v7.92.SEC</span>
        </div>
      </div>

      {/* Control Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 shrink-0">
        {/* Settings Card (5/12) */}
        <div className="lg:col-span-5 bg-[#1a1b26] border border-[#24283b] rounded p-3 flex flex-col justify-between space-y-3">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#e0af68]" />
              Scan Configuration
            </h3>

            {/* Target Select / Input */}
            <div className="space-y-1.5 mb-3">
              <label className="text-[10px] text-[#565f89] uppercase font-bold font-mono">Target Host Node IP</label>
              <div className="flex gap-1.5">
                <select
                  value={targetIp}
                  onChange={(e) => setTargetIp(e.target.value)}
                  className="bg-[#0b0c0f] border border-[#24283b] rounded text-xs text-[#a9b1d6] px-2 py-1 focus:outline-none focus:border-[#7aa2f7] font-mono flex-1 h-8"
                >
                  <optgroup label="Connected Subnet Devices">
                    {devices.map(d => (
                      <option key={d.ip} value={d.ip} className="font-mono">
                        {d.name} ({d.ip}) {d.status === "Offline" ? "[OFFLINE]" : ""}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Manual Definition">
                    <option value="127.0.0.1">LocalHost Loopback (127.0.0.1)</option>
                    <option value="192.168.1.254">Subnet Gateway (192.168.1.254)</option>
                  </optgroup>
                </select>
                <input
                  type="text"
                  placeholder="Custom Target IP..."
                  value={targetIp}
                  onChange={(e) => setTargetIp(e.target.value)}
                  className="w-32 bg-[#0b0c0f] border border-[#24283b] rounded text-xs text-[#a9b1d6] px-2 py-1 focus:outline-none focus:border-[#7aa2f7] font-mono h-8"
                />
              </div>
            </div>

            {/* Profile Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#565f89] uppercase font-bold font-mono">Scan Technique Profiles</label>
              <div className="grid grid-cols-2 gap-2">
                {profiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setProfile(p.id as any)}
                    className={`p-2 rounded text-left border transition flex flex-col justify-between h-14 ${
                      profile === p.id 
                        ? "bg-[#24283b]/60 text-[#7aa2f7] border-[#7aa2f7]/50" 
                        : "bg-[#0b0c0f]/40 text-[#a9b1d6] border-[#24283b]/60 hover:bg-[#24283b]/20"
                    }`}
                  >
                    <span className="text-xs font-bold font-mono">{p.label}</span>
                    <span className="text-[8px] font-mono opacity-60 text-[#565f89] truncate w-full">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleRunNmap}
            disabled={isLoading}
            className={`w-full py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
              isLoading 
                ? "bg-[#24283b] text-[#565f89] cursor-not-allowed" 
                : "bg-[#7aa2f7] text-slate-950 hover:bg-[#7aa2f7]/90 active:scale-95"
            }`}
          >
            {isLoading ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                Executing Network Scan...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Initialize NMAP Scan
              </>
            )}
          </button>
        </div>

        {/* NMAP CLI Live Screen (7/12) */}
        <div className="lg:col-span-7 bg-[#0b0c0f] border border-[#24283b] rounded flex flex-col overflow-hidden h-[195px]">
          <div className="px-3 py-1.5 border-b border-[#24283b] bg-[#16161e] flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-[#565f89] font-mono flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              NMAP CLI EXECUTION STREAM
            </span>
            {isLoading && (
              <span className="flex items-center gap-1 text-[9px] font-mono text-[#e0af68]">
                <span className="w-1.5 h-1.5 bg-[#e0af68] rounded-full animate-ping"></span>
                ACTIVE
              </span>
            )}
          </div>
          <div className="flex-1 p-2.5 font-mono text-[10px] leading-relaxed text-[#7aa2f7] overflow-y-auto whitespace-pre-wrap bg-[#16161f]/30 select-text">
            {terminalOutput || "Scan Engine Ready. Select your target IP and trigger the NMAP scan above to begin packet traversal."}
          </div>
        </div>
      </div>

      {/* Scan Results Layout */}
      <div className="flex-1 flex flex-col bg-[#1a1b26] border border-[#24283b] rounded overflow-hidden min-h-[250px]">
        {/* Navigation bar tabs for analysis outputs */}
        <div className="bg-[#16161e] px-3 border-b border-[#24283b] flex items-center justify-between">
          <div className="flex gap-1.5">
            <button
              onClick={() => setActiveTab("result")}
              className={`px-3 py-2 text-xs font-bold transition border-b-2 uppercase tracking-wider ${
                activeTab === "result" 
                  ? "border-[#7aa2f7] text-[#7aa2f7]" 
                  : "border-transparent text-[#565f89] hover:text-[#a9b1d6]"
              }`}
            >
              Audited Ports ({scanResult?.ports.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("raw")}
              className={`px-3 py-2 text-xs font-bold transition border-b-2 uppercase tracking-wider ${
                activeTab === "raw" 
                  ? "border-[#7aa2f7] text-[#7aa2f7]" 
                  : "border-transparent text-[#565f89] hover:text-[#a9b1d6]"
              }`}
            >
              Raw NMAP Dump
            </button>
            <button
              onClick={() => setActiveTab("ai")}
              className={`px-3 py-2 text-xs font-bold transition border-b-2 uppercase tracking-wider flex items-center gap-1.5 ${
                activeTab === "ai" 
                  ? "border-[#bb9af7] text-[#bb9af7]" 
                  : "border-transparent text-[#565f89] hover:text-[#bb9af7]/80"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Agent Advisory
            </button>
          </div>
          {scanResult && (
            <div className="text-[10px] font-mono text-[#565f89] uppercase">
              SCAN COMPLETED AT: <span className="text-[#a9b1d6]">{scanResult.timestamp}</span>
            </div>
          )}
        </div>

        {/* Tab Body Contents */}
        <div className="flex-1 p-3 overflow-y-auto">
          {!scanResult ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-2">
              <ShieldAlert className="w-10 h-10 text-[#565f89] opacity-40 animate-pulse" />
              <div className="text-xs text-[#565f89] uppercase font-bold">No Active Audits Plotted</div>
              <p className="text-[10px] text-[#565f89] max-w-sm">
                Initiate an NMAP scan above. Once completed, identified open ports, banner versions, risk classifications, and AI advice will populate here.
              </p>
            </div>
          ) : (
            <>
              {/* 1. PORT RESULTS TAB */}
              {activeTab === "result" && (
                <div className="space-y-4">
                  {/* Host OS Fingerprint metadata header */}
                  {scanResult.osInfo && (
                    <div className="p-2.5 rounded bg-[#16161e] border border-[#24283b] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Cpu className="w-4 h-4 text-[#7aa2f7]" />
                        <span className="font-bold text-slate-200 uppercase">OS Identification:</span>
                        <span className="font-mono text-[#9ece6a] font-bold">{scanResult.osInfo.osFamily}</span>
                        <span className="text-[10px] text-[#565f89] font-mono">({scanResult.osInfo.osGen})</span>
                      </div>
                      <div className="text-[10px] text-[#565f89] font-mono">
                        OS MATCH ACCURACY: <span className="text-[#e0af68] font-bold">{scanResult.osInfo.accuracy}%</span>
                      </div>
                    </div>
                  )}

                  {/* Ports Table */}
                  <div className="border border-[#24283b]/60 rounded overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="bg-[#16161e] border-b border-[#24283b]/80 uppercase text-[10px] text-[#565f89] font-bold">
                          <th className="p-2.5">Port/Proto</th>
                          <th className="p-2.5">State</th>
                          <th className="p-2.5">Service</th>
                          <th className="p-2.5">Software Version</th>
                          <th className="p-2.5">Vulnerability Identified</th>
                          <th className="p-2.5 text-right">Actions Remediation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#24283b]/40">
                        {scanResult.ports.map((p, idx) => {
                          const isHighRisk = p.severity === "high" || p.severity === "critical";
                          const isMediumRisk = p.severity === "medium";
                          return (
                            <tr key={idx} className="hover:bg-[#24283b]/10 bg-[#0b0c0f]/25">
                              <td className="p-2.5 font-bold text-slate-200">
                                {p.port}/{p.protocol.toUpperCase()}
                              </td>
                              <td className="p-2.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  p.state === "open" 
                                    ? "bg-[#9ece6a]/10 text-[#9ece6a] border border-[#9ece6a]/20" 
                                    : "bg-[#565f89]/10 text-[#565f89] border border-[#565f89]/20"
                                }`}>
                                  {p.state}
                                </span>
                              </td>
                              <td className="p-2.5 text-[#7aa2f7] font-semibold">{p.service}</td>
                              <td className="p-2.5 text-slate-400 text-[11px] truncate max-w-[200px]" title={p.version}>
                                {p.version || "Unknown Banner"}
                              </td>
                              <td className="p-2.5">
                                {p.vulnerability ? (
                                  <div className="flex items-start gap-1.5 text-[#f7768e] text-[11px]">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span className="font-semibold leading-snug">{p.vulnerability}</span>
                                  </div>
                                ) : (
                                  <span className="text-[#565f89] text-[10px]">No CVE flags</span>
                                )}
                              </td>
                              <td className="p-2.5 text-right shrink-0">
                                <div className="flex gap-1.5 justify-end">
                                  {/* Firewall Mitigation */}
                                  <button
                                    onClick={() => handleApplyFirewallMitigation(p.port, p.service)}
                                    disabled={notifiedActions[`fw-${p.port}`]}
                                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition flex items-center gap-1 ${
                                      notifiedActions[`fw-${p.port}`]
                                        ? "bg-[#9ece6a]/10 text-[#9ece6a] border border-[#9ece6a]/20"
                                        : "bg-[#7aa2f7]/10 text-[#7aa2f7] border border-[#7aa2f7]/30 hover:bg-[#7aa2f7] hover:text-slate-950"
                                    }`}
                                  >
                                    {notifiedActions[`fw-${p.port}`] ? (
                                      <>
                                        <Check className="w-3 h-3" />
                                        Blocked
                                      </>
                                    ) : (
                                      "Firewall Block"
                                    )}
                                  </button>

                                  {/* Task scheduler for patch remediation */}
                                  {p.vulnerability && (
                                    <button
                                      onClick={() => handleSchedulePatchTask(p.port, p.service, p.vulnerability || "")}
                                      disabled={notifiedActions[`task-${p.port}`]}
                                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition flex items-center gap-1 ${
                                        notifiedActions[`task-${p.port}`]
                                          ? "bg-[#9ece6a]/10 text-[#9ece6a] border border-[#9ece6a]/20"
                                          : "bg-[#bb9af7]/10 text-[#bb9af7] border border-[#bb9af7]/30 hover:bg-[#bb9af7] hover:text-slate-950"
                                      }`}
                                    >
                                      {notifiedActions[`task-${p.port}`] ? (
                                        <>
                                          <Check className="w-3 h-3" />
                                          Scheduled
                                        </>
                                      ) : (
                                        "Queue Patch"
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 2. RAW NMAP CONSOLE LOGS TAB */}
              {activeTab === "raw" && (
                <div className="bg-[#0b0c0f] border border-[#24283b] rounded p-3 font-mono text-[10px] leading-relaxed text-[#7280b5] whitespace-pre select-text h-full overflow-auto">
                  {scanResult.rawOutput}
                </div>
              )}

              {/* 3. GEMINI AI RECOMMENDATION ADVISORY TAB */}
              {activeTab === "ai" && (
                <div className="bg-[#1e1e2e]/35 border border-[#bb9af7]/30 rounded p-4 font-mono text-[11px] leading-relaxed select-text space-y-3 relative overflow-hidden">
                  {/* Decorative faint glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#bb9af7]/5 rounded-full blur-2xl"></div>
                  
                  <div className="flex items-center gap-2 text-xs border-b border-[#bb9af7]/20 pb-2 text-[#bb9af7] font-bold uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" />
                    AI AGENT CYBERSECURITY AUDIT REPORT
                  </div>
                  
                  <div className="whitespace-pre-wrap text-[#c0caf5] leading-relaxed font-mono">
                    {scanResult.aiAdvisory}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
