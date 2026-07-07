import React, { useState, useRef, useEffect } from "react";
import { Terminal, Send, TerminalSquare, AlertCircle, HelpCircle } from "lucide-react";
import { TerminalLine } from "../types";

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

  return (
    <div className="p-4 overflow-hidden h-full flex flex-col space-y-3 bg-[#0b0c0f] font-mono text-[#a9b1d6]">
      {/* Title */}
      <div className="border-b border-[#24283b] pb-2 flex items-center justify-between font-sans">
        <div>
          <h2 className="text-base font-bold text-slate-100 uppercase tracking-tight">Active Diagnostics Terminal</h2>
          <p className="text-[#565f89] text-[11px]">Command line analyzer with built-in Gemini security advisory capabilities.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClearTerminal}
            className="text-[10px] text-[#7aa2f7] hover:text-[#f7768e] border border-[#24283b] bg-[#16161e] hover:bg-[#24283b] px-2 py-1 rounded font-mono font-bold transition cursor-pointer"
          >
            CLS
          </button>
          <div className="text-[10px] bg-[#16161e] border border-[#24283b] text-[#565f89] font-mono px-2 py-1 rounded">
            SHELL: POWERSHELL.EXE
          </div>
        </div>
      </div>

      {/* Main Terminal Stage */}
      <div 
        className="flex-1 bg-[#0b0c0f] border border-[#24283b] rounded p-3 overflow-y-auto font-mono text-xs leading-relaxed space-y-2 relative custom-scrollbar"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="text-[#565f89] text-[11px]">
          Microsoft Windows [Version 10.0.22621.Tokyo]<br />
          (c) 2026 NetGuard Corporation. All rights reserved.<br />
          Type 'help' for core commands, or prefix queries with 'ai' to request advanced cyber insights.<br />
          ------------------------------------------------------------------------------------------
        </div>

        {/* Lines */}
        {terminalLines.map((line, idx) => {
          if (line.type === "input") {
            return (
              <div key={idx} className="flex gap-1.5 text-slate-100 font-bold mt-2">
                <span className="text-[#7aa2f7]">PS C:\NetGuard&gt;</span>
                <span>{line.text}</span>
              </div>
            );
          } else if (line.type === "ai") {
            return (
              <div key={idx} className="bg-[#7aa2f7]/5 border-l-2 border-[#7aa2f7] p-2 rounded text-[#a9b1d6] whitespace-pre-wrap leading-normal font-sans text-[11.5px] my-2">
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
                className={`whitespace-pre-wrap leading-normal ${
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
            <span>NetGuard core executing remote advisory diagnostics...</span>
          </div>
        )}

        <div ref={consoleEndRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1 bg-[#16161e] border border-[#24283b] rounded flex items-center px-2">
          <span className="text-[#7aa2f7] text-xs font-bold mr-1.5 select-none shrink-0">PS C:&gt;</span>
          <input
            type="text"
            ref={inputRef}
            disabled={isLoading}
            placeholder="Type 'help' or 'ai explain EternalBlue vulnerability'..."
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

      {/* Quick Access Macros / Tags */}
      <div className="flex flex-wrap items-center gap-1.5 font-sans pt-1">
        <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider mr-1">CLI Presets:</span>
        {[
          { label: "help", cmd: "help" },
          { label: "netstat", cmd: "netstat" },
          { label: "tasklist", cmd: "tasklist" },
          { label: "security-scan", cmd: "security-scan" },
          { label: "alert-log", cmd: "alert-log" },
          { label: "ai secure ms17-010", cmd: "ai explain EternalBlue vulnerability" }
        ].map((tag, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleQuickCommand(tag.cmd)}
            disabled={isLoading}
            className="text-[10px] bg-[#1a1b26] hover:bg-[#24283b] border border-[#24283b] text-[#7aa2f7] px-2 py-0.5 rounded transition cursor-pointer font-mono font-medium disabled:opacity-50"
          >
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  );
}
