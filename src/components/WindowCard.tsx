import React, { useState, useEffect, useRef } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  Maximize2, 
  Minimize2, 
  GripHorizontal,
  RotateCcw
} from "lucide-react";

export interface WindowCardProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  defaultCollapsed?: boolean;
  className?: string;
  contentClassName?: string;
  theme?: string;
  allowMaximize?: boolean;
}

export default function WindowCard({
  id,
  title,
  icon,
  subtitle,
  badge,
  actions,
  children,
  defaultHeight = 320,
  minHeight = 140,
  maxHeight = 900,
  defaultCollapsed = false,
  className = "",
  contentClassName = "",
  theme = "dark",
  allowMaximize = true
}: WindowCardProps) {
  // Load persisted collapsed state and height from localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`netguard_win_${id}_collapsed`);
      return saved !== null ? JSON.parse(saved) : defaultCollapsed;
    } catch {
      return defaultCollapsed;
    }
  });

  const [height, setHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`netguard_win_${id}_height`);
      return saved !== null ? Number(saved) : defaultHeight;
    } catch {
      return defaultHeight;
    }
  });

  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist collapsed state
  useEffect(() => {
    try {
      localStorage.setItem(`netguard_win_${id}_collapsed`, JSON.stringify(isCollapsed));
    } catch {}
  }, [id, isCollapsed]);

  // Persist height
  useEffect(() => {
    try {
      localStorage.setItem(`netguard_win_${id}_height`, String(height));
    } catch {}
  }, [id, height]);

  // Mouse drag resize handler
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - dragStartYRef.current;
      const newHeight = Math.max(minHeight, Math.min(maxHeight, dragStartHeightRef.current + deltaY));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging, minHeight, maxHeight]);

  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isCollapsed || isMaximized) return;
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = height;
    setIsDragging(true);
  };

  const handleResetSize = () => {
    setHeight(defaultHeight);
    setIsMaximized(false);
  };

  const toggleCollapse = () => {
    setIsCollapsed(prev => !prev);
    if (isMaximized) setIsMaximized(false);
  };

  const toggleMaximize = () => {
    if (isCollapsed) setIsCollapsed(false);
    setIsMaximized(prev => !prev);
  };

  // Win3.1 Retro styling
  const isWin31 = theme === "win31";

  return (
    <div
      ref={containerRef}
      className={`bg-[#1a1b26] border rounded transition-shadow flex flex-col overflow-hidden ${
        isDragging ? "border-[#7aa2f7] shadow-lg shadow-[#7aa2f7]/10" : "border-[#24283b] hover:border-[#3b4261]"
      } ${isWin31 ? "border-2 border-black !rounded-none !bg-[#c0c0c0] !text-black shadow-[2px_2px_0px_#000]" : ""} ${
        isMaximized ? "fixed inset-4 z-50 !h-auto !max-h-none shadow-2xl !bg-[#16161e]" : ""
      } ${className}`}
    >
      {/* Window Header Bar */}
      <div 
        className={`px-3 py-2 flex items-center justify-between border-b shrink-0 select-none ${
          isWin31 
            ? "!bg-[#000080] !text-white !border-black font-bold text-xs" 
            : "bg-[#16161e] border-[#24283b] text-slate-200"
        }`}
      >
        <div 
          className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 pr-2" 
          onClick={toggleCollapse}
          title="Click to collapse / expand window"
        >
          {icon && (
            <span className={`shrink-0 ${isWin31 ? "text-white" : "text-[#7aa2f7]"}`}>
              {icon}
            </span>
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-tight truncate ${isWin31 ? "text-white" : "text-slate-100"}`}>
                {title}
              </span>
              {badge && <div className="shrink-0">{badge}</div>}
            </div>
            {subtitle && (
              <span className={`text-[10px] truncate ${isWin31 ? "text-slate-300" : "text-[#565f89]"}`}>
                {subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          {actions}

          {!isCollapsed && height !== defaultHeight && !isMaximized && (
            <button
              onClick={handleResetSize}
              title="Reset window to standard size"
              className="p-1 rounded text-[#565f89] hover:text-[#7aa2f7] hover:bg-[#1a1b26] transition cursor-pointer text-[10px]"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          {allowMaximize && (
            <button
              onClick={toggleMaximize}
              title={isMaximized ? "Restore window size" : "Maximize window"}
              className={`p-1 rounded transition cursor-pointer ${
                isWin31 
                  ? "border border-black bg-[#c0c0c0] text-black font-mono text-[9px] px-1.5 py-0.2" 
                  : "text-[#7aa2f7] hover:bg-[#24283b]"
              }`}
            >
              {isMaximized ? (
                isWin31 ? "❐" : <Minimize2 className="w-3 h-3" />
              ) : (
                isWin31 ? "▲" : <Maximize2 className="w-3 h-3" />
              )}
            </button>
          )}

          <button
            onClick={toggleCollapse}
            title={isCollapsed ? "Expand window" : "Collapse window"}
            className={`p-1 rounded transition cursor-pointer ${
              isWin31 
                ? "border border-black bg-[#c0c0c0] text-black font-mono text-[9px] px-1.5 py-0.2" 
                : "text-[#7aa2f7] hover:bg-[#24283b]"
            }`}
          >
            {isCollapsed ? (
              isWin31 ? "▼" : <ChevronDown className="w-3 h-3" />
            ) : (
              isWin31 ? "▲" : <ChevronUp className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* Window Body (Hidden when collapsed) */}
      {!isCollapsed && (
        <div 
          className={`flex-1 flex flex-col overflow-hidden relative ${contentClassName}`}
          style={{ height: isMaximized ? "100%" : `${height}px` }}
        >
          <div className="flex-1 overflow-auto custom-scrollbar">
            {children}
          </div>

          {/* Interactive Resize Handle at the bottom edge */}
          {!isMaximized && (
            <div
              onMouseDown={handleStartResize}
              className={`h-2.5 w-full bg-[#16161e]/60 hover:bg-[#7aa2f7]/20 border-t border-[#24283b] flex items-center justify-center cursor-row-resize transition shrink-0 group ${
                isDragging ? "bg-[#7aa2f7]/30 border-[#7aa2f7]" : ""
              }`}
              title="Drag up or down to resize window height"
            >
              <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition">
                <GripHorizontal className="w-4 h-3 text-[#7aa2f7]" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
