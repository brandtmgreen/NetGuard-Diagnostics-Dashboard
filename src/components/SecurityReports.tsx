import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Send, 
  Check, 
  Sparkles, 
  AlertTriangle, 
  RefreshCw, 
  ArrowRight, 
  Database, 
  ShieldAlert, 
  Zap, 
  Clipboard,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Info
} from "lucide-react";
import { ThreatResponseReport } from "../types";

interface SecurityReportsProps {
  onAddFirewallRule: (rule: { name: string; port: string; protocol: "TCP" | "UDP" | "All"; direction: "Inbound"; action: "Block" }) => void;
  onRefreshReportsTrigger?: number;
}

export default function SecurityReports({ onAddFirewallRule, onRefreshReportsTrigger = 0 }: SecurityReportsProps) {
  const [reports, setReports] = useState<ThreatResponseReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState<string | null>("rep-101");
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<Record<string, string>>({});
  const [selectedTarget, setSelectedTarget] = useState<Record<string, string>>({});

  const exportTargets = [
    "Corporate SIEM Dashboard (Elastic/Splunk)",
    "Active Directory Administrator",
    "Security Center Log Database",
    "Windows Domain Administrator Console"
  ];

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/security/threat-reports");
      const data = await response.json();
      setReports(data);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load threat reports:", err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [onRefreshReportsTrigger]);

  const handleExportReport = async (reportId: string) => {
    const target = selectedTarget[reportId] || exportTargets[0];
    setIsExporting(reportId);
    
    try {
      const response = await fetch("/api/security/threat-reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, targetDestination: target })
      });
      const data = await response.json();
      
      if (data.success) {
        setExportSuccessMsg(prev => ({
          ...prev,
          [reportId]: `Report dispatched to ${target} successfully!`
        }));
        
        // Refresh local list state
        fetchReports();
        
        setTimeout(() => {
          setExportSuccessMsg(prev => {
            const next = { ...prev };
            delete next[reportId];
            return next;
          });
        }, 4000);
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(null);
    }
  };

  const handleTriggerMitigationRule = (reportId: string, mitigationIndex: number, actionTitle: string) => {
    // If it is a firewall mitigation, automatically deploy the rule in our shared state
    if (actionTitle.toLowerCase().includes("firewall") || actionTitle.toLowerCase().includes("block port")) {
      const portRegex = actionTitle.match(/port\s+(\d+)/i) || actionTitle.match(/(\d+)/);
      const port = portRegex ? portRegex[1] : "445";
      
      onAddFirewallRule({
        name: `Automated Response mitigation for: ${actionTitle}`,
        port,
        protocol: "TCP",
        direction: "Inbound",
        action: "Block"
      });
    }

    // Toggle mitigation status in our frontend view
    setReports(prev => prev.map(rep => {
      if (rep.id === reportId) {
        const updatedMitigations = [...rep.mitigations];
        updatedMitigations[mitigationIndex] = {
          ...updatedMitigations[mitigationIndex],
          status: "completed"
        };
        return { ...rep, mitigations: updatedMitigations };
      }
      return rep;
    }));
  };

  const toggleExpandReport = (id: string) => {
    setExpandedReportId(expandedReportId === id ? null : id);
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "critical": return "bg-[#f7768e]/10 text-[#f7768e] border border-[#f7768e]/20 font-bold";
      case "high": return "bg-[#ff9e64]/10 text-[#ff9e64] border border-[#ff9e64]/20 font-bold";
      case "medium": return "bg-[#e0af68]/10 text-[#e0af68] border border-[#e0af68]/20 font-bold";
      default: return "bg-[#7aa2f7]/10 text-[#7aa2f7] border border-[#7aa2f7]/20 font-bold";
    }
  };

  return (
    <div className="bg-[#1a1b26] border border-[#24283b] rounded flex flex-col overflow-hidden min-h-[300px]">
      <div className="px-3 py-2 border-b border-[#24283b] bg-[#16161e] flex justify-between items-center shrink-0">
        <span className="text-[10px] uppercase font-bold text-[#565f89] font-mono flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-[#7aa2f7]" />
          Vulnerability Audit File Cabinet
        </span>
        <button
          onClick={fetchReports}
          disabled={isLoading}
          className="text-[10px] font-mono font-bold text-[#7aa2f7] flex items-center gap-1 hover:underline disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          Reload Archive
        </button>
      </div>

      <div className="flex-1 p-3 overflow-y-auto space-y-3.5">
        {reports.length === 0 ? (
          <div className="py-12 text-center text-[#565f89] flex flex-col items-center justify-center space-y-1 opacity-60">
            <Info className="w-6 h-6 mb-1 text-[#24283b]" />
            <div className="text-xs uppercase font-bold">No Generated Files Available</div>
            <p className="text-[9px]">Deploy security NMAP scans or audit captured packets to trigger AI incident compilation file response files.</p>
          </div>
        ) : (
          reports.map((r) => {
            const isExpanded = expandedReportId === r.id;
            return (
              <div 
                key={r.id} 
                className={`border rounded overflow-hidden transition-all ${
                  isExpanded ? "border-[#bb9af7]/50 bg-[#16161f]/45" : "border-[#24283b] hover:border-[#bb9af7]/30 bg-[#0b0c0f]/10"
                }`}
              >
                {/* Accordion header */}
                <div 
                  onClick={() => toggleExpandReport(r.id)}
                  className="p-2.5 flex items-center justify-between cursor-pointer select-none bg-[#16161e]/40 hover:bg-[#1a1b26] transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ${getSeverityBadge(r.severity)}`}>
                      {r.severity}
                    </span>
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-slate-100 truncate pr-4">{r.title}</h4>
                      <div className="flex items-center gap-2 text-[9px] font-mono text-[#565f89] mt-0.5">
                        <span>SOURCE: {r.sourceThreat}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#565f89]" />
                          {r.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-2 py-0.5 rounded-[3px] text-[9px] font-mono font-bold uppercase ${
                      r.status === "exported" 
                        ? "bg-[#9ece6a]/10 text-[#9ece6a] border border-[#9ece6a]/20" 
                        : "bg-[#7aa2f7]/10 text-[#7aa2f7] border border-[#7aa2f7]/20"
                    }`}>
                      {r.status}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-[#565f89]" /> : <ChevronDown className="w-4 h-4 text-[#565f89]" />}
                  </div>
                </div>

                {/* Accordion content body */}
                {isExpanded && (
                  <div className="p-3.5 border-t border-[#24283b] space-y-4 text-xs select-text">
                    {/* Attack Vector and Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1 bg-[#0b0c0f]/40 p-2.5 rounded border border-[#24283b]/60">
                        <span className="text-[9px] uppercase font-bold text-[#bb9af7] font-mono">Incident Executive Summary</span>
                        <p className="text-slate-300 leading-relaxed text-[11px]">{r.executiveSummary}</p>
                      </div>

                      <div className="space-y-2">
                        <div className="bg-[#0b0c0f]/40 p-2 rounded border border-[#24283b]/60">
                          <span className="text-[9px] uppercase font-bold text-[#ff9e64] font-mono block">Known Attack Vector</span>
                          <span className="font-mono text-slate-200 font-bold text-[11px] block mt-0.5">{r.attackVector}</span>
                        </div>
                        
                        <div className="bg-[#0b0c0f]/40 p-2 rounded border border-[#24283b]/60">
                          <span className="text-[9px] uppercase font-bold text-[#565f89] font-mono block">Audited Data Points Captured</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {r.auditedDataPoints.map((dp, idx) => (
                              <span key={idx} className="bg-[#24283b] text-[#7aa2f7] font-mono text-[9px] px-1.5 py-0.2 rounded">
                                {dp}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Specific findings lists */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] uppercase font-bold text-[#7aa2f7] font-mono block">Incident Evidence & Findings</span>
                      <ul className="space-y-1 font-mono text-[10.5px] bg-[#16161e]/50 p-2.5 rounded border border-[#24283b]/50">
                        {r.findings.map((finding, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 text-slate-300">
                            <span className="text-[#f7768e] font-extrabold">•</span>
                            <span>{finding}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Action mitigations checklist */}
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase font-bold text-[#9ece6a] font-mono block">Deployable Security Mitigations Checklist</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {r.mitigations.map((mit, idx) => {
                          const isDone = mit.status === "completed";
                          return (
                            <div 
                              key={idx} 
                              className={`p-2.5 rounded border flex items-center justify-between gap-3 ${
                                isDone 
                                  ? "bg-[#9ece6a]/5 border-[#9ece6a]/30 text-[#9ece6a]/90" 
                                  : "bg-[#0b0c0f]/50 border-[#24283b] text-[#a9b1d6]"
                              }`}
                            >
                              <div className="min-w-0">
                                <span className={`text-[8px] uppercase font-mono font-bold px-1 py-0.2 rounded ${
                                  mit.type === "firewall" 
                                    ? "bg-[#7aa2f7]/20 text-[#7aa2f7]" 
                                    : "bg-[#bb9af7]/20 text-[#bb9af7]"
                                }`}>
                                  {mit.type}
                                </span>
                                <h5 className="font-bold text-[11px] text-slate-200 mt-1 truncate" title={mit.action}>{mit.action}</h5>
                                <p className="text-[9.5px] text-[#565f89] leading-tight mt-0.5 truncate" title={mit.details}>{mit.details}</p>
                              </div>
                              
                              <button
                                onClick={() => handleTriggerMitigationRule(r.id, idx, mit.action)}
                                disabled={isDone}
                                className={`px-2 py-1 rounded text-[9px] font-bold uppercase shrink-0 transition flex items-center gap-1 ${
                                  isDone 
                                    ? "bg-[#9ece6a]/10 text-[#9ece6a] border border-[#9ece6a]/20" 
                                    : "bg-[#9ece6a] text-slate-950 hover:bg-[#9ece6a]/90"
                                }`}
                              >
                                {isDone ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    Armed
                                  </>
                                ) : (
                                  "Deploy"
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dispatch and Export Controls */}
                    <div className="border-t border-[#24283b] pt-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#111219]/30 p-2.5 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase font-bold text-[#565f89] font-mono">Dispatch To Platform:</span>
                        <select
                          value={selectedTarget[r.id] || exportTargets[0]}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedTarget(prev => ({ ...prev, [r.id]: val }));
                          }}
                          className="bg-[#0b0c0f] border border-[#24283b] rounded text-[10px] text-slate-300 px-2 py-1 focus:outline-none focus:border-[#7aa2f7] font-mono cursor-pointer"
                        >
                          {exportTargets.map(tgt => (
                            <option key={tgt} value={tgt}>{tgt}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-3">
                        {r.exportedTo.length > 0 && (
                          <div className="text-[9px] font-mono text-[#565f89] flex items-center gap-1">
                            <span>Exposed Targets:</span>
                            <span className="text-[#9ece6a] font-bold">{r.exportedTo.join(", ")}</span>
                          </div>
                        )}
                        
                        <button
                          onClick={() => handleExportReport(r.id)}
                          disabled={isExporting === r.id}
                          className="px-3.5 py-1.5 bg-[#7aa2f7] text-slate-950 font-bold rounded hover:bg-[#7aa2f7]/90 transition uppercase font-mono text-[9.5px] flex items-center gap-1 shrink-0"
                        >
                          {isExporting === r.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Exporting...
                            </>
                          ) : (
                            <>
                              <Send className="w-3 h-3" />
                              Compile & Dispatch
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {exportSuccessMsg[r.id] && (
                      <div className="bg-[#9ece6a]/10 border border-[#9ece6a]/30 p-2 rounded text-[#9ece6a] font-mono text-[10px] font-bold text-center animate-pulse uppercase">
                        {exportSuccessMsg[r.id]}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
