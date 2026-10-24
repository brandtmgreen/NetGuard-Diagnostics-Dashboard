import { useEffect, useState } from "react";
import { Download, FileText, Loader2, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { AppState, Report } from "../types";
import { formatTime } from "../format";

interface Props {
  state: AppState;
}

export default function ReportsView({ state }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const list = await api.reports();
      setReports(list);
      if (!selected && list[0]) setSelected(list[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const report = await api.generateReport();
      setReports((prev) => [report, ...prev]);
      setSelected(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const download = (report: Report) => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `netguard-report-${report.id.slice(0, 8)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#bb9af7]">Evidence</div>
          <h1 className="mt-1 text-2xl font-black text-[#c0caf5]">Incident reports</h1>
          <p className="text-xs text-[#737aa2] mt-1">Built from persisted detections and host state. AI is optional and never fabricates findings.</p>
        </div>
        <button
          onClick={generate}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-[#bb9af7] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#0b0c0f] hover:bg-[#c7a9ff] disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          Generate report
        </button>
      </div>

      {error ? <div className="rounded-lg border border-[#f7768e]/30 bg-[#f7768e]/5 p-3 text-[10px] text-[#f7768e]">{error}</div> : null}

      <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.8fr] gap-4">
        <div className="rounded-xl border border-[#24283b] bg-[#161821] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#24283b] text-[10px] font-black uppercase tracking-wider text-[#565f89]">Report history</div>
          <div className="divide-y divide-[#24283b] max-h-[560px] overflow-y-auto">
            {reports.map((report) => (
              <button key={report.id} onClick={() => setSelected(report)} className={`w-full text-left px-4 py-3 hover:bg-white/[0.03] ${selected?.id === report.id ? "bg-[#7aa2f7]/5" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-[#c0caf5] truncate">{report.title}</span>
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                    report.severity === "critical" ? "text-[#f7768e] bg-[#f7768e]/10" : report.severity === "high" ? "text-[#ff9e64] bg-[#ff9e64]/10" : "text-[#7aa2f7] bg-[#7aa2f7]/10"
                  }`}>{report.severity}</span>
                </div>
                <div className="mt-1 text-[9px] font-mono text-[#565f89]">{formatTime(report.createdAt)} · {report.alerts.length} alerts</div>
              </button>
            ))}
            {reports.length === 0 ? <div className="px-4 py-10 text-center text-[10px] text-[#565f89]">No reports yet. Generate one from the current evidence set.</div> : null}
          </div>
        </div>

        <div className="rounded-xl border border-[#24283b] bg-[#161821] p-5">
          {selected ? (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[9px] font-mono text-[#565f89]">{selected.id}</div>
                  <h2 className="mt-1 text-lg font-black text-[#c0caf5]">{selected.title}</h2>
                  <div className="mt-1 text-[10px] text-[#737aa2]">{new Date(selected.createdAt).toLocaleString()} · {selected.host.hostname}</div>
                </div>
                <button onClick={() => download(selected)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[#a9b1d6] hover:border-[#7aa2f7]/40">
                  <Download className="w-3 h-3" /> JSON
                </button>
              </div>
              <div className="mt-5 rounded-lg border border-[#24283b] bg-[#11131b] p-4 text-[11px] text-[#a9b1d6] leading-relaxed">{selected.summary}</div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ["Alerts", String(selected.alerts.length)],
                  ["Blocked", String(selected.alerts.filter((alert) => alert.status === "blocked").length)],
                  ["Admin", selected.host.isAdmin ? "yes" : "no"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-[#24283b] bg-[#0f1118] p-3">
                    <div className="text-[8px] uppercase tracking-widest text-[#565f89]">{label}</div>
                    <div className="mt-1 text-sm font-mono text-[#c0caf5]">{value}</div>
                  </div>
                ))}
              </div>
              <h3 className="mt-5 text-[10px] font-black uppercase tracking-wider text-[#565f89]">Recommendations</h3>
              <div className="mt-2 space-y-2">
                {selected.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-2 text-[10px] text-[#a9b1d6] leading-relaxed">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#9ece6a] mt-0.5 shrink-0" />
                    {recommendation}
                  </div>
                ))}
                {selected.recommendations.length === 0 ? <p className="text-[10px] text-[#565f89]">No recommendations recorded.</p> : null}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center">
              <FileText className="w-10 h-10 mx-auto text-[#414868]" />
              <p className="mt-3 text-xs text-[#737aa2]">Select a report or generate a new one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
