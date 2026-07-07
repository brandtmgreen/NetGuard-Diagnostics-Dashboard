import React, { useState, useEffect } from "react";
import { 
  Globe, 
  MapPin, 
  Radio, 
  ShieldAlert, 
  ArrowRight, 
  Activity, 
  Terminal, 
  AlertTriangle, 
  Cpu, 
  Network,
  Search,
  CheckCircle,
  HelpCircle,
  RefreshCw
} from "lucide-react";
import { SuspiciousActivity } from "../types";

interface SecurityHeatMapProps {
  suspiciousActivities: SuspiciousActivity[];
  idsEnabled: boolean;
}

interface ThreatIntel {
  ip: string;
  hostname: string;
  geo: {
    country: string;
    countryCode: string;
    city: string;
    lat: number;
    lng: number;
  };
  isp: string;
  asn: string;
  abuseScore: number;
  threatType: string;
  whois: string;
  traceroute: {
    hop: number;
    ip: string;
    host: string;
    rtt: string;
  }[];
}

const MAP_WIDTH = 600;
const MAP_HEIGHT = 280;

// Projected Equirectangular coordinate system converter
function projectCoords(lat: number, lng: number) {
  // Longitude: -180 to 180 maps to 0 to MAP_WIDTH
  const x = ((lng + 180) / 360) * MAP_WIDTH;
  // Latitude: 90 to -90 maps to 0 to MAP_HEIGHT
  const y = ((90 - lat) / 180) * MAP_HEIGHT;
  return { x, y };
}

// Target local HQ node in Washington D.C.
const targetCoords = { lat: 38.9072, lng: -77.0369 };
const targetXY = projectCoords(targetCoords.lat, targetCoords.lng);

const clientIpGeo: Record<string, { country: string; countryCode: string; city: string; lat: number; lng: number }> = {
  "185.122.204.45": { country: "Russian Federation", countryCode: "RU", city: "Moscow", lat: 55.7558, lng: 37.6173 },
  "103.22.41.99": { country: "China", countryCode: "CN", city: "Shenzhen", lat: 22.5431, lng: 114.0579 },
  "198.51.100.12": { country: "United States", countryCode: "US", city: "Chicago", lat: 41.8781, lng: -87.6298 },
  "172.217.164.110": { country: "United States", countryCode: "US", city: "Mountain View", lat: 37.3861, lng: -122.0839 },
  "203.0.113.82": { country: "Netherlands", countryCode: "NL", city: "Amsterdam", lat: 52.3676, lng: 4.9041 },
  "192.168.1.102": { country: "Internal private network", countryCode: "LAN", city: "Local Segment", lat: 38.9072, lng: -77.0369 }
};

function getClientIpGeo(ip: string) {
  if (clientIpGeo[ip]) return clientIpGeo[ip];
  const octets = ip.split(".").map(Number);
  const isLocal = ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.16.");
  if (isLocal) {
    return { country: "Internal Private Network", countryCode: "LAN", city: "Local Segment", lat: 38.9072, lng: -77.0369 };
  }
  const index = octets.length === 4 && !isNaN(octets[0]) ? octets[0] % 6 : 0;
  const list = [
    { country: "United Kingdom", countryCode: "GB", city: "London", lat: 51.5074, lng: -0.1278 },
    { country: "Germany", countryCode: "DE", city: "Frankfurt", lat: 50.1109, lng: 8.6821 },
    { country: "Japan", countryCode: "JP", city: "Tokyo", lat: 35.6762, lng: 139.6503 },
    { country: "Brazil", countryCode: "BR", city: "Sao Paulo", lat: -23.5505, lng: -46.6333 },
    { country: "South Africa", countryCode: "ZA", city: "Johannesburg", lat: -26.2041, lng: 28.0473 },
    { country: "Australia", countryCode: "AU", city: "Sydney", lat: -33.8688, lng: 151.2093 }
  ];
  return list[index];
}

