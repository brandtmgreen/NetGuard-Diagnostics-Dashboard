import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  ChevronDown,
  ChevronRight,
  Cpu,
  ListTree,
  MemoryStick,
  Power,
  RefreshCw,
  Search,
  ShieldAlert,
  Table2,
  X,
} from "lucide-react";
import { api } from "../api";
import { AppState, ProcessInfo } from "../types";

interface Props {
  state: AppState;
}

type SortKey = "memoryMb" | "cpuSeconds" | "name" | "pid";
type ViewMode = "tree" | "table";

interface ProcessNode {
  process: ProcessInfo;
  children: ProcessNode[];
}

function buildProcessTree(processes: ProcessInfo[]): ProcessNode[] {
  const nodes = new Map<number, ProcessNode>();
  processes.forEach(process => nodes.set(process.pid, { process, children: [] }));
  const roots: ProcessNode[] = [];
  nodes.forEach(node => {
    const parent = node.process.parentPid ? nodes.get(node.process.parentPid) : undefined;
    if (parent && parent.process.pid !== node.process.pid) parent.children.push(node);
    else roots.push(node);
  });
  const sortNodes = (items: ProcessNode[]) => {
    items.sort((a, b) => b.process.memoryMb - a.process.memoryMb || a.process.name.localeCompare(b.process.name));
    items.forEach(item => sortNodes(item.children));
  };
  sortNodes(roots);
  return roots;
}

function flattenTree(nodes: ProcessNode[], collapsed: Set<number>, depth = 0): Array<{ node: ProcessNode; depth: number }> {
  const rows: Array<{ node: ProcessNode; depth: number }> = [];
  nodes.forEach(node => {
    rows.push({ node, depth });
    if (node.children.length > 0 && !collapsed.has(node.process.pid)) {
      rows.push(...flattenTree(node.children, collapsed, depth + 1));
    }
  });
  return rows;
}

