import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Activity, 
  Wifi, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight,
  RefreshCw
} from "lucide-react";
import { Device, ThreatLog, SystemAlert } from "../types";

interface DashboardOverviewProps {
  devices: Device[];
  threatLogs: ThreatLog[];
  alerts: SystemAlert[];
  securityScore: number;
  onClearAlerts: () => void;
  onSelectTab: (tab: string) => void;
  trafficMbps: number;
  loadPercent: number;
  hostname: string;
  onRefresh?: () => void;
}

export default function DashboardOverview({
  devices,
  threatLogs,
  alerts,
  securityScore,
  onClearAlerts,
  onSelectTab,
  trafficMbps,
  loadPercent,
  hostname,
  onRefresh
}: DashboardOverviewProps) {
  const [networkTraffic, setNetworkTraffic] = useState<number[]>([0, 0]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Append real host throughput samples for the interface telemetry graph
  useEffect(() => {
    setNetworkTraffic(prev => {
      const next = [...prev, trafficMbps];
      return next.length > 30 ? next.slice(next.length - 30) : next;
    });
  }, [trafficMbps]);

  const triggerManualRefresh = () => {
    setIsRefreshing(true);
    onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const activeDevices = devices.filter(d => d.status === "Online").length;
  const criticalAlerts = alerts.filter(a => a.severity === "critical").length;
  const warningAlerts = alerts.filter(a => a.severity === "warning").length;

  // Convert points to SVG polyline coordinates
  const svgWidth = 500;
  const svgHeight = 120;
  const padding = 10;
  const maxTrafficVal = Math.max(...networkTraffic, 100);

  const getPointsStr = () => {
    if (networkTraffic.length < 2) {
      const y = svgHeight - padding;
      return `${padding},${y} ${svgWidth - padding},${y}`;
    }
    return networkTraffic.map((val, idx) => {
      const x = padding + (idx / (networkTraffic.length - 1)) * (svgWidth - padding * 2);
      const y = svgHeight - padding - (val / maxTrafficVal) * (svgHeight - padding * 2);
      return `${x},${y}`;
    }).join(" ");
  };

  const getAreaPointsStr = () => {
    const points = getPointsStr();
    const startX = padding;
    const endX = svgWidth - padding;
    const bottomY = svgHeight - padding;
    return `${startX},${bottomY} ${points} ${endX},${bottomY}`;
  };

  return (
    <div className="p-4 overflow-y-auto h-full space-y-4 bg-[#0b0c0f] font-sans text-[#a9b1d6]">
      {/* Upper Status Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#24283b] pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-100 tracking-tight uppercase">Security & Health Monitor</h2>
          <p className="text-[#565f89] text-[11px]">Real-time status monitor for Windows nodes and local client devices.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerManualRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1b26] hover:bg-[#24283b] text-[#7aa2f7] rounded border border-[#24283b] text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-[#bb9af7]" : ""}`} />
            Refresh Nodes
          </button>
          <div className="text-[10px] bg-[#16161e] text-[#a9b1d6] border border-[#24283b] px-3 py-1.5 rounded font-mono">
            HOST: <span className="text-[#7aa2f7]">{(hostname || "local").toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Grid of 4 Core Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Posture Score */}
        <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3 flex items-center justify-between relative overflow-hidden">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider">Security Posture</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-black text-slate-100">{securityScore}</span>
              <span className="text-xs font-semibold text-[#565f89]">/100</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-[#9ece6a]">
              <CheckCircle2 className="w-3 h-3" />
              Fully Compliant
            </div>
          </div>
          {/* Circular Progress Ring */}
          <div className="relative w-12 h-12 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="24" cy="24" r="18" stroke="#16161e" strokeWidth="3" fill="transparent" />
              <circle 
                cx="24" 
                cy="24" 
                r="18" 
                stroke="#7aa2f7" 
                strokeWidth="3" 
                fill="transparent" 
                strokeDasharray={113}
                strokeDashoffset={113 - (113 * securityScore) / 100}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <ShieldCheck className="w-4 h-4 text-[#7aa2f7] absolute" />
          </div>
        </div>

        {/* Network Connections */}
        <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3 flex items-center justify-between cursor-pointer hover:border-[#7aa2f7]/50 transition" onClick={() => onSelectTab("network")}>
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider">Local Network</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-black text-slate-100">{activeDevices}</span>
              <span className="text-xs font-semibold text-[#565f89]">/ {devices.length} Online</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[#7aa2f7]">
              <Wifi className="w-3 h-3" />
              Range: {(() => {
                const ip = devices[0]?.ip;
                if (!ip) return "Unknown subnet";
                const parts = ip.split(".");
                return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
              })()}
            </div>
          </div>
          <div className="p-2 rounded bg-[#16161e] text-[#7aa2f7] border border-[#24283b]">
            <Wifi className="w-4 h-4" />
          </div>
        </div>

        {/* System Load */}
        <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3 flex items-center justify-between cursor-pointer hover:border-[#7aa2f7]/50 transition" onClick={() => onSelectTab("tasks")}>
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider">System CPU Load</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-black text-slate-100">{loadPercent}%</span>
              <span className="text-xs font-semibold text-[#565f89]">Core Avg</span>
            </div>
            {/* Health status bar */}
            <div className="w-24 bg-[#16161e] h-1 rounded overflow-hidden mt-1.5">
              <div className="bg-[#7aa2f7] h-full" style={{ width: `${loadPercent}%` }}></div>
            </div>
          </div>
          <div className="p-2 rounded bg-[#16161e] text-[#bb9af7] border border-[#24283b]">
            <Activity className="w-4 h-4" />
          </div>
        </div>

        {/* Device Alerts */}
        <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider">Connected Alerts</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-black text-slate-100">{alerts.length}</span>
              <span className="text-xs font-semibold text-[#565f89]">active triggers</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[9px] bg-[#f7768e]/10 text-[#f7768e] px-1 rounded border border-[#f7768e]/20 font-bold">
                {criticalAlerts} Critical
              </span>
              <span className="text-[9px] bg-[#e0af68]/10 text-[#e0af68] px-1 rounded border border-[#e0af68]/20 font-bold">
                {warningAlerts} Warning
              </span>
            </div>
          </div>
          <div className="p-2 rounded bg-[#16161e] text-[#f7768e] border border-[#24283b] relative">
            {alerts.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#f7768e] rounded-full border border-[#16161e] animate-pulse"></span>
            )}
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Charts & Alarm Feed Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Network Traffic Line Graph (2/3 width) */}
        <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3 lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-slate-200 font-bold text-xs uppercase tracking-tight">Network Interface Telemetry</h3>
              <p className="text-[#565f89] text-[10px]">Active aggregated transfer rate across local gateway interface nodes.</p>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#7aa2f7] bg-[#7aa2f7]/10 border border-[#7aa2f7]/20 px-2 py-0.5 rounded">
              <span className="w-1.5 h-1.5 bg-[#7aa2f7] rounded-full animate-pulse"></span>
              Rate: {networkTraffic[networkTraffic.length - 1]} Mbps
            </div>
          </div>

          {/* SVG Line Graph */}
          <div className="w-full h-24 bg-[#16161e] rounded border border-[#24283b] p-1 overflow-hidden relative">
            {/* Grid lines */}
            <div className="absolute inset-y-0 left-0 right-0 flex flex-col justify-between pointer-events-none p-1.5 opacity-5">
              <div className="border-b border-white w-full"></div>
              <div className="border-b border-white w-full"></div>
              <div className="border-b border-white w-full"></div>
            </div>
            
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
              {/* Gradient Area */}
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7aa2f7" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#7aa2f7" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <polygon points={getAreaPointsStr()} fill="url(#areaGrad)" />
              
              {/* Path stroke line */}
              <polyline
                fill="none"
                stroke="#7aa2f7"
                strokeWidth="2"
                points={getPointsStr()}
                className="transition-all duration-300"
              />

              {/* Dynamic point bubble on the last element */}
              {(() => {
                const idx = networkTraffic.length - 1;
                const x = padding + (idx / (networkTraffic.length - 1)) * (svgWidth - padding * 2);
                const y = svgHeight - padding - (networkTraffic[idx] / maxTrafficVal) * (svgHeight - padding * 2);
                return (
                  <g>
                    <circle cx={x} cy={y} r="3.5" fill="#7aa2f7" />
                    <circle cx={x} cy={y} r="8" fill="#7aa2f7" fillOpacity="0.2" className="animate-ping" />
                  </g>
                );
              })()}
            </svg>
          </div>

          <div className="flex justify-between items-center text-[9px] text-[#565f89] font-mono mt-1.5">
            <span>-30 SECONDS</span>
            <span>-15 SECONDS</span>
            <span>CURRENT METRIC</span>
          </div>
        </div>

        {/* Real-time Alert Notification Feed (1/3 width) */}
        <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3 flex flex-col h-[180px] lg:h-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-200 font-bold text-xs uppercase tracking-tight">Resource Alarms</h3>
            {alerts.length > 0 && (
              <button
                onClick={onClearAlerts}
                className="text-[9px] text-[#7aa2f7] hover:text-[#f7768e] transition font-bold"
              >
                Clear Log
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
            {alerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#565f89] text-[10px] py-4 space-y-1">
                <CheckCircle2 className="w-5 h-5 text-[#9ece6a]" />
                <span>All network clients stable</span>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-2 rounded border flex items-start gap-2 transition text-[11px] ${
                    alert.severity === "critical"
                      ? "bg-[#f7768e]/10 border-[#f7768e]/20 text-[#f7768e]"
                      : "bg-[#e0af68]/10 border-[#e0af68]/20 text-[#e0af68]"
                  }`}
                >
                  <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${alert.severity === "critical" ? "text-[#f7768e]" : "text-[#e0af68]"}`} />
                  <div className="flex-1 space-y-0.5">
                    <p className="font-medium line-clamp-2 leading-tight">{alert.message}</p>
                    <div className="flex items-center gap-1.5 text-[9px] text-[#565f89] font-mono">
                      <span>{alert.deviceIp}</span>
                      <span>•</span>
                      <span>{alert.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Threat log table */}
      <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3">
        <div className="flex items-center justify-between mb-2 border-b border-[#24283b] pb-2">
          <div>
            <h3 className="text-slate-200 font-bold text-xs uppercase tracking-tight">Real-Time Threat Diagnostics</h3>
            <p className="text-[#565f89] text-[10px]">Policy violations, socket telemetry alerts, and intrusion prevention audits.</p>
          </div>
          <button
            onClick={() => onSelectTab("security")}
            className="flex items-center gap-0.5 text-xs text-[#7aa2f7] hover:text-[#89ddff] font-bold transition cursor-pointer"
          >
            Security Center
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] text-[#a9b1d6]">
            <thead className="bg-[#16161e] text-[#565f89] uppercase tracking-wider text-[9px] font-bold border-b border-[#24283b]">
              <tr>
                <th className="py-1.5 px-2">Timestamp</th>
                <th className="py-1.5 px-2">Target Host / Node</th>
                <th className="py-1.5 px-2">Diagnostic Threat Details</th>
                <th className="py-1.5 px-2">Severity</th>
                <th className="py-1.5 px-2">Mitigation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24283b]/40">
              {threatLogs.slice(0, 4).map((log) => (
                <tr key={log.id} className="hover:bg-[#24283b]/20 transition">
                  <td className="py-2 px-2 font-mono text-[#565f89] text-[10px]">{log.timestamp}</td>
                  <td className="py-2 px-2 font-bold text-slate-200">{log.host}</td>
                  <td className="py-2 px-2 text-[#a9b1d6] font-medium">{log.message}</td>
                  <td className="py-2 px-2">
                    <span className={`inline-flex items-center px-1 py-0.2 rounded text-[9px] font-bold border ${
                      log.severity === "Critical" 
                        ? "bg-[#f7768e]/10 text-[#f7768e] border-[#f7768e]/20" 
                        : log.severity === "Warning"
                        ? "bg-[#e0af68]/10 text-[#e0af68] border-[#e0af68]/20"
                        : "bg-[#7aa2f7]/10 text-[#7aa2f7] border-[#7aa2f7]/20"
                    }`}>
                      {log.severity}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <span className="flex items-center gap-1 text-[#9ece6a] font-bold text-[10px]">
                      <span className="w-1 h-1 rounded-full bg-[#9ece6a]"></span>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
