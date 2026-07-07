import React, { useState } from "react";
import { 
  CheckSquare, 
  Square, 
  Calendar, 
  AlertOctagon, 
  Edit2, 
  Trash2, 
  Plus, 
  Search, 
  SlidersHorizontal,
  X,
  CheckCircle,
  Clock,
  Laptop,
  Lock,
  Unlock,
  ArrowRight,
  Workflow,
  Link
} from "lucide-react";
import { PlannerTask, Device } from "../types";

interface TaskPlannerProps {
  tasks: PlannerTask[];
  devices: Device[];
  onAddTask: (task: Omit<PlannerTask, "id">) => void;
  onUpdateTask: (task: PlannerTask) => void;
  onDeleteTask: (id: string) => void;
}

export default function TaskPlanner({
  tasks,
  devices,
  onAddTask,
  onUpdateTask,
  onDeleteTask
}: TaskPlannerProps) {
  const [filterText, setFilterText] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All"); // All, Active, Completed
  
  // Create / Edit modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null);
  
  // Form fields
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formPriority, setFormPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [formNode, setFormNode] = useState("");
  const [formPrereq, setFormPrereq] = useState("");

  // Error block indicators
  const [blockedTaskId, setBlockedTaskId] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<string>("");

  // Cycle checker for nested prerequisites
  const wouldCauseCycle = (taskId: string, prereqId: string): boolean => {
    if (!taskId || !prereqId) return false;
    if (taskId === prereqId) return true;
    let current = tasks.find(t => t.id === prereqId);
    const visited = new Set<string>();
    while (current && current.prerequisiteTaskId) {
      if (visited.has(current.id)) return true;
      visited.add(current.id);
      if (current.prerequisiteTaskId === taskId) return true;
      current = tasks.find(t => t.id === current!.prerequisiteTaskId);
    }
    return false;
  };

  const handleOpenCreate = () => {
    setEditingTask(null);
    setFormTitle("");
    setFormDesc("");
    
    // Set default due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFormDueDate(tomorrow.toISOString().split('T')[0]);
    
    setFormPriority("Medium");
    setFormNode("");
    setFormPrereq("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (task: PlannerTask) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDesc(task.description);
    setFormDueDate(task.dueDate);
    setFormPriority(task.priority);
    setFormNode(task.assignedNode || "");
    setFormPrereq(task.prerequisiteTaskId || "");
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingTask) {
      onUpdateTask({
        ...editingTask,
        title: formTitle,
        description: formDesc,
        dueDate: formDueDate,
        priority: formPriority,
        assignedNode: formNode || undefined,
        prerequisiteTaskId: formPrereq || undefined
      });
    } else {
      onAddTask({
        title: formTitle,
        description: formDesc,
        dueDate: formDueDate,
        completed: false,
        priority: formPriority,
        assignedNode: formNode || undefined,
        prerequisiteTaskId: formPrereq || undefined
      });
    }
    setIsModalOpen(false);
  };

  const handleToggleComplete = (task: PlannerTask) => {
    // If we're marking the task as completed, verify its prerequisite is completed
    if (!task.completed && task.prerequisiteTaskId) {
      const prereq = tasks.find(t => t.id === task.prerequisiteTaskId);
      if (prereq && !prereq.completed) {
        setBlockedTaskId(task.id);
        setBlockedReason(`Blocked: Prerequisite "${prereq.title}" must be completed first.`);
        setTimeout(() => {
          setBlockedTaskId(null);
        }, 4000);
        return;
      }
    }

    onUpdateTask({
      ...task,
      completed: !task.completed
    });
  };

  // Filter & Sort Logic
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(filterText.toLowerCase()) || 
                          task.description.toLowerCase().includes(filterText.toLowerCase());
    const matchesPriority = filterPriority === "All" || task.priority === filterPriority;
    const matchesStatus = filterStatus === "All" || 
                          (filterStatus === "Completed" && task.completed) || 
                          (filterStatus === "Active" && !task.completed);
    return matchesSearch && matchesPriority && matchesStatus;
  });

  // Solve all dependency pipelines
  const getDependencyChains = () => {
    const solvedChains: PlannerTask[][] = [];
    const hasDependents = (tId: string) => tasks.some(t => t.prerequisiteTaskId === tId);
    
    // Roots: have children dependents but no parent prerequisite of their own
    const roots = tasks.filter(t => !t.prerequisiteTaskId && hasDependents(t.id));
    
    roots.forEach(root => {
      const buildPaths = (currentTask: PlannerTask, currentPath: PlannerTask[]) => {
        const nextTasks = tasks.filter(t => t.prerequisiteTaskId === currentTask.id);
        if (nextTasks.length === 0) {
          if (currentPath.length > 1) {
            solvedChains.push(currentPath);
          }
        } else {
          nextTasks.forEach(next => {
            // Guard against infinite recursion just in case
            if (!currentPath.some(visited => visited.id === next.id)) {
              buildPaths(next, [...currentPath, next]);
            }
          });
        }
      };
      buildPaths(root, [root]);
    });
    
    return solvedChains;
  };

  const chains = getDependencyChains();

  const getPriorityColor = (priority: PlannerTask["priority"]) => {
    switch (priority) {
      case "Critical": return "bg-[#f7768e]/10 text-[#f7768e] border-[#f7768e]/20";
      case "High": return "bg-[#ff9e64]/10 text-[#ff9e64] border-[#ff9e64]/20";
      case "Medium": return "bg-[#e0af68]/10 text-[#e0af68] border-[#e0af68]/20";
      case "Low": return "bg-[#7aa2f7]/10 text-[#7aa2f7] border-[#7aa2f7]/20";
    }
  };

  return (
    <div className="p-4 overflow-y-auto h-full flex flex-col space-y-4 bg-[#0b0c0f] font-sans text-[#a9b1d6]">
      {/* Title */}
      <div className="border-b border-[#24283b] pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-100 uppercase tracking-tight">Security Task Organizer & Planner</h2>
          <p className="text-[#565f89] text-[11px]">Deploy and monitor manual network patch routines, server updates, and defensive mitigations.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 text-slate-950 rounded text-xs font-bold transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Schedule Task
        </button>
      </div>

      {/* Aggregate Planner Load */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#1a1b26] border border-[#24283b] p-3 rounded flex flex-col justify-between">
          <span className="text-[9px] font-bold text-[#565f89] uppercase tracking-wider block">Total Scheduled</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black text-slate-100">{tasks.length}</span>
            <span className="text-[10px] text-[#565f89]">actions</span>
          </div>
        </div>
        <div className="bg-[#1a1b26] border border-[#24283b] p-3 rounded flex flex-col justify-between">
          <span className="text-[9px] font-bold text-[#565f89] uppercase tracking-wider block">Pending Tasks</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black text-[#e0af68]">{tasks.filter(t => !t.completed).length}</span>
            <span className="text-[10px] text-[#565f89]">active</span>
          </div>
        </div>
        <div className="bg-[#1a1b26] border border-[#24283b] p-3 rounded flex flex-col justify-between">
          <span className="text-[9px] font-bold text-[#565f89] uppercase tracking-wider block">Completed</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black text-[#9ece6a]">{tasks.filter(t => t.completed).length}</span>
            <span className="text-[10px] text-[#565f89]">mitigated</span>
          </div>
        </div>
        <div className="bg-[#1a1b26] border border-[#24283b] p-3 rounded flex flex-col justify-between">
          <span className="text-[9px] font-bold text-[#565f89] uppercase tracking-wider block">Critical Failures</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black text-[#f7768e]">{tasks.filter(t => t.priority === "Critical" && !t.completed).length}</span>
            <span className="text-[10px] text-[#565f89]">high risk</span>
          </div>
        </div>
      </div>

      {/* Dependency Pipelines Roadmap */}
      {chains.length > 0 && (
        <div className="bg-[#1a1b26] border border-[#24283b] p-3 rounded.5 space-y-2">
          <div className="flex items-center gap-1.5 border-b border-[#24283b]/60 pb-1.5">
            <Workflow className="w-4 h-4 text-[#7aa2f7]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
              Active Security Mitigation Pipelines
              <span className="bg-[#7aa2f7]/10 text-[#7aa2f7] border border-[#7aa2f7]/20 text-[8px] font-mono px-1 rounded uppercase">
                CHAIN MAPS
              </span>
            </h3>
          </div>
          
          <div className="space-y-2.5 overflow-x-auto py-1">
            {chains.map((chain, chainIdx) => (
              <div key={`chain-${chainIdx}`} className="flex items-center gap-2 min-w-max pb-0.5">
                <span className="text-[9px] font-mono font-bold bg-[#16161e] px-1.5 py-0.5 rounded text-[#565f89] uppercase border border-[#24283b] select-none shrink-0">
                  Chain #{chainIdx + 1}
                </span>
                
                {chain.map((task, taskIdx) => {
                  const isCompleted = task.completed;
                  const hasPrereq = !!task.prerequisiteTaskId;
                  const prereq = hasPrereq ? tasks.find(t => t.id === task.prerequisiteTaskId) : null;
                  const isBlocked = prereq ? !prereq.completed : false;
                  
                  return (
                    <React.Fragment key={`chain-${chainIdx}-${task.id}`}>
                      {taskIdx > 0 && (
                        <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${
                          isCompleted ? "text-[#9ece6a]" : isBlocked ? "text-[#565f89]" : "text-[#7aa2f7]"
                        }`} />
                      )}
                      
                      <div 
                        onClick={() => handleOpenEdit(task)}
                        className={`px-3 py-1.5 rounded border font-mono text-[10px] flex items-center gap-1.5 cursor-pointer transition max-w-[240px] shrink-0 ${
                          isCompleted 
                            ? "bg-[#9ece6a]/10 border-[#9ece6a]/30 text-[#9ece6a] hover:bg-[#9ece6a]/20" 
                            : isBlocked 
                              ? "bg-[#16161e] border-[#24283b] text-[#565f89] hover:border-[#f7768e]/30" 
                              : "bg-[#7aa2f7]/10 border-[#7aa2f7]/30 text-[#7aa2f7] hover:bg-[#7aa2f7]/20"
                        }`}
                        title={`Click to edit task. Status: ${isCompleted ? "Resolved" : isBlocked ? "Locked" : "Ready"}`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-3.5 h-3.5 text-[#9ece6a] shrink-0" />
                        ) : isBlocked ? (
                          <Lock className="w-3.5 h-3.5 text-[#f7768e] shrink-0" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5 text-[#7aa2f7] shrink-0 animate-pulse" />
                        )}
                        <span className={`font-bold truncate max-w-[140px] ${isCompleted ? "line-through text-[#565f89]" : ""}`}>{task.title}</span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Options */}
      <div className="bg-[#1a1b26] border border-[#24283b] p-2.5 rounded flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-[#565f89] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search scheduled tasks..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full bg-[#16161e] border border-[#24283b] rounded py-1 pl-8 pr-3 text-xs text-[#a9b1d6] placeholder-[#565f89] focus:outline-none focus:border-[#7aa2f7]"
          />
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#565f89] text-[10px] uppercase font-mono font-bold">Priority:</span>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-[#16161e] border border-[#24283b] rounded text-xs px-2 py-1 text-[#a9b1d6] focus:outline-none focus:border-[#7aa2f7]"
          >
            <option value="All">All Levels</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#565f89] text-[10px] uppercase font-mono font-bold">Status:</span>
          <div className="flex bg-[#16161e] border border-[#24283b] rounded p-0.5">
            {["All", "Active", "Completed"].map((statusOption) => (
              <button
                key={statusOption}
                onClick={() => setFilterStatus(statusOption)}
                className={`px-2 py-0.5 text-[10px] rounded font-semibold transition ${
                  filterStatus === statusOption 
                    ? "bg-[#24283b] text-[#7aa2f7]" 
                    : "text-[#565f89] hover:text-[#a9b1d6]"
                }`}
              >
                {statusOption}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task Grid Cards */}
      <div className="flex-1 min-h-[250px]">
        {filteredTasks.length === 0 ? (
          <div className="h-full min-h-[200px] border border-dashed border-[#24283b] rounded flex flex-col items-center justify-center text-[#565f89] text-xs py-8 space-y-1.5">
            <CheckCircle className="w-8 h-8 text-[#565f89]" />
            <span>No tasks scheduled matching filter criteria.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredTasks.map((task) => {
              const prereq = task.prerequisiteTaskId ? tasks.find(t => t.id === task.prerequisiteTaskId) : null;
              const isLocked = prereq ? !prereq.completed : false;
              const dependents = tasks.filter(t => t.prerequisiteTaskId === task.id);

              return (
                <div 
                  key={task.id}
                  className={`bg-[#1a1b26] border rounded p-3.5 flex flex-col justify-between transition-all relative overflow-hidden ${
                    task.completed 
                      ? "border-[#24283b] opacity-60" 
                      : isLocked
                        ? "border-[#24283b] hover:border-[#f7768e]/30"
                        : "border-[#24283b] hover:border-[#7aa2f7]/50"
                  }`}
                >
                  {/* Blocked Alert Overlay banner */}
                  {blockedTaskId === task.id && (
                    <div className="absolute inset-x-0 top-0 bg-[#f7768e] text-slate-950 px-3 py-1.5 text-[10px] font-mono font-bold flex items-center gap-1.5 rounded-t animate-bounce z-10 select-none">
                      <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{blockedReason}</span>
                    </div>
                  )}

                  {/* Task Header */}
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => handleToggleComplete(task)}
                        className={`shrink-0 focus:outline-none mt-0.5 transition ${
                          isLocked 
                            ? "text-[#f7768e] hover:text-[#f7768e]" 
                            : "text-[#565f89] hover:text-[#9ece6a]"
                        }`}
                        title={isLocked ? `Locked: Prerequisite "${prereq?.title}" is incomplete.` : "Toggle status"}
                      >
                        {task.completed ? (
                          <CheckSquare className="w-4 h-4 text-[#9ece6a]" />
                        ) : isLocked ? (
                          <Lock className="w-4 h-4 text-[#f7768e]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-xs font-bold text-slate-100 truncate ${task.completed ? "line-through text-[#565f89]" : ""}`}>
                          {task.title}
                        </h4>
                      </div>
  
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenEdit(task)}
                          className="p-1 rounded hover:bg-[#24283b] text-[#565f89] hover:text-[#7aa2f7] transition"
                          title="Edit Task"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onDeleteTask(task.id)}
                          className="p-1 rounded hover:bg-[#24283b] text-[#565f89] hover:text-[#f7768e] transition"
                          title="Delete Task"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
  
                    <p className={`text-[11px] leading-relaxed text-[#a9b1d6] line-clamp-3 ${task.completed ? "text-[#565f89]" : ""}`}>
                      {task.description || "No description provided."}
                    </p>

                    {/* Dependency Badges */}
                    {(prereq || dependents.length > 0) && (
                      <div className="mt-2.5 pt-2 border-t border-[#24283b]/30 space-y-1.5 select-none">
                        {prereq && (
                          <div className={`flex items-center gap-1.5 text-[9px] font-mono leading-none ${
                            prereq.completed ? "text-[#9ece6a]" : "text-[#e0af68]"
                          }`}>
                            {prereq.completed ? (
                              <Unlock className="w-3 h-3 shrink-0 text-[#9ece6a]" />
                            ) : (
                              <Lock className="w-3 h-3 shrink-0 text-[#f7768e] animate-pulse" />
                            )}
                            <span className="opacity-60 uppercase font-bold text-[8px] tracking-tight">Requires:</span>
                            <span className="truncate max-w-[120px] font-semibold" title={prereq.title}>{prereq.title}</span>
                            <span className={`text-[8px] font-bold px-1 rounded shrink-0 ${
                              prereq.completed ? "bg-[#9ece6a]/10 text-[#9ece6a] border border-[#9ece6a]/20" : "bg-[#f7768e]/10 text-[#f7768e] border border-[#f7768e]/20"
                            }`}>
                              {prereq.completed ? "RESOLVED" : "LOCKED"}
                            </span>
                          </div>
                        )}
                        
                        {dependents.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#7aa2f7] leading-none">
                            <Link className="w-3 h-3 shrink-0" />
                            <span className="opacity-60 uppercase font-bold text-[8px] tracking-tight">Blocks:</span>
                            <span className="truncate max-w-[170px]" title={dependents.map(d => d.title).join(", ")}>
                              {dependents.length === 1 ? dependents[0].title : `${dependents.length} dependent tasks`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
  
                  {/* Task Footer Meta info */}
                  <div className="mt-4 pt-2.5 border-t border-[#24283b]/60 flex items-center justify-between gap-1.5 text-[10px] font-mono text-[#565f89]">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#7aa2f7]" />
                      <span>Due: {task.dueDate}</span>
                    </div>

                  <div className="flex items-center gap-2">
                    {task.assignedNode && (
                      <div className="flex items-center gap-0.5 text-[#bb9af7]" title={`Assigned Host IP: ${task.assignedNode}`}>
                        <Laptop className="w-3 h-3" />
                        <span className="max-w-[70px] truncate">{task.assignedNode}</span>
                      </div>
                    )}
                    <span className={`inline-block px-1 rounded text-[9px] font-bold uppercase border ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b26] border border-[#24283b] rounded-lg max-w-md w-full shadow-2xl p-4 space-y-4">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[#24283b] pb-2">
              <h3 className="text-xs font-black uppercase text-slate-100 tracking-wider">
                {editingTask ? "Update Planned Task" : "Deploy Scheduled Task Routine"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-[#565f89] hover:text-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[9px] text-[#565f89] font-bold uppercase block mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Patch Windows KB5014732 Rollup"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-[#16161e] border border-[#24283b] rounded px-2.5 py-1.5 text-xs text-[#a9b1d6] focus:outline-none focus:border-[#7aa2f7]"
                />
              </div>

              <div>
                <label className="text-[9px] text-[#565f89] font-bold uppercase block mb-1">Task Description</label>
                <textarea
                  placeholder="Describe step-by-step resolution, security commands, or mitigation policies..."
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-[#16161e] border border-[#24283b] rounded px-2.5 py-1.5 text-xs text-[#a9b1d6] focus:outline-none focus:border-[#7aa2f7] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-[#565f89] font-bold uppercase block mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full bg-[#16161e] border border-[#24283b] rounded px-2 py-1.5 text-xs text-[#a9b1d6] focus:outline-none focus:border-[#7aa2f7] font-mono"
                  />
                </div>

                <div>
                  <label className="text-[9px] text-[#565f89] font-bold uppercase block mb-1">Target Host / IP</label>
                  <select
                    value={formNode}
                    onChange={(e) => setFormNode(e.target.value)}
                    className="w-full bg-[#16161e] border border-[#24283b] rounded px-2 py-1.5 text-xs text-[#a9b1d6] focus:outline-none focus:border-[#7aa2f7]"
                  >
                    <option value="">No host assigned</option>
                    {devices.map(d => (
                      <option key={d.ip} value={d.ip}>{d.name} ({d.ip})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] text-[#565f89] font-bold uppercase block mb-1">Prerequisite Task (Optional dependency)</label>
                <select
                  value={formPrereq}
                  onChange={(e) => setFormPrereq(e.target.value)}
                  className="w-full bg-[#16161e] border border-[#24283b] rounded px-2.5 py-1.5 text-xs text-[#a9b1d6] focus:outline-none focus:border-[#7aa2f7]"
                >
                  <option value="">None (Independent Task)</option>
                  {tasks
                    .filter(t => !editingTask || t.id !== editingTask.id) // Exclude self
                    .filter(t => !editingTask || !wouldCauseCycle(editingTask.id, t.id)) // Prevent circular dependencies
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.title} {t.completed ? "(✓ Resolved)" : "(🔒 Incomplete)"}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] text-[#565f89] font-bold uppercase block mb-1">Severity / Priority</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {["Low", "Medium", "High", "Critical"].map((p) => {
                    const isSelected = formPriority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFormPriority(p as any)}
                        className={`py-1 text-[10px] rounded border font-bold uppercase transition cursor-pointer ${
                          isSelected 
                            ? "bg-[#7aa2f7]/15 text-[#7aa2f7] border-[#7aa2f7]" 
                            : "bg-[#16161e] text-[#565f89] border-[#24283b] hover:text-[#a9b1d6]"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-2 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 text-slate-950 text-xs font-bold rounded transition cursor-pointer mt-2"
              >
                {editingTask ? "Commit Task Changes" : "Create Planned Task"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
