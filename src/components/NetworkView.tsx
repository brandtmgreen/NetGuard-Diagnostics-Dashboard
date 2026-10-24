import { useMemo, useState } from "react";
import { Network, Router, Search, Server, Wifi } from "lucide-react";
import { AppState } from "../types";

interface Props {
  state: AppState;
}

export default function NetworkView({ state }: Props) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"connections" | "neighbors">("connections");

  const connections = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) return state.connections;
    return state.connections.filter((connection) =>
      [connection.localAddress, connection.remoteAddress, connection.state, String(connection.pid), String(connection.localPort), String(connection.remotePort)]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [state.connections, query]);

  const neighbors = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) return state.neighbors;
    return state.neighbors.filter((neighbor) =>
      [neighbor.ip, neighbor.mac, neighbor.state, neighbor.interfaceAlias].join(" ").toLowerCase().includes(term)
    );
  }, [state.neighbors, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7aa2f7]">Network surface</div>
          <h1 className="mt-1 text-2xl font-black text-[#c0caf5]">Interfaces, neighbors, connections</h1>
          <p className="text-xs text-[#737aa2] mt-1">Collected from Windows networking APIs and the live TCP table.</p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#565f89]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter address, port, state, MAC…"
            className="w-full md:w-72 rounded-lg border border-[#24283b] bg-[#11131b] pl-9 pr-3 py-2 text-xs text-[#c0caf5] placeholder:text-[#414868] focus:outline-none focus:border-[#7aa2f7]/60"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {state.interfaces.filter((item) => !item.internal).map((item) => (
          <div key={`${item.name}-${item.address}`} className="rounded-xl border border-[#24283b] bg-[#161821] p-4 flex gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#7aa2f7]/10 border border-[#7aa2f7]/20 flex items-center justify-center shrink-0">
              {item.family === "IPv4" ? <Wifi className="w-4 h-4 text-[#7aa2f7]" /> : <Network className="w-4 h-4 text-[#7dcfff]" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-[#c0caf5] truncate">{item.name}</span>
                <span className="text-[8px] font-mono text-[#9ece6a]">UP</span>
              </div>
              <div className="mt-1 text-sm font-mono text-[#7aa2f7]">{item.address}</div>
              <div className="mt-1 text-[9px] font-mono text-[#565f89] truncate">netmask {item.netmask}</div>
              <div className="text-[9px] font-mono text-[#565f89] truncate">MAC {item.mac || "unavailable"}</div>
            </div>
          </div>
        ))}
        {state.interfaces.filter((item) => !item.internal).length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#24283b] p-8 text-center text-xs text-[#565f89]">No external interfaces detected.</div>
        ) : null}
      </div>

      <div className="rounded-xl border border-[#24283b] bg-[#161821] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#24283b] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("connections")}
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded ${mode === "connections" ? "bg-[#7aa2f7]/10 text-[#7aa2f7]" : "text-[#565f89] hover:text-[#c0caf5]"}`}
            >
              Connections ({state.connections.length})
            </button>
            <button
              onClick={() => setMode("neighbors")}
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded ${mode === "neighbors" ? "bg-[#7aa2f7]/10 text-[#7aa2f7]" : "text-[#565f89] hover:text-[#c0caf5]"}`}
            >
              Neighbors ({state.neighbors.length})
            </button>
          </div>
          <div className="text-[9px] font-mono text-[#565f89]">{state.generatedAt ? new Date(state.generatedAt).toLocaleTimeString() : "—"}</div>
        </div>

        {mode === "connections" ? (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-left text-[10px]">
              <thead className="sticky top-0 bg-[#11131b] text-[#565f89] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 font-black">Protocol</th>
                  <th className="px-3 py-2 font-black">Local</th>
                  <th className="px-3 py-2 font-black">Remote</th>
                  <th className="px-3 py-2 font-black">State</th>
                  <th className="px-3 py-2 font-black">PID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24283b]">
                {connections.map((connection, index) => (
                  <tr key={`${connection.localAddress}:${connection.localPort}-${connection.remoteAddress}:${connection.remotePort}-${connection.pid}-${index}`} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono text-[#7dcfff]">TCP</td>
                    <td className="px-3 py-2 font-mono text-[#c0caf5]">{connection.localAddress}:{connection.localPort}</td>
                    <td className="px-3 py-2 font-mono text-[#a9b1d6]">{connection.remoteAddress}:{connection.remotePort}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                        connection.state === "ESTABLISHED" ? "text-[#9ece6a] bg-[#9ece6a]/10" : connection.state === "LISTENING" ? "text-[#7aa2f7] bg-[#7aa2f7]/10" : "text-[#e0af68] bg-[#e0af68]/10"
                      }`}>{connection.state || "UNKNOWN"}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[#565f89]">{connection.pid || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {connections.length === 0 ? <div className="py-10 text-center text-xs text-[#565f89]">No TCP connections match the filter.</div> : null}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-left text-[10px]">
              <thead className="sticky top-0 bg-[#11131b] text-[#565f89] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 font-black">IP address</th>
                  <th className="px-3 py-2 font-black">MAC</th>
                  <th className="px-3 py-2 font-black">State</th>
                  <th className="px-3 py-2 font-black">Interface</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24283b]">
                {neighbors.map((neighbor) => (
                  <tr key={`${neighbor.ip}-${neighbor.mac}`} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono text-[#c0caf5]">{neighbor.ip}</td>
                    <td className="px-3 py-2 font-mono text-[#a9b1d6]">{neighbor.mac || "—"}</td>
                    <td className="px-3 py-2 text-[#9ece6a]">{neighbor.state}</td>
                    <td className="px-3 py-2 font-mono text-[#565f89]">{neighbor.interfaceAlias}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {neighbors.length === 0 ? <div className="py-10 text-center text-xs text-[#565f89]">No ARP neighbors found.</div> : null}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#24283b] bg-[#161821] p-4">
          <Router className="w-4 h-4 text-[#e0af68]" />
          <div className="mt-2 text-[9px] uppercase tracking-widest text-[#565f89]">Default gateway</div>
          <div className="text-sm font-mono text-[#c0caf5]">{state.host.gateway || "not detected"}</div>
        </div>
        <div className="rounded-xl border border-[#24283b] bg-[#161821] p-4">
          <Server className="w-4 h-4 text-[#7aa2f7]" />
          <div className="mt-2 text-[9px] uppercase tracking-widest text-[#565f89]">Local addresses</div>
          <div className="text-[11px] font-mono text-[#c0caf5] break-all">{state.host.localAddresses.join(", ") || "—"}</div>
        </div>
        <div className="rounded-xl border border-[#24283b] bg-[#161821] p-4">
          <Network className="w-4 h-4 text-[#9ece6a]" />
          <div className="mt-2 text-[9px] uppercase tracking-widest text-[#565f89]">Connection table</div>
          <div className="text-sm font-mono text-[#c0caf5]">{state.connections.length} rows</div>
        </div>
      </div>
    </div>
  );
}
