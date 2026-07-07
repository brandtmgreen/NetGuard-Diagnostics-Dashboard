import React, { useState } from "react";
import { 
  Search, 
  Trash2, 
  Plus, 
  Cpu, 
  HardDrive, 
  Network, 
  Activity,
  ArrowUpDown,
  Boxes,
  Chrome,
  ShieldCheck,
  Server,
  Laptop,
  MessageSquare,
  Music,
  FileCode,
  User,
  Calendar,
  Clock,
  ChevronRight,
  ChevronDown,
  Info,
  Terminal,
  CornerDownRight,
  RefreshCw,
  GitMerge,
  Eye,
  ShieldAlert
} from "lucide-react";
import { Process } from "../types";

interface TaskManagerProps {
  processes: Process[];
  onEndTask: (pid: number) => void;
  onSpawnTask: (parentPid?: number) => void;
}

type SortField = "name" | "pid" | "cpu" | "memory" | "disk" | "network";
type ViewMode = "process-tree" | "program-registry" | "table";

interface AppMetadata {
  id: string;
  name: string;
  description: string;
  publisher: string;
  initiator: string;
  installedDate: string;
  installedMethod: string;
  initializedDate: string;
  initializedMethod: string;
  iconColor: string;
  processNames: string[];
}

const APPS_METADATA: AppMetadata[] = [
  {
    id: "chrome",
    name: "Google Chrome Browser",
    description: "Enterprise multi-tab web browser and secure sandbox runtime environment.",
    publisher: "Google LLC",
    initiator: "Admin_David",
    installedDate: "2026-01-15",
    installedMethod: "ChromeSetup.msi (Enterprise Active Directory GPO)",
    initializedDate: "2026-07-07 07:05:10",
    initializedMethod: "Desktop Shortcut double-click & user shell initialization",
    iconColor: "text-[#7aa2f7]",
    processNames: ["chrome_isolated.exe", "msedge_isolated.exe"]
  },
  {
    id: "docker",
    name: "Docker Desktop Service",
    description: "Container virtualization host, hypervisor manager, and local Kubernetes engine.",
    publisher: "Docker Inc.",
    initiator: "SYSTEM",
    installedDate: "2025-11-20",
    installedMethod: "Chocolatey Package Manager (choco install docker-desktop)",
    initializedDate: "2026-07-07 06:12:05",
    initializedMethod: "Windows Service Control Manager daemon launch (Auto-Start)",
    iconColor: "text-[#7bc5e3]",
    processNames: ["docker_engine.service", "dockerd.exe"]
  },
  {
    id: "netguard",
    name: "NetGuard Cyber Security Suite",
    description: "Endpoint threat detection, live socket inspection, and deep packet analytics engine.",
    publisher: "NetGuard Corp.",
    initiator: "SYSTEM",
    installedDate: "2026-02-10",
    installedMethod: "Secure NetGuard Deployer (Active GPO MSI)",
    initializedDate: "2026-07-07 05:00:00",
    initializedMethod: "Local Machine Run Registry Key (HKLM\\Software\\Microsoft\\Windows)",
    iconColor: "text-[#f7768e]",
    processNames: ["security_scan.bin", "netguard_agent.exe"]
  },
  {
    id: "nodejs",
    name: "Node.js Server Runtime",
    description: "V8 JavaScript server engine hosting local admin command proxy services.",
    publisher: "Node.js Foundation",
    initiator: "DevOps_Sarah",
    installedDate: "2026-05-04",
    installedMethod: "Node Version Manager (nvm install 20.11.0)",
    initializedDate: "2026-07-07 07:15:33",
    initializedMethod: "DevOps PowerShell administrative terminal (npm run start)",
    iconColor: "text-[#9ece6a]",
    processNames: ["node_runtime.exe", "npm_watch.exe", "npm_daemon.exe"]
  },
  {
    id: "explorer",
    name: "Windows Explorer Shell",
    description: "Graphical file explorer, desktop session broker, and keyboard shortcut listeners.",
    publisher: "Microsoft Corporation",
    initiator: "Admin_David",
    installedDate: "Built-in OS Layer",
    installedMethod: "Windows OS Base Image deployment (WIM corporate image)",
    initializedDate: "2026-07-07 06:00:15",
    initializedMethod: "Winlogon credential authorization user shell session handshake",
    iconColor: "text-[#e0af68]",
    processNames: ["explorer.exe"]
  },
  {
    id: "discord",
    name: "Discord Desktop Client",
    description: "Enterprise real-time group communication and Rich Presence RPC thread host.",
    publisher: "Discord Inc.",
    initiator: "Admin_David",
    installedDate: "2026-03-22",
    installedMethod: "DiscordSetup.exe direct manual user install",
    initializedDate: "2026-07-07 07:20:10",
    initializedMethod: "User Startup Folder shortcut execution (APPDATA)",
    iconColor: "text-[#bb9af7]",
    processNames: ["discord_rpc.exe"]
  },
  {
    id: "spotify",
    name: "Spotify Background Agent",
    description: "Lightweight background music agent, media-key hooks, and caching daemon.",
    publisher: "Spotify AB",
    initiator: "Admin_David",
    installedDate: "2026-04-01",
    installedMethod: "Windows App Store package manifest",
    initializedDate: "2026-07-07 07:25:00",
    initializedMethod: "Manual click on Start Menu pinned icon",
    iconColor: "text-[#9ece6a]",
    processNames: ["spotify_agent.exe"]
  },
  {
    id: "system_kernel",
    name: "Windows NT Operating System Kernel",
    description: "System idle processes, hardware abstraction layer, registry hives, and core drivers.",
    publisher: "Microsoft Corporation",
    initiator: "SYSTEM",
    installedDate: "Built-in OS Core",
    installedMethod: "OEM Hardware pre-install partition",
    initializedDate: "2026-07-07 00:00:01",
    initializedMethod: "Motherboard UEFI ACPI system boot sequence",
    iconColor: "text-[#a9b1d6]",
    processNames: ["System Idle Process", "System Kernel Task", "svchost.exe (Local)", "powershell_ssh.exe"]
  }
];

interface ProcessTreeNode {
  process: Process;
  children: ProcessTreeNode[];
}

