import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Send, Terminal, Trash2 } from "lucide-react";
import { api } from "../api";

interface Line {
  id: number;
  kind: "command" | "output" | "error" | "info";
  text: string;
}

const QUICK = ["help", "ipconfig", "netstat", "arp", "nslookup 8.8.8.8", "ping 8.8.8.8"];

export default function TerminalView() {
  const [lines, setLines] = useState<Line[]>([
    { id: 1, kind: "info", text: "NetGuard read-only diagnostics shell. Type help for commands." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(2);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const append = (kind: Line["kind"], text: string) => {
    setLines(prev => [...prev, { id: nextId.current++, kind, text }]);
  };

  const run = async (command: string) => {
    const clean = command.trim();
    if (!clean || busy) return;
    append("command", `> ${clean}`);
    setInput("");
    setBusy(true);
    try {
      const result = await api.terminal(clean);
      append("output", result.output || "(no output)");
    } catch (error) {
      append("error", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-130px)] min-h-[520px] flex-col gap-3">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9ece6a]">Interactive terminal</div>
          <h1 className="mt-1 text-2xl font-black text-[#c0caf5]">Read-only diagnostics shell</h1>
          <p className="text-xs text-[#737aa2] mt-1">Ping, trace route, DNS, sockets and adapter configuration. Commands are allowlisted by the local API.</p>
        </div>
        <button onClick={() => setLines([{ id: nextId.current++, kind: "info", text: "Terminal cleared." }])} className="inline-flex items-center gap-2 self-start rounded-lg border border-[#24283b] bg-[#161821] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#a9b1d6] hover:text-white">
          <Trash2 className="w-3.5 h-3.5" /> Clear
        </button>
      </div>

      <div className="rounded-xl border border-[#24283b] bg-[#0b0c0f] overflow-hidden flex-1 flex flex-col">
        <div className="px-4 py-2 border-b border-[#24283b] flex items-center gap-2 text-[10px] font-mono text-[#565f89]">
          <Terminal className="w-3.5 h-3.5 text-[#9ece6a]" /> POWERSHELL · READ ONLY
        </div>
        <div className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed">
          {lines.map(line => (
            <div key={line.id} className={`whitespace-pre-wrap ${line.kind === "command" ? "text-[#9ece6a] mt-3" : line.kind === "error" ? "text-[#f7768e]" : line.kind === "info" ? "text-[#7aa2f7]" : "text-[#a9b1d6]"}`}>
              {line.text}
            </div>
          ))}
          {busy && <div className="mt-3 flex items-center gap-2 text-[#7aa2f7]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</div>}
          <div ref={endRef} />
        </div>
        <form onSubmit={event => { event.preventDefault(); void run(input); }} className="border-t border-[#24283b] p-3">
          <div className="flex gap-2">
            <input value={input} onChange={event => setInput(event.target.value)} placeholder="Type a command…" className="flex-1 rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs font-mono text-[#c0caf5] outline-none focus:border-[#9ece6a]/60" />
            <button type="submit" disabled={busy || !input.trim()} className="rounded-lg bg-[#9ece6a] px-4 py-2 text-[10px] font-black text-[#0b0c0f] disabled:opacity-40"><Send className="w-3.5 h-3.5" /></button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK.map(command => <button type="button" key={command} onClick={() => void run(command)} disabled={busy} className="rounded border border-[#24283b] bg-[#161821] px-2 py-1 text-[9px] font-mono text-[#737aa2] hover:text-[#c0caf5] disabled:opacity-40">{command}</button>)}
          </div>
        </form>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-[#565f89]"><AlertCircle className="w-3.5 h-3.5" /> Destructive commands are not available in this shell.</div>
    </div>
  );
}
