import { useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Loader2, Plus, Radar, ScanLine } from "lucide-react";
import { api } from "../api";
import { AppState, NmapResult } from "../types";
import { addPlannerTask } from "../planner";

interface Props {
  state: AppState;
}

export default function ScannerView({ state }: Props) {
  const [target, setTarget] = useState("127.0.0.1");
  const [profile, setProfile] = useState("quick");
  const [result, setResult] = useState<NmapResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"ports" | "raw">("ports");
  const [analysis, setAnalysis] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const scan = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.scan(target.trim(), profile));
      setAnalysis("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const analyze = async () => {
    if (!result) return;
    setAiBusy(true);
    setAnalysis("");
    try {
      const response = await api.ai(`Triage this authorized Nmap ${result.profile} scan for ${result.target}. Open ports: ${result.ports.filter(port => port.state === "open").map(port => `${port.port}/${port.protocol} ${port.service} ${port.version}`).join("; ") || "none"}. Summarize the top three risks and concrete remediation. Do not invent findings.`);
      setAnalysis(response.text);
    } catch (err) {
      setAnalysis(err instanceof Error ? err.message : String(err));
    } finally {
      setAiBusy(false);
    }
  };

  const planPort = (port: NmapResult["ports"][number]) => {
    if (!result) return;
    addPlannerTask({
      title: `Remediate ${port.service || "service"} on port ${port.port}/${port.protocol}`,
      description: `Nmap ${result.profile} scan of ${result.target} reported ${port.state} ${port.service || "unknown service"}${port.version ? ` (${port.version})` : ""}. Confirm exposure, restrict access, and patch or disable the service.`,
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      priority: "High",
      completed: false,
      assignedNode: result.target,
    });
    setNotice(`Added remediation for port ${port.port} to the Action Planner.`);
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7dcfff]">Nmap</div>
        <h1 className="mt-1 text-2xl font-black text-[#c0caf5]">Authorized port scanner</h1>
        <p className="text-xs text-[#737aa2] mt-1">Runs the installed Nmap binary. No simulated scan output.</p>
      </div>

      <div className="rounded-xl border border-[#24283b] bg-[#161821] p-5">
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-[#565f89]">Target</label>
            <input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="127.0.0.1 or hostname" className="mt-1 w-full rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs font-mono text-[#c0caf5] placeholder:text-[#414868] focus:outline-none focus:border-[#7aa2f7]/60" />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-[#565f89]">Profile</label>
            <select value={profile} onChange={(event) => setProfile(event.target.value)} className="mt-1 w-full rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs font-bold text-[#c0caf5] focus:outline-none">
              <option value="quick">Quick · top ports</option>
              <option value="intense">Intense · service/OS</option>
              <option value="vuln">Vulnerability scripts</option>
              <option value="os">OS fingerprint</option>
            </select>
          </div>
          <button onClick={scan} disabled={busy || !state.nmapAvailable || !target.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#7dcfff] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#0b0c0f] hover:bg-[#a4e2ff] disabled:opacity-40">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
            {busy ? "Scanning…" : "Scan"}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[9px] text-[#565f89]">
          <AlertTriangle className="w-3.5 h-3.5 text-[#e0af68]" />
          Scan only systems you own or are authorized to test. Public targets are blocked unless enabled in Settings.
        </div>
        {notice ? <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#9ece6a]/30 bg-[#9ece6a]/5 p-3 text-[10px] text-[#9ece6a]"><CheckCircle2 className="w-3.5 h-3.5" />{notice}</div> : null}
        {error ? <div className="mt-3 rounded-lg border border-[#f7768e]/30 bg-[#f7768e]/5 p-3 text-[10px] text-[#f7768e]">{error}</div> : null}
      </div>

      {result ? (
        <div className="rounded-xl border border-[#24283b] bg-[#161821] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#24283b] flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Radar className="w-4 h-4 text-[#7dcfff]" />
              <div>
                <div className="text-xs font-black text-[#c0caf5]">{result.target} · {result.profile}</div>
                <div className="text-[9px] font-mono text-[#565f89]">{new Date(result.timestamp).toLocaleString()} · {result.status}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setTab("ports")} className={`px-2.5 py-1 rounded text-[9px] font-black uppercase ${tab === "ports" ? "bg-[#7dcfff]/10 text-[#7dcfff]" : "text-[#565f89]"}`}>Ports</button>
              <button onClick={() => setTab("raw")} className={`px-2.5 py-1 rounded text-[9px] font-black uppercase ${tab === "raw" ? "bg-[#7dcfff]/10 text-[#7dcfff]" : "text-[#565f89]"}`}>Raw</button>
              {state.ai.configured ? <button onClick={() => void analyze()} disabled={aiBusy} className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[9px] font-black uppercase text-[#bb9af7] disabled:opacity-40">{aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />} AI triage</button> : null}
            </div>
          </div>
          {analysis ? <div className="border-b border-[#24283b] bg-[#bb9af7]/5 px-4 py-3 text-[10px] leading-relaxed text-[#a9b1d6]"><div className="mb-1 text-[8px] font-black uppercase tracking-widest text-[#bb9af7]">AI triage</div>{analysis}</div> : null}
          {tab === "ports" ? (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-left text-[10px]">
                <thead className="sticky top-0 bg-[#11131b] text-[#565f89] uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 font-black">Port</th>
                    <th className="px-3 py-2 font-black">Protocol</th>
                    <th className="px-3 py-2 font-black">State</th>
                    <th className="px-3 py-2 font-black">Service</th>
                    <th className="px-3 py-2 font-black">Version</th>
                    <th className="px-3 py-2 font-black" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24283b]">
                  {result.ports.map((port) => (
                    <tr key={`${port.port}-${port.protocol}`} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2 font-mono text-[#c0caf5]">{port.port}</td>
                      <td className="px-3 py-2 font-mono text-[#7dcfff] uppercase">{port.protocol}</td>
                      <td className="px-3 py-2"><span className={port.state === "open" ? "text-[#9ece6a]" : "text-[#e0af68]"}>{port.state}</span></td>
                      <td className="px-3 py-2 text-[#a9b1d6]">{port.service || "—"}</td>
                      <td className="px-3 py-2 text-[#737aa2]">{port.version || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {port.state === "open" ? <button onClick={() => planPort(port)} title="Add remediation to Action Planner" className="rounded p-1.5 text-[#565f89] hover:bg-[#9ece6a]/10 hover:text-[#9ece6a]"><Plus className="w-3.5 h-3.5" /></button> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.ports.length === 0 ? <div className="py-10 text-center text-[11px] text-[#565f89]">No open ports reported.</div> : null}
            </div>
          ) : (
            <pre className="max-h-[520px] overflow-auto p-4 text-[10px] font-mono text-[#a9b1d6] whitespace-pre-wrap">{result.rawOutput || result.error || "No output."}</pre>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#24283b] bg-[#11131b] py-16 text-center">
          <Radar className="w-9 h-9 mx-auto text-[#414868]" />
          <p className="mt-3 text-xs text-[#737aa2]">No scan yet.</p>
          <p className="mt-1 text-[10px] text-[#565f89]">Nmap {state.nmapAvailable ? "is available." : "is not installed."}</p>
        </div>
      )}
    </div>
  );
}
