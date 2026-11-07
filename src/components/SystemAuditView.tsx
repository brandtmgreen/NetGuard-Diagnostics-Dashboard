import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileCheck,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  XCircle,
} from "lucide-react";
import { api } from "../api";
import { addPlannerTask } from "../planner";
import { AppState, AuditCheck, AuditStatus, SecurityAuditReport } from "../types";

interface Props {
  state: AppState;
}

const STATUS_STYLE: Record<AuditStatus, string> = {
  OK: "border-[#9ece6a]/30 bg-[#9ece6a]/10 text-[#9ece6a]",
  SUGGESTION: "border-[#7aa2f7]/30 bg-[#7aa2f7]/10 text-[#7aa2f7]",
  WARNING: "border-[#e0af68]/30 bg-[#e0af68]/10 text-[#e0af68]",
  CRITICAL: "border-[#f7768e]/30 bg-[#f7768e]/10 text-[#f7768e]",
};

const RISK_PRIORITY: Record<AuditCheck["riskImpact"], "Low" | "Medium" | "High" | "Critical"> = {
  Low: "Low",
  Medium: "Medium",
  High: "High",
};

let auditRequest: Promise<SecurityAuditReport> | null = null;

export default function SystemAuditView({ state }: Props) {
  const [report, setReport] = useState<SecurityAuditReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [query, setQuery] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const started = useRef(false);

  const run = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const request = auditRequest || api.audit();
      auditRequest = request;
      setReport(await request);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      auditRequest = null;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => ["All", ...Array.from(new Set((report?.checks || []).map(check => check.category)))], [report]);

  const filtered = useMemo(() => (report?.checks || []).filter(check => {
    const term = query.trim().toLowerCase();
    const matchesText = !term || `${check.id} ${check.title} ${check.currentValue} ${check.expectedValue} ${check.humanExplanation}`.toLowerCase().includes(term);
    return matchesText && (category === "All" || check.category === category) && (status === "All" || check.status === status);
  }), [report, category, status, query]);

  const analyze = async () => {
    if (!report) return;
    setAiBusy(true);
    setAnalysis("");
    try {
      const nonOk = report.checks.filter(check => check.status !== "OK");
      const response = await api.ai(`You are a Windows hardening auditor. Review these real local audit findings and write a concise prioritized remediation brief. Do not invent findings or claim changes were made. Findings: ${nonOk.map(check => `${check.id} ${check.title}: ${check.status}; current=${check.currentValue}; expected=${check.expectedValue}`).join(" | ") || "none"}`);
      setAnalysis(response.text);
    } catch (err) {
      setAnalysis(err instanceof Error ? err.message : String(err));
    } finally {
      setAiBusy(false);
    }
  };

  const addRemediation = (check: AuditCheck) => {
    if (!report) return;
    addPlannerTask({
      title: `${check.id}: ${check.title}`,
      description: `${check.humanExplanation}\nCurrent: ${check.currentValue}\nExpected: ${check.expectedValue}${check.remediationCommand ? `\nSuggested command: ${check.remediationCommand}` : ""}`,
      dueDate: new Date(Date.now() + (check.riskImpact === "High" ? 86400000 : 3 * 86400000)).toISOString().slice(0, 10),
      priority: RISK_PRIORITY[check.riskImpact],
      completed: false,
      assignedNode: report.hostname,
    });
    setNotice(`Added ${check.id} to the Action Planner.`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#bb9af7]">System audit</div>
          <h1 className="mt-1 text-2xl font-black text-[#c0caf5]">Windows hardening & compliance</h1>
          <p className="text-xs text-[#737aa2] mt-1">Read-only checks against Defender, firewall, UAC, SMB, RDP, Secure Boot, PowerShell and patch state.</p>
        </div>
        <button onClick={() => void run()} disabled={busy} className="inline-flex items-center gap-2 self-start rounded-lg border border-[#24283b] bg-[#161821] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#a9b1d6] hover:text-white disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} /> {busy ? "Auditing" : "Run audit"}
        </button>
      </div>

      {error && <div className="rounded-lg border border-[#f7768e]/30 bg-[#f7768e]/5 p-3 text-[10px] text-[#f7768e]">{error}</div>}
      {notice ? <div className="flex items-center gap-2 rounded-lg border border-[#9ece6a]/30 bg-[#9ece6a]/5 p-3 text-[10px] text-[#9ece6a]"><CheckCircle2 className="w-3.5 h-3.5" />{notice}</div> : null}

      {report ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="col-span-2 rounded-xl border border-[#24283b] bg-gradient-to-br from-[#181b28] to-[#11131b] p-4">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[#565f89]"><ShieldCheck className="w-4 h-4 text-[#bb9af7]" /> Hardening index</div>
              <div className="mt-2 flex items-end gap-2"><span className="text-4xl font-black text-[#c0caf5]">{report.score}</span><span className="pb-1 text-sm font-bold text-[#565f89]">/100</span></div>
              <div className="mt-2 h-1.5 rounded-full bg-[#0b0c0f]"><div className="h-full rounded-full bg-[#bb9af7]" style={{ width: `${report.score}%` }} /></div>
              <div className="mt-2 text-[9px] text-[#565f89]">{report.hostname} · {report.platform}</div>
            </div>
            {[
              { label: "Passed", value: report.okCount, status: "OK" as AuditStatus },
              { label: "Suggestions", value: report.suggestionCount, status: "SUGGESTION" as AuditStatus },
              { label: "Warnings", value: report.warningCount, status: "WARNING" as AuditStatus },
              { label: "Critical", value: report.criticalCount, status: "CRITICAL" as AuditStatus },
            ].map(item => (
              <div key={item.label} className={`rounded-xl border p-4 ${STATUS_STYLE[item.status]}`}>
                <div className="text-[9px] font-black uppercase tracking-widest opacity-70">{item.label}</div>
                <div className="mt-2 text-2xl font-black">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col xl:flex-row gap-2 xl:items-center rounded-xl border border-[#24283b] bg-[#161821] p-3">
            <div className="relative flex-1"><Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#565f89]" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter checks, IDs, values or explanations" className="w-full rounded-lg border border-[#24283b] bg-[#11131b] py-2 pl-9 pr-3 text-[10px] font-mono text-[#c0caf5] outline-none focus:border-[#7aa2f7]/60" /></div>
            <select value={category} onChange={event => setCategory(event.target.value)} className="rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-[10px] font-bold text-[#c0caf5] outline-none">
              {categories.map(item => <option key={item} value={item}>{item === "All" ? "All categories" : item}</option>)}
            </select>
            <select value={status} onChange={event => setStatus(event.target.value)} className="rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-[10px] font-bold text-[#c0caf5] outline-none">
              {["All", "OK", "SUGGESTION", "WARNING", "CRITICAL"].map(item => <option key={item} value={item}>{item === "All" ? "All statuses" : item}</option>)}
            </select>
            {state.ai.configured ? <button onClick={() => void analyze()} disabled={aiBusy} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#bb9af7]/30 bg-[#bb9af7]/10 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[#bb9af7] disabled:opacity-40">{aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />} AI brief</button> : null}
          </div>

          {analysis ? <div className="rounded-xl border border-[#bb9af7]/20 bg-[#bb9af7]/5 p-4 text-[10px] leading-relaxed text-[#a9b1d6]"><div className="mb-2 text-[8px] font-black uppercase tracking-widest text-[#bb9af7]">AI hardening brief</div>{analysis}</div> : null}

          <div className="space-y-2">
            {filtered.map(check => (
              <div key={check.id} className="rounded-xl border border-[#24283b] bg-[#161821] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[8px] font-black uppercase ${STATUS_STYLE[check.status]}`}>{check.status}</span>
                      <span className="font-mono text-[9px] text-[#565f89]">{check.id}</span>
                      <span className="text-[9px] uppercase tracking-wider text-[#565f89]">{check.category}</span>
                      <span className={`text-[8px] font-black uppercase ${check.riskImpact === "High" ? "text-[#f7768e]" : check.riskImpact === "Medium" ? "text-[#e0af68]" : "text-[#565f89]"}`}>{check.riskImpact} risk</span>
                    </div>
                    <h2 className="mt-1.5 text-sm font-black text-[#c0caf5]">{check.title}</h2>
                  </div>
                  {check.remediationCommand ? <button onClick={() => addRemediation(check)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#24283b] bg-[#11131b] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-[#7aa2f7] hover:border-[#7aa2f7]/40"><Plus className="w-3 h-3" /> Plan fix</button> : null}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#737aa2]">{check.humanExplanation}</p>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[9px] font-mono">
                  <div className="rounded border border-[#24283b] bg-[#11131b] p-2"><span className="text-[#565f89]">CURRENT </span><span className="text-[#a9b1d6]">{check.currentValue}</span></div>
                  <div className="rounded border border-[#24283b] bg-[#11131b] p-2"><span className="text-[#565f89]">EXPECTED </span><span className="text-[#9ece6a]">{check.expectedValue}</span></div>
                </div>
                {check.remediationCommand ? <div className="mt-2 flex items-start gap-2 rounded border border-[#24283b] bg-[#0b0c0f] p-2 text-[9px] font-mono text-[#737aa2]"><Terminal className="mt-0.5 w-3 h-3 shrink-0 text-[#565f89]" /><span className="break-all">{check.remediationCommand}</span></div> : null}
              </div>
            ))}
            {filtered.length === 0 && <div className="rounded-xl border border-dashed border-[#24283b] bg-[#11131b] py-12 text-center"><FileCheck className="w-8 h-8 mx-auto text-[#414868]" /><p className="mt-3 text-xs text-[#737aa2]">No checks match these filters.</p></div>}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-[#24283b] bg-[#11131b] p-3 text-[9px] text-[#565f89]"><AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#e0af68]" /> The audit reads local configuration only. Suggested commands are never executed automatically; add a plan and review it with an administrator.</div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-[#24283b] bg-[#11131b] py-20 text-center"><Loader2 className={`w-8 h-8 mx-auto text-[#7aa2f7] ${busy ? "animate-spin" : ""}`} /><p className="mt-3 text-xs text-[#737aa2]">{busy ? "Reading Windows configuration..." : "Run the audit to inspect this host."}</p></div>
      )}
    </div>
  );
}