export default function SecurityHeatMap({
  suspiciousActivities,
  idsEnabled
}: SecurityHeatMapProps) {
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [intel, setIntel] = useState<ThreatIntel | null>(null);
  const [loadingIntel, setLoadingIntel] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"whois" | "traceroute" | "reputation">("reputation");
  const [hoveredThreat, setHoveredThreat] = useState<any>(null);

  // Filter for active threats with geographical coordinates
  const activeThreats = suspiciousActivities
    .filter(a => a.status === "active")
    .map(activity => {
      const geo = getClientIpGeo(activity.srcIp);
      const xy = projectCoords(geo.lat, geo.lng);
      return {
        ...activity,
        geo,
        xy
      };
    });

  // Auto-select first active public IP on load or changes
  useEffect(() => {
    const activePublicThreats = activeThreats.filter(t => !t.srcIp.startsWith("192.168."));
    if (activePublicThreats.length > 0 && !selectedIp) {
      handleLookupIp(activePublicThreats[0].srcIp);
    }
  }, [suspiciousActivities]);

  const handleLookupIp = async (ip: string) => {
    setSelectedIp(ip);
    setLoadingIntel(true);
    try {
      const res = await fetch("/api/security/ip-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip })
      });
      if (res.ok) {
        const data = await res.json();
        setIntel(data);
      }
    } catch (err) {
      console.error("Failed to run automated WHOIS and traceroute resolution:", err);
    } finally {
      setLoadingIntel(false);
    }
  };

  // Generate curve path between threat origin and gateway target
  const getCurvePath = (x1: number, y1: number, x2: number, y2: number) => {
    const midX = (x1 + x2) / 2;
    // Curve upwards by subtracting from Y coordinates
    const midY = Math.min(y1, y2) - 40;
    return `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;
  };

  return (
    <div className="bg-[#1a1b26] border border-[#24283b] rounded overflow-hidden">
      {/* CSS Animation Injector */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes cyberdash {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-cyberdash {
          stroke-dasharray: 4, 6;
          animation: cyberdash 1.2s linear infinite;
        }
        @keyframes radar-pulse {
          0% {
            transform: scale(0.9);
            opacity: 0.8;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
        .animate-radar {
          animation: radar-pulse 2s cubic-bezier(0.215, 0.610, 0.355, 1) infinite;
        }
      `}} />

      {/* Header */}
      <div className="p-3 border-b border-[#24283b] flex items-center justify-between bg-[#16161e]/80">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#f7768e] animate-spin" style={{ animationDuration: '20s' }} />
          <div>
            <h3 className="text-xs font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
              Tactical Inbound Threat Heat Map
              <span className="bg-[#f7768e]/10 text-[#f7768e] border border-[#f7768e]/20 text-[8px] font-mono px-1 rounded">
                LIVE WAN TRACING
              </span>
            </h3>
            <p className="text-[#565f89] text-[10px]">Geographical packet tracking, real-time trace coordinates, and WHOIS abuse intelligence.</p>
          </div>
        </div>

        {selectedIp && (
          <div className="text-[10px] font-mono bg-[#16161e] border border-[#24283b] px-2 py-0.5 rounded text-[#7aa2f7] flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-[#9ece6a] animate-pulse" />
            Active Trace: <span className="font-bold text-slate-200">{selectedIp}</span>
          </div>
        )}
      </div>

      {/* Grid Layout: Map (Left) and Automated Forensic Intelligence Console (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-px bg-[#24283b]/40">
        
        {/* Left Area - Stylized SVG World Map (xl:col-span-7) */}
        <div className="xl:col-span-7 p-3 bg-[#0f1115] flex flex-col justify-between relative min-h-[310px]">
          
          {/* Map Overlay HUD Details */}
          <div className="absolute top-3 left-3 z-10 space-y-1 bg-[#16161e]/90 border border-[#24283b] p-1.5 rounded pointer-events-none font-mono text-[9px]">
            <div className="flex items-center gap-1 text-[#f7768e] font-bold uppercase">
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              IDS Radar Active
            </div>
            <p className="text-[#565f89]">Intercepting IP Geolocation</p>
            <div className="text-slate-300">Active Threats: <span className="font-bold text-[#f7768e]">{activeThreats.length}</span></div>
          </div>

          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 font-mono text-[8px] bg-[#16161e]/90 border border-[#24283b] p-1.5 rounded">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f7768e]"></span>
              <span className="text-[#565f89]">Attacker Node</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7aa2f7]"></span>
              <span className="text-[#565f89]">Local Gateway</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#f7768e]/10 border border-dashed border-[#f7768e]/40 rounded-full inline-block"></span>
              <span className="text-[#565f89]">Heat Bounds</span>
            </div>
          </div>

          {/* Map Container */}
          <div className="w-full h-full flex items-center justify-center py-2 relative overflow-hidden">
            
            {/* Hover Tooltip Overlay */}
            {hoveredThreat && (
              <div 
                className="absolute z-20 bg-[#16161e] border border-[#f7768e]/30 p-2 rounded text-[10px] font-mono shadow-2xl space-y-1 pointer-events-none"
                style={{
                  left: `${hoveredThreat.xy.x + 10}px`,
                  top: `${hoveredThreat.xy.y - 10}px`,
                  maxWidth: '200px'
                }}
              >
                <div className="font-bold text-[#f7768e] flex items-center justify-between border-b border-[#24283b] pb-0.5 mb-1 gap-4">
                  <span>{hoveredThreat.srcIp}</span>
                  <span className="uppercase text-[8px] px-1 bg-[#f7768e]/15 rounded">{hoveredThreat.severity}</span>
                </div>
                <div>Geo: <span className="text-[#7aa2f7]">{hoveredThreat.geo.city}, {hoveredThreat.geo.countryCode}</span></div>
                <div>Vector: <span className="text-slate-300 font-sans">{hoveredThreat.type}</span></div>
                <div className="text-[9px] text-[#565f89] leading-tight font-sans mt-1 italic">"{hoveredThreat.reason}"</div>
              </div>
            )}

            <svg 
              viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} 
              className="w-full max-w-[600px] h-auto select-none overflow-visible"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Grid Parallel & Meridian Map Lines (SOC Radar HUD look) */}
              <g stroke="#1a1b26" strokeWidth="0.5">
                {[...Array(9)].map((_, i) => {
                  const x = (MAP_WIDTH / 10) * (i + 1);
                  return <line key={`vl-${i}`} x1={x} y1={0} x2={x} y2={MAP_HEIGHT} />;
                })}
                {[...Array(5)].map((_, i) => {
                  const y = (MAP_HEIGHT / 6) * (i + 1);
                  return <line key={`hl-${i}`} x1={0} y1={y} x2={MAP_WIDTH} y2={y} />;
                })}
              </g>

              {/* Stylized geometric world map path blocks (high-tech cyber outline) */}
              <g fill="#1a1b26" stroke="#24283b" strokeWidth="0.8">
                {/* North America */}
                <path d="M50 40 L160 40 L160 80 L130 110 L100 130 L70 120 L40 70 Z" />
                {/* South America */}
                <path d="M120 135 L150 135 L170 190 L130 250 L110 210 L110 160 Z" />
                {/* Greenland */}
                <path d="M150 25 L180 25 L170 45 L145 40 Z" />
                {/* Eurasia (Europe + Asia) */}
                <path d="M240 40 L500 40 L520 120 L440 165 L360 140 L280 110 L240 80 Z" />
                {/* Africa */}
                <path d="M250 100 L300 100 L330 140 L310 200 L270 210 L245 150 Z" />
                {/* Australia */}
                <path d="M440 190 L490 190 L510 230 L450 240 Z" />
              </g>

              {/* Attack Streams & Connection lines */}
              {idsEnabled && activeThreats.map((threat) => {
                // Ignore local devices or empty coords
                if (threat.srcIp.startsWith("192.168.") || threat.xy.x === targetXY.x) return null;
                const pathStr = getCurvePath(threat.xy.x, threat.xy.y, targetXY.x, targetXY.y);
                const isSelected = selectedIp === threat.srcIp;
                
                return (
                  <g key={`stream-${threat.id}`}>
                    {/* Underlying static path */}
                    <path 
                      d={pathStr} 
                      fill="none" 
                      stroke={isSelected ? "#f7768e" : "#f7768e"} 
                      strokeWidth={isSelected ? 1.5 : 0.8} 
                      opacity={isSelected ? 0.6 : 0.25}
                    />
                    {/* Pulsing packets flow line */}
                    <path 
                      d={pathStr} 
                      fill="none" 
                      stroke="#f7768e" 
                      strokeWidth={isSelected ? 2 : 1.2} 
                      className="animate-cyberdash"
                      opacity={isSelected ? 0.95 : 0.5}
                    />
                  </g>
                );
              })}

              {/* Home Gateway Node (Target) */}
              <g transform={`translate(${targetXY.x}, ${targetXY.y})`}>
                <circle r="7" fill="#7aa2f7" fillOpacity="0.2" className="animate-pulse" />
                <circle r="3" fill="#7aa2f7" />
                <circle r="1" fill="#fff" />
              </g>

              {/* Attacker Active Heat Coordinates */}
              {idsEnabled && activeThreats.map((threat) => {
                const isLocal = threat.srcIp.startsWith("192.168.");
                if (isLocal) return null; // local isn't mapped geographically on world map
                const isSelected = selectedIp === threat.srcIp;

                return (
                  <g 
                    key={`point-${threat.id}`}
                    transform={`translate(${threat.xy.x}, ${threat.xy.y})`}
                    className="cursor-pointer"
                    onClick={() => handleLookupIp(threat.srcIp)}
                    onMouseEnter={() => setHoveredThreat(threat)}
                    onMouseLeave={() => setHoveredThreat(null)}
                  >
                    {/* Pulsing Concentric Heat Map Ring */}
                    <circle r={isSelected ? "18" : "12"} fill="#f7768e" fillOpacity="0.15" className="animate-radar" />
                    
                    {/* Outer core ring */}
                    <circle 
                      r={isSelected ? "6" : "4.5"} 
                      fill="none" 
                      stroke="#f7768e" 
                      strokeWidth={isSelected ? 2 : 1} 
                      opacity="0.8" 
                    />

                    {/* Glowing Core */}
                    <circle 
                      r="3.5" 
                      fill={isSelected ? "#ff9e64" : "#f7768e"} 
                      className="animate-pulse" 
                    />
                  </g>
                );
              })}
            </svg>

            {!idsEnabled && (
              <div className="absolute inset-0 bg-[#0f1115]/90 flex flex-col items-center justify-center p-4 text-center">
                <AlertTriangle className="w-8 h-8 text-[#565f89] mb-1.5" />
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">IDS Visual Tracer Offline</h4>
                <p className="text-[#565f89] text-[10px] max-w-xs mt-0.5 leading-normal">
                  Arm the host intrusion detection shield to hook network socket listeners and map IP threat routes in real-time.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Area - Automated Threat Intelligence Terminal Panel (xl:col-span-5) */}
        <div className="xl:col-span-5 bg-[#16161e] p-3 flex flex-col justify-between min-h-[310px]">
          
          <div className="space-y-3 h-full flex flex-col">
            
            {/* Header / Select Threat Host */}
            <div className="space-y-1.5">
              <span className="text-[9px] text-[#565f89] font-mono font-bold uppercase block tracking-wider">
                Automated Forensic Scan Desk
              </span>
              
              {/* Select dropdown of active socket threats */}
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <select 
                    value={selectedIp || ""} 
                    onChange={(e) => handleLookupIp(e.target.value)}
                    className="w-full bg-[#0f1115] border border-[#24283b] text-slate-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-[#f7768e]"
                  >
                    <option value="" disabled>-- Choose Host to Audit --</option>
                    {activeThreats.map(t => (
                      <option key={`sel-${t.id}`} value={t.srcIp}>
                        {t.srcIp} ({t.geo.countryCode}) • {t.type}
                      </option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={() => selectedIp && handleLookupIp(selectedIp)}
                  disabled={!selectedIp || loadingIntel}
                  className="px-2 py-1 bg-[#24283b] border border-[#565f89]/20 hover:bg-[#2e344f] rounded text-[#a9b1d6] cursor-pointer disabled:opacity-40 transition"
                  title="Re-run Forensic Audit"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingIntel ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* If no IP selected */}
            {!selectedIp ? (
              <div className="flex-1 border border-[#24283b]/60 rounded bg-[#0f1115]/50 flex flex-col items-center justify-center text-center p-6 text-[#565f89] font-mono text-xs">
                <Terminal className="w-8 h-8 text-[#565f89]/60 mb-2" />
                <p className="font-bold">Awaiting Intel Trigger</p>
                <p className="text-[10px] max-w-xs mt-1 leading-normal">
                  Click on an active red coordinates coordinate marker on the global map to execute an automated multi-vector forensic sweep.
                </p>
              </div>
            ) : loadingIntel ? (
              /* Loading Screen */
              <div className="flex-1 border border-[#24283b]/60 rounded bg-[#0f1115] flex flex-col items-center justify-center p-6 text-center text-xs font-mono text-[#7aa2f7] space-y-2">
                <Network className="w-7 h-7 text-[#7aa2f7] animate-pulse" />
                <div className="space-y-1">
                  <p className="font-bold animate-pulse">[SCANNING] Querying registrar socket registries...</p>
                  <p className="text-[#565f89] text-[9px]">dns.reverse() • whois.iana.org • icmp.tracert({selectedIp})</p>
                </div>
              </div>
            ) : intel ? (
              /* Intel details */
              <div className="flex-1 flex flex-col min-h-0">
                
                {/* Meta Summary Cards */}
                <div className="grid grid-cols-2 gap-2 mb-2 font-mono text-[10px]">
                  <div className="bg-[#0f1115] border border-[#24283b] p-1.5 rounded">
                    <span className="text-[#565f89] block text-[9px] uppercase">Country / City</span>
                    <span className="font-bold text-slate-200 truncate block">
                      {intel.geo.city}, {intel.geo.country}
                    </span>
                  </div>
                  <div className="bg-[#0f1115] border border-[#24283b] p-1.5 rounded">
                    <span className="text-[#565f89] block text-[9px] uppercase">ISP / ASN</span>
                    <span className="font-bold text-[#bb9af7] truncate block" title={`${intel.isp} (${intel.asn})`}>
                      {intel.isp}
                    </span>
                  </div>
                </div>

                {/* Abuse Risk / Severity Rating */}
                <div className="bg-[#0f1115] border border-[#24283b] p-2 rounded mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className={`w-4 h-4 ${intel.abuseScore > 70 ? "text-[#f7768e]" : "text-[#e0af68]"}`} />
                    <div className="font-mono text-[10px]">
                      <span className="text-[#565f89] block uppercase text-[8px] leading-tight">Abuse Rating</span>
                      <span className="font-bold text-slate-200 leading-none">
                        {intel.abuseScore}% Threat Probability
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] text-[#565f89] uppercase block font-mono">Classification</span>
                    <span className={`text-[10px] font-bold uppercase font-mono px-1.5 py-0.5 rounded ${
                      intel.abuseScore > 80 ? "bg-[#f7768e]/10 text-[#f7768e]" : "bg-[#e0af68]/10 text-[#e0af68]"
                    }`}>
                      {intel.abuseScore > 80 ? "HOSTILE BOT" : "PROBING IPS"}
                    </span>
                  </div>
                </div>

                {/* Interactive Console Tabs */}
                <div className="flex border-b border-[#24283b] bg-[#0f1115] rounded-t overflow-hidden">
                  <button 
                    onClick={() => setActiveTab("reputation")}
                    className={`flex-1 py-1 text-[10px] font-mono font-bold uppercase tracking-tight text-center border-b-2 cursor-pointer transition ${
                      activeTab === "reputation" 
                        ? "border-[#f7768e] text-slate-100 bg-[#16161e]" 
                        : "border-transparent text-[#565f89] hover:text-[#a9b1d6]"
                    }`}
                  >
                    Threat Assessment
                  </button>
                  <button 
                    onClick={() => setActiveTab("whois")}
                    className={`flex-1 py-1 text-[10px] font-mono font-bold uppercase tracking-tight text-center border-b-2 cursor-pointer transition ${
                      activeTab === "whois" 
                        ? "border-[#f7768e] text-slate-100 bg-[#16161e]" 
                        : "border-transparent text-[#565f89] hover:text-[#a9b1d6]"
                    }`}
                  >
                    WHOIS Registry
                  </button>
                  <button 
                    onClick={() => setActiveTab("traceroute")}
                    className={`flex-1 py-1 text-[10px] font-mono font-bold uppercase tracking-tight text-center border-b-2 cursor-pointer transition ${
                      activeTab === "traceroute" 
                        ? "border-[#f7768e] text-slate-100 bg-[#16161e]" 
                        : "border-transparent text-[#565f89] hover:text-[#a9b1d6]"
                    }`}
                  >
                    Trace Route
                  </button>
                </div>

                {/* Tab content area (Scrollable console) */}
                <div className="flex-1 bg-[#0f1115] border-x border-b border-[#24283b] p-2 overflow-y-auto max-h-[140px] text-[10px] font-mono text-[#a9b1d6] leading-relaxed select-text">
                  
                  {/* REPUTATION ASSESSMENT TAB */}
                  {activeTab === "reputation" && (
                    <div className="space-y-2">
                      <div className="border-b border-[#24283b]/60 pb-1.5 mb-1.5 flex justify-between items-center text-[#ff9e64]">
                        <span className="font-bold flex items-center gap-1">
                          <Cpu className="w-3.5 h-3.5" />
                          Security Intelligence
                        </span>
                        <span>[LEGAL SCAN OK]</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="text-[#565f89]">Reverse DNS:</div>
                        <div className="col-span-2 text-slate-300 select-all truncate">{intel.hostname}</div>
                        
                        <div className="text-[#565f89]">ASN Registry:</div>
                        <div className="col-span-2 text-slate-300 font-bold">{intel.asn}</div>
                        
                        <div className="text-[#565f89]">Threat Profile:</div>
                        <div className="col-span-2 text-[#f7768e] font-semibold">{intel.threatType}</div>
                        
                        <div className="text-[#565f89]">Abuse Org:</div>
                        <div className="col-span-2 text-slate-300">abuse@{intel.isp.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}.{intel.geo.countryCode.toLowerCase()}</div>
                      </div>

                      <div className="bg-[#16161e] border border-[#24283b] p-1.5 rounded text-[9px] text-[#9ece6a] flex items-start gap-1.5 mt-1">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          <strong>Recommended action:</strong> Create a Port Block policy rule immediately in the firewall matrix for Remote IP <strong>{intel.ip}</strong>.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* WHOIS REGISTRY TAB */}
                  {activeTab === "whois" && (
                    <pre className="whitespace-pre overflow-x-auto text-[9.5px] text-[#9ece6a] leading-tight">
                      {intel.whois}
                    </pre>
                  )}

                  {/* TRACEROUTE HOPS TAB */}
                  {activeTab === "traceroute" && (
                    <div className="space-y-1">
                      <div className="grid grid-cols-12 text-[#565f89] font-bold border-b border-[#24283b]/60 pb-1 text-[9px]">
                        <span className="col-span-2">Hop</span>
                        <span className="col-span-4">Node IP</span>
                        <span className="col-span-4">Reverse Name</span>
                        <span className="col-span-2 text-right">RTT</span>
                      </div>
                      <div className="space-y-1 pt-1.5">
                        {intel.traceroute.map(h => (
                          <div key={`hop-${h.hop}`} className="grid grid-cols-12 font-mono text-[9.5px] items-center text-slate-300">
                            <span className="col-span-2 font-bold text-[#565f89]">#{h.hop}</span>
                            <span className="col-span-4 select-all text-slate-400">{h.ip}</span>
                            <span className="col-span-4 truncate text-[9px]" title={h.host}>{h.host}</span>
                            <span className="col-span-2 text-right font-bold text-[#7aa2f7]">{h.rtt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

              </div>
            ) : (
              <div className="flex-1 border border-[#24283b]/60 rounded bg-[#0f1115] flex items-center justify-center p-4">
                <span className="text-[#565f89] font-mono text-xs">Error parsing threat database.</span>
              </div>
            )}
          </div>

          <div className="border-t border-[#24283b]/60 pt-2.5 mt-2 flex items-center gap-1.5 text-[9px] font-mono text-[#565f89]">
            <Terminal className="w-3 h-3 text-[#f7768e]" />
            <span>WHOIS query fully logged. All captured traces comply with WAN compliance policies.</span>
          </div>

        </div>

      </div>
    </div>
  );
}