export default function TaskManager({ processes, onEndTask, onSpawnTask }: TaskManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("process-tree");
  const [filterText, setFilterText] = useState("");
  
  // Table sort states
  const [sortField, setSortField] = useState<SortField>("cpu");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);

  // Tree view state
  const [selectedAppId, setSelectedAppId] = useState<string>("chrome");
  const [collapsedPids, setCollapsedPids] = useState<Set<number>>(new Set());

  // Determine dynamic apps based on current processes
  const mappedProcessNames = new Set(APPS_METADATA.flatMap(app => app.processNames));
  const unmappedActiveProcesses = processes.filter(p => !mappedProcessNames.has(p.name));

  const dynamicApps = [...APPS_METADATA];
  if (unmappedActiveProcesses.length > 0) {
    // Add virtual app container for unmapped threads so they can be grouped/killed
    dynamicApps.push({
      id: "unmapped",
      name: "Independent Daemon Threads",
      description: "Uncategorized background tasks, logs, or manually executed CLI command loops.",
      publisher: "Ad-Hoc / Various Systems",
      initiator: "Admin_David / SYSTEM",
      installedDate: "Temporary Cache",
      installedMethod: "Ad-hoc sandbox executed binary / Local administrator shell",
      initializedDate: "Dynamic Terminal Session",
      initializedMethod: "Manual subprocess invocation or custom developer terminal daemon spawn",
      iconColor: "text-[#a9b1d6]",
      processNames: unmappedActiveProcesses.map(p => p.name)
    });
  }

  // Filter logic for Apps Registry View
  const filteredApps = dynamicApps.filter(app => {
    const appProcesses = processes.filter(p => app.processNames.includes(p.name));
    
    // Search app parameters or its active processes
    const matchesAppMeta = 
      app.name.toLowerCase().includes(filterText.toLowerCase()) ||
      app.description.toLowerCase().includes(filterText.toLowerCase()) ||
      app.publisher.toLowerCase().includes(filterText.toLowerCase()) ||
      app.initiator.toLowerCase().includes(filterText.toLowerCase());
      
    const matchesProcesses = appProcesses.some(p => 
      p.name.toLowerCase().includes(filterText.toLowerCase()) || 
      p.pid.toString().includes(filterText)
    );

    return matchesAppMeta || matchesProcesses;
  });

  // Automatically select an app if the current selection is filtered out
  const activeSelectedAppId = filteredApps.some(a => a.id === selectedAppId)
    ? selectedAppId
    : filteredApps[0]?.id || "";

  const selectedApp = dynamicApps.find(a => a.id === activeSelectedAppId);
  const selectedAppProcesses = selectedApp 
    ? processes.filter(p => selectedApp.processNames.includes(p.name))
    : [];

  // Table sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedProcesses = [...processes]
    .filter(p => p.name.toLowerCase().includes(filterText.toLowerCase()) || p.pid.toString().includes(filterText))
    .sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === "string" && typeof valB === "string") {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      }
    });

  // Build a tree of active processes
  const buildProcessTree = (procs: Process[]): ProcessTreeNode[] => {
    const procMap = new Map<number, ProcessTreeNode>();
    
    // Create nodes
    procs.forEach(p => {
      procMap.set(p.pid, { process: p, children: [] });
    });

    const roots: ProcessTreeNode[] = [];

    // Assign children or roots
    procs.forEach(p => {
      const node = procMap.get(p.pid)!;
      if (p.parentPid !== undefined && procMap.has(p.parentPid) && p.parentPid !== p.pid) {
        const parentNode = procMap.get(p.parentPid)!;
        parentNode.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const processTreeRoots = buildProcessTree(processes);

  // Recursive search matching for process tree
  const nodeMatchesFilter = (node: ProcessTreeNode, text: string): boolean => {
    if (!text) return true;
    const term = text.toLowerCase();
    return (
      node.process.name.toLowerCase().includes(term) ||
      node.process.pid.toString().includes(term) ||
      node.process.publisher.toLowerCase().includes(term) ||
      node.children.some(child => nodeMatchesFilter(child, text))
    );
  };

  // Flatten process tree into visible rows for table display
  const getVisibleRows = (nodes: ProcessTreeNode[], depth = 0): { node: ProcessTreeNode; depth: number }[] => {
    let rows: { node: ProcessTreeNode; depth: number }[] = [];
    
    nodes.forEach(node => {
      if (filterText && !nodeMatchesFilter(node, filterText)) {
        return;
      }

      rows.push({ node, depth });

      const hasChildren = node.children.length > 0;
      const isCollapsed = collapsedPids.has(node.process.pid);
      
      // Auto-expand everything when filter is applied, otherwise follow collapsedPids
      const isExpanded = filterText ? true : !isCollapsed;

      if (hasChildren && isExpanded) {
        rows = [...rows, ...getVisibleRows(node.children, depth + 1)];
      }
    });
    
    return rows;
  };

  const visibleTreeRows = getVisibleRows(processTreeRoots);

  const toggleCollapse = (pid: number) => {
    setCollapsedPids(prev => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setCollapsedPids(new Set());
  };

  const handleCollapseAll = () => {
    const parentPids = processes
      .filter(p => processes.some(c => c.parentPid === p.pid))
      .map(p => p.pid);
    setCollapsedPids(new Set(parentPids));
  };

  // Calculate Aggregates
  const totalCpu = Math.round(processes.reduce((acc, curr) => acc + curr.cpu, 0));
  const totalMemory = Math.round(processes.reduce((acc, curr) => acc + curr.memory, 0));
  const totalDisk = processes.reduce((acc, curr) => acc + curr.disk, 0).toFixed(1);
  const totalNetwork = processes.reduce((acc, curr) => acc + curr.network, 0).toFixed(1);

  const handleEndSelected = () => {
    if (selectedPid !== null) {
      onEndTask(selectedPid);
      setSelectedPid(null);
    }
  };

  const handleKillEntireApp = (app: AppMetadata) => {
    const appProcs = processes.filter(p => app.processNames.includes(p.name));
    appProcs.forEach(p => onEndTask(p.pid));
  };

  const getAppIconComponent = (appId: string) => {
    switch (appId) {
      case "chrome": return <Chrome className="w-4 h-4 text-[#7aa2f7]" />;
      case "docker": return <Boxes className="w-4 h-4 text-[#7bc5e3]" />;
      case "netguard": return <ShieldCheck className="w-4 h-4 text-[#f7768e]" />;
      case "nodejs": return <Server className="w-4 h-4 text-[#9ece6a]" />;
      case "explorer": return <Laptop className="w-4 h-4 text-[#e0af68]" />;
      case "discord": return <MessageSquare className="w-4 h-4 text-[#bb9af7]" />;
      case "spotify": return <Music className="w-4 h-4 text-[#9ece6a]" />;
      case "system_kernel": return <Cpu className="w-4 h-4 text-[#a9b1d6]" />;
      default: return <FileCode className="w-4 h-4 text-[#c0caf5]" />;
    }
  };

  const getProcessIcon = (processName: string) => {
    const matchingApp = APPS_METADATA.find(app => app.processNames.includes(processName));
    if (matchingApp) {
      return getAppIconComponent(matchingApp.id);
    }
    if (processName.endsWith(".exe") || processName.includes("isolated")) {
      return <Laptop className="w-4 h-4 text-[#e0af68]" />;
    }
    if (processName.endsWith(".bin") || processName.endsWith(".service")) {
      return <Server className="w-4 h-4 text-[#f7768e]" />;
    }
    return <Terminal className="w-4 h-4 text-[#7aa2f7]" />;
  };

  const getProcessInitiator = (name: string): string => {
    const matchingApp = APPS_METADATA.find(app => app.processNames.includes(name));
    return matchingApp ? matchingApp.initiator : "SYSTEM";
  };

  const getAppColorBorder = (appId: string) => {
    switch (appId) {
      case "chrome": return "border-[#7aa2f7]/25 hover:border-[#7aa2f7]/50";
      case "docker": return "border-[#7bc5e3]/25 hover:border-[#7bc5e3]/50";
      case "netguard": return "border-[#f7768e]/25 hover:border-[#f7768e]/50";
      case "nodejs": return "border-[#9ece6a]/25 hover:border-[#9ece6a]/50";
      case "explorer": return "border-[#e0af68]/25 hover:border-[#e0af68]/50";
      case "discord": return "border-[#bb9af7]/25 hover:border-[#bb9af7]/50";
      case "spotify": return "border-[#9ece6a]/25 hover:border-[#9ece6a]/50";
      case "system_kernel": return "border-[#a9b1d6]/25 hover:border-[#a9b1d6]/50";
      default: return "border-[#565f89]/25 hover:border-[#565f89]/50";
    }
  };

  return (
    <div className="p-4 overflow-y-auto h-full flex flex-col space-y-4 bg-[#0b0c0f] font-sans text-[#a9b1d6]">
      {/* Title */}
      <div className="border-b border-[#24283b] pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[#7aa2f7]" />
            Enterprise System Task Manager
          </h2>
          <p className="text-[#565f89] text-[11px]">Trace hierarchical process trees, inspect security lineages, and deploy immediate SIGKILL signals.</p>
        </div>

        {/* Dynamic View Selector Tab bar */}
        <div className="flex bg-[#16161e] border border-[#24283b] rounded p-0.5 shrink-0 self-end sm:self-auto">
          <button
            onClick={() => setViewMode("process-tree")}
            className={`px-2.5 py-1 text-[11px] rounded font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === "process-tree" 
                ? "bg-[#24283b] text-[#7aa2f7]" 
                : "text-[#565f89] hover:text-[#a9b1d6]"
            }`}
          >
            <GitMerge className="w-3.5 h-3.5 rotate-90" />
            Interactive Process Tree
          </button>
          <button
            onClick={() => setViewMode("program-registry")}
            className={`px-2.5 py-1 text-[11px] rounded font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === "program-registry" 
                ? "bg-[#24283b] text-[#7aa2f7]" 
                : "text-[#565f89] hover:text-[#a9b1d6]"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Program Registry & Install Meta
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-2.5 py-1 text-[11px] rounded font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === "table" 
                ? "bg-[#24283b] text-[#7aa2f7]" 
                : "text-[#565f89] hover:text-[#a9b1d6]"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Classic Spreadsheet
          </button>
        </div>
      </div>

      {/* Aggregate Resource Load Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* CPU */}
        <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#565f89] text-[10px] font-bold uppercase tracking-wider mb-1.5">
            <span>CPU Cluster</span>
            <Cpu className="w-3.5 h-3.5 text-[#7aa2f7]" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-100">{totalCpu}%</span>
            <span className="text-[9px] text-[#565f89]">64 Cores</span>
          </div>
          <div className="w-full bg-[#16161e] h-1 rounded overflow-hidden mt-2">
            <div 
              className={`h-full transition-all duration-550 ${totalCpu > 80 ? "bg-[#f7768e]" : totalCpu > 55 ? "bg-[#e0af68]" : "bg-[#7aa2f7]"}`} 
              style={{ width: `${Math.min(100, totalCpu)}%` }}
            ></div>
          </div>
        </div>

        {/* Memory */}
        <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#565f89] text-[10px] font-bold uppercase tracking-wider mb-1.5">
            <span>Committed RAM</span>
            <Activity className="w-3.5 h-3.5 text-[#9ece6a]" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-100">{(totalMemory / 1024).toFixed(2)} GB</span>
            <span className="text-[9px] text-[#565f89]">of 64 GB</span>
          </div>
          <div className="w-full bg-[#16161e] h-1 rounded overflow-hidden mt-2">
            <div 
              className="bg-[#9ece6a] h-full transition-all duration-550" 
              style={{ width: `${Math.min(100, (totalMemory / 655.36))}%` }}
            ></div>
          </div>
        </div>

        {/* Disk */}
        <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#565f89] text-[10px] font-bold uppercase tracking-wider mb-1.5">
            <span>Disk I/O Rate</span>
            <HardDrive className="w-3.5 h-3.5 text-[#e0af68]" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-100">{totalDisk} MB/s</span>
            <span className="text-[9px] text-[#565f89]">NVMe Array</span>
          </div>
          <div className="w-full bg-[#16161e] h-1 rounded overflow-hidden mt-2">
            <div 
              className="bg-[#e0af68] h-full transition-all duration-550" 
              style={{ width: `${Math.min(100, (parseFloat(totalDisk) * 2))}%` }}
            ></div>
          </div>
        </div>

        {/* Network */}
        <div className="bg-[#1a1b26] border border-[#24283b] rounded p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#565f89] text-[10px] font-bold uppercase tracking-wider mb-1.5">
            <span>Socket I/O</span>
            <Network className="w-3.5 h-3.5 text-[#bb9af7]" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-100">{totalNetwork} Mbps</span>
            <span className="text-[9px] text-[#565f89]">10GbE Port</span>
          </div>
          <div className="w-full bg-[#16161e] h-1 rounded overflow-hidden mt-2">
            <div 
              className="bg-[#bb9af7] h-full transition-all duration-550" 
              style={{ width: `${Math.min(100, (parseFloat(totalNetwork) / 5))}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Control Actions & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#1a1b26] border border-[#24283b] p-3 rounded">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-[#565f89] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              viewMode === "process-tree" 
                ? "Search processes, publishers, or PIDs..." 
                : viewMode === "program-registry" 
                ? "Search programs, initiators, or logs..." 
                : "Filter processes by image name or PID..."
            }
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full bg-[#16161e] border border-[#24283b] rounded py-1.5 pl-8 pr-3 text-xs text-[#a9b1d6] placeholder-[#565f89] focus:outline-none focus:border-[#7aa2f7] transition font-mono"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {viewMode === "process-tree" && (
            <div className="flex items-center gap-1.5 bg-[#16161e] border border-[#24283b] rounded p-0.5 mr-2">
              <button
                onClick={handleExpandAll}
                className="px-2.5 py-1 text-[10px] text-slate-300 font-bold hover:text-slate-100 transition rounded hover:bg-[#24283b] cursor-pointer"
                title="Expand all collapsible processes"
              >
                Expand All
              </button>
              <div className="w-[1px] h-3 bg-[#24283b]" />
              <button
                onClick={handleCollapseAll}
                className="px-2.5 py-1 text-[10px] text-slate-300 font-bold hover:text-slate-100 transition rounded hover:bg-[#24283b] cursor-pointer"
                title="Collapse all child processes"
              >
                Collapse All
              </button>
            </div>
          )}

          <button
            onClick={() => onSpawnTask()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 text-slate-950 rounded text-xs font-bold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-950" />
            Spawn Root Process
          </button>
          
          {viewMode === "table" && (
            <button
              onClick={handleEndSelected}
              disabled={selectedPid === null}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border transition ${
                selectedPid !== null
                  ? "bg-[#f7768e]/10 hover:bg-[#f7768e]/20 text-[#f7768e] border-[#f7768e]/30 cursor-pointer"
                  : "bg-[#16161e] text-[#565f89] border-[#24283b] cursor-not-allowed"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              End Task (SigKill)
            </button>
          )}
        </div>
      </div>

      {/* MAIN CONTAINER */}
      {viewMode === "process-tree" ? (
        /* INTERACTIVE PARENT-CHILD PROCESS TREE VIEW */
        <div className="flex-1 min-h-[480px] bg-[#1a1b26] border border-[#24283b] rounded overflow-hidden flex flex-col">
          <div className="bg-[#16161e] px-3.5 py-2.5 border-b border-[#24283b] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider">Active Process Lineage Tree</span>
              <span className="text-[9px] bg-[#24283b] border border-[#24283b] px-1.5 py-0.5 text-[#7aa2f7] font-mono rounded font-black">
                {visibleTreeRows.length} Threads Visible
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[#565f89] font-mono">
              <Info className="w-3.5 h-3.5 text-[#7aa2f7]" />
              <span>Guidelines denote parent-child runtime links. Toggle expand icons.</span>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-[11px] text-[#a9b1d6] table-fixed min-w-[900px]">
              <thead className="bg-[#111217] text-[#565f89] uppercase tracking-wider text-[9px] font-bold sticky top-0 border-b border-[#24283b] z-10">
                <tr>
                  <th className="py-2.5 px-3 w-[35%]">Process Name / Pid</th>
                  <th className="py-2.5 px-2 w-[15%]">Initiator (Owner)</th>
                  <th className="py-2.5 px-2 w-[10%] text-center">Status</th>
                  <th className="py-2.5 px-2 w-[10%] text-right">CPU</th>
                  <th className="py-2.5 px-2 w-[10%] text-right">RAM</th>
                  <th className="py-2.5 px-2 w-[10%] text-right">System I/O</th>
                  <th className="py-2.5 px-3 w-[10%] text-right">Signals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24283b]/30 bg-[#16161e]/10 font-mono">
                {visibleTreeRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-20 text-[#565f89] font-mono">
                      <GitMerge className="w-8 h-8 mx-auto opacity-30 mb-2 rotate-90" />
                      <p className="text-xs">No active processes matched your search query.</p>
                      <button 
                        onClick={() => setFilterText("")}
                        className="mt-3 text-xs text-[#7aa2f7] underline hover:text-[#7aa2f7]/80 cursor-pointer"
                      >
                        Reset search filter
                      </button>
                    </td>
                  </tr>
                ) : (
                  visibleTreeRows.map(({ node, depth }) => {
                    const hasChildren = node.children.length > 0;
                    const isCollapsed = collapsedPids.has(node.process.pid);
                    const isOrphan = node.process.parentPid !== undefined && !processes.some(p => p.pid === node.process.parentPid);
                    const isSystemKernel = node.process.pid === 4 || node.process.pid === 0;

                    const initiator = getProcessInitiator(node.process.name);
                    const initiatorColor = 
                      initiator === "SYSTEM" 
                        ? "text-[#f7768e] bg-[#f7768e]/10 border-[#f7768e]/25" 
                        : initiator.includes("David") 
                        ? "text-[#7aa2f7] bg-[#7aa2f7]/10 border-[#7aa2f7]/25" 
                        : "text-[#9ece6a] bg-[#9ece6a]/10 border-[#9ece6a]/25";

                    return (
                      <tr 
                        key={node.process.pid} 
                        className={`hover:bg-[#24283b]/25 transition-all group ${
                          node.process.pid === selectedPid ? "bg-[#24283b]/50 border-y border-[#7aa2f7]/40" : ""
                        }`}
                        onClick={() => setSelectedPid(node.process.pid)}
                      >
                        {/* 1. Process Name & Lineage */}
                        <td className="py-2.5 px-3 flex items-center min-w-0 select-none">
                          {/* Tree visual guideline spaces */}
                          {Array.from({ length: depth }).map((_, idx) => (
                            <div 
                              key={idx} 
                              className="w-5 h-7 border-r border-[#24283b]/70 inline-block shrink-0 self-center mr-1" 
                            />
                          ))}

                          {/* Lineage Branch Arrow indicator if indented */}
                          {depth > 0 && (
                            <div className="w-4 h-5 flex items-center justify-center text-[#565f89]/50 shrink-0 mr-1 self-center">
                              <CornerDownRight className="w-3.5 h-3.5" />
                            </div>
                          )}

                          {/* Expand/Collapse Toggle Button or Bullet point */}
                          {hasChildren ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCollapse(node.process.pid);
                              }}
                              className="w-4 h-4 flex items-center justify-center rounded bg-[#1e2030] hover:bg-[#2e3047] text-[#a9b1d6] border border-[#24283b] transition cursor-pointer shrink-0 mr-2"
                              title={isCollapsed ? "Expand subprocess tree" : "Collapse subprocess tree"}
                            >
                              {isCollapsed ? (
                                <Plus className="w-2.5 h-2.5 text-[#7aa2f7]" />
                              ) : (
                                <ChevronDown className="w-2.5 h-2.5 text-[#e0af68]" />
                              )}
                            </button>
                          ) : (
                            <div className="w-4 h-4 flex items-center justify-center shrink-0 mr-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#565f89]/50 group-hover:bg-[#7aa2f7]/60" />
                            </div>
                          )}

                          {/* App icon & Name */}
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <div className="p-1 rounded bg-[#111217] border border-[#24283b] shrink-0">
                              {getProcessIcon(node.process.name)}
                            </div>
                            <div className="min-w-0 truncate">
                              <span className="font-bold text-slate-100 group-hover:text-[#7aa2f7] transition-colors block truncate leading-tight">
                                {node.process.name}
                              </span>
                              <span className="text-[9px] text-[#565f89] block mt-0.5">
                                PID: <strong className="text-slate-400 font-medium">{node.process.pid}</strong> 
                                {node.process.parentPid !== undefined && (
                                  <span className="text-[#565f89]"> · Parent: {node.process.parentPid}</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Dynamic Initiator */}
                        <td className="py-2.5 px-2 align-middle">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${initiatorColor}`}>
                            <User className="w-2.5 h-2.5" />
                            {initiator}
                          </span>
                        </td>

                        {/* 3. Status Code */}
                        <td className="py-2.5 px-2 text-center align-middle">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider border ${
                            node.process.status === "Running" 
                              ? "bg-[#9ece6a]/10 text-[#9ece6a] border-[#9ece6a]/20" 
                              : "bg-[#e0af68]/10 text-[#e0af68] border-[#e0af68]/20"
                          }`}>
                            {node.process.status}
                          </span>
                        </td>

                        {/* 4. CPU Indicator with mini slider */}
                        <td className="py-2.5 px-2 text-right align-middle">
                          <div>
                            <span className={`font-bold ${node.process.cpu > 25 ? "text-[#f7768e]" : "text-slate-100"}`}>{node.process.cpu}%</span>
                            <div className="w-16 bg-[#111217] h-1.5 rounded-full overflow-hidden ml-auto mt-1 border border-[#24283b]">
                              <div 
                                className={`h-full transition-all duration-300 ${
                                  node.process.cpu > 25 ? "bg-[#f7768e]" : "bg-[#7aa2f7]"
                                }`}
                                style={{ width: `${Math.min(100, node.process.cpu * 2)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* 5. Memory MB */}
                        <td className="py-2.5 px-2 text-right align-middle">
                          <div>
                            <span className="text-slate-100 font-bold">{node.process.memory} MB</span>
                            <span className="text-[8.5px] text-[#565f89] block mt-0.5">RAM Reserved</span>
                          </div>
                        </td>

                        {/* 6. Dynamic Disk & Net I/O speed */}
                        <td className="py-2.5 px-2 text-right align-middle">
                          <div className="text-[9.5px] space-y-0.5">
                            <div className="flex items-center justify-end gap-1 text-[#e0af68]">
                              <HardDrive className="w-3 h-3 text-[#e0af68]/60" />
                              <span>{node.process.disk} MB/s</span>
                            </div>
                            <div className="flex items-center justify-end gap-1 text-[#bb9af7]">
                              <Network className="w-3 h-3 text-[#bb9af7]/60" />
                              <span>{node.process.network} Mbps</span>
                            </div>
                          </div>
                        </td>

                        {/* 7. Action Signals */}
                        <td className="py-2.5 px-3 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Spawn Subthread trigger */}
                            <button
                              onClick={() => onSpawnTask(node.process.pid)}
                              className="p-1 rounded bg-[#1e2030] hover:bg-[#7aa2f7]/25 text-[#565f89] hover:text-[#7aa2f7] border border-[#24283b] hover:border-[#7aa2f7]/30 transition cursor-pointer"
                              title={`Spawn new subprocess thread under PID ${node.process.pid}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                            {/* Signal end SIGKILL */}
                            <button
                              onClick={() => onEndTask(node.process.pid)}
                              className="p-1 rounded bg-[#1e2030] hover:bg-[#f7768e]/20 text-[#565f89] hover:text-[#f7768e] border border-[#24283b] hover:border-[#f7768e]/30 transition cursor-pointer"
                              title={`Send SIGKILL signal to instantly terminate process ID ${node.process.pid}`}
                              disabled={isSystemKernel}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-[#111217] p-2.5 border-t border-[#24283b] flex justify-between items-center text-[10px] text-[#565f89] font-mono">
            <span>Parent-Child lineage threads active: {processes.length} nodes</span>
            <span>Process Hypervisor: Windows WSL2 System Console Layer</span>
          </div>
        </div>
      ) : viewMode === "program-registry" ? (
        /* PROGRAM METADATA AND INSTALL HISTORY REGISTRY VIEW */
        <div className="flex-1 min-h-[480px] grid grid-cols-1 lg:grid-cols-12 gap-3">
          
          {/* LEFT COLUMN: Open Applications / Programs Registry (4/12 width) */}
          <div className="lg:col-span-4 bg-[#1a1b26] border border-[#24283b] rounded flex flex-col overflow-hidden">
            <div className="bg-[#16161e] px-3 py-2 border-b border-[#24283b] flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider">Open Programs Registry</span>
              <span className="text-[9px] bg-[#24283b] px-1.5 py-0.2 text-[#7aa2f7] font-mono rounded font-black">{filteredApps.length} Apps</span>
            </div>

            <div className="p-2 space-y-1.5 overflow-y-auto flex-1 max-h-[500px]">
              {filteredApps.length === 0 ? (
                <div className="text-center py-12 text-[#565f89] text-xs font-mono space-y-1">
                  <Boxes className="w-6 h-6 mx-auto opacity-40 text-[#565f89]" />
                  <p>No applications matched search.</p>
                </div>
              ) : (
                filteredApps.map((app) => {
                  const appProcs = processes.filter(p => app.processNames.includes(p.name));
                  const appCpu = Math.round(appProcs.reduce((sum, p) => sum + p.cpu, 0));
                  const appMem = Math.round(appProcs.reduce((sum, p) => sum + p.memory, 0));
                  const isActive = activeSelectedAppId === app.id;
                  
                  return (
                    <div
                      key={app.id}
                      onClick={() => setSelectedAppId(app.id)}
                      className={`p-2.5 rounded border transition-all cursor-pointer relative flex flex-col justify-between group ${getAppColorBorder(app.id)} ${
                        isActive 
                          ? "bg-[#24283b]/30 border-[#7aa2f7]/55 text-slate-100" 
                          : "bg-[#16161e]/50 border-[#24283b]/60 text-[#a9b1d6]"
                      }`}
                    >
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded bg-[#0b0c0f] border border-[#24283b] ${isActive ? "border-[#7aa2f7]/40" : ""}`}>
                            {getAppIconComponent(app.id)}
                          </div>
                          <div>
                            <span className="text-xs font-bold block leading-tight text-slate-100 truncate max-w-[150px] group-hover:text-[#7aa2f7] transition">{app.name}</span>
                            <span className="text-[9px] text-[#565f89] block truncate">{app.publisher}</span>
                          </div>
                        </div>

                        <ChevronRight className={`w-3.5 h-3.5 text-[#565f89] self-center transition ${isActive ? "translate-x-0.5 text-[#7aa2f7]" : ""}`} />
                      </div>

                      {/* Lineage Info Summary */}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[9.5px] border-t border-[#24283b]/30 pt-1.5 font-mono text-[#565f89]">
                        <div>
                          <span className="block text-[8px] uppercase tracking-wider font-semibold text-[#565f89]/75">Initiator</span>
                          <span className="text-slate-300 font-bold flex items-center gap-0.5 mt-0.5">
                            <User className="w-2.5 h-2.5 text-[#7aa2f7]" />
                            {app.initiator}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[8px] uppercase tracking-wider font-semibold text-[#565f89]/75">Active Threads</span>
                          <span className="text-[#9ece6a] font-bold block mt-0.5">
                            {appProcs.length > 0 ? `${appProcs.length} process${appProcs.length > 1 ? "es" : ""}` : "Suspended"}
                          </span>
                        </div>
                      </div>

                      {/* Resource Utilization Gauges */}
                      {appProcs.length > 0 && (
                        <div className="mt-2.5 bg-[#0b0c0f]/40 p-1 rounded border border-[#24283b]/30 flex items-center justify-between gap-3 text-[10px] font-mono">
                          <div className="flex items-center gap-1">
                            <Cpu className="w-3 h-3 text-[#7aa2f7]" />
                            <span className="font-bold text-slate-300">{appCpu}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Activity className="w-3 h-3 text-[#9ece6a]" />
                            <span className="font-bold text-slate-300">{appMem} MB</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Interactive Dependency Tree Mapping Details (8/12 width) */}
          <div className="lg:col-span-8 flex flex-col space-y-3">
            {selectedApp ? (
              <>
                {/* Application Encompassing Information Box */}
                <div className="bg-[#1a1b26] border border-[#24283b] rounded p-4 space-y-3.5 relative overflow-hidden">
                  {/* Decorative ambient background identifier */}
                  <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none">
                    {getAppIconComponent(selectedApp.id)}
                  </div>

                  {/* Header info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#24283b] pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#16161e] border border-[#24283b]/80 shadow-inner">
                        {getAppIconComponent(selectedApp.id)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-slate-100 uppercase tracking-wide">{selectedApp.name}</h3>
                          <span className="text-[10px] font-mono bg-[#16161e] border border-[#24283b] px-1.5 py-0.5 rounded text-[#565f89]">
                            {selectedApp.publisher}
                          </span>
                        </div>
                        <p className="text-[#a9b1d6] text-[11px] mt-0.5 leading-snug">{selectedApp.description}</p>
                      </div>
                    </div>

                    {/* Bulk Actions */}
                    {selectedAppProcesses.length > 0 && (
                      <button
                        onClick={() => handleKillEntireApp(selectedApp)}
                        className="px-3 py-1.5 bg-[#f7768e]/10 hover:bg-[#f7768e]/20 border border-[#f7768e]/30 hover:border-[#f7768e]/50 text-[#f7768e] text-xs font-bold rounded flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto shrink-0 animate-pulse"
                        title="SIGKILL entire application container"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Kill Encompassing App Tree
                      </button>
                    )}
                  </div>

                  {/* Program Lineage & Installation Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#16161e]/60 border border-[#24283b]/80 p-3 rounded-lg font-mono text-[10.5px]">
                    <div className="space-y-2">
                      <div>
                        <span className="text-[#565f89] uppercase text-[8.5px] font-black tracking-wider block">Process Tree Initiator (Owner)</span>
                        <div className="flex items-center gap-1.5 mt-1 text-slate-200">
                          <User className="w-3.5 h-3.5 text-[#7aa2f7]" />
                          <span className="font-bold">{selectedApp.initiator}</span>
                        </div>
                      </div>

                      <div className="border-t border-[#24283b]/40 pt-2">
                        <span className="text-[#565f89] uppercase text-[8.5px] font-black tracking-wider block">Operational Status</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`w-2 h-2 rounded-full ${selectedAppProcesses.length > 0 ? "bg-[#9ece6a] animate-pulse" : "bg-[#565f89]"}`} />
                          <span className={`font-bold uppercase ${selectedAppProcesses.length > 0 ? "text-[#9ece6a]" : "text-[#565f89]"}`}>
                            {selectedAppProcesses.length > 0 ? `${selectedAppProcesses.length} Service Threads Online` : "Suspended (No Processes Executing)"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 md:border-l md:border-[#24283b]/40 md:pl-3">
                      <div>
                        <span className="text-[#565f89] uppercase text-[8.5px] font-black tracking-wider block">Deployment / Installation History</span>
                        <div className="mt-1 text-slate-200 space-y-0.5">
                          <div className="flex items-start gap-1">
                            <Calendar className="w-3.5 h-3.5 text-[#e0af68] shrink-0 mt-0.5" />
                            <span><strong>Installed:</strong> {selectedApp.installedDate}</span>
                          </div>
                          <p className="text-[#565f89] text-[9.5px] pl-4.5 font-sans leading-snug">Method: {selectedApp.installedMethod}</p>
                        </div>
                      </div>

                      <div className="border-t border-[#24283b]/40 pt-2">
                        <span className="text-[#565f89] uppercase text-[8.5px] font-black tracking-wider block">Runtime Initialization Log</span>
                        <div className="mt-1 text-slate-200 space-y-0.5">
                          <div className="flex items-start gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#bb9af7] shrink-0 mt-0.5" />
                            <span><strong>Initialized:</strong> {selectedApp.initializedDate}</span>
                          </div>
                          <p className="text-[#565f89] text-[9.5px] pl-4.5 font-sans leading-snug">Trigger: {selectedApp.initializedMethod}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tree Visual Flow Diagram Nodes */}
                <div className="flex-1 bg-[#1a1b26] border border-[#24283b] rounded p-4 flex flex-col justify-between">
                  <div className="border-b border-[#24283b]/60 pb-2 mb-3">
                    <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider">Lineage Branch & Spawns Visualizer</span>
                  </div>

                  {selectedAppProcesses.length === 0 ? (
                    <div className="flex-1 py-12 flex flex-col items-center justify-center text-[#565f89] text-xs font-mono space-y-1">
                      <Boxes className="w-10 h-10 text-[#565f89]/50 animate-pulse" />
                      <span className="font-bold text-slate-400">Application Thread Tree is Currently Offline</span>
                      <p className="text-[10px] max-w-xs text-center leading-normal">This program is dormant. Trigger the "Spawn Process Thread" control above to dynamically execute a user session subthread.</p>
                    </div>
                  ) : (
                    /* The dynamic flow chart mapping App node -> process nodes */
                    <div className="relative flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 py-4 flex-1">
                      
                      {/* App Main Node Card */}
                      <div className="md:w-5/12 flex justify-center items-center relative">
                        <div className="w-full bg-[#16161e] border-2 border-[#7aa2f7] p-3.5 rounded-lg shadow-xl text-center space-y-2 relative z-10">
                          <div className="mx-auto w-10 h-10 rounded-full bg-[#7aa2f7]/10 border border-[#7aa2f7]/30 flex items-center justify-center">
                            {getAppIconComponent(selectedApp.id)}
                          </div>
                          <div>
                            <span className="font-mono text-[9px] uppercase tracking-widest text-[#7aa2f7] block font-black">App Parent Container</span>
                            <span className="text-xs font-black text-slate-100">{selectedApp.name}</span>
                          </div>
                          <div className="text-[9.5px] font-mono text-[#565f89] flex justify-center gap-3 bg-[#0b0c0f] py-1 rounded">
                            <span>CPU: {Math.round(selectedAppProcesses.reduce((s, p) => s + p.cpu, 0))}%</span>
                            <span>RAM: {Math.round(selectedAppProcesses.reduce((s, p) => s + p.memory, 0))}MB</span>
                          </div>
                        </div>

                        {/* Central Telemetry pipeline (MD+ screen visual connection) */}
                        <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-8 h-1 bg-gradient-to-r from-[#7aa2f7] to-[#24283b]" />
                      </div>

                      {/* Dynamic Tree Connecting Lines (SVG overlay drawn on parent block) */}
                      <div className="hidden md:block absolute left-[38%] top-0 bottom-0 w-8 pointer-events-none">
                        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                          {selectedAppProcesses.map((_, idx) => {
                            const count = selectedAppProcesses.length;
                            if (count === 1) {
                              return <line key={idx} x1="0" y1="50%" x2="100%" y2="50%" stroke="#24283b" strokeWidth="2" />;
                            }
                            const step = 100 / (count + 1);
                            const yPercent = `${step * (idx + 1)}%`;
                            return (
                              <g key={idx}>
                                <path 
                                  d={`M 0,50% C 15,50% 15,${yPercent} 32,${yPercent}`} 
                                  fill="none" 
                                  stroke="#24283b" 
                                  strokeWidth="2" 
                                />
                                <circle cx="32" cy={yPercent} r="3" fill="#7aa2f7" />
                              </g>
                            );
                          })}
                        </svg>
                      </div>

                      {/* Right Subprocesses Nodes Stack */}
                      <div className="md:w-6/12 space-y-2 flex-1 max-h-[350px] overflow-y-auto pr-1">
                        {selectedAppProcesses.map((p) => (
                          <div 
                            key={p.pid} 
                            className="bg-[#16161e] border border-[#24283b] hover:border-[#7aa2f7]/40 p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs transition"
                          >
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-[#9ece6a] font-bold text-[11px] truncate">{p.name}</span>
                                <span className="font-mono text-[#565f89] text-[9.5px]">PID: {p.pid}</span>
                                <span className="text-[8px] bg-[#9ece6a]/10 border border-[#9ece6a]/20 text-[#9ece6a] px-1 rounded uppercase font-bold font-mono shrink-0">
                                  {p.status}
                                </span>
                              </div>

                              {/* Telemetry values */}
                              <div className="grid grid-cols-4 gap-1.5 text-[9.5px] font-mono text-slate-300 bg-[#0b0c0f]/50 p-1 rounded border border-[#24283b]/30">
                                <div>
                                  <span className="block text-[7.5px] text-[#565f89] uppercase tracking-wider">CPU</span>
                                  <span className="font-bold text-[#7aa2f7]">{p.cpu}%</span>
                                </div>
                                <div>
                                  <span className="block text-[7.5px] text-[#565f89] uppercase tracking-wider">RAM</span>
                                  <span className="font-bold text-[#9ece6a]">{p.memory}M</span>
                                </div>
                                <div>
                                  <span className="block text-[7.5px] text-[#565f89] uppercase tracking-wider">Disk</span>
                                  <span className="font-bold text-[#e0af68]">{p.disk}M/s</span>
                                </div>
                                <div>
                                  <span className="block text-[7.5px] text-[#565f89] uppercase tracking-wider">Net</span>
                                  <span className="font-bold text-[#bb9af7]">{p.network}M</span>
                                </div>
                              </div>
                            </div>

                            {/* Signal terminate button */}
                            <button
                              onClick={() => onEndTask(p.pid)}
                              className="p-1.5 rounded hover:bg-[#24283b] border border-transparent hover:border-[#f7768e]/30 text-[#565f89] hover:text-[#f7768e] transition cursor-pointer shrink-0"
                              title="Send SIGKILL to Process ID"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                    </div>
                  )}

                </div>
              </>
            ) : (
              <div className="h-full border border-dashed border-[#24283b] rounded flex flex-col items-center justify-center text-[#565f89] py-12">
                <Boxes className="w-8 h-8 opacity-40 text-[#565f89] mb-2" />
                <span>Select an active application container from registry list to trace thread lineage.</span>
              </div>
            )}
          </div>

        </div>
      ) : (
        /* THE CLASSIC PROCESS SPREADSHEET VIEW */
        <div className="flex-1 min-h-[300px] bg-[#1a1b26] border border-[#24283b] rounded overflow-hidden flex flex-col font-mono">
          <div className="flex-1 overflow-auto max-h-[500px]">
            <table className="w-full text-left text-[11px] text-[#a9b1d6]">
              <thead className="bg-[#16161e] text-[#565f89] uppercase tracking-wider text-[9px] font-bold sticky top-0 border-b border-[#24283b] z-10">
                <tr>
                  <th className="py-2.5 px-3 w-10">Sel</th>
                  <th className="py-2.5 px-2 cursor-pointer select-none hover:text-slate-200 transition" onClick={() => handleSort("name")}>
                    <div className="flex items-center gap-0.5">
                      Image Name <ArrowUpDown className="w-2.5 h-2.5" />
                    </div>
                  </th>
                  <th className="py-2.5 px-2 cursor-pointer select-none hover:text-slate-200 transition" onClick={() => handleSort("pid")}>
                    <div className="flex items-center gap-0.5">
                      PID <ArrowUpDown className="w-2.5 h-2.5" />
                    </div>
                  </th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 px-2 cursor-pointer select-none hover:text-slate-200 transition text-right" onClick={() => handleSort("cpu")}>
                    <div className="flex items-center justify-end gap-0.5">
                      CPU <ArrowUpDown className="w-2.5 h-2.5" />
                    </div>
                  </th>
                  <th className="py-2.5 px-2 cursor-pointer select-none hover:text-slate-200 transition text-right" onClick={() => handleSort("memory")}>
                    <div className="flex items-center justify-end gap-0.5">
                      Memory <ArrowUpDown className="w-2.5 h-2.5" />
                    </div>
                  </th>
                  <th className="py-2.5 px-2 cursor-pointer select-none hover:text-slate-200 transition text-right" onClick={() => handleSort("disk")}>
                    <div className="flex items-center justify-end gap-0.5">
                      Disk <ArrowUpDown className="w-2.5 h-2.5" />
                    </div>
                  </th>
                  <th className="py-2.5 px-2 cursor-pointer select-none hover:text-slate-200 transition text-right" onClick={() => handleSort("network")}>
                    <div className="flex items-center justify-end gap-0.5">
                      Network <ArrowUpDown className="w-2.5 h-2.5" />
                    </div>
                  </th>
                  <th className="py-2.5 px-3">Publisher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24283b]/30">
                {sortedProcesses.map((p) => {
                  const isSelected = selectedPid === p.pid;
                  return (
                    <tr 
                      key={p.pid} 
                      onClick={() => setSelectedPid(p.pid)}
                      className={`hover:bg-[#24283b]/20 transition cursor-pointer ${isSelected ? "bg-[#7aa2f7]/10 hover:bg-[#7aa2f7]/15" : ""}`}
                    >
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => setSelectedPid(isSelected ? null : p.pid)}
                          className="rounded border-[#24283b] bg-[#16161e] text-[#7aa2f7] focus:ring-[#7aa2f7] cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-2 font-mono font-bold text-slate-100">{p.name}</td>
                      <td className="py-2 px-2 font-mono text-[#565f89]">{p.pid}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={`inline-flex px-1 rounded text-[9px] font-bold border ${
                          p.status === "Running" 
                            ? "bg-[#9ece6a]/10 text-[#9ece6a] border-[#9ece6a]/20" 
                            : "bg-[#e0af68]/10 text-[#e0af68] border-[#e0af68]/20"
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className={`py-2 px-2 text-right font-mono font-bold ${p.cpu > 25 ? "text-[#f7768e]" : "text-slate-200"}`}>{p.cpu}%</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-300">{p.memory} MB</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-300">{p.disk} MB/s</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-300">{p.network} Mbps</td>
                      <td className="py-2 px-3 text-[#565f89] text-[10px] truncate max-w-[120px]" title={p.publisher}>{p.publisher}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-[#16161e] p-2 border-t border-[#24283b] flex justify-between items-center text-[10px] text-[#565f89] font-mono">
            <span>Active threads: {sortedProcesses.length} items</span>
            <span>Gateway Monitor Node: localhost (192.168.1.15)</span>
          </div>
        </div>
      )}
    </div>
  );
}
