import React, { useState, useEffect } from "react";
import { ShieldCheck, Download, Loader2, ServerCrash, CheckCircle2, ChevronRight } from "lucide-react";
import { safeFetchJson } from "../lib/api";

interface BootLoaderProps {
  onReady: () => void;
}

export default function BootLoader({ onReady }: BootLoaderProps) {
  const [checking, setChecking] = useState(true);
  const [deps, setDeps] = useState<{ nmap: boolean; npcap: boolean } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkDependencies = async () => {
    try {
      const data = await safeFetchJson<any>("/api/system/dependencies");
      if (data && data.success) {
        setDeps({ nmap: data.nmap, npcap: data.npcap });
        if (data.nmap && data.npcap) {
          // Both installed, delay slightly for effect then continue
          setTimeout(() => onReady(), 1000);
        } else {
          setChecking(false);
        }
      } else {
        setError(data?.error || "Failed to check system dependencies");
        setChecking(false);
      }
    } catch (err: any) {
      setError(err.message);
      setChecking(false);
    }
  };

  useEffect(() => {
    checkDependencies();
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await fetch("/api/system/install-deps", { method: "POST" });
      // Poll every 5 seconds to see if they've finished installing
      const interval = setInterval(async () => {
        const res = await fetch("/api/system/dependencies");
        const data = await res.json();
        if (data.success && data.nmap && data.npcap) {
          clearInterval(interval);
          onReady();
        }
      }, 5000);
    } catch (err: any) {
      setError("Failed to trigger installation.");
      setInstalling(false);
    }
  };

  if (checking) {
    return (
      <div className="h-screen w-full bg-[#0b0c0f] flex flex-col items-center justify-center text-[#a9b1d6] font-mono select-none">
        <ShieldCheck className="w-16 h-16 text-[#7aa2f7] mb-6 animate-pulse" />
        <h1 className="text-xl font-bold uppercase tracking-widest text-slate-200 mb-2">NetGuard Security Desk</h1>
        <div className="flex items-center gap-3 text-xs text-[#565f89]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Validating system integrity and host telemetry dependencies...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#0b0c0f] flex flex-col items-center justify-center text-[#a9b1d6] font-mono select-none p-6">
      <div className="w-full max-w-lg bg-[#16161e] border border-[#24283b] rounded p-6 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-[#f7768e] shadow-[0_0_20px_rgba(247,118,142,0.5)]"></div>
        
        <h2 className="text-lg font-bold text-slate-200 uppercase tracking-widest mb-2 flex items-center gap-2">
          <ServerCrash className="w-5 h-5 text-[#f7768e]" />
          System Missing Dependencies
        </h2>
        
        <p className="text-xs text-[#565f89] mb-6 leading-relaxed">
          NetGuard requires low-level system access for packet inspection and port scanning. The following host dependencies were not detected on this machine.
        </p>

        <div className="space-y-3 mb-6">
          <div className="p-3 bg-[#0b0c0f] border border-[#24283b] rounded flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-300">Nmap Security Scanner</h3>
              <p className="text-[10px] text-[#565f89]">Required for local subnet host discovery and port enumeration.</p>
            </div>
            {deps?.nmap ? (
              <CheckCircle2 className="w-5 h-5 text-[#9ece6a]" />
            ) : (
              <span className="text-[9px] px-2 py-1 bg-[#f7768e]/10 text-[#f7768e] border border-[#f7768e]/20 rounded font-bold uppercase">Missing</span>
            )}
          </div>

          <div className="p-3 bg-[#0b0c0f] border border-[#24283b] rounded flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-300">Npcap / Wireshark Protocol</h3>
              <p className="text-[10px] text-[#565f89]">Required for raw socket packet capturing and traffic analysis.</p>
            </div>
            {deps?.npcap ? (
              <CheckCircle2 className="w-5 h-5 text-[#9ece6a]" />
            ) : (
              <span className="text-[9px] px-2 py-1 bg-[#f7768e]/10 text-[#f7768e] border border-[#f7768e]/20 rounded font-bold uppercase">Missing</span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-2 bg-[#f7768e]/10 border border-[#f7768e]/20 text-[#f7768e] text-[10px] rounded">
            {error}
          </div>
        )}

        <button
          onClick={handleInstall}
          disabled={installing}
          className="w-full py-3 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 text-slate-950 rounded font-bold uppercase tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {installing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Downloading & Installing (Please Wait)...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Install Required Dependencies
            </>
          )}
        </button>

        {installing && (
           <p className="text-[10px] text-center text-[#565f89] mt-3 animate-pulse">
             System installer windows may appear in the background. Please accept any UAC prompts.
           </p>
        )}
      </div>
    </div>
  );
}