export default function TaskManagerView({ state }: Props) {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("memoryMb");
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<ProcessInfo | null>(null);
  const [confirmKill, setConfirmKill] = useState<ProcessInfo | null>(null);

  const load = async () => {
    try {
      const result = await api.processes();
      setProcesses(result.processes);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return processes
      .filter(process => {
        if (!term) return true;
        return [process.name, String(process.pid), process.path, process.commandLine]
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "pid") return a.pid - b.pid;
        return Number(b[sort]) - Number(a[sort]);
      });
  }, [processes, query, sort]);

  const treeRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const roots = buildProcessTree(processes);
    if (!term) return flattenTree(roots, collapsed);
    const visible = (node: ProcessNode): boolean => {
      const match = [node.process.name, String(node.process.pid), node.process.path, node.process.commandLine]
        .join(" ")
        .toLowerCase()
        .includes(term);
      return match || node.children.some(visible);
    };
    const filterTree = (nodes: ProcessNode[]): ProcessNode[] => nodes
      .filter(visible)
      .map(node => ({ process: node.process, children: filterTree(node.children) }));
    return flattenTree(filterTree(roots), collapsed);
  }, [processes, query, collapsed]);

  const totalMemory = processes.reduce((sum, process) => sum + process.memoryMb, 0);
  const topMemory = processes.slice().sort((a, b) => b.memoryMb - a.memoryMb)[0];

  const toggleCollapse = (pid: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const collapseAll = () => {
    const parentPids = processes.filter(process => processes.some(child => child.parentPid === process.pid)).map(process => process.pid);
    setCollapsed(new Set(parentPids));
  };

  const kill = async () => {
    if (!confirmKill) return;
    try {
      await api.killProcess(confirmKill.pid, confirmKill.name);
      setConfirmKill(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConfirmKill(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7aa2f7]">Task manager</div>
          <h1 className="mt-1 text-2xl font-black text-[#c0caf5]">Live process control</h1>
          <p className="text-xs text-[#737aa2] mt-1">Real Windows processes, parent/child lineage, memory and CPU time. Refresh runs every 5 seconds.</p>
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 self-start rounded-lg border border-[#24283b] bg-[#161821] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#a9b1d6] hover:text-white">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Processes", value: processes.length, icon: Cpu },
          { label: "Memory in use", value: `${(totalMemory / 1024).toFixed(1)} GB`, icon: MemoryStick },
          { label: "Top memory", value: topMemory ? `${topMemory.name} · ${topMemory.memoryMb} MB` : "—", icon: ArrowDownWideNarrow },
          { label: "Privilege", value: state.host.isAdmin ? "Administrator" : "Standard user", icon: ShieldAlert },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-[#24283b] bg-[#161821] p-4">
            <Icon className="w-4 h-4 text-[#7aa2f7]" />
            <div className="mt-3 text-[9px] font-black uppercase tracking-widest text-[#565f89]">{label}</div>
            <div className="mt-1 text-sm font-black text-[#c0caf5] truncate">{value}</div>
          </div>
        ))}
      </div>

      {!state.host.isAdmin && (
        <div className="rounded-lg border border-[#e0af68]/30 bg-[#e0af68]/5 p-3 text-[10px] text-[#e0af68] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Start NetGuard as administrator to enable process termination. Listing remains read-only.
        </div>
      )}
      {error && <div className="rounded-lg border border-[#f7768e]/30 bg-[#f7768e]/5 p-3 text-[10px] text-[#f7768e]">{error}</div>}

      <div className="rounded-xl border border-[#24283b] bg-[#161821] overflow-hidden">
        <div className="p-3 border-b border-[#24283b] flex flex-col xl:flex-row gap-2 xl:items-center">
          <div className="flex rounded-lg border border-[#24283b] bg-[#11131b] p-1 shrink-0">
            <button onClick={() => setViewMode("tree")} className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider ${viewMode === "tree" ? "bg-[#7aa2f7]/10 text-[#7aa2f7]" : "text-[#565f89]"}`}>
              <ListTree className="w-3.5 h-3.5" /> Tree
            </button>
            <button onClick={() => setViewMode("table")} className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider ${viewMode === "table" ? "bg-[#7aa2f7]/10 text-[#7aa2f7]" : "text-[#565f89]"}`}>
              <Table2 className="w-3.5 h-3.5" /> Table
            </button>
          </div>
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#565f89]" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter by process, path, command line or PID" className="w-full rounded-lg border border-[#24283b] bg-[#11131b] py-2 pl-9 pr-3 text-[11px] font-mono text-[#c0caf5] outline-none focus:border-[#7aa2f7]/60" />
          </div>
          {viewMode === "tree" ? (
            <div className="flex gap-1.5 shrink-0">
              <button onClick={() => setCollapsed(new Set())} className="rounded-lg border border-[#24283b] bg-[#11131b] px-2.5 py-2 text-[9px] font-black uppercase tracking-wider text-[#737aa2] hover:text-[#c0caf5]">Expand all</button>
              <button onClick={collapseAll} className="rounded-lg border border-[#24283b] bg-[#11131b] px-2.5 py-2 text-[9px] font-black uppercase tracking-wider text-[#737aa2] hover:text-[#c0caf5]">Collapse</button>
            </div>
          ) : (
            <select value={sort} onChange={event => setSort(event.target.value as SortKey)} className="rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-[10px] font-bold text-[#c0caf5] outline-none shrink-0">
              <option value="memoryMb">Sort: memory</option>
              <option value="cpuSeconds">Sort: CPU time</option>
              <option value="name">Sort: name</option>
              <option value="pid">Sort: PID</option>
            </select>
          )}
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-left text-[10px]">
            <thead className="sticky top-0 bg-[#11131b] uppercase tracking-wider text-[#565f89]">
              <tr>
                <th className="px-3 py-2 font-black">PID</th>
                <th className="px-3 py-2 font-black">Process</th>
                <th className="px-3 py-2 font-black text-right">Memory</th>
                <th className="px-3 py-2 font-black text-right">CPU time</th>
                <th className="px-3 py-2 font-black text-right">Threads</th>
                <th className="px-3 py-2 font-black">Status</th>
                <th className="px-3 py-2 font-black" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24283b]">
              {viewMode === "tree"
                ? treeRows.map(({ node, depth }) => {
                    const process = node.process;
                    const hasChildren = node.children.length > 0;
                    const isCollapsed = collapsed.has(process.pid);
                    return (
                      <tr key={process.pid} onClick={() => setSelected(process)} className={`cursor-pointer hover:bg-white/[0.03] ${selected?.pid === process.pid ? "bg-[#7aa2f7]/5" : ""}`}>
                        <td className="px-3 py-2 font-mono text-[#565f89]">{process.pid}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-start gap-1.5" style={{ paddingLeft: depth * 16 }}>
                            {hasChildren ? (
                              <button onClick={event => { event.stopPropagation(); toggleCollapse(process.pid); }} className="mt-0.5 rounded p-0.5 text-[#565f89] hover:text-[#7aa2f7]" aria-label={isCollapsed ? "Expand process children" : "Collapse process children"}>
                                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            ) : <span className="w-4 shrink-0" />}
                            <div className="min-w-0">
                              <div className="font-bold text-[#c0caf5]">{process.name}</div>
                              <div className="max-w-[340px] truncate text-[9px] text-[#565f89]">{process.path || process.commandLine || "-"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[#a9b1d6]">{process.memoryMb.toFixed(1)} MB</td>
                        <td className="px-3 py-2 text-right font-mono text-[#737aa2]">{process.cpuSeconds.toFixed(1)}s</td>
                        <td className="px-3 py-2 text-right font-mono text-[#737aa2]">{process.threads}</td>
                        <td className="px-3 py-2"><span className={process.status === "Running" ? "text-[#9ece6a]" : "text-[#e0af68]"}>{process.status}</span></td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={event => { event.stopPropagation(); setConfirmKill(process); }} disabled={!state.host.isAdmin} title="End process" className="rounded p-1.5 text-[#565f89] hover:bg-[#f7768e]/10 hover:text-[#f7768e] disabled:opacity-30">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                : filtered.map(process => (
                    <tr key={process.pid} onClick={() => setSelected(process)} className={`cursor-pointer hover:bg-white/[0.03] ${selected?.pid === process.pid ? "bg-[#7aa2f7]/5" : ""}`}>
                      <td className="px-3 py-2 font-mono text-[#565f89]">{process.pid}</td>
                      <td className="px-3 py-2">
                        <div className="font-bold text-[#c0caf5]">{process.name}</div>
                        <div className="max-w-[340px] truncate text-[9px] text-[#565f89]">{process.path || "-"}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[#a9b1d6]">{process.memoryMb.toFixed(1)} MB</td>
                      <td className="px-3 py-2 text-right font-mono text-[#737aa2]">{process.cpuSeconds.toFixed(1)}s</td>
                      <td className="px-3 py-2 text-right font-mono text-[#737aa2]">{process.threads}</td>
                      <td className="px-3 py-2"><span className={process.status === "Running" ? "text-[#9ece6a]" : "text-[#e0af68]"}>{process.status}</span></td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={event => { event.stopPropagation(); setConfirmKill(process); }} disabled={!state.host.isAdmin} title="End process" className="rounded p-1.5 text-[#565f89] hover:bg-[#f7768e]/10 hover:text-[#f7768e] disabled:opacity-30">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {(viewMode === "tree" ? treeRows.length === 0 : filtered.length === 0) && <div className="py-12 text-center text-[11px] text-[#565f89]">No matching processes.</div>}
        </div>
      </div>

      {selected && (
        <div className="rounded-xl border border-[#24283b] bg-[#161821] p-4 text-[10px]">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-[#c0caf5]">{selected.name}</h2>
            <button onClick={() => setSelected(null)} className="text-[#565f89] hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 font-mono">
            {[
              ["PID", selected.pid],
              ["Parent PID", selected.parentPid ?? "—"],
              ["Memory", `${selected.memoryMb} MB`],
              ["CPU time", `${selected.cpuSeconds}s`],
              ["Threads", selected.threads],
              ["Status", selected.status],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded border border-[#24283b] bg-[#11131b] p-2">
                <div className="text-[8px] uppercase text-[#565f89]">{label}</div>
                <div className="mt-1 text-[#c0caf5]">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 break-all font-mono text-[9px] text-[#737aa2]">{selected.path || "Path unavailable (requires elevation)."}</div>
          {selected.commandLine ? <div className="mt-1 break-all font-mono text-[9px] text-[#565f89]">cmd: {selected.commandLine}</div> : null}
        </div>
      )}

      {confirmKill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmKill(null)}>
          <div className="w-full max-w-md rounded-xl border border-[#f7768e]/30 bg-[#161821] p-5" onClick={event => event.stopPropagation()}>
            <div className="flex items-center gap-2 text-[#f7768e]"><Power className="w-4 h-4" /><h3 className="text-sm font-black">End process?</h3></div>
            <p className="mt-3 text-xs text-[#a9b1d6]">Stop <strong className="text-white">{confirmKill.name}</strong> (PID {confirmKill.pid})? Unsaved work in that application will be lost.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmKill(null)} className="rounded-lg border border-[#24283b] px-3 py-2 text-[10px] font-bold text-[#a9b1d6]">Cancel</button>
              <button onClick={() => void kill()} className="rounded-lg bg-[#f7768e] px-3 py-2 text-[10px] font-black text-[#0b0c0f]">End process</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
