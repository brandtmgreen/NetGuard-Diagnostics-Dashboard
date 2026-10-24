import { useMemo, useState } from "react";
import { AlertTriangle, Check, EyeOff, ShieldAlert, ShieldBan } from "lucide-react";
import { Alert, AppState } from "../types";
import { formatTime } from "../format";

interface Props {
  state: AppState;
  onAcknowledge: (id: string) => void;
  onIgnore: (id: string) => void;
  onBlock: (alert: Alert) => void;
}

const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function severityClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "text-[#f7768e] bg-[#f7768e]/10 border-[#f7768e]/25";
    case "high":
      return "text-[#ff9e64] bg-[#ff9e64]/10 border-[#ff9e64]/25";
    case "medium":
      return "text-[#e0af68] bg-[#e0af68]/10 border-[#e0af68]/25";
    default:
      return "text-[#7aa2f7] bg-[#7aa2f7]/10 border-[#7aa2f7]/25";
  }
}

export default function DetectionsView({ state, onAcknowledge, onIgnore, onBlock }: Props) {
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");

  const alerts = useMemo(() => {
    return state.alerts
      .filter((alert) => severity === "all" || alert.severity === severity)
      .filter((alert) => status === "all" || alert.status === status)
      .sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0) || b.timestamp.localeCompare(a.timestamp));
  }, [state.alerts, severity, status]);

  const open = state.alerts.filter((alert) => alert.status === "open").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f7768e]">Detection engine</div>
          <h1 className="mt-1 text-2xl font-black text-[#c0caf5]">Real detections, no demo events</h1>
          <p className="text-xs text-[#737aa2] mt-1">Rules fire from captured packets and live connection deltas. Every alert is persisted locally.</p>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono">
          <span className={`w-2 h-2 rounded-full ${state.capture.running ? "bg-[#9ece6a] animate-pulse" : "bg-[#e0af68]"}`} />
          {state.capture.running ? "CAPTURE RUNNING" : "CAPTURE STOPPED"}
          <span className="text-[#565f89]">·</span>
          <span className="text-[#c0caf5]">{open} OPEN</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-[10px] font-bold text-[#c0caf5] focus:outline-none">
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-[10px] font-bold text-[#c0caf5] focus:outline-none">
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="blocked">Blocked</option>
          <option value="ignored">Ignored</option>
        </select>
        <span className="text-[10px] text-[#565f89]">{alerts.length} shown</span>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert.id} className="rounded-xl border border-[#24283b] bg-[#161821] p-4">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${severityClass(alert.severity)}`}>{alert.severity}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#565f89]">{alert.kind.replace(/-/g, " ")}</span>
                  <span className="text-[9px] font-mono text-[#565f89]">{formatTime(alert.timestamp)}</span>
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                    alert.status === "open" ? "text-[#f7768e] bg-[#f7768e]/10" : alert.status === "blocked" ? "text-[#9ece6a] bg-[#9ece6a]/10" : "text-[#737aa2] bg-white/[0.04]"
                  }`}>{alert.status}</span>
                </div>
                <h3 className="mt-2 text-sm font-bold text-[#c0caf5]">{alert.message}</h3>
                <p className="mt-1 text-[11px] text-[#a9b1d6] leading-relaxed">{alert.evidence}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-mono text-[#565f89]">
                  <span className="rounded bg-[#0f1118] border border-[#24283b] px-2 py-1">src {alert.sourceIp || "—"}{alert.sourcePort ? `:${alert.sourcePort}` : ""}</span>
                  <span className="rounded bg-[#0f1118] border border-[#24283b] px-2 py-1">dst {alert.destinationIp || "multiple"}{alert.destinationPort ? `:${alert.destinationPort}` : ""}</span>
                  <span className="rounded bg-[#0f1118] border border-[#24283b] px-2 py-1">{alert.protocol}</span>
                  <span className="rounded bg-[#0f1118] border border-[#24283b] px-2 py-1">count {alert.count}</span>
                </div>
              </div>
              <div className="flex lg:flex-col gap-2 shrink-0">
                {alert.status === "open" ? (
                  <button onClick={() => onAcknowledge(alert.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[#a9b1d6] hover:border-[#7aa2f7]/40">
                    <Check className="w-3 h-3" /> Acknowledge
                  </button>
                ) : null}
                {alert.status === "open" ? (
                  <button onClick={() => onIgnore(alert.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[#737aa2] hover:text-[#c0caf5]">
                    <EyeOff className="w-3 h-3" /> Ignore
                  </button>
                ) : null}
                <button
                  onClick={() => onBlock(alert)}
                  disabled={!state.host.isAdmin || !alert.sourceIp}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#f7768e]/30 bg-[#f7768e]/10 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[#f7768e] hover:bg-[#f7768e]/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ShieldBan className="w-3 h-3" /> Block source
                </button>
              </div>
            </div>
          </div>
        ))}
        {alerts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#24283b] bg-[#11131b] py-16 text-center">
            <ShieldAlert className="w-10 h-10 mx-auto text-[#414868]" />
            <h3 className="mt-4 text-sm font-black text-[#c0caf5]">No detections in this view</h3>
            <p className="mt-1 text-[11px] text-[#565f89] max-w-md mx-auto">
              {state.capture.running
                ? "The capture engine is running. Alerts appear here when a threshold is crossed."
                : "Start packet capture to feed the port-scan, brute-force, flood, and suspicious-outbound rules."}
            </p>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-[#24283b] bg-[#161821] p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-[#e0af68] shrink-0 mt-0.5" />
        <div className="text-[10px] text-[#737aa2] leading-relaxed">
          Detection thresholds: 20 distinct ports / 10 s (port scan), 10 SYN attempts / 30 s to sensitive ports (brute force), 100 SYN / 5 s (flood), 50 ICMP / 1 s, and outbound traffic to known suspicious ports. Tune these in the engine before production use.
        </div>
      </div>
    </div>
  );
}
