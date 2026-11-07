import { useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowUpRight, Ban, CheckCircle2, Flame, RefreshCw, ShieldAlert, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { api } from "../api";
import { AppState, Severity } from "../types";

interface Props {
  state: AppState;
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

const HEAT: Record<Severity, string> = {
  critical: "bg-[#f7768e] text-[#0b0c0f]",
  high: "bg-[#ff9e64] text-[#0b0c0f]",
  medium: "bg-[#e0af68] text-[#0b0c0f]",
  low: "bg-[#7aa2f7]/40 text-[#c0caf5]",
  info: "bg-[#565f89]/40 text-[#a9b1d6]",
};

export default function SecurityCenterView({ state, onNavigate, onRefresh }: Props) {
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const openAlerts = state.alerts.filter(alert => alert.status === "open");
  const critical = openAlerts.filter(alert => alert.severity === "critical").length;
  const activeRules = state.firewallRules.filter(rule => rule.enabled);

  const sourceHeat = useMemo(() => {
    const map = new Map<string, { count: number; severity: Severity; last: string }>();
    state.alerts.forEach(alert => {
      const key = alert.sourceIp || "local";
      const current = map.get(key);
      const rank: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
      if (!current || rank[alert.severity] > rank[current.severity]) {
        map.set(key, { count: (current?.count || 0) + 1, severity: alert.severity, last: alert.timestamp });
      } else {
        map.set(key, { ...current, count: current.count + 1, last: alert.timestamp });
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 18);
  }, [state.alerts]);

  const action = async (id: string, kind: "ack" | "ignore") => {
    setBusyId(id);
    setError("");
    try {
      if (kind === "ack") await api.acknowledgeAlert(id);
      else await api.ignoreAlert(id);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const removeRule = async (name: string) => {
    setRemoving(name);
    setError("");
    try {
      await api.unblock(name);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemoving(null);
    }
  };

  const checks = [
    { label: "Administrator session", ok: state.host.isAdmin, detail: state.host.isAdmin ? "Firewall enforcement is available." : "Restart NetGuard as administrator." },
    { label: "Npcap / tshark", ok: Boolean(state.capture.tsharkPath), detail: state.capture.tsharkPath ? "Capture engine present." : "Install Npcap + Wireshark." },
    { label: "Packet capture", ok: state.capture.running, detail: state.capture.running ? "Live capture is feeding detections." : "Start capture from the Capture view." },
    { label: "Automatic blocking", ok: state.settings.autoBlock && state.settings.preventionMode === "prevent", detail: state.settings.autoBlock && state.settings.preventionMode === "prevent" ? "High/critical alerts can be blocked." : "Monitor mode; manual blocks only." },
    { label: "Open critical alerts", ok: critical === 0, detail: critical === 0 ? "No critical alerts need triage." : `${critical} critical alert${critical === 1 ? "" : "s"} open.` },
    { label: "Nmap inventory", ok: state.nmapAvailable, detail: state.nmapAvailable ? "Authorized scanner is available." : "Install Nmap for port audits." },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f7768e]">Security center</div>
          <h1 className="mt-1 text-2xl font-black text-[#c0caf5]">Posture, alerts and source heat map</h1>
          <p className="text-xs text-[#737aa2] mt-1">A single operations view over the real detection and firewall state.</p>
        </div>
        <button onClick={onRefresh} className="inline-flex items-center gap-2 self-start rounded-lg border border-[#24283b] bg-[#161821] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#a9b1d6] hover:text-white">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Security score", value: `${state.securityScore}/100`, icon: ShieldCheck, color: state.securityScore >= 80 ? "text-[#9ece6a]" : "text-[#e0af68]" },
          { label: "Open alerts", value: openAlerts.length, icon: ShieldAlert, color: "text-[#f7768e]" },
          { label: "Critical", value: critical, icon: AlertTriangle, color: "text-[#f7768e]" },
          { label: "Active firewall rules", value: activeRules.length, icon: Ban, color: "text-[#7aa2f7]" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-[#24283b] bg-[#161821] p-4">
            <Icon className={`w-4 h-4 ${color}`} />
            <div className="mt-2 text-[9px] font-black uppercase tracking-widest text-[#565f89]">{label}</div>
            <div className={`mt-1 text-2xl font-black ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {error && <div className="rounded-lg border border-[#f7768e]/30 bg-[#f7768e]/5 p-3 text-[10px] text-[#f7768e]">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4">
        <div className="rounded-xl border border-[#24283b] bg-[#161821] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#24283b] flex items-center justify-between">
            <div className="flex items-center gap-2"><Flame className="w-4 h-4 text-[#ff9e64]" /><h2 className="text-xs font-black text-[#c0caf5]">Source heat map</h2></div>
            <span className="text-[9px] font-mono text-[#565f89]">{sourceHeat.length} sources</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {sourceHeat.map(([ip, info]) => (
                <div key={ip} className={`rounded-lg p-2 min-h-[58px] ${HEAT[info.severity]}`} title={`${ip} · ${info.count} alerts · last ${new Date(info.last).toLocaleString()}`}>
                  <div className="text-[8px] font-mono truncate opacity-80">{ip}</div>
                  <div className="mt-2 text-lg font-black leading-none">{info.count}</div>
                  <div className="text-[7px] font-black uppercase tracking-wider mt-1">{info.severity}</div>
                </div>
              ))}
            </div>
            {sourceHeat.length === 0 && <p className="py-10 text-center text-[11px] text-[#565f89]">No alert sources yet.</p>}
            <div className="mt-3 flex items-center gap-3 text-[9px] text-[#565f89]"><span className="w-2 h-2 rounded-full bg-[#f7768e]" /> critical <span className="w-2 h-2 rounded-full bg-[#ff9e64]" /> high <span className="w-2 h-2 rounded-full bg-[#e0af68]" /> medium</div>
          </div>
        </div>

        <div className="rounded-xl border border-[#24283b] bg-[#161821] p-4">
          <h2 className="text-xs font-black text-[#c0caf5]">Open detections</h2>
          <div className="mt-3 space-y-2 max-h-[300px] overflow-auto">
            {openAlerts.slice(0, 8).map(alert => (
              <div key={alert.id} className="rounded-lg border border-[#24283b] bg-[#11131b] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black text-[#c0caf5]">{alert.kind.replace(/-/g, " ")}</div>
                    <div className="text-[9px] font-mono text-[#565f89] mt-0.5">{alert.sourceIp} → {alert.destinationIp}</div>
                  </div>
                  <span className={`rounded border px-1.5 py-0.5 text-[8px] font-black uppercase ${HEAT[alert.severity]}`}>{alert.severity}</span>
                </div>
                <p className="mt-2 text-[10px] text-[#a9b1d6] line-clamp-2">{alert.message}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => void action(alert.id, "ack")} disabled={busyId === alert.id} className="text-[9px] font-black uppercase tracking-wider text-[#9ece6a] hover:underline disabled:opacity-40">Acknowledge</button>
                  <button onClick={() => void action(alert.id, "ignore")} disabled={busyId === alert.id} className="text-[9px] font-black uppercase tracking-wider text-[#565f89] hover:text-[#a9b1d6] disabled:opacity-40">Ignore</button>
                </div>
              </div>
            ))}
            {openAlerts.length === 0 && <div className="py-8 text-center text-[11px] text-[#565f89]"><CheckCircle2 className="w-6 h-6 text-[#9ece6a] mx-auto mb-2" />No open detections.</div>}
          </div>
          <button onClick={() => onNavigate("detections")} className="mt-3 inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[#7aa2f7] hover:underline">Open full detections <ArrowUpRight className="w-3 h-3" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: "Detection policy", detail: `${state.settings.autoBlock ? "Auto-block armed" : "Monitor mode"}`, tab: "prevention" },
          { label: "Packet capture", detail: state.capture.running ? "Live capture running" : "Capture stopped", tab: "capture" },
          { label: "Reports", detail: "Generate a current security report", tab: "reports" },
        ].map(card => (
          <button key={card.label} onClick={() => onNavigate(card.tab)} className="text-left rounded-xl border border-[#24283b] bg-[#161821] p-4 hover:border-[#7aa2f7]/40">
            <Activity className="w-4 h-4 text-[#7aa2f7]" />
            <div className="mt-2 text-xs font-black text-[#c0caf5]">{card.label}</div>
            <div className="mt-1 text-[10px] text-[#737aa2]">{card.detail}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#24283b] bg-[#161821] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#9ece6a]" /><h2 className="text-xs font-black text-[#c0caf5]">Host security checks</h2></div>
            <span className="text-[9px] font-mono text-[#9ece6a]">{checks.filter(check => check.ok).length} / {checks.length}</span>
          </div>
          <div className="mt-3 space-y-1.5">
            {checks.map(check => (
              <div key={check.label} className="flex items-start gap-2 rounded-lg border border-[#24283b] bg-[#11131b] p-2.5">
                {check.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9ece6a]" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e0af68]" />}
                <div className="min-w-0"><div className="text-[10px] font-black text-[#c0caf5]">{check.label}</div><div className="mt-0.5 text-[9px] text-[#737aa2]">{check.detail}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#24283b] bg-[#161821] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><Ban className="w-4 h-4 text-[#f7768e]" /><h2 className="text-xs font-black text-[#c0caf5]">Active firewall rules</h2></div>
            <button onClick={() => onNavigate("prevention")} className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-[#7aa2f7] hover:underline">Manage <ArrowUpRight className="w-3 h-3" /></button>
          </div>
          <div className="mt-3 space-y-1.5 max-h-[280px] overflow-auto">
            {state.firewallRules.slice(0, 10).map(rule => (
              <div key={rule.id || rule.name} className="flex items-center justify-between gap-2 rounded-lg border border-[#24283b] bg-[#11131b] p-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-bold text-[#c0caf5]">{rule.displayName || rule.name}</div>
                  <div className="mt-0.5 truncate font-mono text-[9px] text-[#565f89]">{rule.direction} · {rule.remoteAddresses.join(", ") || "any"}</div>
                </div>
                <button onClick={() => void removeRule(rule.name)} disabled={!state.host.isAdmin || removing === rule.name} className="shrink-0 rounded border border-[#24283b] p-1.5 text-[#565f89] hover:border-[#f7768e]/40 hover:text-[#f7768e] disabled:opacity-30" title="Remove rule"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
            {state.firewallRules.length === 0 && <div className="py-8 text-center text-[10px] text-[#565f89]">No active NetGuard firewall rules.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
