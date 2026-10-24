import { useEffect, useMemo, useState } from "react";
import { CircleStop, Play, Radio, RefreshCw, Waypoints } from "lucide-react";
import { api } from "../api";
import { AppState, CaptureInterface, Packet } from "../types";
import { formatTime } from "../format";

interface Props {
  state: AppState;
  onRefresh: () => void;
}

export default function CaptureView({ state, onRefresh }: Props) {
  const [interfaces, setInterfaces] = useState<CaptureInterface[]>([]);
  const [selected, setSelected] = useState(state.settings.captureInterface || "");
  const [filter, setFilter] = useState(state.settings.captureFilter || "not port 3000");
  const [packets, setPackets] = useState<Packet[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadInterfaces = async () => {
    try {
      const list = await api.captureInterfaces();
      setInterfaces(list);
      if (!selected && list[0]) setSelected(list[0].path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    void loadInterfaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!state.capture.running) {
      setPackets([]);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const result = await api.packets(400);
        if (!cancelled) setPackets(result.packets);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void poll();
    const timer = setInterval(poll, 1200);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state.capture.running]);

  const start = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.startCapture(selected, filter);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await api.stopCapture();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const displayed = useMemo(() => packets.slice().reverse().slice(0, 250), [packets]);
  const currentInterface = interfaces.find((item) => item.path === state.capture.interfacePath);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7dcfff]">Packet capture</div>
          <h1 className="mt-1 text-2xl font-black text-[#c0caf5]">Live Npcap / tshark stream</h1>
          <p className="text-xs text-[#737aa2] mt-1">Real packets from the selected adapter. No generated frames.</p>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono">
          <span className={`w-2 h-2 rounded-full ${state.capture.running ? "bg-[#9ece6a] animate-pulse" : "bg-[#565f89]"}`} />
          {state.capture.running ? `${state.capture.packets} PACKETS` : "STOPPED"}
        </div>
      </div>

      <div className="rounded-xl border border-[#24283b] bg-[#161821] p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-[#565f89]">Capture interface</label>
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              disabled={state.capture.running}
              className="mt-1 w-full rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs font-mono text-[#c0caf5] focus:outline-none disabled:opacity-60"
            >
              {interfaces.map((item) => (
                <option key={item.path} value={item.path}>{item.name}</option>
              ))}
              {interfaces.length === 0 ? <option value="">No Npcap interfaces found</option> : null}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-[#565f89]">BPF capture filter</label>
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              disabled={state.capture.running}
              className="mt-1 w-full rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs font-mono text-[#c0caf5] placeholder:text-[#414868] focus:outline-none disabled:opacity-60"
              placeholder="not port 3000"
            />
          </div>
          <button
            onClick={state.capture.running ? stop : start}
            disabled={busy || !state.capture.tsharkPath || (!state.capture.running && !selected)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[10px] font-black uppercase tracking-wider disabled:opacity-40 ${
              state.capture.running
                ? "border border-[#f7768e]/30 bg-[#f7768e]/10 text-[#f7768e] hover:bg-[#f7768e]/20"
                : "bg-[#7aa2f7] text-[#0b0c0f] hover:bg-[#89b4fa]"
            }`}
          >
            {state.capture.running ? <CircleStop className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {state.capture.running ? "Stop" : "Start"}
          </button>
          <button onClick={() => { void loadInterfaces(); onRefresh(); }} className="inline-flex items-center justify-center rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2.5 text-[#737aa2] hover:text-[#c0caf5]">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[9px] font-mono text-[#565f89]">
          <span>tshark: {state.capture.tsharkPath || "not found"}</span>
          <span>interface: {currentInterface?.name || state.capture.interfacePath || "—"}</span>
          {state.capture.startedAt ? <span>started {formatTime(state.capture.startedAt)}</span> : null}
          {state.capture.error ? <span className="text-[#f7768e]">error: {state.capture.error}</span> : null}
        </div>
        {error ? <div className="mt-3 rounded-lg border border-[#f7768e]/30 bg-[#f7768e]/5 p-3 text-[10px] text-[#f7768e]">{error}</div> : null}
        {!state.host.isAdmin ? <div className="mt-3 rounded-lg border border-[#e0af68]/30 bg-[#e0af68]/5 p-3 text-[10px] text-[#e0af68]">Administrator privileges are recommended for Npcap capture.</div> : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4">
        <div className="rounded-xl border border-[#24283b] bg-[#161821] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#24283b] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className={`w-3.5 h-3.5 ${state.capture.running ? "text-[#9ece6a]" : "text-[#565f89]"}`} />
              <h2 className="text-xs font-black text-[#c0caf5]">Packet stream</h2>
            </div>
            <span className="text-[9px] font-mono text-[#565f89]">{displayed.length} shown</span>
          </div>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-left text-[10px]">
              <thead className="sticky top-0 bg-[#11131b] text-[#565f89] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 font-black">#</th>
                  <th className="px-3 py-2 font-black">Source</th>
                  <th className="px-3 py-2 font-black">Destination</th>
                  <th className="px-3 py-2 font-black">Protocol</th>
                  <th className="px-3 py-2 font-black">Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24283b]">
                {displayed.map((packet) => (
                  <tr key={`${packet.id}-${packet.timestamp}`} onClick={() => setSelectedPacket(packet)} className={`cursor-pointer hover:bg-white/[0.03] ${selectedPacket?.id === packet.id ? "bg-[#7aa2f7]/5" : ""}`}>
                    <td className="px-3 py-1.5 font-mono text-[#565f89]">{packet.id}</td>
                    <td className="px-3 py-1.5 font-mono text-[#c0caf5]">{packet.source || "—"}{packet.srcPort ? `:${packet.srcPort}` : ""}</td>
                    <td className="px-3 py-1.5 font-mono text-[#a9b1d6]">{packet.destination || "—"}{packet.dstPort ? `:${packet.dstPort}` : ""}</td>
                    <td className="px-3 py-1.5 text-[#7dcfff] font-bold">{packet.protocol}</td>
                    <td className="px-3 py-1.5 text-[#737aa2] truncate max-w-[260px]">{packet.info}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayed.length === 0 ? (
              <div className="py-14 text-center">
                <Waypoints className="w-8 h-8 mx-auto text-[#414868]" />
                <p className="mt-3 text-xs text-[#737aa2]">{state.capture.running ? "Waiting for packets…" : "Capture is stopped."}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-[#24283b] bg-[#161821] p-4">
          <h2 className="text-xs font-black text-[#c0caf5]">Packet detail</h2>
          {selectedPacket ? (
            <div className="mt-3 space-y-2 text-[10px]">
              {[
                ["Frame", String(selectedPacket.id)],
                ["Time", selectedPacket.timestamp],
                ["Source", `${selectedPacket.source}:${selectedPacket.srcPort ?? "—"}`],
                ["Destination", `${selectedPacket.destination}:${selectedPacket.dstPort ?? "—"}`],
                ["Protocol", selectedPacket.protocol],
                ["Length", `${selectedPacket.length} bytes`],
                ["Flags", selectedPacket.flags || "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-[#24283b] pb-1.5">
                  <span className="text-[#565f89] uppercase tracking-wide">{label}</span>
                  <span className="font-mono text-[#c0caf5] text-right break-all">{value}</span>
                </div>
              ))}
              <div className="pt-2">
                <div className="text-[#565f89] uppercase tracking-wide mb-1">Info</div>
                <p className="text-[#a9b1d6] leading-relaxed font-mono">{selectedPacket.info || "—"}</p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[10px] text-[#565f89]">Select a packet to inspect its metadata.</p>
          )}
        </div>
      </div>
    </div>
  );
}
