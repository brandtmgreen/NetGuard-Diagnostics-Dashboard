import { useEffect, useState } from "react";
import { Lock, Shield, ShieldBan, ShieldCheck, Trash2 } from "lucide-react";
import { AppState, Settings } from "../types";

interface Props {
  state: AppState;
  onSaveSettings: (patch: Partial<Settings>) => Promise<void>;
  onBlock: (ip: string, direction: "Inbound" | "Outbound" | "Both", duration: number) => Promise<void>;
  onUnblock: (name: string) => Promise<void>;
}

export default function PreventionView({ state, onSaveSettings, onBlock, onUnblock }: Props) {
  const [mode, setMode] = useState<Settings["preventionMode"]>(state.settings.preventionMode);
  const [autoBlock, setAutoBlock] = useState(state.settings.autoBlock);
  const [duration, setDuration] = useState(state.settings.blockDurationMinutes);
  const [ip, setIp] = useState("");
  const [direction, setDirection] = useState<"Inbound" | "Outbound" | "Both">("Both");
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMode(state.settings.preventionMode);
    setAutoBlock(state.settings.autoBlock);
    setDuration(state.settings.blockDurationMinutes);
  }, [state.settings.preventionMode, state.settings.autoBlock, state.settings.blockDurationMinutes]);

  const save = async () => {
    setSaving(true);
    try {
      await onSaveSettings({ preventionMode: mode, autoBlock, blockDurationMinutes: duration });
    } finally {
      setSaving(false);
    }
  };

  const submitBlock = async () => {
    if (!confirm || !ip.trim()) return;
    await onBlock(ip.trim(), direction, duration);
    setIp("");
    setConfirm(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f7768e]">Prevention</div>
        <h1 className="mt-1 text-2xl font-black text-[#c0caf5]">Windows Firewall enforcement</h1>
        <p className="text-xs text-[#737aa2] mt-1">Monitor first. Arming automatic blocks is an explicit, auditable action.</p>
      </div>

      <div className={`rounded-xl border p-5 ${state.host.isAdmin ? "border-[#24283b] bg-[#161821]" : "border-[#e0af68]/30 bg-[#e0af68]/5"}`}>
        <div className="flex items-start gap-3">
          {state.host.isAdmin ? <ShieldCheck className="w-5 h-5 text-[#9ece6a] mt-0.5" /> : <Lock className="w-5 h-5 text-[#e0af68] mt-0.5" />}
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-[#c0caf5]">{state.host.isAdmin ? "Administrator session" : "Standard-user session"}</h2>
                <p className="text-[10px] text-[#737aa2] mt-1">
                  {state.host.isAdmin
                    ? "Firewall rules can be created and removed. Every change is written to the local audit log."
                    : "Read-only telemetry. Launch NetGuard as administrator to enable firewall enforcement."}
                </p>
              </div>
              <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${state.host.isAdmin ? "text-[#9ece6a] bg-[#9ece6a]/10" : "text-[#e0af68] bg-[#e0af68]/10"}`}>
                {state.host.isAdmin ? "ELEVATED" : "READ ONLY"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-[#24283b] bg-[#161821] p-5">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#7aa2f7]" />
            <h2 className="text-sm font-black text-[#c0caf5]">Prevention mode</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("monitor")}
              className={`rounded-lg border p-4 text-left transition ${mode === "monitor" ? "border-[#7aa2f7]/50 bg-[#7aa2f7]/10" : "border-[#24283b] bg-[#11131b] hover:border-[#7aa2f7]/30"}`}
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-[#7aa2f7]">Monitor</div>
              <div className="mt-1 text-[10px] text-[#737aa2]">Detect and record. Never changes firewall rules.</div>
            </button>
            <button
              onClick={() => setMode("prevent")}
              className={`rounded-lg border p-4 text-left transition ${mode === "prevent" ? "border-[#f7768e]/50 bg-[#f7768e]/10" : "border-[#24283b] bg-[#11131b] hover:border-[#f7768e]/30"}`}
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-[#f7768e]">Prevent</div>
              <div className="mt-1 text-[10px] text-[#737aa2]">Allow manual blocks. Optional auto-block for high/critical alerts.</div>
            </button>
          </div>
          <label className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[#24283b] bg-[#11131b] p-3">
            <div>
              <div className="text-[10px] font-black text-[#c0caf5]">Automatic block on high/critical alerts</div>
              <div className="text-[9px] text-[#565f89] mt-0.5">Only public, non-allowlisted remote IPs. Expires automatically.</div>
            </div>
            <input
              type="checkbox"
              checked={autoBlock}
              disabled={mode !== "prevent" || !state.host.isAdmin}
              onChange={(event) => setAutoBlock(event.target.checked)}
              className="h-4 w-4 accent-[#f7768e]"
            />
          </label>
          <div className="mt-4">
            <label className="text-[9px] font-black uppercase tracking-widest text-[#565f89]">Block duration (minutes)</label>
            <input
              type="number"
              min={1}
              max={1440}
              value={duration}
              onChange={(event) => setDuration(Math.max(1, Math.min(1440, Number(event.target.value) || 15)))}
              className="mt-1 w-full rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs font-mono text-[#c0caf5] focus:outline-none focus:border-[#7aa2f7]/60"
            />
          </div>
          <button onClick={save} disabled={saving} className="mt-4 w-full rounded-lg bg-[#7aa2f7] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#0b0c0f] hover:bg-[#89b4fa] disabled:opacity-50">
            {saving ? "Saving…" : "Save prevention settings"}
          </button>
        </section>

        <section className="rounded-xl border border-[#24283b] bg-[#161821] p-5">
          <div className="flex items-center gap-2">
            <ShieldBan className="w-4 h-4 text-[#f7768e]" />
            <h2 className="text-sm font-black text-[#c0caf5]">Manual block</h2>
          </div>
          <p className="mt-1 text-[10px] text-[#737aa2]">Blocks both inbound and outbound traffic to a public IPv4 address.</p>
          <div className="mt-4 space-y-3">
            <input
              value={ip}
              onChange={(event) => setIp(event.target.value)}
              placeholder="203.0.113.42"
              className="w-full rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs font-mono text-[#c0caf5] placeholder:text-[#414868] focus:outline-none focus:border-[#f7768e]/60"
            />
            <select value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)} className="w-full rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-xs font-bold text-[#c0caf5] focus:outline-none">
              <option value="Both">Both directions</option>
              <option value="Inbound">Inbound only</option>
              <option value="Outbound">Outbound only</option>
            </select>
            <label className="flex items-start gap-2 text-[10px] text-[#a9b1d6]">
              <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-[#f7768e]" />
              I understand this creates a Windows Firewall block rule that can interrupt connectivity.
            </label>
            <button
              onClick={submitBlock}
              disabled={!state.host.isAdmin || !confirm || !ip.trim()}
              className="w-full rounded-lg border border-[#f7768e]/30 bg-[#f7768e]/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#f7768e] hover:bg-[#f7768e]/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create block rule
            </button>
          </div>
          <div className="mt-4 rounded-lg border border-[#24283b] bg-[#11131b] p-3 text-[9px] text-[#565f89] leading-relaxed">
            Guardrails: loopback, RFC1918, link-local, multicast, the default gateway, this host, and allowlisted IPs are rejected by the backend even if this form is bypassed.
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-[#24283b] bg-[#161821] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#24283b] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-[#c0caf5]">Active NetGuard firewall rules</h2>
            <p className="text-[10px] text-[#565f89]">Read from Windows Firewall. Only rules prefixed with NetGuard are touched.</p>
          </div>
          <span className="text-[10px] font-mono text-[#565f89]">{state.firewallRules.length} rules</span>
        </div>
        <div className="divide-y divide-[#24283b]">
          {state.firewallRules.map((rule) => (
            <div key={rule.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-[#c0caf5] truncate">{rule.displayName}</div>
                <div className="text-[9px] font-mono text-[#565f89] truncate">{rule.direction} · {rule.action} · {rule.remoteAddresses.join(", ") || "no remote filter"}</div>
              </div>
              <button
                onClick={() => void onUnblock(rule.name)}
                disabled={!state.host.isAdmin}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#24283b] bg-[#11131b] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[#a9b1d6] hover:border-[#f7768e]/40 hover:text-[#f7768e] disabled:opacity-40"
              >
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            </div>
          ))}
          {state.firewallRules.length === 0 ? (
            <div className="px-5 py-10 text-center text-[11px] text-[#565f89]">No active NetGuard firewall rules.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
