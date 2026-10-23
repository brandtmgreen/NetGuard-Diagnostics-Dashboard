import React, { useState, useRef, useEffect } from "react";
import { 
  Terminal, 
  Send, 
  TerminalSquare, 
  AlertCircle, 
  HelpCircle,
  Cpu,
  RefreshCw,
  Sliders,
  Check
} from "lucide-react";
import { TerminalLine } from "../types";
import WindowCard from "./WindowCard";

interface TerminalConsoleProps {
  terminalLines: TerminalLine[];
  onRunCommand: (cmd: string) => Promise<void>;
  onClearTerminal: () => void;
  isLoading: boolean;
}

export default function TerminalConsole({
  terminalLines,
  onRunCommand,
  onClearTerminal,
  isLoading
}: TerminalConsoleProps) {
  const [input, setInput] = useState("");
  const [activeShell, setActiveShell] = useState<"powershell" | "cmd" | "bash">("powershell");
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to the bottom of the log when new output is appended
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLines, isLoading]);

  // Focus input automatically on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const cmd = input;
    setInput("");
    await onRunCommand(cmd);
  };

  const handleQuickCommand = async (cmd: string) => {
    if (isLoading) return;
    await onRunCommand(cmd);
  };

  const promptPrefix = activeShell === "powershell" 
    ? "PS C:\\NetGuard>" 
    : activeShell === "cmd" 
    ? "C:\\NetGuard>" 
    : "netguard@host:~$";

  return (
    <div className="p-4 overflow-y-auto h-full space-y-3 bg-[#0b0c0f] font-mono text-[#a9b1d6]">
      {/* Upper Header Window Controls */}
      <div className="border-b border-[#24283b] pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 font-sans">
        <div>
          <h2 className="text-base font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <TerminalSquare className="w-4 h-4 text-[#7aa2f7]" />
            Universal Command Console
          </h2>
          <p className="text-[#565f89] text-[11px]">
            Native host pass-through terminal supporting all Windows CMD, PowerShell, and Bash shell commands.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Shell Environment Switcher */}
          <div className="flex items-center bg-[#16161e] border border-[#24283b] rounded p-0.5 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setActiveShell("powershell")}
              className={`px-2 py-0.5 rounded transition ${
                activeShell === "powershell" ? "bg-[#7aa2f7] text-slate-950 font-bold" : "text-[#565f89] hover:text-[#a9b1d6]"
              }`}
            >
              PowerShell
            </button>
            <button
              type="button"
              onClick={() => setActiveShell("cmd")}
              className={`px-2 py-0.5 rounded transition ${
                activeShell === "cmd" ? "bg-[#7aa2f7] text-slate-950 font-bold" : "text-[#565f89] hover:text-[#a9b1d6]"
              }`}
            >
              CMD.exe
            </button>
            <button
              type="button"
              onClick={() => setActiveShell("bash")}
              className={`px-2 py-0.5 rounded transition ${
                activeShell === "bash" ? "bg-[#7aa2f7] text-slate-950 font-bold" : "text-[#565f89] hover:text-[#a9b1d6]"
              }`}
            >
              Bash
            </button>
          </div>

          <button
            onClick={onClearTerminal}
            className="text-[10px] text-[#7aa2f7] hover:text-[#f7768e] border border-[#24283b] bg-[#16161e] hover:bg-[#24283b] px-2.5 py-1 rounded font-mono font-bold transition cursor-pointer"
          >
            CLS
          </button>
        </div>
      </div>

      {/* Main Terminal Window (Collapsible & Resizable) */}
      <WindowCard
        id="term_main_viewport"
        title="Interactive Terminal Session"
        icon={<Terminal className="w-4 h-4 text-[#7aa2f7]" />}
        subtitle={`Active session environment: ${activeShell.toUpperCase()} | Full binary & pipeline execution`}
        defaultHeight={460}
        minHeight={250}
        maxHeight={850}
        badge={
          <span className="text-[9px] bg-[#9ece6a]/10 text-[#9ece6a] border border-[#9ece6a]/20 px-2 py-0.5 rounded font-mono font-bold">
            HOST ONLINE
          </span>
        }
      >
        <div className="flex flex-col h-full bg-[#0b0c0f]">
          {/* Scrollable Output Viewport */}
          <div 
            className="flex-1 p-3 overflow-y-auto font-mono text-xs leading-relaxed space-y-2 relative custom-scrollbar select-text"
            onClick={() => inputRef.current?.focus()}
          >
            <div className="text-[#565f89] text-[11px]">
              Microsoft Windows PowerShell [Version 10.0.22621.NetGuard]<br />
              (c) 2026 NetGuard Corporation. All rights reserved.<br />
              All Windows shell binaries and Linux Bash commands execute directly.<br />
              Type 'help' for built-in diagnostic tools, or prefix with 'ai' for AI Cyber Advisory.<br />
              ------------------------------------------------------------------------------------------
            </div>

            {/* Lines */}
            {terminalLines.map((line, idx) => {
              if (line.type === "input") {
                return (
                  <div key={idx} className="flex gap-1.5 text-slate-100 font-bold mt-2">
                    <span className="text-[#7aa2f7] shrink-0">{promptPrefix}</span>
                    <span className="break-all">{line.text}</span>
                  </div>
                );
              } else if (line.type === "ai") {
                return (
                  <div key={idx} className="bg-[#7aa2f7]/5 border-l-2 border-[#7aa2f7] p-2.5 rounded text-[#a9b1d6] whitespace-pre-wrap leading-normal font-sans text-[11.5px] my-2">
                    <div className="text-[#7aa2f7] font-mono font-bold uppercase text-[9.5px] mb-1 flex items-center gap-1">
                      <span>● NETGUARD INTELLIGENT EXPERT ADVISOR</span>
                    </div>
                    {line.text}
                  </div>
                );
              } else {
                return (
                  <div 
                    key={idx} 
                    className={`whitespace-pre-wrap leading-normal break-all ${
                      line.type === "error" 
                        ? "text-[#f7768e]" 
                        : line.type === "info" 
                        ? "text-[#bb9af7]" 
                        : "text-[#9ece6a]"
                    }`}
                  >
                    {line.text}
                  </div>
                );
              }
            })}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-center gap-1.5 text-[#bb9af7] mt-1 animate-pulse text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#bb9af7] animate-ping"></span>
                <span>Executing native host shell command in background...</span>
              </div>
            )}

            <div ref={consoleEndRef} />
          </div>

          {/* Fixed Command Input Bar */}
          <form onSubmit={handleSubmit} className="p-2 border-t border-[#24283b] bg-[#16161e] flex gap-2 shrink-0">
            <div className="relative flex-1 bg-[#101216] border border-[#24283b] rounded flex items-center px-2.5">
              <span className="text-[#7aa2f7] text-xs font-bold mr-2 select-none shrink-0">{promptPrefix}</span>
              <input
                type="text"
                ref={inputRef}
                disabled={isLoading}
                placeholder="Enter any Windows or Bash command (e.g. dir, ls -la, ipconfig, netstat -ano, tasklist, curl, ai explain...)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full bg-transparent border-0 outline-none text-xs text-slate-100 py-2 font-mono placeholder-[#565f89] focus:ring-0"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-[#24283b] hover:bg-[#7aa2f7] text-[#a9b1d6] hover:text-slate-950 px-4 py-2 border border-[#24283b] rounded transition font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              RUN
            </button>
          </form>
        </div>
      </WindowCard>

      {/* Quick Command Toolbar Window (Collapsible) */}
      <WindowCard
        id="term_quick_presets"
        title="Quick Command Glossary & Presets"
        icon={<Sliders className="w-4 h-4 text-[#bb9af7]" />}
        subtitle="One-click execution presets for Windows commands, Bash utilities, and NetGuard telemetry"
        defaultHeight={140}
        minHeight={100}
        maxHeight={260}
      >
        <div className="p-3 space-y-2.5 font-sans">
          {/* Windows Commands */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider w-20 shrink-0">Windows:</span>
            {[
              { label: "dir", cmd: "dir" },
              { label: "ipconfig /all", cmd: "ipconfig /all" },
              { label: "netstat -ano", cmd: "netstat -ano" },
              { label: "tasklist", cmd: "tasklist" },
              { label: "Get-Process", cmd: "Get-Process" },
              { label: "whoami /all", cmd: "whoami /all" },
              { label: "systeminfo", cmd: "systeminfo" },
              { label: "firewall rules", cmd: "netsh advfirewall firewall show rule name=all" }
            ].map((tag, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickCommand(tag.cmd)}
                disabled={isLoading}
                className="text-[10px] bg-[#16161e] hover:bg-[#24283b] border border-[#24283b] text-[#7aa2f7] px-2 py-0.5 rounded transition cursor-pointer font-mono font-medium disabled:opacity-50"
              >
                {tag.label}
              </button>
            ))}
          </div>

          {/* Bash Commands */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider w-20 shrink-0">Bash / Nix:</span>
            {[
              { label: "ls -lah", cmd: "ls -lah" },
              { label: "ifconfig", cmd: "ifconfig" },
              { label: "ps aux", cmd: "ps aux" },
              { label: "uname -a", cmd: "uname -a" },
              { label: "pwd", cmd: "pwd" },
              { label: "free -m", cmd: "free -m" },
              { label: "df -h", cmd: "df -h" },
              { label: "curl -I", cmd: "curl -I https://google.com" }
            ].map((tag, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickCommand(tag.cmd)}
                disabled={isLoading}
                className="text-[10px] bg-[#16161e] hover:bg-[#24283b] border border-[#24283b] text-[#9ece6a] px-2 py-0.5 rounded transition cursor-pointer font-mono font-medium disabled:opacity-50"
              >
                {tag.label}
              </button>
            ))}
          </div>

          {/* NetGuard Diagnostics & AI */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider w-20 shrink-0">Security AI:</span>
            {[
              { label: "security-scan", cmd: "security-scan" },
              { label: "alert-log", cmd: "alert-log" },
              { label: "bandwidth", cmd: "bandwidth" },
              { label: "sysinfo", cmd: "sysinfo" },
              { label: "ai eternalblue", cmd: "ai explain EternalBlue MS17-010 vulnerability" },
              { label: "ai audit port 445", cmd: "ai analyze risks of open SMB port 445 on Windows" }
            ].map((tag, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickCommand(tag.cmd)}
                disabled={isLoading}
                className="text-[10px] bg-[#16161e] hover:bg-[#24283b] border border-[#24283b] text-[#bb9af7] px-2 py-0.5 rounded transition cursor-pointer font-mono font-medium disabled:opacity-50"
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      </WindowCard>
    </div>
  );
}
