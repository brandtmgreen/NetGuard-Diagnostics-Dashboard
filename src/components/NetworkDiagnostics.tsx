import React, { useState, useEffect } from "react";
import { 
  Wifi, 
  Search, 
  Activity, 
  ShieldAlert, 
  Zap, 
  Cpu, 
  HardDrive, 
  HelpCircle,
  TrendingUp,
  RefreshCw,
  Server,
  Laptop,
  Terminal,
  Network,
  Smartphone,
  Play,
  CheckCircle2,
  ListFilter,
  AlertCircle
} from "lucide-react";
import { Device } from "../types";

interface NetworkDiagnosticsProps {
  devices: Device[];
  onPingDevice: (ip: string) => void;
  onScanDevice: (ip: string) => void;
  onToggleStatus: (ip: string) => void;
  onImportDevices?: (newDevices: Device[]) => void;
}

export default function NetworkDiagnostics({
  devices,
  onPingDevice,
  onScanDevice,
  onToggleStatus,
  onImportDevices
}: NetworkDiagnosticsProps) {
  const [filter, setFilter] = useState("");
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [simulatedLoad, setSimulatedLoad] = useState<Record<string, { cpu: number, mem: number }>>({});
  const [viewMode, setViewMode] = useState<"map" | "list" | "discovery">("map");
  const [hoveredIp, setHoveredIp] = useState<string | null>(null);

  // Discovery Scanner States
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [targetSubnet, setTargetSubnet] = useState("192.168.1.0/24");
  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [serverNetInfo, setServerNetInfo] = useState<any>(null);
  const [selectedDiscoveredIp, setSelectedDiscoveredIp] = useState<string | null>(null);
  const [autoDiscoverEnabled, setAutoDiscoverEnabled] = useState(true);

  // Real-time fluctuating pings & dynamic bandwidth updates for scanned subnet clients
  useEffect(() => {
    if (discoveredDevices.length === 0) return;

    const interval = setInterval(() => {
      setDiscoveredDevices(prev => 
        prev.map(d => {
          if (d.status === "Offline") return d;
          
          let currentPing = parseInt(d.ping) || 5;
          currentPing = Math.max(1, Math.min(150, currentPing + (Math.floor(Math.random() * 5) - 2)));
          
          const tx = parseFloat((Math.random() * 250 + 2).toFixed(1));
          const rx = parseFloat((Math.random() * 1200 + 10).toFixed(1));

          return {
            ...d,
            ping: `${currentPing}ms`,
            bandwidth: { tx, rx }
          };
        })
      );
    }, 1500);

    return () => clearInterval(interval);
  }, [discoveredDevices.length]);

  const handleStartDiscovery = async () => {
    setIsDiscovering(true);
    setScanProgress(0);
    setDiscoveredDevices([]);
    setScanLogs([`[${new Date().toLocaleTimeString()}] [SYSTEM] Initializing NetGuard network discovery engine...`]);
    setSelectedDiscoveredIp(null);

    try {
      const res = await fetch("/api/network/discover");
      const data = await res.json();
      
      if (data.success) {
        setServerNetInfo({
          hostname: data.hostname,
          platform: data.platform,
          release: data.release,
          interfaces: data.interfaces
        });

        const pool = data.devices || [];
        
        let currentProgress = 0;
        const totalDuration = 4000; // 4 seconds sweep
        const intervalTime = 100;
        const totalTicks = totalDuration / intervalTime;
        const tickIncrement = 100 / totalTicks;

        const timer = setInterval(() => {
          currentProgress += tickIncrement;
          const roundedProgress = Math.min(100, Math.floor(currentProgress));
          setScanProgress(roundedProgress);

          if (roundedProgress % 15 === 0 && roundedProgress < 95) {
            const tempIp = `192.168.1.${Math.floor(Math.random() * 254) + 1}`;
            setScanLogs(prev => [
              ...prev,
              `[${new Date().toLocaleTimeString()}] [PING] Probing remote segment IP: ${tempIp}... Timeout (No reply)`,
            ]);
          }

          const targetCount = Math.floor((roundedProgress / 100) * pool.length);
          if (targetCount > 0) {
            setDiscoveredDevices(prev => {
              const currentCount = prev.length;
              if (currentCount < targetCount) {
                const newDevicesToAdd = pool.slice(currentCount, targetCount);
                
                newDevicesToAdd.forEach((item: any) => {
                  setScanLogs(l => [
                    ...l,
                    `[${new Date().toLocaleTimeString()}] [DISCOVERED] Host '${item.name}' found at ${item.ip} [MAC: ${item.mac}] (${item.vendor})`
                  ]);
                });

                return [...prev, ...newDevicesToAdd];
              }
              return prev;
            });
          }

          if (roundedProgress >= 100) {
            clearInterval(timer);
            setIsDiscovering(false);
            setScanLogs(prev => [
              ...prev,
              `[${new Date().toLocaleTimeString()}] [SUCCESS] Subnet scanning finalized. Identified ${pool.length} active hosts.`,
              `[${new Date().toLocaleTimeString()}] [SYSTEM] Core interface bound to ${data.interfaces[0]?.address || '127.0.0.1'} [MAC: ${data.interfaces[0]?.mac || 'unknown'}]`
            ]);
          }
        }, intervalTime);

      } else {
        throw new Error(data.error || "Unknown API Error");
      }

    } catch (err: any) {
      console.error(err);
      setIsDiscovering(false);
      setScanLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [ERROR] Scan sweep aborted: ${err.message || err}`
      ]);
    }
  };

  const handleImportToInventory = (item: any) => {
    if (onImportDevices) {
      onImportDevices([{
        ip: item.ip,
        name: item.name,
        type: item.type,
        status: "Online",
        ping: item.ping,
        cpu: Math.floor(Math.random() * 15) + 5,
        memory: Math.floor(Math.random() * 25) + 10,
        mac: item.mac
      }]);
    }
  };

  const handleImportAll = () => {
    if (onImportDevices && discoveredDevices.length > 0) {
      const formatted = discoveredDevices.map(d => ({
        ip: d.ip,
        name: d.name,
        type: d.type,
        status: d.status as "Online" | "Offline",
        ping: d.ping,
        cpu: Math.floor(Math.random() * 15) + 5,
        memory: Math.floor(Math.random() * 25) + 10,
        mac: d.mac
      }));
      onImportDevices(formatted);
    }
  };

  // Identify core gateway/router for the hub-and-spoke star topology
  const routerDevice = devices.find(
    (d) => d.type.toLowerCase() === "router" || d.name.toLowerCase().includes("router")
  ) || devices[0];

  const leafDevices = devices.filter((d) => d.ip !== routerDevice?.ip);

  // Oval geometry for neat distribution on a 600x380 viewport
  const centerX = 300;
  const centerY = 190;
  const radiusX = 180;
  const radiusY = 115;

  const nodePositions = devices.map((d) => {
    if (d.ip === routerDevice?.ip) {
      return { ip: d.ip, x: centerX, y: centerY, isCenter: true };
    }
    const leafIndex = leafDevices.findIndex((ld) => ld.ip === d.ip);
    const totalLeaves = leafDevices.length;
    // Spreading angles symmetrically starting at top (-Math.PI/2)
    const angle = (leafIndex * (2 * Math.PI) / totalLeaves) - Math.PI / 2;
    return {
      ip: d.ip,
      x: centerX + radiusX * Math.cos(angle),
      y: centerY + radiusY * Math.sin(angle),
      isCenter: false
    };
  });

  const getDeviceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "router":
        return <Wifi className="w-4 h-4 text-[#e0af68]" />;
      case "windows":
        return <Cpu className="w-4 h-4 text-[#7aa2f7]" />;
      case "mac":
        return <Laptop className="w-4 h-4 text-[#7aa2f7]" />;
      case "linux":
        return <Terminal className="w-4 h-4 text-[#9ece6a]" />;
      case "iot":
        return <Activity className="w-4 h-4 text-[#f7768e]" />;
      default:
        return <Cpu className="w-4 h-4 text-[#a9b1d6]" />;
    }
  };

  // Simulate subtle real-time fluctuation of client device resources
  useEffect(() => {
    const initLoads: Record<string, { cpu: number, mem: number }> = {};
    devices.forEach(d => {
      initLoads[d.ip] = { cpu: d.cpu, mem: d.memory };
    });
    setSimulatedLoad(initLoads);

    const interval = setInterval(() => {
      setSimulatedLoad(prev => {
        const next = { ...prev };
        devices.forEach(d => {
          if (d.status === "Offline") {
            next[d.ip] = { cpu: 0, mem: 0 };
            return;
          }
          const cpuOffset = Math.floor(Math.random() * 11) - 5; // -5 to +5
          const memOffset = Math.floor(Math.random() * 5) - 2;   // -2 to +2
          const baseCpu = prev[d.ip]?.cpu ?? d.cpu;
          const baseMem = prev[d.ip]?.mem ?? d.memory;
          
          next[d.ip] = {
            cpu: Math.max(2, Math.min(99, baseCpu + cpuOffset)),
            mem: Math.max(5, Math.min(95, baseMem + memOffset))
          };
        });
        return next;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [devices]);

  const filteredDevices = devices.filter(d => 
    d.name.toLowerCase().includes(filter.toLowerCase()) || 
    d.ip.includes(filter) ||
    d.type.toLowerCase().includes(filter.toLowerCase())
  );

  const selectedDevice = devices.find(d => d.ip === selectedIp);

  return (
    <div className="p-4 overflow-y-auto h-full flex flex-col space-y-4 bg-[#0b0c0f] font-sans text-[#a9b1d6]">
      {/* Page Title */}
      <div className="border-b border-[#24283b] pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-100 uppercase tracking-tight">LAN Node Diagnostics</h2>
          <p className="text-[#565f89] text-[11px]">Subnet diagnostics, ICMP delay counters, and remote device telemetry streams.</p>
        </div>
        <div className="text-[10px] bg-[#16161e] border border-[#24283b] px-2.5 py-1 text-[#565f89] font-mono rounded">
          SUBNET: <span className="text-[#9ece6a]">192.168.1.0/24</span>
        </div>
      </div>

      {/* Grid: Left Column (Device List), Right Column (Diagnostic Details) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[350px]">
        
        {/* Device List Section (7/12) */}
        <div className="lg:col-span-7 bg-[#1a1b26] border border-[#24283b] rounded flex flex-col overflow-hidden">
          
          {/* List/Map Header & View Switcher */}
          <div className="p-2 border-b border-[#24283b] bg-[#16161e] flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-1.5 bg-[#0b0c0f] border border-[#24283b] p-0.5 rounded">
              <button
                onClick={() => setViewMode("map")}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded transition cursor-pointer ${
                  viewMode === "map" 
                    ? "bg-[#7aa2f7] text-slate-950" 
                    : "text-[#565f89] hover:text-[#a9b1d6]"
                }`}
                id="btn-view-topology"
              >
                Topology Map
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded transition cursor-pointer ${
                  viewMode === "list" 
                    ? "bg-[#7aa2f7] text-slate-950" 
                    : "text-[#565f89] hover:text-[#a9b1d6]"
                }`}
                id="btn-view-nodes"
              >
                Nodes List
              </button>
              <button
                onClick={() => setViewMode("discovery")}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded transition cursor-pointer ${
                  viewMode === "discovery" 
                    ? "bg-[#7aa2f7] text-slate-950" 
                    : "text-[#565f89] hover:text-[#a9b1d6]"
                }`}
                id="btn-view-discovery"
              >
                Device Discovery
              </button>
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-[#565f89] absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search hosts, IPs..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-[#0b0c0f] border border-[#24283b] rounded py-1 pl-7 pr-2.5 text-[11px] text-[#a9b1d6] placeholder-[#565f89] focus:outline-none focus:border-[#7aa2f7] font-mono h-7"
                id="topology-search"
              />
            </div>

            <div className="text-[10px] text-[#565f89] font-mono font-bold self-center shrink-0">
              {devices.filter(d => d.status === "Online").length}/{devices.length} ONLINE
            </div>
          </div>

          {/* View Container */}
          {viewMode === "map" ? (
            /* Topology SVG map area */
            <div className="relative flex-1 min-h-[380px] bg-[#0b0c0f]/20 flex flex-col justify-between overflow-hidden">
              {/* Ambient animated grid backdrop */}
              <svg viewBox="0 0 600 380" className="w-full h-full select-none" id="network-topology-svg">
                <defs>
                  <pattern id="diagGrid" width="24" height="24" patternUnits="userSpaceOnUse">
                    <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#24283b" strokeWidth="0.5" opacity="0.25" />
                  </pattern>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                
                <rect width="100%" height="100%" fill="url(#diagGrid)" />
                
                {/* Draw Connection Lines first (so they render behind circles) */}
                {devices.map((d) => {
                  if (d.ip === routerDevice?.ip) return null;
                  const pos = nodePositions.find((p) => p.ip === d.ip);
                  if (!pos) return null;
                  
                  const isOnline = d.status === "Online";
                  const isSelected = selectedIp === d.ip;
                  const stats = simulatedLoad[d.ip] || { cpu: d.cpu, mem: d.memory };
                  
                  // Dim the link if filter search is active and doesn't match this device
                  const matchesFilter = filter === "" || 
                    d.name.toLowerCase().includes(filter.toLowerCase()) || 
                    d.ip.includes(filter) ||
                    d.type.toLowerCase().includes(filter.toLowerCase());

                  return (
                    <g key={`link-${d.ip}`} opacity={matchesFilter ? 1 : 0.25} className="transition-opacity duration-300">
                      {/* Base Connection Trace */}
                      <line
                        x1={centerX}
                        y1={centerY}
                        x2={pos.x}
                        y2={pos.y}
                        stroke={isOnline ? "#7aa2f7" : "#24283b"}
                        strokeWidth={isSelected ? "2.5" : "1.5"}
                        opacity={isOnline ? (isSelected ? "0.8" : "0.35") : "0.2"}
                        strokeDasharray={isOnline ? undefined : "3 4"}
                        className="transition-all duration-300"
                      />
                      
                      {/* Under-glow for active selected nodes */}
                      {isOnline && isSelected && (
                        <line
                          x1={centerX}
                          y1={centerY}
                          x2={pos.x}
                          y2={pos.y}
                          stroke="#7aa2f7"
                          strokeWidth="5"
                          opacity="0.15"
                          filter="url(#glow)"
                        />
                      )}

                      {/* Glowing Traffic Dash Particles flowing outward */}
                      {isOnline && (
                        <line
                          x1={centerX}
                          y1={centerY}
                          x2={pos.x}
                          y2={pos.y}
                          stroke={stats.cpu > 80 ? "#f7768e" : "#9ece6a"}
                          strokeWidth="2"
                          strokeDasharray="6 24"
                          opacity="0.9"
                        >
                          <animate
                            attributeName="stroke-dashoffset"
                            values="120;0"
                            dur={stats.cpu > 80 ? "0.9s" : "2.2s"}
                            repeatCount="indefinite"
                          />
                        </line>
                      )}
                    </g>
                  );
                })}

                {/* Draw Nodes */}
                {devices.map((d) => {
                  const pos = nodePositions.find((p) => p.ip === d.ip);
                  if (!pos) return null;
                  
                  const isOnline = d.status === "Online";
                  const isSelected = selectedIp === d.ip;
                  const stats = simulatedLoad[d.ip] || { cpu: d.cpu, mem: d.memory };
                  const hasAlert = isOnline && (stats.cpu > 80 || stats.mem > 85);
                  const isCenter = d.ip === routerDevice?.ip;
                  const r = isCenter ? 23 : 18;

                  const matchesFilter = filter === "" || 
                    d.name.toLowerCase().includes(filter.toLowerCase()) || 
                    d.ip.includes(filter) ||
                    d.type.toLowerCase().includes(filter.toLowerCase());

                  return (
                    <g
                      key={`node-${d.ip}`}
                      onClick={() => setSelectedIp(d.ip)}
                      onMouseEnter={() => setHoveredIp(d.ip)}
                      onMouseLeave={() => setHoveredIp(null)}
                      opacity={matchesFilter ? 1 : 0.25}
                      className="cursor-pointer group transition-all duration-300"
                      id={`node-group-${d.ip.replace(/\./g, "-")}`}
                    >
                      {/* Outer Glowing boundary for selected node */}
                      {isSelected && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={r + 5}
                          fill="none"
                          stroke="#bb9af7"
                          strokeWidth="1.5"
                          strokeDasharray="4 2"
                          className="animate-spin"
                          style={{
                            transformOrigin: `${pos.x}px ${pos.y}px`,
                            animationDuration: "12s"
                          }}
                        />
                      )}

                      {/* Alert ping ripple */}
                      {hasAlert && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={r + 7}
                          fill="none"
                          stroke="#f7768e"
                          strokeWidth="1"
                          className="animate-ping"
                          style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
                        />
                      )}

                      {/* Base Circle */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={r}
                        fill={isSelected ? "#1f2335" : "#16161f"}
                        stroke={
                          isSelected 
                            ? "#bb9af7" 
                            : isOnline 
                              ? (hasAlert ? "#f7768e" : "#7aa2f7") 
                              : "#565f89"
                        }
                        strokeWidth={isSelected ? "2.5" : "1.5"}
                        className="transition-all duration-300 group-hover:fill-[#24283b]"
                      />

                      {/* Icon container */}
                      <foreignObject
                        x={pos.x - 9}
                        y={pos.y - 9}
                        width="18"
                        height="18"
                        className="pointer-events-none"
                      >
                        <div className="flex items-center justify-center w-full h-full text-slate-200">
                          {getDeviceIcon(d.type)}
                        </div>
                      </foreignObject>

                      {/* Heartbeat Status LED Indicator */}
                      {isOnline && (
                        <g>
                          <circle
                            cx={pos.x + r - 2}
                            cy={pos.y - r + 2}
                            r="3"
                            fill={hasAlert ? "#e0af68" : "#9ece6a"}
                            stroke="#16161f"
                            strokeWidth="1"
                          />
                          <circle
                            cx={pos.x + r - 2}
                            cy={pos.y - r + 2}
                            r="3"
                            fill="none"
                            stroke={hasAlert ? "#e0af68" : "#9ece6a"}
                            strokeWidth="0.5"
                            className="animate-ping"
                            style={{ transformOrigin: `${pos.x + r - 2}px ${pos.y - r + 2}px` }}
                          />
                        </g>
                      )}

                      {/* Text Label Container */}
                      <text
                        x={pos.x}
                        y={pos.y + r + 13}
                        textAnchor="middle"
                        className={`font-sans font-bold text-[9px] select-none pointer-events-none transition-all ${
                          isSelected ? "fill-[#bb9af7]" : "fill-slate-200"
                        }`}
                      >
                        {d.name}
                      </text>
                      <text
                        x={pos.x}
                        y={pos.y + r + 22}
                        textAnchor="middle"
                        className="font-mono text-[8px] fill-[#565f89] select-none pointer-events-none"
                      >
                        {d.ip}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Absolute positioning overlay for tooltip */}
              {hoveredIp && (() => {
                const hoverDevice = devices.find((d) => d.ip === hoveredIp);
                if (!hoverDevice) return null;
                const hoverPos = nodePositions.find((p) => p.ip === hoveredIp);
                if (!hoverPos) return null;
                const stats = simulatedLoad[hoverDevice.ip] || { cpu: hoverDevice.cpu, mem: hoverDevice.memory };
                const isOnline = hoverDevice.status === "Online";

                return (
                  <div
                    className="absolute z-10 p-2.5 bg-[#16161e] border border-[#7aa2f7]/40 rounded shadow-2xl text-[10px] w-48 font-mono pointer-events-none transition-all duration-150"
                    style={{
                      left: `${(hoverPos.x / 600) * 100}%`,
                      top: `${(hoverPos.y / 380) * 100}%`,
                      transform: "translate(-50%, -100%)",
                      marginTop: (hoverDevice.ip === routerDevice?.ip) ? "-36px" : "-31px"
                    }}
                    id="topology-tooltip"
                  >
                    <div className="border-b border-[#24283b] pb-1.5 mb-1.5">
                      <div className="font-bold text-slate-100 flex items-center justify-between">
                        <span className="truncate max-w-[110px]">{hoverDevice.name}</span>
                        <span className={`px-1 rounded text-[8px] uppercase ${
                          isOnline ? "bg-[#9ece6a]/15 text-[#9ece6a]" : "bg-[#f7768e]/15 text-[#f7768e]"
                        }`}>
                          {hoverDevice.status}
                        </span>
                      </div>
                      <div className="text-[9px] text-[#565f89] mt-0.5">{hoverDevice.ip}</div>
                    </div>

                    {isOnline ? (
                      <div className="space-y-1 text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-[#565f89]">CPU LOAD:</span>
                          <span className={stats.cpu > 80 ? "text-[#f7768e] font-bold" : "text-[#7aa2f7] font-bold"}>
                            {stats.cpu}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#565f89]">MEM USE:</span>
                          <span className={stats.mem > 85 ? "text-[#e0af68] font-bold" : "text-[#bb9af7] font-bold"}>
                            {stats.mem}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#565f89]">LATENCY:</span>
                          <span className="text-[#9ece6a] font-bold">{hoverDevice.ping}</span>
                        </div>
                        <div className="flex justify-between text-[8px] text-[#565f89] border-t border-[#24283b]/60 pt-1 mt-1">
                          <span>MAC ADDR:</span>
                          <span className="truncate">{hoverDevice.mac}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[#f7768e] italic text-center py-1">
                        Host is currently offline.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Map Legend Row */}
              <div className="px-3 py-1.5 border-t border-[#24283b] bg-[#16161e]/90 flex flex-wrap gap-x-4 gap-y-1 items-center justify-between font-mono text-[9px] text-[#565f89] shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 bg-[#7aa2f7] block"></span>
                  <span>ACTIVE TRAFFIC LINK</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 border-t border-dashed border-[#565f89] block"></span>
                  <span>OFFLINE LINK</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9ece6a] animate-ping block"></span>
                  <span>HEARTBEAT OK</span>
                </div>
                <div className="text-right ml-auto text-[8px] text-[#7aa2f7] font-bold">
                  * CLICK NODE TO INSPECT TELEMETRY
                </div>
              </div>
            </div>
          ) : viewMode === "list" ? (
            /* List Body */
            <div className="flex-1 overflow-y-auto divide-y divide-[#24283b]/30" id="nodes-list-body">
              {filteredDevices.map(d => {
                const stats = simulatedLoad[d.ip] || { cpu: d.cpu, mem: d.memory };
                const isSelected = selectedIp === d.ip;
                const hasAlert = d.status === "Online" && (stats.cpu > 80 || stats.mem > 85);
                
                return (
                  <div
                    key={d.ip}
                    onClick={() => setSelectedIp(d.ip)}
                    className={`p-2.5 flex items-center justify-between cursor-pointer transition ${
                      isSelected ? "bg-[#24283b]" : "hover:bg-[#24283b]/30"
                    }`}
                    id={`list-item-${d.ip.replace(/\./g, "-")}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Online status indicator */}
                      <div className="relative">
                        <span className={`w-2.5 h-2.5 rounded-full block border border-[#1a1b26] ${
                          d.status === "Online" ? "bg-[#9ece6a]" : "bg-[#565f89]"
                        }`}></span>
                        {hasAlert && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#f7768e] rounded-full animate-ping"></span>
                        )}
                      </div>

                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-200">{d.name}</span>
                          <span className="text-[9px] font-mono bg-[#16161e] border border-[#24283b] px-1 text-[#565f89] rounded">
                            {d.type}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-[#565f89] flex items-center gap-1.5">
                          <span>{d.ip}</span>
                          <span>•</span>
                          <span>MAC: {d.mac}</span>
                        </div>
                      </div>
                    </div>

                    {/* Resource Micro Stats */}
                    <div className="flex items-center gap-4 shrink-0 font-mono text-[10px]">
                      {d.status === "Online" ? (
                        <>
                          <div className="hidden sm:block text-right w-16">
                            <div className="text-[9px] text-[#565f89]">CPU LOAD</div>
                            <span className={`font-bold ${stats.cpu > 80 ? "text-[#f7768e]" : "text-[#a9b1d6]"}`}>
                              {stats.cpu}%
                            </span>
                          </div>
                          <div className="hidden sm:block text-right w-16">
                            <div className="text-[9px] text-[#565f89]">MEM USE</div>
                            <span className={`font-bold ${stats.mem > 85 ? "text-[#e0af68]" : "text-[#a9b1d6]"}`}>
                              {stats.mem}%
                            </span>
                          </div>
                          <div className="text-right w-14">
                            <div className="text-[9px] text-[#565f89]">LATENCY</div>
                            <span className="text-[#7aa2f7] font-bold">{d.ping}</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-[#565f89] uppercase font-bold text-[9px] tracking-wider">Host Dead</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredDevices.length === 0 && (
                <div className="p-8 text-center text-[#565f89] text-xs">
                  No local subnet nodes found matching filters.
                </div>
              )}
            </div>
          ) : (
            /* Discovery Body */
            <div className="flex-1 overflow-y-auto flex flex-col bg-[#16161e]/40 p-3 space-y-3 font-mono text-xs" id="discovery-panel-body">
              {/* Controls Block */}
              <div className="bg-[#16161e] border border-[#24283b] p-3 rounded space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
                  <div>
                    <span className="text-[10px] font-bold text-[#7aa2f7] block">ACTIVE ARP/ICMP DISCOVERY RANGE</span>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        value={targetSubnet}
                        onChange={(e) => setTargetSubnet(e.target.value)}
                        disabled={isDiscovering}
                        className="bg-[#0b0c0f] border border-[#24283b] rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-[#7aa2f7] w-36 font-mono"
                      />
                      <span className="text-[#565f89] text-[10px]">/24 Subnet Sweep</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[#565f89] text-[10px]">
                      <input
                        type="checkbox"
                        checked={autoDiscoverEnabled}
                        onChange={(e) => setAutoDiscoverEnabled(e.target.checked)}
                        className="rounded bg-[#0b0c0f] border-[#24283b] text-[#7aa2f7] focus:ring-0 focus:ring-offset-0"
                      />
                      Continuous Monitoring Sniffer
                    </label>
                    <button
                      onClick={handleStartDiscovery}
                      disabled={isDiscovering}
                      className="px-3 py-1.5 bg-[#7aa2f7] hover:bg-[#7aa2f7]/85 text-slate-950 font-bold rounded flex items-center gap-1.5 text-[10px] uppercase transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-[#7aa2f7]/10"
                    >
                      {isDiscovering ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Sweeping Segment...
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-slate-950" />
                          Initiate Scan Swarm
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Real-time progress */}
                {(isDiscovering || scanProgress > 0) && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-[#bb9af7] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-[#bb9af7] rounded-full animate-ping"></span>
                        {scanProgress < 100 ? "SUB-SEGMENT SWEEP UNDERWAY..." : "SCAN SEGMENT COMPLETED"}
                      </span>
                      <span className="text-[#9ece6a]">{scanProgress}%</span>
                    </div>
                    <div className="h-2 bg-[#0b0c0f] rounded border border-[#24283b] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#7aa2f7] to-[#bb9af7] transition-all duration-100"
                        style={{ width: `${scanProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Server Host info banner if fetched */}
              {serverNetInfo && (
                <div className="bg-[#16161e]/80 border border-[#24283b] p-2.5 rounded text-[10px] text-[#565f89] grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <span className="text-[#a9b1d6] font-bold block uppercase">Local Gateway Host</span>
                    <span className="text-slate-400 font-mono">{serverNetInfo.hostname} ({serverNetInfo.platform} {serverNetInfo.release})</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#a9b1d6] font-bold block uppercase">Primary Server NIC Interfaces</span>
                    <div className="flex flex-wrap gap-x-2 gap-y-1 text-slate-400 mt-0.5">
                      {serverNetInfo.interfaces.map((iface: any, idx: number) => (
                        <span key={idx} className="bg-[#0b0c0f] border border-[#24283b] px-1 rounded text-[9px]">
                          {iface.interfaceName}: <span className="text-[#7aa2f7]">{iface.address}</span> (MAC: {iface.mac})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Double Pane content: Discovered Devices list & Live Terminal Logs */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[250px]">
                {/* Discovered Devices list (7/12) */}
                <div className="lg:col-span-7 bg-[#16161e] border border-[#24283b] rounded flex flex-col overflow-hidden">
                  <div className="p-2 border-b border-[#24283b] bg-[#1a1b26] flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-300">DISCOVERED SUBNET NODES ({discoveredDevices.length})</span>
                    {discoveredDevices.length > 0 && (
                      <button
                        onClick={handleImportAll}
                        className="text-[9px] px-2 py-0.5 bg-[#9ece6a]/15 text-[#9ece6a] border border-[#9ece6a]/20 rounded hover:bg-[#9ece6a]/25 transition font-bold cursor-pointer"
                      >
                        IMPORT ALL TO MAP
                      </button>
                    )}
                  </div>
                  <div className="flex-1 divide-y divide-[#24283b]/40 overflow-y-auto max-h-[260px]">
                    {discoveredDevices.map((d) => {
                      const isAlreadyInInventory = devices.some(ex => ex.ip === d.ip);
                      const isSelected = selectedDiscoveredIp === d.ip;
                      return (
                        <div
                          key={d.ip}
                          onClick={() => setSelectedDiscoveredIp(d.ip)}
                          className={`p-2 flex items-center justify-between cursor-pointer transition ${
                            isSelected ? "bg-[#24283b]/60" : "hover:bg-[#24283b]/25"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="bg-[#0b0c0f] border border-[#24283b] p-1.5 rounded text-slate-300">
                              {getDeviceIcon(d.type)}
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-200 text-xs">{d.name}</span>
                                <span className="text-[8px] bg-[#0b0c0f] text-[#565f89] border border-[#24283b] px-1 rounded uppercase font-mono">
                                  {d.vendor}
                                </span>
                              </div>
                              <div className="text-[9px] text-[#565f89] font-mono mt-0.5">
                                IP: <span className="text-slate-300">{d.ip}</span> • MAC: <span className="text-slate-300">{d.mac}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 font-mono text-[9px]">
                            {d.bandwidth && d.status === "Online" && (
                              <div className="text-right hidden sm:block text-[#565f89]">
                                <div>TX: <span className="text-[#7aa2f7]">{d.bandwidth.tx} KB/s</span></div>
                                <div>RX: <span className="text-[#bb9af7]">{d.bandwidth.rx} KB/s</span></div>
                              </div>
                            )}
                            <div className="text-right">
                              <div className="text-[#9ece6a] font-bold">ONLINE</div>
                              <div className="text-[#565f89] text-[8px]">{d.ping}</div>
                            </div>
                            <div>
                              {isAlreadyInInventory ? (
                                <span className="px-1.5 py-0.5 bg-[#9ece6a]/10 text-[#9ece6a] rounded border border-[#9ece6a]/15 font-semibold text-[8px]">
                                  MAPPED
                                </span>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleImportToInventory(d);
                                  }}
                                  className="px-1.5 py-0.5 bg-[#7aa2f7]/15 text-[#7aa2f7] hover:bg-[#7aa2f7]/25 rounded border border-[#7aa2f7]/20 font-semibold text-[8px] transition cursor-pointer"
                                >
                                  ADD MAP
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {discoveredDevices.length === 0 && (
                      <div className="p-8 text-center text-[#565f89] space-y-2">
                        <Search className="w-6 h-6 mx-auto animate-pulse" />
                        <p className="text-[10px]">No active devices discovered on subnet. Trigger scan sequence above.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Console Log window (5/12) */}
                <div className="lg:col-span-5 bg-[#0b0c0f] border border-[#24283b] rounded flex flex-col overflow-hidden font-mono text-[9px] text-slate-300">
                  <div className="p-2 border-b border-[#24283b] bg-[#16161e] text-[#565f89] font-bold">
                    PACKET & SWEEPING MONITOR LOGS
                  </div>
                  <div className="flex-1 p-2 overflow-y-auto space-y-1 max-h-[260px] flex flex-col-reverse select-all scrollbar-thin scrollbar-thumb-[#24283b] scrollbar-track-[#16161e]">
                    {scanLogs.slice().reverse().map((log, index) => {
                      let color = "text-[#a9b1d6]";
                      if (log.includes("[ERROR]")) color = "text-[#f7768e]";
                      if (log.includes("[DISCOVERED]")) color = "text-[#9ece6a] font-bold";
                      if (log.includes("[SUCCESS]")) color = "text-[#bb9af7] font-bold";
                      if (log.includes("[SYSTEM]")) color = "text-[#7aa2f7]";
                      return (
                        <div key={index} className={`leading-tight whitespace-pre-wrap ${color}`}>
                          {log}
                        </div>
                      );
                    })}
                    {scanLogs.length === 0 && (
                      <div className="text-center text-[#565f89] py-12">
                        [MONITOR IDLE - WAITING FOR PACKET SWARM SWEEP]
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Diagnostic Details & Tools Panel (5/12) */}
        <div className="lg:col-span-5 bg-[#1a1b26] border border-[#24283b] rounded flex flex-col p-3 overflow-y-auto space-y-3 justify-between">
          {selectedDevice ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="border-b border-[#24283b] pb-2">
                <span className="text-[10px] font-bold text-[#7aa2f7] uppercase tracking-wider block">Node Inspected</span>
                <h3 className="font-bold text-sm text-slate-100">{selectedDevice.name}</h3>
                <span className="font-mono text-xs text-[#565f89]">{selectedDevice.ip}</span>
              </div>

              {/* Status and Toggle */}
              <div className="flex justify-between items-center p-2 bg-[#16161e] border border-[#24283b] rounded">
                <div className="text-xs">
                  <span className="text-[#565f89] block text-[10px] font-mono">STATE POWER</span>
                  <span className={`font-bold ${selectedDevice.status === "Online" ? "text-[#9ece6a]" : "text-[#f7768e]"}`}>
                    {selectedDevice.status === "Online" ? "Active / Connected" : "Inactive / Sleep"}
                  </span>
                </div>
                <button
                  onClick={() => onToggleStatus(selectedDevice.ip)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold border transition cursor-pointer uppercase ${
                    selectedDevice.status === "Online" 
                      ? "bg-[#f7768e]/10 text-[#f7768e] border-[#f7768e]/20 hover:bg-[#f7768e]/20" 
                      : "bg-[#9ece6a]/10 text-[#9ece6a] border-[#9ece6a]/20 hover:bg-[#9ece6a]/20"
                  }`}
                >
                  {selectedDevice.status === "Online" ? "Force Off" : "Force On"}
                </button>
              </div>

              {/* Connected Alerts / Stats details */}
              {selectedDevice.status === "Online" ? (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center text-[10px] text-[#565f89] font-mono mb-1">
                      <span>PROCESSOR MULTITHREAD CORES</span>
                      <span className="font-bold text-[#a9b1d6]">{(simulatedLoad[selectedDevice.ip]?.cpu ?? selectedDevice.cpu)}%</span>
                    </div>
                    <div className="h-2 bg-[#16161e] border border-[#24283b] rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          (simulatedLoad[selectedDevice.ip]?.cpu ?? selectedDevice.cpu) > 80 ? "bg-[#f7768e]" : "bg-[#7aa2f7]"
                        }`}
                        style={{ width: `${simulatedLoad[selectedDevice.ip]?.cpu ?? selectedDevice.cpu}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-[10px] text-[#565f89] font-mono mb-1">
                      <span>COMMITTED SYSTEM MEMORY</span>
                      <span className="font-bold text-[#a9b1d6]">{(simulatedLoad[selectedDevice.ip]?.mem ?? selectedDevice.memory)}%</span>
                    </div>
                    <div className="h-2 bg-[#16161e] border border-[#24283b] rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          (simulatedLoad[selectedDevice.ip]?.mem ?? selectedDevice.memory) > 85 ? "bg-[#e0af68]" : "bg-[#bb9af7]"
                        }`}
                        style={{ width: `${simulatedLoad[selectedDevice.ip]?.mem ?? selectedDevice.memory}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono text-[10px] border-t border-[#24283b] pt-3">
                    <div className="bg-[#16161e] p-2 rounded border border-[#24283b]">
                      <span className="text-[#565f89] block uppercase text-[8px]">NIC Jitter</span>
                      <span className="text-[#a9b1d6] font-bold">1.2ms Avg</span>
                    </div>
                    <div className="bg-[#16161e] p-2 rounded border border-[#24283b]">
                      <span className="text-[#565f89] block uppercase text-[8px]">DNS Resolution</span>
                      <span className="text-[#9ece6a] font-bold">0.4ms (OK)</span>
                    </div>
                    <div className="bg-[#16161e] p-2 rounded border border-[#24283b]">
                      <span className="text-[#565f89] block uppercase text-[8px]">Local Gateway Hops</span>
                      <span className="text-[#a9b1d6] font-bold">1 hop</span>
                    </div>
                    <div className="bg-[#16161e] p-2 rounded border border-[#24283b]">
                      <span className="text-[#565f89] block uppercase text-[8px]">TCP Open Sockets</span>
                      <span className="text-[#7aa2f7] font-bold">12 Active</span>
                    </div>
                  </div>

                  {/* High Density Trigger Warning Alert banner */}
                  {(simulatedLoad[selectedDevice.ip]?.cpu ?? selectedDevice.cpu) > 80 && (
                    <div className="bg-[#f7768e]/10 border-l-2 border-[#f7768e] p-2 rounded text-xs text-[#f7768e] font-mono">
                      <span className="font-bold">[ALERT] CPU SPIKE OVER 80%</span>
                      <p className="text-[#a9b1d6] text-[10px] mt-0.5">High CPU load detected on remote host. Kill processes or inspect logs to mitigate crash risks.</p>
                    </div>
                  )}

                  {(simulatedLoad[selectedDevice.ip]?.mem ?? selectedDevice.memory) > 85 && (
                    <div className="bg-[#e0af68]/10 border-l-2 border-[#e0af68] p-2 rounded text-xs text-[#e0af68] font-mono">
                      <span className="font-bold">[ALERT] MEMORY EXCEEDED 85%</span>
                      <p className="text-[#a9b1d6] text-[10px] mt-0.5">Ram commitment high. System may execute memory compression routines shortly.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-[#565f89] text-xs">
                  This device is currently offline. Power on the node to monitor resource streams.
                </div>
              )}

              {/* Action Tools Drawer */}
              <div className="border-t border-[#24283b] pt-3">
                <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider block mb-2">Diagnostic Action Suite</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onPingDevice(selectedDevice.ip)}
                    disabled={selectedDevice.status === "Offline"}
                    className="flex items-center justify-center gap-1 py-1.5 bg-[#16161e] hover:bg-[#24283b] border border-[#24283b] text-xs font-semibold rounded text-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5 text-[#7aa2f7]" />
                    Run Ping Tests
                  </button>
                  <button
                    onClick={() => onScanDevice(selectedDevice.ip)}
                    disabled={selectedDevice.status === "Offline"}
                    className="flex items-center justify-center gap-1 py-1.5 bg-[#16161e] hover:bg-[#24283b] border border-[#24283b] text-xs font-semibold rounded text-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-[#e0af68]" />
                    Query Open Ports
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#565f89] py-16 space-y-2">
              <Wifi className="w-8 h-8 text-[#565f89]" />
              <div className="text-center">
                <span className="text-xs font-bold block uppercase text-slate-400">No Target Host Selected</span>
                <p className="text-[10px] max-w-xs mt-1 leading-normal">Select a connected client from the subnet explorer tree to stream diagnostic feeds.</p>
              </div>
            </div>
          )}

          {/* Quick Informational Tips */}
          <div className="bg-[#16161e] p-2 rounded border border-[#24283b] flex items-start gap-2 text-[10px] text-[#565f89] font-mono">
            <HelpCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#bb9af7]" />
            <p className="leading-tight">Run `tracert {selectedDevice?.ip || "192.168.1.1"}` in the Interactive Terminal to map routes to local subnet gateway router nodes.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
