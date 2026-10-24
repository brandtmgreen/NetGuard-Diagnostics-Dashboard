import {
  Activity,
  FileText,
  LayoutDashboard,
  Network,
  ScanLine,
  Settings,
  ShieldAlert,
  ShieldBan,
  Waypoints,
} from "lucide-react";
import { AppState } from "../types";

const items = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "network", label: "Network", icon: Network },
  { id: "scanner", label: "Port Scanner", icon: ScanLine },
  { id: "detections", label: "Detections", icon: ShieldAlert },
  { id: "prevention", label: "Prevention", icon: ShieldBan },
  { id: "capture", label: "Packet Capture", icon: Waypoints },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
];

interface Props {
  activeTab: string;
  onNavigate: (tab: string) => void;
  state: AppState | null;
}

export default function Sidebar({ activeTab, onNavigate, state }: Props) {
  const openAlerts = state?.alerts.filter((alert) => alert.status === "open").length || 0;
  const armed = state?.settings.preventionMode === "prevent" && state.settings.autoBlock;

  return (
    <aside className="w-64 shrink-0 border-r border-[#24283b] bg-[#0d0f16] flex flex-col min-h-screen">
      <div className="px-5 pt-6 pb-5 border-b border-[#24283b]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#7aa2f7]/10 border border-[#7aa2f7]/30 flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#7aa2f7]" />
          </div>
          <div>
            <div className="text-[13px] font-black tracking-[0.22em] text-[#c0caf5]">NETGUARD</div>
            <div className="text-[9px] tracking-[0.18em] text-[#565f89] font-bold">LOCAL SECURITY DESK</div>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between text-[10px] font-mono">
          <span className="text-[#565f89]">HOST</span>
          <span className="text-[#9ece6a] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9ece6a] animate-pulse" />
            {state?.host.hostname || "connecting"}
          </span>
        </div>
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-xs font-bold transition ${
                active
                  ? "bg-[#7aa2f7]/10 text-[#c0caf5] border border-[#7aa2f7]/20"
                  : "text-[#737aa2] hover:text-[#c0caf5] hover:bg-white/[0.03] border border-transparent"
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? "text-[#7aa2f7]" : "text-[#565f89]"}`} />
              <span className="flex-1">{item.label}</span>
              {badge ? (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#f7768e] text-[#0b0c0f] text-[10px] font-black flex items-center justify-center">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#24283b] space-y-3">
        <div className="rounded-lg border border-[#24283b] bg-[#11131b] p-3">
          <div className="flex items-center justify-between text-[9px] font-black tracking-wider uppercase">
            <span className="text-[#565f89]">Prevention</span>
            <span className={armed ? "text-[#f7768e]" : "text-[#e0af68]"}>
              {armed ? "ARMED" : "MONITOR"}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-[#737aa2]">
            {state?.host.isAdmin ? "Administrator session" : "Standard user — firewall writes disabled"}
          </div>
        </div>
        <div className="text-[9px] font-mono text-[#414868] flex items-center justify-between">
          <span>v1.0.4</span>
          <span>LOCAL ONLY</span>
        </div>
      </div>
    </aside>
  );
}
