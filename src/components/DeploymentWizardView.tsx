import { useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, Circle, RefreshCw, ShieldCheck, Terminal, Wrench, XCircle } from "lucide-react";
import { api } from "../api";
import { AppState, Diagnostics } from "../types";

interface Props {
  state: AppState;
  onNavigate: (tab: string) => void;
}

export default function DeploymentWizardView({ state, onNavigate }: Props) {
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    setError("");
    try { setDiagnostics(await api.diagnostics()); } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checks = [
    { label: "Administrator privileges", ok: state.host.isAdmin, detail: state.host.isAdmin ? "Elevated session detected." : "Restart NetGuard as administrator for capture and firewall enforcement.", tab: "settings" },
    { label: "Npcap / tshark", ok: Boolean(state.capture.tsharkPath), detail: state.capture.tsharkPath || "tshark not found. Install Npcap + Wireshark.", tab: "capture" },
    { label: "Nmap", ok: state.nmapAvailable, detail: state.nmapAvailable ? "Nmap is available." : "Install Nmap and add it to PATH.", tab: "scanner" },
    { label: "Capture interface", ok: Boolean(state.settings.captureInterface), detail: state.settings.captureInterface || "Choose an interface in Settings, then start capture.", tab: "settings" },
    { label: "Prevention policy", ok: state.settings.preventionMode === "prevent", detail: state.settings.preventionMode === "prevent" ? "Prevention mode is enabled." : "Monitor mode only. Arm prevention in Settings when ready.", tab: "prevention" },
    { label: "Capture state", ok: state.capture.running, detail: state.capture.running ? `Capturing ${state.capture.packets} packets.` : "Capture is stopped.", tab: "capture" },
  ];

  const complete = checks.filter(check => check.ok).length;

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9ece6a]">Deployment wizard</div>
        <h1 className="mt-1 text-2xl font-black text-[#c0caf5]">Get this host capture-ready</h1>
        <p className="text-xs text-[#737aa2] mt-1">Live checks against the current NetGuard process. Nothing here is simulated.</p>
      </div>

      <div className="rounded-xl border border-[#24283b] bg-[#161821] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Wrench className="w-4 h-4 text-[#9ece6a]" /><h2 className="text-sm font-black text-[#c0caf5]">Readiness</h2></div>
          <span className="text-[10px] font-mono text-[#9ece6a]">{complete} / {checks.length}</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-[#11131b] overflow-hidden"><div className="h-full bg-[#9ece6a] transition-all" style={{ width: `${(complete / checks.length) * 100}%` }} /></div>
        <div className="mt-4 space-y-2">
          {checks.map(check => (
            <button key={check.label} onClick={() => onNavigate(check.tab)} className="w-full flex items-start gap-3 rounded-lg border border-[#24283b] bg-[#11131b] p-3 text-left hover:border-[#7aa2f7]/40">
              {check.ok ? <CheckCircle2 className="w-4 h-4 text-[#9ece6a] mt-0.5 shrink-0" /> : <Circle className="w-4 h-4 text-[#565f89] mt-0.5 shrink-0" />}
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-black text-[#c0caf5]">{check.label}</span>
                <span className="block text-[10px] text-[#737aa2] mt-0.5">{check.detail}</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#565f89] mt-0.5 shrink-0" />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#24283b] bg-[#161821] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#7aa2f7]" /><h2 className="text-xs font-black text-[#c0caf5]">Runtime diagnostics</h2></div>
            <button onClick={() => void refresh()} disabled={busy} className="text-[9px] font-black uppercase tracking-wider text-[#7aa2f7] disabled:opacity-40"><RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} /></button>
          </div>
          {error && <p className="mt-3 text-[10px] text-[#f7768e]">{error}</p>}
          {diagnostics ? (
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono">
              {[["Version", diagnostics.version], ["Uptime", `${Math.floor(diagnostics.uptimeSeconds / 60)}m`], ["Memory", `${diagnostics.memory.rssMb} MB`], ["Platform", diagnostics.platform]].map(([label, value]) => (
                <div key={label} className="rounded border border-[#24283b] bg-[#11131b] p-2"><div className="text-[8px] uppercase text-[#565f89]">{label}</div><div className="mt-1 truncate text-[#c0caf5]">{value}</div></div>
              ))}
            </div>
          ) : <p className="mt-3 text-[10px] text-[#565f89]">Run diagnostics to see version, uptime and log health.</p>}
        </div>

        <div className="rounded-xl border border-[#24283b] bg-[#161821] p-5">
          <div className="flex items-center gap-2"><Terminal className="w-4 h-4 text-[#9ece6a]" /><h2 className="text-xs font-black text-[#c0caf5]">Operator tips</h2></div>
          <ul className="mt-3 space-y-2 text-[10px] text-[#737aa2] list-disc pl-4">
            <li>Start NetGuard as administrator so packet capture and firewall rules work.</li>
            <li>Keep the Ethernet capture interface selected; do not capture the loopback adapter.</li>
            <li>Prevention defaults to monitor mode. Arm auto-block only after tuning detections.</li>
            <li>Use the Terminal and Network Diagnostics views for read-only checks.</li>
          </ul>
          <div className="mt-4 flex gap-2">
            <button onClick={() => onNavigate("settings")} className="rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[#a9b1d6] hover:text-white">Open settings</button>
            <button onClick={() => onNavigate("capture")} className="rounded-lg bg-[#7aa2f7] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[#0b0c0f]">Open capture</button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-[#e0af68]/30 bg-[#e0af68]/5 p-3 text-[10px] text-[#e0af68]">
        <XCircle className="w-4 h-4 shrink-0" /> The signed installer and true Windows service are not installed by this wizard; those remain release-pipeline work.
      </div>
    </div>
  );
}
