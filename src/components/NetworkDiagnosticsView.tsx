import { useMemo, useState } from "react";
import { Activity, ArrowRightLeft, Globe2, Loader2, Monitor, Network, Play, Radio, Router, Search, Server, Terminal } from "lucide-react";
import { api } from "../api";
import { AppState, Neighbor } from "../types";

interface Props {
  state: AppState;
}

const TOOLS = [
  { id: "ping", label: "Ping", command: (target: string) => `ping ${target}`, hint: "ICMP reachability" },
  { id: "tracert", label: "Trace route", command: (target: string) => `tracert ${target}`, hint: "8-hop route" },
  { id: "nslookup", label: "DNS lookup", command: (target: string) => `nslookup ${target}`, hint: "Resolve a name" },
] as const;

export default function NetworkDiagnosticsView({ state }: Props) {
  const [target, setTarget] = useState(state.host.gateway || state.interfaces[0]?.address || "8.8.8.8");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"neighbors" | "connections">("neighbors");
  const [selectedNeighbor, setSelectedNeighbor] = useState<Neighbor | null>(null);

  const connections = useMemo(() => {
    const term = query.toLowerCase();
    return state.connections
      .filter(item => !term || `${item.processName} ${item.localAddress} ${item.remoteAddress} ${item.state}`.toLowerCase().includes(term))
      .slice(0, 150);
  }, [state.connections, query]);

  const neighbors = useMemo(() => {
    const term = query.toLowerCase();
    return state.neighbors.filter(item => !term || `${item.ip} ${item.mac} ${item.state} ${item.interfaceAlias}`.toLowerCase().includes(term));
  }, [state.neighbors, query]);

  const topologyNeighbors = useMemo(() => {
    return state.neighbors
      .filter(item => item.ip && !/^(224\.|239\.|255\.)/.test(item.ip))
      .filter(item => !item.ip.endsWith(".255") && item.ip !== "255.255.255.255")
      .filter(item => item.ip !== state.host.gateway)
      .filter((item, index, all) => all.findIndex(candidate => candidate.ip === item.ip) === index)
      .slice(0, 12);
  }, [state.neighbors, state.host.gateway]);

  const run = async (command: string) => {
    setRunning(true);
    setError("");
    setOutput(`> ${command}\n`);
    try {
      const result = await api.terminal(command);
      setOutput(previous => `${previous}${result.output || "(no output)"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7dcfff]">Network diagnostics</div>
        <h1 className="mt-1 text-2xl font-black text-[#c0caf5]">Host, route and socket tools</h1>
        <p className="text-xs text-[#737aa2] mt-1">Read-only commands against real interfaces, neighbors and TCP sockets. No simulated network map.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Interfaces", value: state.interfaces.filter(item => !item.internal).length, icon: Network },
          { label: "Neighbors", value: state.neighbors.length, icon: Radio },
          { label: "TCP sockets", value: state.connections.length, icon: ArrowRightLeft },
          { label: "Gateway", value: state.host.gateway || "—", icon: Globe2 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-[#24283b] bg-[#161821] p-4">
            <Icon className="w-4 h-4 text-[#7dcfff]" />
            <div className="mt-2 text-[9px] font-black uppercase tracking-widest text-[#565f89]">{label}</div>
            <div className="mt-1 text-lg font-black text-[#c0caf5] truncate">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#24283b] bg-[#161821] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#24283b] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-[#7dcfff]" />
            <div>
              <h2 className="text-xs font-black text-[#c0caf5]">LAN topology map</h2>
              <p className="text-[9px] text-[#565f89]">Real ARP neighbors around {state.host.hostname}; click a node for details.</p>
            </div>
          </div>
          <span className="text-[9px] font-mono text-[#565f89]">{topologyNeighbors.length + 1} nodes</span>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-0">
          <div className="relative min-h-[300px] bg-[#0b0c0f] overflow-hidden">
            <svg viewBox="0 0 720 330" className="w-full h-[330px]" role="img" aria-label="LAN topology map">
              <defs>
                <radialGradient id="topology-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#7aa2f7" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#7aa2f7" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="360" cy="165" r="150" fill="url(#topology-glow)" />
              <line x1="360" y1="165" x2="360" y2="55" stroke="#e0af68" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.8" />
              {topologyNeighbors.map((neighbor, index) => {
                const angle = (index / Math.max(1, topologyNeighbors.length)) * Math.PI * 2 - Math.PI / 2;
                const x = 360 + Math.cos(angle) * 235;
                const y = 165 + Math.sin(angle) * 110;
                return <line key={`line-${neighbor.ip}`} x1="360" y1="165" x2={x} y2={y} stroke="#24283b" strokeWidth="1.2" />;
              })}
              <g>
                <circle cx="360" cy="55" r="24" fill="#e0af68" fillOpacity="0.12" stroke="#e0af68" strokeWidth="1.5" />
                <foreignObject x="344" y="41" width="32" height="28"><div className="flex h-full items-center justify-center text-[#e0af68]"><Router className="w-5 h-5" /></div></foreignObject>
                <text x="360" y="94" textAnchor="middle" fill="#e0af68" fontSize="9" fontFamily="monospace">{state.host.gateway || "gateway"}</text>
                <text x="360" y="106" textAnchor="middle" fill="#565f89" fontSize="7" fontFamily="monospace">GATEWAY</text>
              </g>
              <g onClick={() => setSelectedNeighbor(null)} className="cursor-pointer">
                <circle cx="360" cy="165" r="30" fill="#7aa2f7" fillOpacity="0.12" stroke="#7aa2f7" strokeWidth="1.5" />
                <foreignObject x="342" y="149" width="36" height="32"><div className="flex h-full items-center justify-center text-[#7aa2f7]"><Monitor className="w-5 h-5" /></div></foreignObject>
                <text x="360" y="210" textAnchor="middle" fill="#7aa2f7" fontSize="9" fontFamily="monospace">{state.host.hostname}</text>
                <text x="360" y="222" textAnchor="middle" fill="#565f89" fontSize="7" fontFamily="monospace">THIS HOST</text>
              </g>
              {topologyNeighbors.map((neighbor, index) => {
                const angle = (index / Math.max(1, topologyNeighbors.length)) * Math.PI * 2 - Math.PI / 2;
                const x = 360 + Math.cos(angle) * 235;
                const y = 165 + Math.sin(angle) * 110;
                const active = selectedNeighbor?.ip === neighbor.ip;
                const color = neighbor.state.toLowerCase() === "stale" ? "#565f89" : "#9ece6a";
                return (
                  <g key={neighbor.ip} onClick={() => setSelectedNeighbor(neighbor)} className="cursor-pointer">
                    <circle cx={x} cy={y} r={active ? 22 : 18} fill={color} fillOpacity={active ? 0.2 : 0.1} stroke={color} strokeWidth={active ? 2 : 1.2} />
                    <foreignObject x={x - 14} y={y - 14} width="28" height="28"><div className="flex h-full items-center justify-center" style={{ color }}><Server className="w-4 h-4" /></div></foreignObject>
                    <text x={x} y={y + 31} textAnchor="middle" fill={color} fontSize="8" fontFamily="monospace">{neighbor.ip}</text>
                  </g>
                );
              })}
            </svg>
            {topologyNeighbors.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-[10px] text-[#565f89]">No LAN neighbors in the ARP cache.</div>}
          </div>
          <div className="border-l border-[#24283b] p-4">
            <div className="text-[9px] font-black uppercase tracking-widest text-[#565f89]">Selected node</div>
            {selectedNeighbor ? (
              <div className="mt-3 space-y-2 text-[10px]">
                <div className="font-mono text-base font-black text-[#c0caf5]">{selectedNeighbor.ip}</div>
                {[["MAC", selectedNeighbor.mac || "unavailable"], ["State", selectedNeighbor.state], ["Interface", selectedNeighbor.interfaceAlias]].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-[#24283b] pb-1.5"><span className="uppercase tracking-wide text-[#565f89]">{label}</span><span className="text-right font-mono text-[#a9b1d6]">{value}</span></div>
                ))}
                <button onClick={() => void run(`ping ${selectedNeighbor.ip}`)} disabled={running} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[#7dcfff] disabled:opacity-40"><Play className="w-3 h-3" /> Ping node</button>
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-[#565f89]"><Server className="mt-0.5 h-4 w-4 shrink-0" /> Click a neighbor node to inspect its MAC, state and interface, or ping it from the diagnostic tools below.</div>
            )}
            <div className="mt-5 flex items-center gap-3 text-[8px] font-bold uppercase tracking-wider text-[#565f89]"><span className="w-2 h-2 rounded-full bg-[#7aa2f7]" /> host <span className="w-2 h-2 rounded-full bg-[#e0af68]" /> gateway <span className="w-2 h-2 rounded-full bg-[#9ece6a]" /> neighbor</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#24283b] bg-[#161821] p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-[#565f89]">Host or IP</label>
            <input value={target} onChange={event => setTarget(event.target.value)} placeholder="192.168.1.1 or example.com" className="mt-1 w-full rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs font-mono text-[#c0caf5] outline-none focus:border-[#7dcfff]/60" />
          </div>
          <div className="flex flex-wrap gap-2">
            {TOOLS.map(tool => (
              <button key={tool.id} onClick={() => void run(tool.command(target.trim()))} disabled={running || !target.trim()} className="inline-flex items-center gap-1.5 rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#a9b1d6] hover:border-[#7dcfff]/40 hover:text-[#7dcfff] disabled:opacity-40">
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} {tool.label}
              </button>
            ))}
          </div>
        </div>
        {error && <div className="mt-3 rounded-lg border border-[#f7768e]/30 bg-[#f7768e]/5 p-3 text-[10px] text-[#f7768e]">{error}</div>}
        {output && (
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-[#24283b] bg-[#0b0c0f] p-3 text-[10px] leading-relaxed whitespace-pre-wrap font-mono text-[#a9b1d6]">{output}</pre>
        )}
      </div>

      <div className="rounded-xl border border-[#24283b] bg-[#161821] overflow-hidden">
        <div className="p-3 border-b border-[#24283b] flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex gap-1">
            {(["neighbors", "connections"] as const).map(item => (
              <button key={item} onClick={() => setTab(item)} className={`rounded px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${tab === item ? "bg-[#7dcfff]/10 text-[#7dcfff]" : "text-[#565f89] hover:text-[#c0caf5]"}`}>{item}</button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#565f89]" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter IP, MAC, process or state" className="w-full rounded-lg border border-[#24283b] bg-[#11131b] py-2 pl-9 pr-3 text-[10px] font-mono text-[#c0caf5] outline-none" />
          </div>
        </div>
        <div className="max-h-[420px] overflow-auto">
          {tab === "neighbors" ? (
            <table className="w-full text-left text-[10px]">
              <thead className="sticky top-0 bg-[#11131b] text-[#565f89] uppercase tracking-wider"><tr><th className="px-3 py-2">IP</th><th className="px-3 py-2">MAC</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Interface</th></tr></thead>
              <tbody className="divide-y divide-[#24283b]">
                {neighbors.map(item => <tr key={`${item.ip}-${item.mac}`}><td className="px-3 py-2 font-mono text-[#c0caf5]">{item.ip}</td><td className="px-3 py-2 font-mono text-[#a9b1d6]">{item.mac}</td><td className="px-3 py-2 text-[#9ece6a]">{item.state}</td><td className="px-3 py-2 text-[#737aa2]">{item.interfaceAlias}</td></tr>)}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-[10px]">
              <thead className="sticky top-0 bg-[#11131b] text-[#565f89] uppercase tracking-wider"><tr><th className="px-3 py-2">Process</th><th className="px-3 py-2">Local</th><th className="px-3 py-2">Remote</th><th className="px-3 py-2">State</th><th className="px-3 py-2">PID</th></tr></thead>
              <tbody className="divide-y divide-[#24283b]">
                {connections.map((item, index) => <tr key={`${item.localAddress}-${item.localPort}-${item.remoteAddress}-${item.remotePort}-${index}`}><td className="px-3 py-2 font-bold text-[#c0caf5]">{item.processName || "—"}</td><td className="px-3 py-2 font-mono text-[#a9b1d6]">{item.localAddress}:{item.localPort}</td><td className="px-3 py-2 font-mono text-[#7dcfff]">{item.remoteAddress}:{item.remotePort}</td><td className="px-3 py-2 text-[#9ece6a]">{item.state}</td><td className="px-3 py-2 font-mono text-[#565f89]">{item.pid}</td></tr>)}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-[#24283b] bg-[#11131b] p-3 text-[10px] text-[#737aa2]">
        <Terminal className="w-4 h-4 text-[#565f89] shrink-0" />
        Active subnet discovery is intentionally not automatic. Use the NMAP view for authorized scans of hosts you own.
      </div>
    </div>
  );
}
