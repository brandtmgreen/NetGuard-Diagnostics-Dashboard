import { useEffect, useState } from "react";
import { Activity, Bot, Check, Copy, KeyRound, Save, Settings as SettingsIcon, ShieldAlert } from "lucide-react";
import { AppState, Diagnostics, Settings } from "../types";
import { api } from "../api";

interface Props {
  state: AppState;
  onSaveSettings: (patch: Partial<Settings>) => Promise<void>;
}

export default function SettingsView({ state, onSaveSettings }: Props) {
  const [captureFilter, setCaptureFilter] = useState(state.settings.captureFilter);
  const [geminiModel, setGeminiModel] = useState(state.settings.geminiModel);
  const [allowPublicScan, setAllowPublicScan] = useState(state.settings.allowPublicScan);
  const [allowedIps, setAllowedIps] = useState(state.settings.allowedRemoteIps.join("\n"));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [diagnosticsError, setDiagnosticsError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCaptureFilter(state.settings.captureFilter);
    setGeminiModel(state.settings.geminiModel);
    setAllowPublicScan(state.settings.allowPublicScan);
    setAllowedIps(state.settings.allowedRemoteIps.join("\n"));
  }, [
    state.settings.captureFilter,
    state.settings.geminiModel,
    state.settings.allowPublicScan,
    state.settings.allowedRemoteIps.join("|"),
  ]);

  useEffect(() => {
    let cancelled = false;
    api.diagnostics()
      .then(data => { if (!cancelled) setDiagnostics(data); })
      .catch(error => { if (!cancelled) setDiagnosticsError(error instanceof Error ? error.message : String(error)); });
    return () => { cancelled = true; };
  }, []);

  const copyLogPath = async () => {
    if (!diagnostics?.log.path) return;
    try {
      await navigator.clipboard.writeText(diagnostics.log.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await onSaveSettings({
        captureFilter,
        geminiModel,
        allowPublicScan,
        allowedRemoteIps: allowedIps.split(/\s+/).map((ip) => ip.trim()).filter(Boolean),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7aa2f7]">Configuration</div>
        <h1 className="mt-1 text-2xl font-black text-[#c0caf5]">Settings</h1>
        <p className="text-xs text-[#737aa2] mt-1">Local configuration only. Secrets stay in environment variables, never in the browser.</p>
      </div>

      <section className="rounded-xl border border-[#24283b] bg-[#161821] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-4 h-4 text-[#7aa2f7]" />
          <h2 className="text-sm font-black text-[#c0caf5]">Capture</h2>
        </div>
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-[#565f89]">Default BPF filter</label>
          <input value={captureFilter} onChange={(event) => setCaptureFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs font-mono text-[#c0caf5] focus:outline-none focus:border-[#7aa2f7]/60" />
          <p className="mt-1 text-[9px] text-[#565f89]">Applied when starting a capture. The default excludes the NetGuard UI port.</p>
        </div>
      </section>

      <section className="rounded-xl border border-[#24283b] bg-[#161821] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#bb9af7]" />
          <h2 className="text-sm font-black text-[#c0caf5]">AI analyst</h2>
        </div>
        <div className={`rounded-lg border p-3 text-[10px] ${state.ai.configured ? "border-[#9ece6a]/30 bg-[#9ece6a]/5 text-[#9ece6a]" : "border-[#e0af68]/30 bg-[#e0af68]/5 text-[#e0af68]"}`}>
          {state.ai.message}
        </div>
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-[#565f89]">Gemini model</label>
          <input value={geminiModel} onChange={(event) => setGeminiModel(event.target.value)} className="mt-1 w-full rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs font-mono text-[#c0caf5] focus:outline-none focus:border-[#7aa2f7]/60" />
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-[#24283b] bg-[#11131b] p-3 text-[10px] text-[#737aa2]">
          <KeyRound className="w-3.5 h-3.5 mt-0.5 text-[#565f89] shrink-0" />
          Set <code className="text-[#a9b1d6]">GEMINI_API_KEY</code> in the environment before launching NetGuard. AI output is advisory only and cannot execute commands or create firewall rules.
        </div>
      </section>

      <section className="rounded-xl border border-[#24283b] bg-[#161821] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#e0af68]" />
          <h2 className="text-sm font-black text-[#c0caf5]">Scanning & allowlist</h2>
        </div>
        <label className="flex items-center justify-between gap-4 rounded-lg border border-[#24283b] bg-[#11131b] p-3">
          <div>
            <div className="text-[10px] font-black text-[#c0caf5]">Allow public Nmap targets</div>
            <div className="text-[9px] text-[#565f89] mt-0.5">Only enable for systems you own or have written authorization to test.</div>
          </div>
          <input type="checkbox" checked={allowPublicScan} onChange={(event) => setAllowPublicScan(event.target.checked)} className="h-4 w-4 accent-[#e0af68]" />
        </label>
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-[#565f89]">Never-block allowlist</label>
          <textarea value={allowedIps} onChange={(event) => setAllowedIps(event.target.value)} rows={4} placeholder="One IP per line" className="mt-1 w-full rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs font-mono text-[#c0caf5] placeholder:text-[#414868] focus:outline-none focus:border-[#7aa2f7]/60" />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#7aa2f7] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#0b0c0f] hover:bg-[#89b4fa] disabled:opacity-50">
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save settings"}
        </button>
        {saved ? <span className="text-[10px] text-[#9ece6a]">Saved locally.</span> : null}
      </div>

      <section className="rounded-xl border border-[#24283b] bg-[#161821] p-5">
        <h2 className="text-sm font-black text-[#c0caf5]">System</h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono">
          {[
            ["Host", state.host.hostname],
            ["OS", `${state.host.platform} ${state.host.release}`],
            ["Architecture", state.host.arch],
            ["Privilege", state.host.isAdmin ? "administrator" : "standard user"],
            ["Nmap", state.nmapAvailable ? "available" : "missing"],
            ["tshark", state.tsharkAvailable ? "available" : "missing"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-[#24283b] py-1.5">
              <span className="text-[#565f89] uppercase">{label}</span>
              <span className="text-[#c0caf5] text-right">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[#24283b] bg-[#161821] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#9ece6a]" />
          <h2 className="text-sm font-black text-[#c0caf5]">Diagnostics & crash log</h2>
        </div>
        {diagnosticsError ? (
          <p className="text-[10px] text-[#f7768e]">Diagnostics unavailable: {diagnosticsError}</p>
        ) : diagnostics ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono">
              {[
                ["Version", diagnostics.version],
                ["Uptime", `${Math.floor(diagnostics.uptimeSeconds / 60)}m ${diagnostics.uptimeSeconds % 60}s`],
                ["Memory", `${diagnostics.memory.rssMb} MB`],
                ["Node", diagnostics.node],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[#24283b] bg-[#11131b] p-2">
                  <div className="text-[8px] font-black uppercase tracking-widest text-[#565f89]">{label}</div>
                  <div className="mt-1 truncate text-[#c0caf5]">{value}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-[9px] text-[#a9b1d6]">{diagnostics.log.path}</code>
              <button onClick={copyLogPath} className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-[#7aa2f7] hover:text-[#89b4fa]">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy path"}
              </button>
            </div>
            <p className="text-[9px] text-[#565f89]">
              Local JSONL log · {diagnostics.log.exists ? `${Math.round(diagnostics.log.sizeBytes / 1024)} KB` : "no file yet"}. Crash records include message, stack, process id and timestamp.
            </p>
            {diagnostics.recent.length > 0 && (
              <details className="rounded-lg border border-[#24283b] bg-[#0b0c0f] p-3">
                <summary className="cursor-pointer text-[9px] font-black uppercase tracking-widest text-[#565f89]">Recent events ({diagnostics.recent.length})</summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-[9px] leading-relaxed text-[#737aa2]">{diagnostics.recent.slice(-25).map(event => JSON.stringify(event)).join("\n")}</pre>
              </details>
            )}
          </>
        ) : (
          <p className="text-[10px] text-[#565f89]">Loading diagnostics…</p>
        )}
      </section>
    </div>
  );
}
