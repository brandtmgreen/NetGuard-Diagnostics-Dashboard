import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Terminal,
  Lock,
  ExternalLink,
  Play,
  X,
  FileCheck,
  Search,
  RotateCcw,
  Info,
  Globe
} from "lucide-react";
import {
  LynisAuditReport,
  LynisAuditCheck,
  AiRemediationPlanItem,
  AuditCategory
} from "../types";
import { safeFetchJson } from "../lib/api";
import WindowCard from "./WindowCard";

interface SystemHardeningAuditProps {
  onLogTerminal?: (text: string, type?: "input" | "output" | "error" | "ai" | "info") => void;
}

interface PendingRemediationRequest {
  findingId: string;
  title: string;
  humanSummary: string;
  whyItMatters: string;
  command: string;
  rollbackCommand?: string;
  riskLevel: "Low" | "Medium" | "High";
}

export default function SystemHardeningAudit({ onLogTerminal }: SystemHardeningAuditProps) {
  const [report, setReport] = useState<LynisAuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ISSUES" | "OK">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Permission Modal State (Human-in-the-loop gate before executing any command)
  const [pendingApproval, setPendingApproval] = useState<PendingRemediationRequest | null>(null);
  const [editableCommand, setEditableCommand] = useState<string>("");
  const [isExecutingRemediation, setIsExecutingRemediation] = useState<boolean>(false);

  // History of user-approved & executed remediations in this session
  const [executionLogs, setExecutionLogs] = useState<
    Array<{
      id: string;
      findingId: string;
      title: string;
      command: string;
      output: string;
      executedAt: string;
      success: boolean;
    }>
  >([]);

  const executeLynisAudit = async (includeAi = true) => {
    setIsAuditing(true);
    setErrorMsg(null);
    onLogTerminal?.(
      "[LYNIS AUDITOR] Running live host hardening & compliance checks (Kernel, Auth, Filesystem, Network, SSH, Logging)...",
      "info"
    );

    try {
      const data = await safeFetchJson<LynisAuditReport>("/api/security/lynis-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeAi }),
      });

      if (!data || !Array.isArray(data.checks)) {
        throw new Error((data as any)?.error || "Invalid audit response from host daemon.");
      }

      setReport(data);
      onLogTerminal?.(
        `[LYNIS AUDITOR] Completed ${data.totalChecks} live checks. Hardening Index: ${data.hardeningIndex}/100 (${data.okCount} OK, ${data.suggestionCount} Suggestions, ${data.warningCount} Warnings, ${data.criticalCount} Critical).`,
        "ai"
      );
    } catch (err: any) {
      const msg = err?.message || String(err);
      setErrorMsg(msg);
      onLogTerminal?.(`[LYNIS AUDITOR ERROR] ${msg}`, "error");
    } finally {
      setIsAuditing(false);
    }
  };

  useEffect(() => {
    executeLynisAudit(true);
  }, []);

  // Open the explicit permission confirmation modal — never execute automatically
  const requestPermissionToRemediate = (req: PendingRemediationRequest) => {
    setPendingApproval(req);
    setEditableCommand(req.command);
  };

  const handleRequestFromCheck = (check: LynisAuditCheck) => {
    if (!check.remediationCommand) return;
    requestPermissionToRemediate({
      findingId: check.id,
      title: `${check.id}: ${check.title}`,
      humanSummary: check.humanExplanation,
      whyItMatters: `Current OS state (${check.currentValue}) differs from target hardened state (${check.expectedValue}).`,
      command: check.remediationCommand,
      rollbackCommand: check.rollbackCommand,
      riskLevel: check.riskImpact,
    });
  };

  const handleRequestFromAiItem = (item: AiRemediationPlanItem) => {
    requestPermissionToRemediate({
      findingId: item.findingId,
      title: `${item.findingId}: ${item.title}`,
      humanSummary: item.humanSummary,
      whyItMatters: item.whyItMatters,
      command: item.command,
      rollbackCommand: item.rollbackCommand,
      riskLevel: item.riskLevel,
    });
  };

  const handleConfirmAndExecute = async () => {
    if (!pendingApproval || !editableCommand.trim()) return;
    setIsExecutingRemediation(true);

    onLogTerminal?.(
      `[REMEDIATION APPROVED] User granted permission for ${pendingApproval.findingId}: ${editableCommand.trim()}`,
      "input"
    );

    try {
      const res = await safeFetchJson<any>("/api/security/lynis-remediate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved: true,
          findingId: pendingApproval.findingId,
          title: pendingApproval.title,
          command: editableCommand.trim(),
        }),
      });

      const outText = res?.output || res?.error || "Command completed with no stdout.";
      const ok = Boolean(res?.success);

      setExecutionLogs((prev) => [
        {
          id: `exec-${Date.now()}`,
          findingId: pendingApproval.findingId,
          title: pendingApproval.title,
          command: editableCommand.trim(),
          output: outText,
          executedAt: res?.executedAt || new Date().toLocaleTimeString(),
          success: ok,
        },
        ...prev,
      ]);

      onLogTerminal?.(outText, ok ? "output" : "error");
      setPendingApproval(null);

      // Re-run the audit checks so the user immediately sees the updated live OS value
      await executeLynisAudit(false);
    } catch (err: any) {
      const errStr = err?.message || String(err);
      setExecutionLogs((prev) => [
        {
          id: `exec-${Date.now()}`,
          findingId: pendingApproval.findingId,
          title: pendingApproval.title,
          command: editableCommand.trim(),
          output: `Execution error: ${errStr}`,
          executedAt: new Date().toLocaleTimeString(),
          success: false,
        },
        ...prev,
      ]);
      onLogTerminal?.(`[REMEDIATION ERROR] ${errStr}`, "error");
      setPendingApproval(null);
    } finally {
      setIsExecutingRemediation(false);
    }
  };

  const categories: AuditCategory[] = [
    "Kernel & Boot",
    "Authentication & Access",
    "Filesystem & Permissions",
    "Network & Firewall",
    "SSH & Services",
    "Logging & Integrity",
  ];

  const filteredChecks = (report?.checks || []).filter((chk) => {
    if (selectedCategory !== "ALL" && chk.category !== selectedCategory) return false;
    if (statusFilter === "ISSUES" && chk.status === "OK") return false;
    if (statusFilter === "OK" && chk.status !== "OK") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        chk.id.toLowerCase().includes(q) ||
        chk.title.toLowerCase().includes(q) ||
        chk.humanExplanation.toLowerCase().includes(q) ||
        chk.currentValue.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getStatusStyle = (status: LynisAuditCheck["status"]) => {
    switch (status) {
      case "OK":
        return "text-[#9ece6a]";
      case "SUGGESTION":
        return "text-[#7aa2f7]";
      case "WARNING":
        return "text-[#e0af68]";
      case "CRITICAL":
        return "text-[#f7768e]";
    }
  };

  return (
    <div className="p-4 overflow-y-auto h-full space-y-4 bg-[#0b0c0f] font-sans text-[#a9b1d6] relative">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#24283b] pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-100 tracking-tight uppercase flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#9ece6a]" />
            Lynis System Hardening & Compliance Auditor
          </h2>
          <p className="text-[#565f89] text-[11px]">
            Deep host configuration audit translated into plain English with Search-grounded AI remediation and mandatory permission gating.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => executeLynisAudit(true)}
            disabled={isAuditing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 text-slate-950 rounded text-xs font-bold transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? "animate-spin" : ""}`} />
            {isAuditing ? "Auditing System & Querying AI..." : "Run Full Lynis Audit + AI Analysis"}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-[#f7768e]/10 border border-[#f7768e]/30 rounded text-xs text-[#f7768e] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Window 1: Hardening Index & Plain-English AI Executive Summary */}
      <WindowCard
        id="lynis-summary-card"
        title="Hardening Index & Plain-English Security Summary"
        icon={<ShieldCheck className="w-4 h-4 text-[#9ece6a]" />}
        subtitle="Human-readable system posture score and Search-grounded AI hardening advisor"
        defaultHeight={250}
        minHeight={180}
        maxHeight={520}
      >
        <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left 4 cols: Hardening Index Gauge & Breakdown */}
          <div className="lg:col-span-4 bg-[#16161e] border border-[#24283b] rounded p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#565f89]">
                Lynis Hardening Index
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-slate-100">
                  {report ? report.hardeningIndex : "--"}
                </span>
                <span className="text-xs text-[#565f89] font-mono">/ 100</span>
                {report && (
                  <span className="text-xs text-[#9ece6a] ml-auto font-mono">
                    {report.totalChecks} Checks Run
                  </span>
                )}
              </div>

              <div className="w-full bg-[#0b0c0f] h-2 rounded overflow-hidden mt-2 border border-[#24283b]">
                <div
                  className="h-full bg-[#9ece6a] transition-all duration-700"
                  style={{ width: `${report?.hardeningIndex || 0}%` }}
                />
              </div>
            </div>

            {report && (
              <div className="mt-4 pt-3 border-t border-[#24283b] space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[#565f89]">Host / Kernel</span>
                  <span className="text-slate-200 truncate max-w-[180px]" title={report.kernelVersion}>
                    {report.hostname} · {report.platform}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#565f89]">Check Results</span>
                  <span className="text-slate-200">
                    <span className="text-[#9ece6a]">{report.okCount} OK</span>
                    {" · "}
                    <span className="text-[#7aa2f7]">{report.suggestionCount} Sugg</span>
                    {" · "}
                    <span className="text-[#e0af68]">{report.warningCount} Warn</span>
                    {" · "}
                    <span className="text-[#f7768e]">{report.criticalCount} Crit</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#565f89]">Execution Mode</span>
                  <span className="text-[#7aa2f7]">Permission-Gated (Safe)</span>
                </div>
              </div>
            )}
          </div>

          {/* Right 8 cols: Human-Parsable AI Overview + Google Search Grounding Sources */}
          <div className="lg:col-span-8 bg-[#16161e] border border-[#24283b] rounded p-3.5 flex flex-col justify-between">
            {isAuditing && !report ? (
              <div className="h-full flex items-center justify-center text-xs font-mono text-[#7aa2f7] py-8">
                Inspecting live kernel parameters, authentication policies, file permissions, and consulting Gemini AI with Google Search...
              </div>
            ) : report?.aiAnalysis ? (
              <div className="space-y-2.5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#7aa2f7]">
                    What This Means In Plain English
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed mt-1">
                    {report.aiAnalysis.plainEnglishOverview}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#24283b]/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#565f89]">
                    Technical Executive Assessment
                  </div>
                  <p className="text-[11px] text-[#a9b1d6] leading-relaxed mt-0.5">
                    {report.aiAnalysis.executiveSummary}
                  </p>
                </div>

                {report.aiAnalysis.groundingSources.length > 0 && (
                  <div className="pt-2 border-t border-[#24283b]/60">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ece6a] flex items-center gap-1.5 mb-1">
                      <Globe className="w-3 h-3" />
                      Verified Google Search Grounding References (CIS / Lynis Standards)
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                      {report.aiAnalysis.groundingSources.slice(0, 5).map((src, idx) => (
                        <a
                          key={idx}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#7aa2f7] hover:underline flex items-center gap-1 truncate max-w-[260px]"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{src.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col justify-center text-xs text-[#565f89] space-y-1">
                <p className="text-slate-300 font-semibold">
                  System audit checks completed. Click "Run Full Lynis Audit + AI Analysis" to generate Search-grounded AI recommendations.
                </p>
                <p>
                  Every check below includes a plain-English explanation and a permission-gated remediation command.
                </p>
              </div>
            )}
          </div>
        </div>
      </WindowCard>

      {/* Window 2: AI Recommended Remediations (Requires Explicit User Permission) */}
      {report?.aiAnalysis?.remediationPlan && report.aiAnalysis.remediationPlan.length > 0 && (
        <WindowCard
          id="lynis-ai-remediations"
          title="AI Recommended Remediations (Requires Your Permission Before Execution)"
          icon={<Lock className="w-4 h-4 text-[#e0af68]" />}
          subtitle="Review each recommended fix in plain English; nothing runs until you click Review & Approve"
          defaultHeight={280}
          minHeight={180}
          maxHeight={600}
        >
          <div className="p-3 space-y-2.5">
            {report.aiAnalysis.remediationPlan.map((item) => (
              <div
                key={item.id}
                className="bg-[#16161e] border border-[#24283b] rounded p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-[#7aa2f7]">{item.findingId}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-slate-100">{item.title}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#e0af68] font-mono text-[10px]">
                      Impact: {item.riskLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-snug">{item.humanSummary}</p>
                  <p className="text-[11px] text-[#565f89] leading-snug">
                    <strong className="text-[#a9b1d6]">Why it matters:</strong> {item.whyItMatters}
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-3 font-mono text-[10px]">
                    <span className="text-[#9ece6a] bg-[#0b0c0f] px-2 py-0.5 rounded border border-[#24283b]">
                      Command: {item.command}
                    </span>
                    {item.rollbackCommand && (
                      <span className="text-[#565f89]">
                        Rollback: {item.rollbackCommand}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleRequestFromAiItem(item)}
                  className="px-3 py-2 bg-[#e0af68] hover:bg-[#e0af68]/90 text-slate-950 font-bold text-xs rounded transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  Review & Grant Permission
                </button>
              </div>
            ))}
          </div>
        </WindowCard>
      )}

      {/* Window 3: Full Human-Parsable Lynis System Audit Checks */}
      <WindowCard
        id="lynis-checks-table"
        title="Human-Parsable System Hardening Checks"
        icon={<FileCheck className="w-4 h-4 text-[#7aa2f7]" />}
        subtitle="Detailed results across Kernel, Authentication, Filesystem, Network, SSH, and Logging"
        defaultHeight={460}
        minHeight={260}
        maxHeight={800}
      >
        <div className="p-3 space-y-3">
          {/* Interactive Filter Controls */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 bg-[#16161e] p-2 rounded border border-[#24283b]">
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => setSelectedCategory("ALL")}
                className={`px-2.5 py-1 text-[11px] font-bold rounded transition cursor-pointer ${
                  selectedCategory === "ALL"
                    ? "bg-[#24283b] text-[#7aa2f7]"
                    : "text-[#565f89] hover:text-slate-200"
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded transition cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-[#24283b] text-[#7aa2f7]"
                      : "text-[#565f89] hover:text-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-[#0b0c0f] p-0.5 rounded border border-[#24283b]">
                <button
                  onClick={() => setStatusFilter("ALL")}
                  className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${
                    statusFilter === "ALL" ? "bg-[#24283b] text-slate-100" : "text-[#565f89]"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter("ISSUES")}
                  className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${
                    statusFilter === "ISSUES" ? "bg-[#24283b] text-[#e0af68]" : "text-[#565f89]"
                  }`}
                >
                  Needs Attention
                </button>
                <button
                  onClick={() => setStatusFilter("OK")}
                  className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${
                    statusFilter === "OK" ? "bg-[#24283b] text-[#9ece6a]" : "text-[#565f89]"
                  }`}
                >
                  Hardened (OK)
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#565f89] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by ID or keyword..."
                  className="bg-[#0b0c0f] border border-[#24283b] rounded pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-[#565f89] focus:outline-none focus:border-[#7aa2f7] font-mono w-48"
                />
              </div>
            </div>
          </div>

          {/* Checks List */}
          <div className="space-y-2">
            {filteredChecks.length === 0 ? (
              <div className="text-center py-10 text-xs text-[#565f89] font-mono">
                No audit checks matched your current filter criteria.
              </div>
            ) : (
              filteredChecks.map((chk) => (
                <div
                  key={chk.id}
                  className="bg-[#16161e] border border-[#24283b] rounded p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    {/* Unboxed clean metadata row */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`font-mono font-bold ${getStatusStyle(chk.status)}`}>
                        [{chk.status}]
                      </span>
                      <span className="font-mono font-bold text-[#7aa2f7]">{chk.id}</span>
                      <span aria-hidden="true" className="text-[#565f89]">·</span>
                      <span className="font-bold text-slate-100">{chk.title}</span>
                      <span aria-hidden="true" className="text-[#565f89]">·</span>
                      <span className="text-[#565f89]">{chk.category}</span>
                    </div>

                    {/* Plain-English explanation */}
                    <p className="text-xs text-[#a9b1d6] leading-relaxed">
                      {chk.humanExplanation}
                    </p>

                    {/* Live Value vs Expected Target */}
                    <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-[#565f89]">
                      <span>
                        <strong className="text-slate-300">Live OS Value:</strong> {chk.currentValue}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        <strong className="text-[#9ece6a]">Hardened Target:</strong> {chk.expectedValue}
                      </span>
                    </div>
                  </div>

                  {chk.status !== "OK" && chk.remediationCommand ? (
                    <button
                      onClick={() => handleRequestFromCheck(chk)}
                      className="px-3 py-1.5 bg-[#1a1b26] hover:bg-[#24283b] text-[#e0af68] border border-[#e0af68]/40 rounded text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Remediate (Ask Permission)
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 text-xs font-mono text-[#9ece6a] shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Compliant</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </WindowCard>

      {/* Window 4: Executed Remediation Audit Trail */}
      {executionLogs.length > 0 && (
        <WindowCard
          id="lynis-remediation-log"
          title="Approved Remediation Execution Log"
          icon={<Terminal className="w-4 h-4 text-[#9ece6a]" />}
          subtitle="Commands explicitly authorized and executed during this session"
          defaultHeight={220}
          minHeight={140}
          maxHeight={420}
        >
          <div className="p-3 space-y-2 font-mono text-xs">
            {executionLogs.map((log) => (
              <div key={log.id} className="bg-[#16161e] border border-[#24283b] rounded p-2.5 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-100">
                    {log.title} ({log.findingId})
                  </span>
                  <span className="text-[#565f89]">{log.executedAt}</span>
                </div>
                <div className="text-[#7aa2f7] text-[10px]">$ {log.command}</div>
                <pre className="text-[10px] text-[#a9b1d6] bg-[#0b0c0f] p-2 rounded border border-[#24283b] whitespace-pre-wrap overflow-x-auto">
                  {log.output}
                </pre>
              </div>
            ))}
          </div>
        </WindowCard>
      )}

      {/* EXPLICIT PERMISSION & APPROVAL MODAL */}
      {pendingApproval && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#16161e] border-2 border-[#e0af68] rounded-lg max-w-xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#24283b] pb-3">
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-[#e0af68] shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                    Permission Required: System Hardening Remediation
                  </h3>
                  <p className="text-[11px] text-[#565f89]">
                    NetGuard will never modify system settings without your explicit confirmation.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPendingApproval(null)}
                className="text-[#565f89] hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase text-[#565f89]">Target Finding</div>
                <div className="text-slate-100 font-bold mt-0.5">{pendingApproval.title}</div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase text-[#565f89]">
                  What This Change Does (Plain English)
                </div>
                <p className="text-slate-200 mt-0.5 leading-relaxed">{pendingApproval.humanSummary}</p>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase text-[#565f89]">
                  Security Justification
                </div>
                <p className="text-[#a9b1d6] mt-0.5 leading-relaxed">{pendingApproval.whyItMatters}</p>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[#e0af68] block mb-1">
                  Exact Command To Be Executed (Editable before approval)
                </label>
                <input
                  type="text"
                  value={editableCommand}
                  onChange={(e) => setEditableCommand(e.target.value)}
                  className="w-full bg-[#0b0c0f] border border-[#24283b] rounded px-3 py-2 font-mono text-xs text-[#9ece6a] focus:outline-none focus:border-[#e0af68]"
                />
              </div>

              {pendingApproval.rollbackCommand && (
                <div className="bg-[#0b0c0f] border border-[#24283b] rounded p-2.5 font-mono text-[10px] text-[#565f89] flex items-center justify-between">
                  <span>
                    <strong className="text-slate-300">Reversible Rollback Command:</strong>{" "}
                    {pendingApproval.rollbackCommand}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditableCommand(pendingApproval.rollbackCommand || "")}
                    className="text-[#7aa2f7] hover:underline flex items-center gap-1 ml-2 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Load Rollback
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#24283b]">
              <button
                type="button"
                onClick={() => setPendingApproval(null)}
                disabled={isExecutingRemediation}
                className="px-4 py-2 bg-[#1a1b26] hover:bg-[#24283b] text-[#a9b1d6] rounded text-xs font-bold border border-[#24283b] transition cursor-pointer"
              >
                Deny / Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAndExecute}
                disabled={isExecutingRemediation || !editableCommand.trim()}
                className="px-4 py-2 bg-[#9ece6a] hover:bg-[#9ece6a]/90 text-slate-950 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isExecutingRemediation ? "Executing Approved Command..." : "Approve & Execute Command"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
