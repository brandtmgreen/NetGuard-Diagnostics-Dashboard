import React, { useState, useEffect, useRef } from "react";
import { 
  LayoutDashboard, 
  Cpu, 
  Network, 
  ShieldAlert, 
  Terminal, 
  Settings, 
  Activity, 
  ClipboardCheck,
  Eye,
  Wrench,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
  FileCheck
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

const MIN_EXPANDED_WIDTH = 200;
const MAX_EXPANDED_WIDTH = 420;
const DEFAULT_WIDTH = 256;
const RETRACTED_WIDTH = 64;

export default function Sidebar({
  activeTab,
  setActiveTab,
  alertCount,
  threatCount,
  currentTheme,
  onSelectTheme
}: SidebarProps) {
  const [time, setTime] = useState<string>("");
  const [isRetracted, setIsRetracted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("netguard_sidebar_retracted");
      return saved === "true";
    } catch {
      return false;
    }
  });
  const [expandedWidth, setExpandedWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem("netguard_sidebar_width"));
      if (saved >= MIN_EXPANDED_WIDTH && saved <= MAX_EXPANDED_WIDTH) return saved;
    } catch {}
    return DEFAULT_WIDTH;
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: DEFAULT_WIDTH });

  useEffect(() => {
    try {
      localStorage.setItem("netguard_sidebar_retracted", String(isRetracted));
    } catch {}
  }, [isRetracted]);

  useEffect(() => {
    try {
      localStorage.setItem("netguard_sidebar_width", String(expandedWidth));
    } catch {}
  }, [expandedWidth]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartRef.current.startX;
      const rawNext = dragStartRef.current.startWidth + delta;
      if (rawNext < 120) {
        setIsRetracted(true);
      } else {
        setIsRetracted(false);
        const clamped = Math.min(MAX_EXPANDED_WIDTH, Math.max(MIN_EXPANDED_WIDTH, rawNext));
        setExpandedWidth(clamped);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "";
    };

    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStartRef.current = {
      startX: e.clientX,
      startWidth: isRetracted ? RETRACTED_WIDTH : expandedWidth,
    };
    setIsDragging(true);
  };

  const toggleRetract = () => {
    setIsRetracted((prev) => !prev);
  };

  const handleEnlargeStep = () => {
    if (isRetracted) {
      setIsRetracted(false);
      setExpandedWidth(DEFAULT_WIDTH);
    } else {
      setExpandedWidth((prev) => (prev >= 340 ? DEFAULT_WIDTH : Math.min(MAX_EXPANDED_WIDTH, prev + 64)));
    }
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard Overview", icon: LayoutDashboard, badge: alertCount },
    { id: "tasks", label: "Task Manager", icon: Cpu },
    { id: "planner", label: "Action Planner", icon: ClipboardCheck },
    { id: "network", label: "Network Diagnostics", icon: Network },
    { id: "nmap", label: "NMAP Port Scanner", icon: Network },
    { id: "wireshark", label: "Wireshark Console", icon: Eye },
    { id: "lynis", label: "Lynis System Auditor", icon: FileCheck },
    { id: "security", label: "Security Center", icon: ShieldAlert, badge: threatCount, badgeColor: "bg-[#f7768e] text-slate-950 font-bold" },
    { id: "terminal", label: "Interactive Terminal", icon: Terminal },
    { id: "wizard", label: "Deployment Wizard", icon: Wrench },
    { id: "config", label: "App Configuration", icon: Settings }
  ];

  const currentWidth = isRetracted ? RETRACTED_WIDTH : expandedWidth;

  return (
    <aside
      id="netguard-sidebar"
      style={{ width: `${currentWidth}px` }}
      className={`relative bg-[#1a1b26] border-r border-[#24283b] text-[#a9b1d6] flex flex-col justify-between h-full select-none shrink-0 font-sans ${
        isDragging ? "" : "transition-[width] duration-200 ease-out"
      }`}
    >
      {/* Brand Header + Retract / Re-Enlarge Controls */}
      <div className={`p-3 border-b border-[#24283b] flex items-center ${isRetracted ? "justify-center" : "justify-between"} gap-2`}>
        {!isRetracted && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded bg-[#16161e] text-[#7aa2f7] border border-[#24283b] shrink-0">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-100 tracking-tight text-xs uppercase truncate">NetGuard CLI</h1>
              <span className="font-mono text-[9px] text-[#565f89] uppercase tracking-widest block truncate">Live Telemetry</span>
            </div>
          </div>
        )}

        <div className={`flex items-center ${isRetracted ? "flex-col gap-1.5" : "gap-1"} shrink-0`}>
          {!isRetracted && (
            <button
              onClick={handleEnlargeStep}
              title={expandedWidth >= 340 ? "Restore standard menu width" : "Enlarge menu window width"}
              className="p-1.5 rounded bg-[#16161e] hover:bg-[#24283b] text-[#565f89] hover:text-[#7aa2f7] border border-[#24283b] transition cursor-pointer"
            >
              {expandedWidth >= 340 ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            onClick={toggleRetract}
            id="sidebar-toggle-btn"
            title={isRetracted ? "Re-enlarge navigation menu" : "Retract navigation menu"}
            className="p-1.5 rounded bg-[#16161e] hover:bg-[#24283b] text-[#7aa2f7] border border-[#24283b] transition cursor-pointer"
          >
            {isRetracted ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              title={isRetracted ? item.label : undefined}
              className={`w-full flex items-center ${
                isRetracted ? "justify-center px-1.5 py-2.5" : "justify-between px-3 py-1.5"
              } rounded transition-all text-xs font-semibold group text-left relative cursor-pointer ${
                isActive 
                  ? "bg-[#24283b] text-[#7aa2f7]" 
                  : "hover:bg-[#24283b]/40 text-[#a9b1d6] hover:text-[#7aa2f7]"
              }`}
            >
              <div className={`flex items-center ${isRetracted ? "justify-center" : "gap-2.5 min-w-0"}`}>
                <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isActive ? "text-[#7aa2f7]" : "text-[#565f89] group-hover:text-[#7aa2f7]"}`} />
                {!isRetracted && <span className="truncate">{item.label}</span>}
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                isRetracted ? (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#f7768e]" />
                ) : (
                  <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded shrink-0 ${item.badgeColor || "bg-[#7aa2f7]/10 text-[#7aa2f7] border border-[#7aa2f7]/30"}`}>
                    {item.badge}
                  </span>
                )
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer System Info */}
      <div className="p-2.5 border-t border-[#24283b] bg-[#16161e] flex flex-col gap-1.5">
        {isRetracted ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <span className="w-2 h-2 rounded-full bg-[#9ece6a] animate-ping" title="System Node Active" />
            <button
              onClick={() => setIsRetracted(false)}
              className="text-[9px] font-mono text-[#7aa2f7] hover:underline cursor-pointer"
              title="Re-enlarge menu"
            >
              OPEN
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Right-Edge Drag Handle to Re-enlarge / Resize or Retract */}
      <div
        onMouseDown={startResize}
        title="Drag horizontally to resize or retract/enlarge menu"
        className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#7aa2f7]/60 active:bg-[#7aa2f7] transition-colors z-20"
      />
    </aside>
  );
}

