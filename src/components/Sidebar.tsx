import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Cpu, 
  Network, 
  ShieldAlert, 
  Terminal, 
  Settings, 
  Activity, 
  Bell,
  ClipboardCheck,
  Eye,
  Wrench,
  Palette
} from "lucide-react";
import { ThemeMode } from "../types";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  alertCount: number;
  threatCount: number;
  currentTheme?: ThemeMode;
  onSelectTheme?: (theme: ThemeMode) => void;
}

export default function Sidebar({ activeTab, setActiveTab, alertCount, threatCount, currentTheme, onSelectTheme }: SidebarProps) {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { id: "dashboard", label: "Dashboard Overview", icon: LayoutDashboard, badge: alertCount },
    { id: "tasks", label: "Task Manager", icon: Cpu },
    { id: "planner", label: "Action Planner", icon: ClipboardCheck },
    { id: "network", label: "Network Diagnostics", icon: Network },
    { id: "nmap", label: "NMAP Port Scanner", icon: Network },
    { id: "wireshark", label: "Wireshark Console", icon: Eye },
    { id: "security", label: "Security Center", icon: ShieldAlert, badge: threatCount, badgeColor: "bg-[#f7768e] text-slate-950 font-bold" },
    { id: "terminal", label: "Interactive Terminal", icon: Terminal },
    { id: "wizard", label: "Deployment Wizard", icon: Wrench },
    { id: "config", label: "App Configuration", icon: Settings }
  ];

  return (
    <aside id="netguard-sidebar" className="w-64 bg-[#1a1b26] border-r border-[#24283b] text-[#a9b1d6] flex flex-col justify-between h-full select-none shrink-0 font-sans">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#24283b]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-[#16161e] text-[#7aa2f7] border border-[#24283b]">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 tracking-tight text-sm uppercase">NetGuard CLI</h1>
            <span className="font-mono text-[10px] text-[#565f89] uppercase tracking-widest block">Omni Diagnostic</span>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded transition-all text-xs font-semibold group text-left ${
                isActive 
                  ? "bg-[#24283b] text-[#7aa2f7] border-l-2 border-[#7aa2f7]" 
                  : "hover:bg-[#24283b]/40 text-[#a9b1d6] hover:text-[#7aa2f7] border-l-2 border-transparent"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 transition-transform duration-200 ${isActive ? "text-[#7aa2f7]" : "text-[#565f89] group-hover:text-[#7aa2f7]"}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${item.badgeColor || "bg-[#7aa2f7]/10 text-[#7aa2f7] border border-[#7aa2f7]/30"}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer System Info */}
      <div className="p-3 border-t border-[#24283b] bg-[#16161e] flex flex-col gap-1.5">
        {/* Quick Theme Selector */}
        {currentTheme && onSelectTheme && (
          <div className="flex items-center justify-between text-[10px] text-[#565f89] border-b border-[#24283b]/60 pb-1.5 mb-0.5">
            <span className="flex items-center gap-1 font-bold text-[#7aa2f7] uppercase font-mono">
              <Palette className="w-3 h-3" /> Theme
            </span>
            <select
              value={currentTheme}
              onChange={(e) => onSelectTheme(e.target.value as ThemeMode)}
              className="bg-[#0b0c0f] border border-[#24283b] text-[10px] text-slate-200 rounded px-1.5 py-0.5 font-mono focus:outline-none focus:border-[#7aa2f7] cursor-pointer"
              id="sidebar-theme-selector"
            >
              <option value="dark">Dark Mode</option>
              <option value="high-contrast">High Contrast</option>
              <option value="win31">Windows 3.1</option>
              <option value="mario">Mario Bros</option>
              <option value="johnny5">Johnny 5</option>
            </select>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-[#565f89]">
          <span className="font-mono uppercase">System Node</span>
          <span className="flex items-center gap-1 font-mono font-bold text-[#9ece6a]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9ece6a] animate-ping"></span>
            ACTIVE
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-[#565f89] border-t border-[#24283b]/60 pt-1.5">
          <span>Local Time</span>
          <span className="font-mono font-medium text-[#a9b1d6]">{time}</span>
        </div>
        <div className="flex justify-center text-[9px] text-[#565f89] font-mono">
          Build 10.0.22621.Tokyo
        </div>
      </div>
    </aside>
  );
}
