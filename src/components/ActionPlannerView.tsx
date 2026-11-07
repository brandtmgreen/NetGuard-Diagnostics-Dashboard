import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { PlannerTask } from "../types";
import { PLANNER_EVENT, readPlannerTasks, savePlannerTasks } from "../planner";

const PRIORITY_STYLE: Record<PlannerTask["priority"], string> = {
  Critical: "border-[#f7768e]/40 bg-[#f7768e]/10 text-[#f7768e]",
  High: "border-[#e0af68]/40 bg-[#e0af68]/10 text-[#e0af68]",
  Medium: "border-[#7aa2f7]/40 bg-[#7aa2f7]/10 text-[#7aa2f7]",
  Low: "border-[#565f89]/40 bg-[#565f89]/10 text-[#a9b1d6]",
};

const emptyForm = () => ({
  title: "",
  description: "",
  dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  priority: "Medium" as PlannerTask["priority"],
  assignedNode: "",
  prerequisiteTaskId: "",
});

export default function ActionPlannerView() {
  const [tasks, setTasks] = useState<PlannerTask[]>(() => readPlannerTasks());
  const [filterText, setFilterText] = useState("");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterStatus, setFilterStatus] = useState("Active");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [blocked, setBlocked] = useState("");

  useEffect(() => {
    savePlannerTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    const reload = () => setTasks(readPlannerTasks());
    window.addEventListener(PLANNER_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(PLANNER_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const sorted = useMemo(() => tasks.slice().sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const priorityRank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
    return byPriority || a.dueDate.localeCompare(b.dueDate);
  }), [tasks]);

  const filtered = useMemo(() => sorted.filter(task => {
    const term = filterText.trim().toLowerCase();
    const matchesText = !term || `${task.title} ${task.description} ${task.assignedNode || ""}`.toLowerCase().includes(term);
    const matchesPriority = filterPriority === "All" || task.priority === filterPriority;
    const matchesStatus = filterStatus === "All"
      || (filterStatus === "Active" && !task.completed)
      || (filterStatus === "Completed" && task.completed);
    return matchesText && matchesPriority && matchesStatus;
  }), [sorted, filterText, filterPriority, filterStatus]);

  const open = tasks.filter(task => !task.completed).length;
  const overdue = tasks.filter(task => !task.completed && task.dueDate < today).length;
  const completed = tasks.filter(task => task.completed).length;
  const critical = tasks.filter(task => !task.completed && task.priority === "Critical").length;

  const openForm = (task?: PlannerTask) => {
    setBlocked("");
    setEditingId(task?.id || null);
    setForm(task ? {
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      priority: task.priority,
      assignedNode: task.assignedNode || "",
      prerequisiteTaskId: task.prerequisiteTaskId || "",
    } : emptyForm());
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    const next: PlannerTask = {
      id: editingId || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: form.title.trim(),
      description: form.description.trim(),
      dueDate: form.dueDate || today,
      priority: form.priority,
      completed: editingId ? tasks.find(task => task.id === editingId)?.completed || false : false,
      createdAt: editingId ? tasks.find(task => task.id === editingId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
      assignedNode: form.assignedNode.trim() || undefined,
      prerequisiteTaskId: form.prerequisiteTaskId || undefined,
    };
    setTasks(prev => editingId ? prev.map(task => task.id === editingId ? next : task) : [next, ...prev]);
    closeForm();
  };

  const toggle = (task: PlannerTask) => {
    if (!task.completed && task.prerequisiteTaskId) {
      const prerequisite = tasks.find(item => item.id === task.prerequisiteTaskId);
      if (prerequisite && !prerequisite.completed) {
        setBlocked(`“${task.title}” is blocked until “${prerequisite.title}” is completed.`);
        return;
      }
    }
    setBlocked("");
    setTasks(prev => prev.map(item => item.id === task.id ? { ...item, completed: !item.completed } : item));
  };

  const remove = (id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
    if (editingId === id) closeForm();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9ece6a]">Action planner</div>
          <h1 className="mt-1 text-2xl font-black text-[#c0caf5]">Security follow-through</h1>
          <p className="text-xs text-[#737aa2] mt-1">Schedule remediation, assign it to a host, and enforce prerequisite steps.</p>
        </div>
        <button onClick={() => openForm()} className="inline-flex items-center gap-2 self-start rounded-lg bg-[#9ece6a] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#0b0c0f] hover:bg-[#b9e88a]">
          <Plus className="w-3.5 h-3.5" /> Add action
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total", value: tasks.length, icon: ClipboardCheck, color: "text-[#7aa2f7]" },
          { label: "Open", value: open, icon: Circle, color: "text-[#e0af68]" },
          { label: "Overdue", value: overdue, icon: CalendarDays, color: "text-[#f7768e]" },
          { label: "Completed", value: completed, icon: CheckCircle2, color: "text-[#9ece6a]" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-[#24283b] bg-[#161821] p-4">
            <Icon className={`w-4 h-4 ${color}`} />
            <div className="mt-2 text-[9px] font-black uppercase tracking-widest text-[#565f89]">{label}</div>
            <div className={`mt-1 text-2xl font-black ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {critical > 0 && <div className="rounded-lg border border-[#f7768e]/30 bg-[#f7768e]/5 p-3 text-[10px] text-[#f7768e]"><AlertTriangle className="inline w-3.5 h-3.5 mr-1.5" />{critical} critical action{critical === 1 ? "" : "s"} still open.</div>}
      {blocked && <div className="flex items-start justify-between gap-3 rounded-lg border border-[#e0af68]/30 bg-[#e0af68]/5 p-3 text-[10px] text-[#e0af68]"><span><AlertTriangle className="inline w-3.5 h-3.5 mr-1.5" />{blocked}</span><button onClick={() => setBlocked("")}><X className="w-3.5 h-3.5" /></button></div>}

      <div className="rounded-xl border border-[#24283b] bg-[#161821] p-3 flex flex-col xl:flex-row gap-2 xl:items-center">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#565f89]" />
          <input value={filterText} onChange={event => setFilterText(event.target.value)} placeholder="Search scheduled actions, descriptions or assigned nodes" className="w-full rounded-lg border border-[#24283b] bg-[#11131b] py-2 pl-9 pr-3 text-[10px] font-mono text-[#c0caf5] outline-none focus:border-[#7aa2f7]/60" />
        </div>
        <select value={filterPriority} onChange={event => setFilterPriority(event.target.value)} className="rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-[10px] font-bold text-[#c0caf5] outline-none">
          {["All", "Critical", "High", "Medium", "Low"].map(item => <option key={item} value={item}>Priority: {item}</option>)}
        </select>
        <div className="flex rounded-lg border border-[#24283b] bg-[#11131b] p-1">
          {["All", "Active", "Completed"].map(item => (
            <button key={item} onClick={() => setFilterStatus(item)} className={`rounded px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${filterStatus === item ? "bg-[#7aa2f7]/10 text-[#7aa2f7]" : "text-[#565f89] hover:text-[#c0caf5]"}`}>{item}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map(task => {
          const prerequisite = task.prerequisiteTaskId ? tasks.find(item => item.id === task.prerequisiteTaskId) : null;
          const isBlocked = Boolean(prerequisite && !prerequisite.completed && !task.completed);
          return (
            <div key={task.id} className={`group rounded-xl border p-4 transition ${task.completed ? "border-[#24283b] bg-[#11131b] opacity-60" : "border-[#24283b] bg-[#161821] hover:border-[#7aa2f7]/40"}`}>
              <div className="flex items-start gap-3">
                <button onClick={() => toggle(task)} className="mt-0.5 text-[#565f89] hover:text-[#9ece6a]" aria-label={task.completed ? "Mark incomplete" : "Mark complete"}>
                  {task.completed ? <CheckCircle2 className="w-4 h-4 text-[#9ece6a]" /> : <Circle className="w-4 h-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={`text-sm font-black ${task.completed ? "text-[#565f89] line-through" : "text-[#c0caf5]"}`}>{task.title}</h2>
                    <span className={`rounded border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${PRIORITY_STYLE[task.priority]}`}>{task.priority}</span>
                    {isBlocked && <span className="rounded border border-[#e0af68]/40 bg-[#e0af68]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#e0af68]">Blocked</span>}
                    {!task.completed && task.dueDate < today && <span className="rounded border border-[#f7768e]/40 bg-[#f7768e]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#f7768e]">Overdue</span>}
                  </div>
                  {task.description && <p className="mt-1 text-[11px] leading-relaxed text-[#737aa2]">{task.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-mono uppercase tracking-wider text-[#565f89]">
                    <span>Due {task.dueDate}</span>
                    {task.assignedNode && <span>Node {task.assignedNode}</span>}
                    {prerequisite && <span className={isBlocked ? "text-[#e0af68]" : ""}>After {prerequisite.title}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => openForm(task)} className="rounded p-1.5 text-[#565f89] hover:bg-[#7aa2f7]/10 hover:text-[#7aa2f7]" aria-label="Edit task"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(task.id)} className="rounded p-1.5 text-[#565f89] hover:bg-[#f7768e]/10 hover:text-[#f7768e]" aria-label="Delete task"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#24283b] bg-[#11131b] py-14 text-center">
            <ClipboardCheck className="w-8 h-8 mx-auto text-[#414868]" />
            <p className="mt-3 text-xs text-[#737aa2]">No actions match this view.</p>
            <button onClick={() => { setFilterText(""); setFilterPriority("All"); setFilterStatus("All"); }} className="mt-2 text-[9px] font-black uppercase tracking-wider text-[#7aa2f7] hover:underline">Reset filters</button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeForm}>
          <form className="w-full max-w-lg rounded-xl border border-[#24283b] bg-[#161821] p-5" onClick={event => event.stopPropagation()} onSubmit={save}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[#c0caf5]">{editingId ? "Edit security action" : "New security action"}</h2>
              <button type="button" onClick={closeForm} className="text-[#565f89] hover:text-white" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="mt-4 space-y-3">
              <input value={form.title} onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))} placeholder="Action title" className="w-full rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs text-[#c0caf5] outline-none focus:border-[#7aa2f7]/60" />
              <textarea value={form.description} onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))} placeholder="What needs to happen?" rows={3} className="w-full rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs text-[#c0caf5] outline-none focus:border-[#7aa2f7]/60" />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={form.dueDate} onChange={event => setForm(prev => ({ ...prev, dueDate: event.target.value }))} className="rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs text-[#c0caf5] outline-none" />
                <select value={form.priority} onChange={event => setForm(prev => ({ ...prev, priority: event.target.value as PlannerTask["priority"] }))} className="rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs font-bold text-[#c0caf5] outline-none">
                  {["Low", "Medium", "High", "Critical"].map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <input value={form.assignedNode} onChange={event => setForm(prev => ({ ...prev, assignedNode: event.target.value }))} placeholder="Assigned node or host (optional)" className="w-full rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs text-[#c0caf5] outline-none focus:border-[#7aa2f7]/60" />
              <select value={form.prerequisiteTaskId} onChange={event => setForm(prev => ({ ...prev, prerequisiteTaskId: event.target.value }))} className="w-full rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs text-[#c0caf5] outline-none">
                <option value="">No prerequisite</option>
                {tasks.filter(task => task.id !== editingId).map(task => <option key={task.id} value={task.id}>{task.title}</option>)}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeForm} className="rounded-lg border border-[#24283b] px-3 py-2 text-[10px] font-bold text-[#a9b1d6]">Cancel</button>
              <button type="submit" disabled={!form.title.trim()} className="rounded-lg bg-[#9ece6a] px-3 py-2 text-[10px] font-black text-[#0b0c0f] disabled:opacity-40">{editingId ? "Save changes" : "Add action"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
