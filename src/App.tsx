import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, ShieldAlert, X } from "lucide-react";
import { api } from "./api";
import { Alert, AppState, Settings } from "./types";
import Sidebar from "./components/Sidebar";
import DashboardView from "./components/DashboardView";
import NetworkView from "./components/NetworkView";
import ScannerView from "./components/ScannerView";
import DetectionsView from "./components/DetectionsView";
import PreventionView from "./components/PreventionView";
import CaptureView from "./components/CaptureView";
import ReportsView from "./components/ReportsView";
import SettingsView from "./components/SettingsView";

const titles: Record<string, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: "Operations", title: "Security overview" },
  network: { eyebrow: "Telemetry", title: "Network surface" },
  scanner: { eyebrow: "Assessment", title: "Authorized port scanner" },
  detections: { eyebrow: "Detection", title: "Intrusion detections" },
  prevention: { eyebrow: "Enforcement", title: "Prevention controls" },
  capture: { eyebrow: "Evidence", title: "Packet capture" },
  reports: { eyebrow: "Evidence", title: "Incident reports" },
  settings: { eyebrow: "Configuration", title: "Settings" },
};

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ ip: string; label: string } | null>(null);
  const [blocking, setBlocking] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await api.state();
      setState(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const action = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      await refresh();
      setToast({ kind: "ok", message: success });
    } catch (err) {
      setToast({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const saveSettings = async (patch: Partial<Settings>) => {
    try {
      await api.settings(patch);
      await refresh();
      setToast({ kind: "ok", message: "Settings saved." });
    } catch (err) {
      setToast({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const block = async (ip: string, direction: "Inbound" | "Outbound" | "Both", duration: number) => {
    try {
      await api.block(ip, direction, duration);
      await refresh();
      setToast({ kind: "ok", message: `Block rule created for ${ip}.` });
    } catch (err) {
      setToast({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const confirmBlock = async () => {
    if (!blockTarget) return;
    setBlocking(true);
    try {
      await api.block(blockTarget.ip, "Both", state?.settings.blockDurationMinutes || 15);
      await refresh();
      setToast({ kind: "ok", message: `Block rule created for ${blockTarget.ip}.` });
      setBlockTarget(null);
    } catch (err) {
      setToast({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBlocking(false);
    }
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-[#0b0c0f] text-[#a9b1d6] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          {error ? (
            <>
              <AlertTriangle className="w-10 h-10 mx-auto text-[#f7768e]" />
              <h1 className="mt-4 text-lg font-black text-[#c0caf5]">Control plane unavailable</h1>
              <p className="mt-2 text-xs text-[#737aa2] break-words">{error}</p>
              <button onClick={() => void refresh()} className="mt-4 rounded-lg bg-[#7aa2f7] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[#0b0c0f]">Retry</button>
            </>
          ) : (
            <>
              <Loader2 className="w-8 h-8 mx-auto text-[#7aa2f7] animate-spin" />
              <p className="mt-4 text-xs font-mono text-[#565f89]">Collecting live Windows telemetry…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const page = titles[activeTab] || titles.dashboard;
  const openAlerts = state.alerts.filter((alert) => alert.status === "open").length;

  return (
    <div className="min-h-screen bg-[#0b0c0f] text-[#a9b1d6] flex">
      <Sidebar activeTab={activeTab} onNavigate={setActiveTab} state={state} />
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 border-b border-[#24283b] bg-[#0b0c0f]/95 backdrop-blur px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-[8px] font-black uppercase tracking-[0.22em] text-[#565f89]">{page.eyebrow}</div>
            <h1 className="mt-0.5 text-sm font-black text-[#c0caf5]">{page.title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-[9px] font-mono text-[#565f89]">
              <span className={`w-1.5 h-1.5 rounded-full ${state.capture.running ? "bg-[#9ece6a]" : "bg-[#565f89]"}`} />
              {state.capture.running ? "CAPTURING" : "IDLE"}
              <span className="text-[#24283b]">|</span>
              {state.connections.length} CONN
              <span className="text-[#24283b]">|</span>
              {state.host.cpuPercent.toFixed(0)}% CPU
            </div>
            {openAlerts > 0 ? (
              <button onClick={() => setActiveTab("detections")} className="inline-flex items-center gap-1.5 rounded-lg border border-[#f7768e]/30 bg-[#f7768e]/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-[#f7768e]">
                <ShieldAlert className="w-3 h-3" /> {openAlerts} open
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-[#9ece6a]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9ece6a]" /> clear
              </span>
            )}
            <button onClick={() => void refresh()} className="text-[9px] font-black uppercase tracking-wider text-[#565f89] hover:text-[#c0caf5]">Refresh</button>
          </div>
        </header>

        <div className="p-6 max-w-[1500px]">
          {error ? (
            <div className="mb-4 rounded-lg border border-[#f7768e]/30 bg-[#f7768e]/5 p-3 text-[10px] text-[#f7768e]">
              Live refresh failed: {error}
            </div>
          ) : null}
          {activeTab === "dashboard" ? <DashboardView state={state} onNavigate={setActiveTab} /> : null}
          {activeTab === "network" ? <NetworkView state={state} /> : null}
          {activeTab === "scanner" ? <ScannerView state={state} /> : null}
          {activeTab === "detections" ? (
            <DetectionsView
              state={state}
              onAcknowledge={(id) => void action(() => api.acknowledgeAlert(id), "Alert acknowledged.")}
              onIgnore={(id) => void action(() => api.ignoreAlert(id), "Alert ignored.")}
              onBlock={(alert: Alert) => setBlockTarget({ ip: alert.sourceIp, label: alert.message })}
            />
          ) : null}
          {activeTab === "prevention" ? (
            <PreventionView
              state={state}
              onSaveSettings={saveSettings}
              onBlock={block}
              onUnblock={(name) => action(() => api.unblock(name), "Firewall rule removed.")}
            />
          ) : null}
          {activeTab === "capture" ? <CaptureView state={state} onRefresh={() => void refresh()} /> : null}
          {activeTab === "reports" ? <ReportsView state={state} /> : null}
          {activeTab === "settings" ? <SettingsView state={state} onSaveSettings={saveSettings} /> : null}
        </div>
      </main>

      {blockTarget ? (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-[#24283b] bg-[#161821] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-[#f7768e]">Firewall action</div>
                <h2 className="mt-1 text-sm font-black text-[#c0caf5]">Block {blockTarget.ip}?</h2>
              </div>
              <button onClick={() => setBlockTarget(null)} className="text-[#565f89] hover:text-[#c0caf5]"><X className="w-4 h-4" /></button>
            </div>
            <p className="mt-3 text-[11px] text-[#a9b1d6] leading-relaxed">
              This creates inbound and outbound Windows Firewall rules for <span className="font-mono text-[#f7768e]">{blockTarget.ip}</span>. The rule expires after {state.settings.blockDurationMinutes} minutes and is written to the local audit log.
            </p>
            <div className="mt-3 rounded-lg border border-[#24283b] bg-[#11131b] p-3 text-[10px] text-[#737aa2]">{blockTarget.label}</div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setBlockTarget(null)} className="rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[#a9b1d6]">Cancel</button>
              <button onClick={confirmBlock} disabled={blocking} className="rounded-lg bg-[#f7768e] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[#0b0c0f] disabled:opacity-50">
                {blocking ? "Creating…" : "Create block rule"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`fixed bottom-5 right-5 z-50 rounded-lg border px-4 py-3 text-[10px] font-bold shadow-xl ${
          toast.kind === "ok" ? "border-[#9ece6a]/30 bg-[#9ece6a]/10 text-[#9ece6a]" : "border-[#f7768e]/30 bg-[#f7768e]/10 text-[#f7768e]"
        }`}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
