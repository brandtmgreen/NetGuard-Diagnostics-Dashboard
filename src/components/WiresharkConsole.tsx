import React, { useState, useEffect, useRef } from "react";
import { 
  ShieldAlert, 
  Terminal, 
  Search, 
  Activity, 
  Sparkles, 
  Play, 
  Square,
  RefreshCw,
  Eye,
  Settings,
  Database,
  Filter,
  ArrowRight,
  Fingerprint,
  Info,
  Check,
  Download
} from "lucide-react";
import { CapturedPacket } from "../types";

interface WiresharkConsoleProps {
  onAddFirewallRule: (rule: { name: string; port: string; protocol: "TCP" | "UDP" | "All"; direction: "Inbound"; action: "Block" }) => void;
  onGenerateThreatReport: (report: { scanData: any; packetsData: any; sourceThreat: string }) => void;
}

export default function WiresharkConsole({ onAddFirewallRule, onGenerateThreatReport }: WiresharkConsoleProps) {
  const [interfaceName, setInterfaceName] = useState("");
  const [filterStr, setFilterStr] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [packets, setPackets] = useState<CapturedPacket[]>([]);
  const [selectedPacketId, setSelectedPacketId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [aiReportOutput, setAiReportOutput] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);

  const packetsStreamRef = useRef<CapturedPacket[]>([]);
  const streamTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [interfaces, setInterfaces] = useState<Array<{ name: string; ip: string; type: string }>>([]);

  // Load the real host network interface list
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/network/interfaces");
        const data = await res.json();
        if (data?.success && Array.isArray(data.interfaces)) {
          const mapped = data.interfaces.map((i: any) => ({
            name: i.interfaceName,
            ip: i.address,
            type: i.internal ? "Local Loopback Interface" : `${i.family} Network Interface`
          }));
          setInterfaces(mapped);
          const primary = mapped.find((i: any) => !i.type.includes("Loopback")) || mapped[0];
          if (primary) setInterfaceName(primary.name);
        }
      } catch (err) {
        console.error("Failed to load network interfaces:", err);
      }
    })();
  }, []);

  // Stop capturing on unmount
  useEffect(() => {
    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    };
  }, []);

  const handleStartCapture = async () => {
    setIsLoading(true);
    setPackets([]);
    setSelectedPacketId(null);
    setAiReportOutput("");
    setReportGenerated(false);

    try {
      // Load initial batch of captured packets from backend simulator
      const response = await fetch("/api/security/wireshark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter: filterStr, count: 20, interfaceName })
      });
      const data = await response.json();
      
      setPackets(data.packets);
      packetsStreamRef.current = data.packets;
      setIsLoading(false);
      setIsCapturing(true);

      // Set up a live interval to capture scrolling packets in real-time!
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
      
      let nextId = data.packets.length + 1;
      streamTimerRef.current = setInterval(async () => {
        // Fetch incremental next packets
        try {
          const streamResponse = await fetch("/api/security/wireshark", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filter: filterStr, count: 2, interfaceName })
          });
          const streamData = await streamResponse.json();
          
          if (streamData.packets && streamData.packets.length > 0) {
            const enrichedPackets = streamData.packets.map((p: any, idx: number) => ({
              ...p,
              id: nextId + idx
            }));
            nextId += enrichedPackets.length;

            setPackets(prev => {
              const merged = [...prev, ...enrichedPackets];
              // Cap at 100 packets to avoid memory lag
              if (merged.length > 80) merged.shift();
              return merged;
            });
          }
        } catch (e) {
          console.error("Failed to stream packets:", e);
        }
      }, 3500);

    } catch (err: any) {
      console.error("Failed to start packet capture:", err);
      setIsLoading(false);
    }
  };

  const handleStopCapture = () => {
    setIsCapturing(false);
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  };

  const handleClearCapture = () => {
    handleStopCapture();
    setPackets([]);
    setSelectedPacketId(null);
    setAiReportOutput("");
    setReportGenerated(false);
  };

  // Generate automated deep AI audit on captured packet trace
  const handleAnalyzeTraceAI = async () => {
    if (packets.length === 0) return;
    setIsAiLoading(true);
    setAiReportOutput("");
    
    try {
      const suspectPackets = packets.filter(p => p.severity === "critical" || p.severity === "warning");
      const sampleTrace = packets.slice(0, 15).map(p => ({
        no: p.id,
        time: p.timestamp,
        src: p.source,
        dst: p.destination,
        proto: p.protocol,
        len: p.length,
        info: p.info,
        hasThreatSignature: p.severity !== "normal"
      }));

      // Query AI to analyze captured packets
      const response = await fetch("/api/security/ai-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packetsData: { interface: interfaceName, filter: filterStr, packetsSample: sampleTrace },
          sourceThreat: suspectPackets.length > 0 
            ? `Wireshark Trace: ${suspectPackets[0].info}` 
            : `General packet capture audit on interface ${interfaceName}`
        })
      });
      const data = await response.json();

      let auditText = `=== NETGUARD AI WIRESHARK ANALYST AGENT ===\n`;
      auditText += `Audit Timestamp: ${new Date().toLocaleString()}\n`;
      auditText += `Target Threat Classification: ${data.title}\n`;
      auditText += `Severity: [${data.severity.toUpperCase()}]\n`;
      auditText += `Attack Vector: ${data.attackVector}\n\n`;
      
      auditText += `Executive Summary:\n${data.executiveSummary}\n\n`;
      
      auditText += `Key Findings from Packet Trace Inspection:\n`;
      data.findings.forEach((f: string, i: number) => {
        auditText += `  [${i+1}] ${f}\n`;
      });
      
      auditText += `\nRecommended Mitigations Checklist:\n`;
      data.mitigations.forEach((m: any, i: number) => {
        auditText += `  [${i+1}] ${m.action} (${m.type.toUpperCase()}) - status: ${m.status.toUpperCase()}\n`;
        auditText += `      Action Details: ${m.details}\n`;
      });

      setAiReportOutput(auditText);
      setReportGenerated(true);
      setIsAiLoading(false);

      // Trigger high-level report update callback in App state
      onGenerateThreatReport({
        scanData: null,
        packetsData: sampleTrace,
        sourceThreat: suspectPackets.length > 0 ? suspectPackets[0].info : `Packet Capture Filter: ${filterStr || "All Interfaces"}`
      });

    } catch (err: any) {
      console.error("AI trace analysis failed:", err);
      setAiReportOutput(`[ERROR] Secure AI traffic model trace scanner offline: ${err.message || err}`);
      setIsAiLoading(false);
    }
  };

  const handleApplyPacketBlockRule = (port: string, proto: string, reason: string) => {
    onAddFirewallRule({
      name: `Block suspicious ${proto} port ${port}: ${reason}`,
      port: port,
      protocol: proto === "UDP" ? "UDP" : "TCP",
      direction: "Inbound",
      action: "Block"
    });
  };

  const selectedPacket = packets.find(p => p.id === selectedPacketId);

  // Return protocol-specific background colors (matching standard Wireshark layout)
  const getWiresharkColorClass = (proto: string, severity?: string) => {
    if (severity === "critical") return "bg-[#f7768e]/15 text-[#f7768e] border-l-2 border-[#f7768e]";
    if (severity === "warning") return "bg-[#e0af68]/15 text-[#e0af68] border-l-2 border-[#e0af68]";
    
    switch (proto) {
      case "HTTP": return "bg-[#9ece6a]/10 text-[#9ece6a] hover:bg-[#9ece6a]/20";
      case "SMB": return "bg-[#e0af68]/10 text-[#e0af68] hover:bg-[#e0af68]/20";
      case "DNS": return "bg-[#7bc6e3]/10 text-[#7bc6e3] hover:bg-[#7bc6e3]/20";
      case "UDP": return "bg-[#7bc6e3]/5 text-[#7bc6e3]/90 hover:bg-[#7bc6e3]/15";
      case "ICMP": return "bg-[#bb9af7]/10 text-[#bb9af7] hover:bg-[#bb9af7]/20";
      case "TLS": return "bg-[#a9b1d6]/5 text-[#a9b1d6]/80 hover:bg-[#a9b1d6]/15";
      default: return "hover:bg-[#24283b]/25";
    }
  };

  return (
    <div className="p-4 bg-[#0b0c0f] text-[#a9b1d6] h-full flex flex-col space-y-4 overflow-y-auto">
      {/* Header Panel */}
      <div className="border-b border-[#24283b] pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <span className="p-1 rounded bg-[#e0af68]/10 text-[#e0af68] border border-[#e0af68]/20">
              <Eye className="w-4 h-4" />
            </span>
            Wireshark Packet Capture & Console
          </h2>
          <p className="text-[#565f89] text-[11px]">Real-time packet capture, filter network interfaces, inspect deep frames and memory hexadecimal offsets.</p>
        </div>
        <div className="flex gap-2 font-mono text-[10px]">
          <span className="bg-[#16161e] border border-[#24283b] px-2 py-1 text-[#565f89] rounded">
            BUFFER: <span className="text-[#9ece6a]">80 FRAMES</span>
          </span>
        </div>
      </div>

      {/* Capture Control configuration bar */}
      <div className="bg-[#1a1b26] border border-[#24283b] p-2.5 rounded flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Select NIC Interface */}
          <div className="flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-[#565f89]" />
            <select
              value={interfaceName}
              onChange={(e) => setInterfaceName(e.target.value)}
              disabled={isCapturing}
              className="bg-[#0b0c0f] border border-[#24283b] rounded text-xs text-[#a9b1d6] px-2 py-1 focus:outline-none focus:border-[#e0af68] font-mono h-7 cursor-pointer"
            >
              {interfaces.map(i => (
                <option key={i.name} value={i.name} className="font-mono">
                  {i.name} ({i.ip}) - {i.type}
                </option>
              ))}
            </select>
          </div>

          <div className="h-4 w-px bg-[#24283b] hidden md:block"></div>

          {/* Wireshark filter syntax */}
          <div className="flex-1 min-w-[200px] flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#565f89]" />
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Enter capture filter (e.g., port 445, tcp, telnet, dns)..."
                value={filterStr}
                onChange={(e) => setFilterStr(e.target.value)}
                disabled={isCapturing}
                className="w-full bg-[#0b0c0f] border border-[#24283b] rounded py-1 pl-2.5 pr-20 text-xs text-[#a9b1d6] placeholder-[#565f89] focus:outline-none focus:border-[#e0af68] font-mono h-7"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[#565f89] uppercase">
                Bpf Syntax
              </span>
            </div>
          </div>
        </div>

        {/* Start/Stop buttons */}
        <div className="flex gap-2">
          {isCapturing ? (
            <button
              onClick={handleStopCapture}
              className="px-3.5 py-1 bg-[#f7768e] text-slate-950 rounded text-xs font-bold uppercase flex items-center gap-1.5 hover:bg-[#f7768e]/90 transition"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop Capture
            </button>
          ) : (
            <button
              onClick={handleStartCapture}
              disabled={isLoading}
              className="px-3.5 py-1 bg-[#9ece6a] text-slate-950 rounded text-xs font-bold uppercase flex items-center gap-1.5 hover:bg-[#9ece6a]/90 transition disabled:opacity-40"
            >
              {isLoading ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              Capture Live
            </button>
          )}

          <button
            onClick={handleClearCapture}
            className="px-2.5 py-1 border border-[#24283b] hover:bg-[#24283b]/60 text-[#a9b1d6] rounded text-xs font-bold uppercase flex items-center gap-1 transition"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Interactive Wireshark Panes (Packet list grid + dissection details + hex offsets) */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-3 min-h-[300px]">
        {/* Packets Stream list (8/12) */}
        <div className="xl:col-span-8 bg-[#1a1b26] border border-[#24283b] rounded flex flex-col overflow-hidden h-[380px] xl:h-full">
          {/* List Title Header */}
          <div className="p-2 border-b border-[#24283b] bg-[#16161e] flex justify-between items-center text-[10px] uppercase font-bold text-[#565f89] font-mono select-none">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Captured Frame Buffer ({packets.length} Packet Rows)
            </span>
            {isCapturing && (
              <span className="text-[#9ece6a] flex items-center gap-1 font-bold animate-pulse">
                ● Live Streaming Sockets
              </span>
            )}
          </div>

          {/* Wireshark Header Columns */}
          <div className="bg-[#111219] border-b border-[#24283b] grid grid-cols-12 text-[10px] font-bold font-mono text-[#565f89] py-1.5 px-3 uppercase select-none shrink-0">
            <div className="col-span-1">No.</div>
            <div className="col-span-1.5">Time</div>
            <div className="col-span-2.5">Source IP</div>
            <div className="col-span-2.5">Destination IP</div>
            <div className="col-span-1.5">Proto</div>
            <div className="col-span-1">Len</div>
            <div className="col-span-2">Information</div>
          </div>

          {/* Packets Scrolling Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#24283b]/20 select-none">
            {packets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 space-y-2 opacity-50">
                <Activity className="w-10 h-10 text-[#565f89] animate-pulse" />
                <div className="text-xs uppercase font-bold text-[#565f89]">NIC Capturer Idle</div>
                <p className="text-[9px] text-[#565f89]">Click "Capture Live" above to open socket listening listeners.</p>
              </div>
            ) : (
              packets.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPacketId(p.id)}
                  className={`grid grid-cols-12 text-[10px] font-mono py-1 px-3 cursor-pointer items-center transition-all ${
                    selectedPacketId === p.id 
                      ? "bg-[#7aa2f7] text-slate-950 font-bold border-l-2 border-slate-950" 
                      : getWiresharkColorClass(p.protocol, p.severity)
                  }`}
                >
                  <div className="col-span-1">{p.id}</div>
                  <div className="col-span-1.5 font-mono truncate">{p.timestamp}</div>
                  <div className="col-span-2.5 font-bold truncate">{p.source}</div>
                  <div className="col-span-2.5 font-bold truncate">{p.destination}</div>
                  <div className="col-span-1.5">
                    <span className="font-extrabold uppercase">{p.protocol}</span>
                  </div>
                  <div className="col-span-1 font-semibold">{p.length}</div>
                  <div className="col-span-2 truncate pr-1 text-[9.5px]" title={p.info}>
                    {p.info}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Packet Inspector (4/12) */}
        <div className="xl:col-span-4 flex flex-col gap-3 h-full overflow-hidden">
          {/* Inspector Details block */}
          <div className="flex-1 bg-[#1a1b26] border border-[#24283b] rounded flex flex-col overflow-hidden max-h-[220px]">
            <div className="p-2 border-b border-[#24283b] bg-[#16161e] flex items-center gap-1.5 text-[10px] uppercase font-bold text-[#565f89] font-mono">
              <Eye className="w-3.5 h-3.5" />
              Frame Dissect Analyzer
            </div>
            <div className="flex-1 p-3 overflow-y-auto font-mono text-[10px] space-y-2 select-text bg-[#0b0c0f]/40">
              {!selectedPacket ? (
                <div className="text-[#565f89] italic text-center py-10">Select a captured row packet to expand header offsets.</div>
              ) : (
                <div className="space-y-2">
                  <div className="border-b border-[#24283b]/60 pb-1.5 mb-1.5">
                    <div className="font-bold text-slate-200">Frame {selectedPacket.id}: {selectedPacket.length} bytes captured</div>
                    <div className="text-[9px] text-[#565f89]">Interingress link layer payload details:</div>
                  </div>

                  {/* Header breakdown details */}
                  <div className="space-y-1 text-slate-300">
                    <div>• Ethernet II (MAC Address offsets mapping)</div>
                    <div>• Internet Protocol Version 4 (IPv4 Header)</div>
                    <div className="pl-3 text-[#7aa2f7]">
                      - Source IP: {selectedPacket.source} <br />
                      - Destination IP: {selectedPacket.destination} <br />
                      - Total Length Offset: {selectedPacket.length} octets
                    </div>
                    <div>• Transmission Protocol layer ({selectedPacket.protocol})</div>
                    {selectedPacket.payloadDetails && (
                      <div className="pl-3 text-[#e0af68] bg-[#16161e] p-1.5 rounded border border-[#24283b]/50 mt-1">
                        <div className="font-bold border-b border-[#24283b]/40 pb-0.5 mb-1 text-[9px] uppercase">Payload attributes:</div>
                        {Object.entries(selectedPacket.payloadDetails).map(([key, val]) => (
                          <div key={key}>
                            - <span className="font-bold">{key}</span>: {String(val)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Threat mitigation trigger action */}
                  {selectedPacket.severity && selectedPacket.severity !== "normal" && (
                    <div className="pt-2">
                      <button
                        onClick={() => handleApplyPacketBlockRule(
                          selectedPacket.protocol === "SMB" ? "445" : selectedPacket.protocol === "HTTP" ? "80" : "23", 
                          selectedPacket.protocol,
                          selectedPacket.info
                        )}
                        className="w-full py-1 bg-[#f7768e]/10 hover:bg-[#f7768e] hover:text-slate-950 border border-[#f7768e]/30 text-[#f7768e] rounded text-[9px] font-bold uppercase transition"
                      >
                        Enforce Firewall Rule to Block This Port
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Hex Memory offsets block */}
          <div className="flex-1 bg-[#1a1b26] border border-[#24283b] rounded flex flex-col overflow-hidden max-h-[160px]">
            <div className="p-2 border-b border-[#24283b] bg-[#16161e] flex items-center gap-1.5 text-[10px] uppercase font-bold text-[#565f89] font-mono">
              <Fingerprint className="w-3.5 h-3.5" />
              Raw Hex & ASCII Offsets
            </div>
            <div className="flex-1 p-2 font-mono text-[9px] bg-[#0b0c0f] select-text overflow-auto leading-relaxed text-[#7aa2f7]">
              {!selectedPacket ? (
                <div className="text-[#565f89] italic text-center py-6">Select a captured frame packet to view raw offsets.</div>
              ) : (
                <div className="grid grid-cols-12 gap-2 h-full">
                  <div className="col-span-8 whitespace-pre text-[#a9b1d6]">{selectedPacket.hexDump}</div>
                  <div className="col-span-4 whitespace-pre border-l border-[#24283b] pl-2 text-[#9ece6a]">{selectedPacket.asciiDump}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Agentic AI Threat Hunter Analysis container */}
      <div className="bg-[#1a1b26] border border-[#24283b] rounded overflow-hidden flex flex-col shrink-0 min-h-[160px]">
        <div className="px-3 py-1.5 border-b border-[#24283b] bg-[#16161e] flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase text-[#bb9af7] font-mono flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            AI Agentic Threat Hunter Analyst
          </span>
          {packets.length > 0 && (
            <button
              onClick={handleAnalyzeTraceAI}
              disabled={isAiLoading}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded flex items-center gap-1 transition ${
                isAiLoading 
                  ? "bg-[#24283b] text-[#565f89] cursor-not-allowed" 
                  : "bg-[#bb9af7] text-slate-950 hover:bg-[#bb9af7]/90"
              }`}
            >
              {isAiLoading ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Analyzing Packets...
                </>
              ) : (
                <>
                  <Activity className="w-3 h-3" />
                  Analyze Trace with AI Agent
                </>
              )}
            </button>
          )}
        </div>

        <div className="p-3 bg-[#0b0c0f]/35 flex-1 font-mono text-[10px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {isAiLoading ? (
            <div className="py-6 text-center text-[#bb9af7] flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[9px] animate-pulse">
              <Sparkles className="w-4 h-4 animate-spin" />
              Secure AI Agent is auditing traces for injection exploits, cleartext passphrases, and socket anomalies...
            </div>
          ) : aiReportOutput ? (
            <div className="text-slate-300">
              <div className="bg-[#bb9af7]/10 p-2 rounded border border-[#bb9af7]/30 text-[#bb9af7] font-bold mb-3 flex items-center justify-between uppercase text-[9px]">
                <span className="flex items-center gap-1.5">
                  <Fingerprint className="w-3.5 h-3.5" />
                  AI SECURE AUDIT REGISTERED SUCCESSFULLY
                </span>
                {reportGenerated && (
                  <span className="text-[#9ece6a] flex items-center gap-1">
                    <Check className="w-3 h-3" /> Threat Incident File Created
                  </span>
                )}
              </div>
              {aiReportOutput}
            </div>
          ) : (
            <div className="text-[#565f89] italic text-center py-6 flex flex-col items-center justify-center space-y-1">
              <Info className="w-5 h-5 text-[#24283b]" />
              <div>Traffic Inspector Idle. Initiate live packet stream capture and click "Analyze Trace with AI Agent" to construct an instant vulnerability file report.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
