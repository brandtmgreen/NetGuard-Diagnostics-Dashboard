import {
  Activity,
  ArrowUpRight,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Shield,
  ShieldAlert,
  Waypoints,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppState } from "../types";
import { formatBytes, formatTime, formatUptime } from "../format";

interface Props {
  state: AppState;
  onNavigate: (tab: string) => void;
}

function Metric({ label, value, detail, icon: Icon, accent = "text-[#7aa2f7]" }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Cpu;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-[#24283b] bg-[#161821] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#565f89]">{label}</div>
          <div className="mt-2 text-2xl font-black text-[#c0caf5] font-mono">{value}</div>
        </div>
        <div className={`w-8 h-8 rounded-lg bg-[#0f1118] border border-[#24283b] flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 text-[10px] text-[#737aa2]">{detail}</div>
    </div>
  );
}

function severityClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "text-[#f7768e] bg-[#f7768e]/10 border-[#f7768e]/20";
    case "high":
      return "text-[#ff9e64] bg-[#ff9e64]/10 border-[#ff9e64]/20";
    case "medium":
      return "text-[#e0af68] bg-[#e0af68]/10 border-[#e0af68]/20";
    default:
      return "text-[#7aa2f7] bg-[#7aa2f7]/10 border-[#7aa2f7]/20";
  }
}

export default function DashboardView({ state, onNavigate }: Props) {
  const [history, setHistory] = useState<{ cpu: number[]; memory: number[] }>({ cpu: [state.host.cpuPercent], memory: [state.host.memoryPercent] });
  const openAlerts = state.alerts.filter((alert) => alert.status === "open");
  const established = state.connections.filter((connection) => connection.state === "ESTABLISHED");
  const listening = state.connections.filter((connection) => connection.state === "LISTENING");
  const scoreColor = state.securityScore >= 80 ? "#9ece6a" : state.securityScore >= 55 ? "#e0af68" : "#f7768e";

  useEffect(() => {
    setHistory(previous => ({
      cpu: [...previous.cpu, state.host.cpuPercent].slice(-30),
      memory: [...previous.memory, state.host.memoryPercent].slice(-30),
    }));
  }, [state.host.cpuPercent, state.host.memoryPercent]);

  const spark = (values: number[], color: string) => {
    const width = 220;
    const height = 42;
    const max = Math.max(100, ...values);
    const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * width},${height - (value / max) * height}`).join(" ");
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-5">
        <section className="rounded-2xl border border-[#24283b] bg-gradient-to-br from-[#181b28] to-[#11131b] p-6 relative overflow-hidden">
          <div className="absolute -right-8 -top-10 w-56 h-56 rounded-full bg-[#7aa2f7]/5 blur-2xl" />
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#7aa2f7]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9ece6a]" />
                Local control plane
              </div>
              <h1 className="mt-3 text-3xl font-black text-[#c0caf5] tracking-tight">
                {state.host.hostname}
              </h1>
              <p className="mt-2 text-sm text-[#737aa2] max-w-xl">
                Live Windows telemetry, real packet capture, and auditable firewall enforcement. No simulated events.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => onNavigate("capture")}
                  className="px-4 py-2.5 rounded-lg bg-[#7aa2f7] text-[#0b0c0f] text-[10px] font-black uppercase tracking-wider hover:bg-[#89b4fa] transition"
                >
                  {state.capture.running ? "View live capture" : "Start packet capture"}
                </button>
                <button
                  onClick={() => onNavigate("detections")}
                  className="px-4 py-2.5 rounded-lg bg-[#1a1d2a] border border-[#2a2e42] text-[#c0caf5] text-[10px] font-black uppercase tracking-wider hover:border-[#7aa2f7]/40 transition"
                >
                  Open detections
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div
                className="w-28 h-28 rounded-full flex items-center justify-center relative"
                style={{ background: `conic-gradient(${scoreColor} ${state.securityScore * 3.6}deg, #24283b 0deg)` }}
              >
                <div className="w-24 h-24 rounded-full bg-[#11131b] border border-[#24283b] flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-[#c0caf5] font-mono">{state.securityScore}</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#565f89]">posture</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2 relative">
            {[
              ["OS", `${state.host.platform} ${state.host.release}`],
              ["Privilege", state.host.isAdmin ? "Administrator" : "Standard user"],
              ["Gateway", state.host.gateway || "not detected"],
              ["Capture", state.capture.running ? `${state.capture.packets} packets` : "stopped"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-[#24283b]/80 bg-[#0f1118]/60 px-3 py-2">
                <div className="text-[8px] font-black uppercase tracking-widest text-[#565f89]">{label}</div>
                <div className="mt-1 text-[10px] font-mono text-[#a9b1d6] truncate">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#24283b] bg-[#161821] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#565f89]">Current state</div>
              <h2 className="mt-1 text-sm font-black text-[#c0caf5]">Host health</h2>
            </div>
            <Activity className="w-4 h-4 text-[#9ece6a]" />
          </div>
          <div className="mt-5 space-y-4">
            {[
              { label: "CPU", value: state.host.cpuPercent, color: "#7aa2f7", detail: `${state.host.cpuCount} logical cores` },
              { label: "Memory", value: state.host.memoryPercent, color: "#bb9af7", detail: `${formatBytes(state.host.freeMemoryBytes)} free of ${formatBytes(state.host.totalMemoryBytes)}` },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-[#737aa2]">{row.label}</span>
                  <span className="text-[#c0caf5] font-mono">{row.value.toFixed(1)}%</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-[#0b0c0f] overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, row.value)}%`, backgroundColor: row.color }} />
                </div>
                <div className="mt-1 text-[9px] text-[#565f89]">{row.detail}</div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-lg bg-[#0f1118] border border-[#24283b] p-3">
                <div className="text-[8px] uppercase tracking-widest text-[#565f89]">Uptime</div>
                <div className="mt-1 text-xs font-mono text-[#a9b1d6]">{formatUptime(state.host.uptimeSeconds)}</div>
              </div>
              <div className="rounded-lg bg-[#0f1118] border border-[#24283b] p-3">
                <div className="text-[8px] uppercase tracking-widest text-[#565f89]">AI analyst</div>
                <div className={`mt-1 text-xs font-mono ${state.ai.configured ? "text-[#9ece6a]" : "text-[#e0af68]"}`}>
                  {state.ai.configured ? "ready" : "not configured"}
                </div>
              </div>
            </div>
            <div className="border-t border-[#24283b] pt-3">
              <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-[#565f89]">
                <span>Resource trend</span>
                <span className="flex items-center gap-2"><span className="text-[#7aa2f7]">CPU</span><span className="text-[#bb9af7]">MEM</span></span>
              </div>
              <div className="mt-1 space-y-1">
                {spark(history.cpu, "#7aa2f7")}
                {spark(history.memory, "#bb9af7")}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Metric label="CPU load" value={`${state.host.cpuPercent.toFixed(1)}%`} detail={state.host.cpuModel} icon={Cpu} />
        <Metric label="Memory" value={`${state.host.memoryPercent.toFixed(1)}%`} detail={formatBytes(state.host.totalMemoryBytes - state.host.freeMemoryBytes)} icon={MemoryStick} accent="text-[#bb9af7]" />
        <Metric label="TCP connections" value={String(established.length)} detail={`${listening.length} listening · ${state.connections.length} total`} icon={Network} accent="text-[#7dcfff]" />
        <Metric label="Open detections" value={String(openAlerts.length)} detail={openAlerts[0]?.message || "No active detections"} icon={ShieldAlert} accent={openAlerts.length ? "text-[#f7768e]" : "text-[#9ece6a]"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-5">
        <section className="rounded-2xl border border-[#24283b] bg-[#161821] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#24283b] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-[#c0caf5]">Recent detections</h2>
              <p className="text-[10px] text-[#565f89]">Generated by the local detection engine from real telemetry.</p>
            </div>
            <button onClick={() => onNavigate("detections")} className="text-[10px] font-bold text-[#7aa2f7] hover:text-[#89b4fa] flex items-center gap-1">
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-[#24283b]">
            {state.alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="px-5 py-3.5 flex items-start gap-3">
                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${alert.severity === "critical" ? "bg-[#f7768e]" : alert.severity === "high" ? "bg-[#ff9e64]" : "bg-[#e0af68]"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${severityClass(alert.severity)}`}>{alert.severity}</span>
                    <span className="text-[9px] text-[#565f89] font-mono">{formatTime(alert.timestamp)}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-[#c0caf5] font-bold truncate">{alert.message}</div>
                  <div className="text-[9px] text-[#565f89] font-mono truncate">{alert.sourceIp || "local"} → {alert.destinationIp || "multiple"}</div>
                </div>
              </div>
            ))}
            {state.alerts.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Shield className="w-8 h-8 mx-auto text-[#414868]" />
                <p className="mt-3 text-xs font-bold text-[#737aa2]">No detections recorded</p>
                <p className="mt-1 text-[10px] text-[#565f89]">
                  {state.capture.running ? "Capture is running; detections will appear here." : "Start packet capture to feed the detection engine."}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-[#24283b] bg-[#161821] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#24283b] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-[#c0caf5]">Live connections</h2>
              <p className="text-[10px] text-[#565f89]">Real TCP table from netstat.</p>
            </div>
            <Waypoints className="w-4 h-4 text-[#7dcfff]" />
          </div>
          <div className="divide-y divide-[#24283b]">
            {state.connections.filter((connection) => connection.state === "ESTABLISHED").slice(0, 6).map((connection) => (
              <div key={`${connection.localAddress}:${connection.localPort}-${connection.remoteAddress}:${connection.remotePort}-${connection.pid}`} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-[#c0caf5] truncate">{connection.remoteAddress || "local"}:{connection.remotePort || "—"}</div>
                    <div className="text-[9px] text-[#565f89] font-mono truncate">local {connection.localPort || "—"} · pid {connection.pid || "—"}</div>
                  </div>
                  <span className="text-[8px] font-black text-[#9ece6a] bg-[#9ece6a]/10 border border-[#9ece6a]/20 px-1.5 py-0.5 rounded uppercase">ESTABLISHED</span>
                </div>
              </div>
            ))}
            {state.connections.filter((connection) => connection.state === "ESTABLISHED").length === 0 ? (
              <div className="px-5 py-10 text-center text-[10px] text-[#565f89]">No established TCP connections.</div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[#24283b] bg-[#161821] p-5">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-[#bb9af7]" />
          <h2 className="text-sm font-black text-[#c0caf5]">Adapter footprint</h2>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {state.interfaces.filter((item) => !item.internal).map((item) => (
            <div key={`${item.name}-${item.address}`} className="rounded-lg border border-[#24283b] bg-[#0f1118] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-[#c0caf5]">{item.name}</span>
                <span className="text-[8px] font-mono text-[#565f89]">{item.family}</span>
              </div>
              <div className="mt-2 text-[11px] font-mono text-[#7aa2f7]">{item.address}</div>
              <div className="text-[9px] font-mono text-[#565f89] truncate">mask {item.netmask} · {item.mac || "no MAC"}</div>
            </div>
          ))}
          {state.interfaces.filter((item) => !item.internal).length === 0 ? (
            <div className="text-[10px] text-[#565f89]">No external interfaces detected.</div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-[#24283b] bg-[#161821] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#24283b] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-[#c0caf5]">Windows security log</h2>
            <p className="text-[10px] text-[#565f89]">Recent 4625, 5156, 5157, 4688, and 7045 events read from the Security log.</p>
          </div>
          <span className="text-[9px] font-mono text-[#565f89]">{state.events.length} events</span>
        </div>
        <div className="divide-y divide-[#24283b]">
          {state.events.slice(0, 6).map((event) => (
            <div key={`${event.id}-${event.timestamp}-${event.message.slice(0, 20)}`} className="px-5 py-3 flex items-start gap-3">
              <span className="mt-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-[#7aa2f7]/10 border border-[#7aa2f7]/20 text-[#7aa2f7] shrink-0">{event.id}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[9px] font-mono text-[#565f89]">
                  <span>{formatTime(event.timestamp)}</span>
                  <span className="text-[#24283b]">|</span>
                  <span className="truncate">{event.provider}</span>
                  <span className="text-[#e0af68] truncate">{event.level}</span>
                </div>
                <p className="mt-1 text-[10px] text-[#a9b1d6] truncate">{event.message.replace(/\s+/g, " ").slice(0, 220)}</p>
              </div>
            </div>
          ))}
          {state.events.length === 0 ? (
            <div className="px-5 py-8 text-center text-[10px] text-[#565f89]">No matching Security log events were readable. Administrator access is required.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
