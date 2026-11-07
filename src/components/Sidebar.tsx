import {
  Activity,
  ClipboardCheck,
  Cpu,
  FileText,
  FileCheck,
  Gauge,
  LayoutDashboard,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  ScanLine,
  Settings,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  Terminal,
  Waypoints,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppState } from "../types";

const items = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "tasks", label: "Task Manager", icon: Cpu },
  { id: "planner", label: "Action Planner", icon: ClipboardCheck },
  { id: "network", label: "Network", icon: Network },
  { id: "diagnostics", label: "Diagnostics", icon: Gauge },
  { id: "scanner", label: "Port Scanner", icon: ScanLine },
  { id: "security", label: "Security Center", icon: ShieldCheck },
  { id: "audit", label: "System Audit", icon: FileCheck },
  { id: "detections", label: "Detections", icon: ShieldAlert },
  { id: "prevention", label: "Prevention", icon: ShieldBan },
  { id: "capture", label: "Packet Capture", icon: Waypoints },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "wizard", label: "Deployment Wizard", icon: Wrench },
  { id: "settings", label: "Settings", icon: Settings },
];

interface Props {
  activeTab: string;
  onNavigate: (tab: string) => void;
  state: AppState | null;
}

export default function Sidebar({ activeTab, onNavigate, state }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.localStorage.getItem("netguard-sidebar-collapsed") === "true"; } catch { return false; }
  });
  const openAlerts = state?.alerts.filter((alert) => alert.status === "open").length || 0;
  const armed = state?.settings.preventionMode === "prevent" && state.settings.autoBlock;

  useEffect(() => {
    try { window.localStorage.setItem("netguard-sidebar-collapsed", String(collapsed)); } catch { /* storage may be blocked */ }
  }, [collapsed]);

  return (
    <aside className={`${collapsed ? "w-[76px]" : "w-64"} shrink-0 border-r border-[#24283b] bg-[#0d0f16] flex flex-col min-h-screen transition-[width] duration-200`}>
      <div className={`${collapsed ? "px-3" : "px-5"} pt-6 pb-5 border-b border-[#24283b]`}>
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-3`}>
          <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#7aa2f7]/10 border border-[#7aa2f7]/30 flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#7aa2f7]" />
          </div>
          {!collapsed && <div>
            <div className="text-[13px] font-black tracking-[0.22em] text-[#c0caf5]">NETGUARD</div>
            <div className="text-[9px] tracking-[0.18em] text-[#565f89] font-bold">LOCAL SECURITY DESK</div>
          </div>}
          </div>
          <button onClick={() => setCollapsed(prev => !prev)} title={collapsed ? "Expand navigation" : "Collapse navigation"} className="rounded-lg border border-[#24283b] bg-[#11131b] p-1.5 text-[#565f89] hover:text-[#7aa2f7]">
            {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
          </button>
        </div>
        {!collapsed && <div className="mt-5 flex items-center justify-between text-[10px] font-mono">
          <span className="text-[#565f89]">HOST</span>
          <span className="text-[#9ece6a] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9ece6a] animate-pulse" />
            {state?.host.hostname || "connecting"}
          </span>
        </div>}
      </div>

      <nav className="p-3 space-y-1 flex-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          const badge = item.id === "detections" && openAlerts > 0 ? openAlerts : null;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`relative w-full flex items-center ${collapsed ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-lg text-left text-xs font-bold transition ${
                active
                  ? "bg-[#7aa2f7]/10 text-[#c0caf5] border border-[#7aa2f7]/20"
                  : "text-[#737aa2] hover:text-[#c0caf5] hover:bg-white/[0.03] border border-transparent"
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? "text-[#7aa2f7]" : "text-[#565f89]"}`} />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {badge && !collapsed ? (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#f7768e] text-[#0b0c0f] text-[10px] font-black flex items-center justify-center">
                  {badge}
                </span>
              ) : badge && collapsed ? <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-[#f7768e]" /> : null}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#24283b] space-y-3">
        {collapsed ? <div className="flex justify-center" title={armed ? "Prevention armed" : "Prevention monitor mode"}><span className={`h-2.5 w-2.5 rounded-full ${armed ? "bg-[#f7768e]" : "bg-[#e0af68]"}`} /></div> : <div className="rounded-lg border border-[#24283b] bg-[#11131b] p-3">
          <div className="flex items-center justify-between text-[9px] font-black tracking-wider uppercase">
            <span className="text-[#565f89]">Prevention</span>
            <span className={armed ? "text-[#f7768e]" : "text-[#e0af68]"}>
              {armed ? "ARMED" : "MONITOR"}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-[#737aa2]">
            {state?.host.isAdmin ? "Administrator session" : "Standard user — firewall writes disabled"}
          </div>
        </div>}
        {!collapsed && <div className="text-[9px] font-mono text-[#414868] flex items-center justify-between">
          <span>v1.0.6</span>
          <span>LOCAL ONLY</span>
        </div>}
      </div>
    </aside>
  );
}
