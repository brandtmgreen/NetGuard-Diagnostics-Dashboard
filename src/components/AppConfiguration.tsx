import React, { useState } from "react";
import { 
  Palette, 
  Monitor, 
  Check, 
  Moon, 
  Eye, 
  Tv, 
  Gamepad2, 
  Bot, 
  Sparkles, 
  RotateCcw, 
  Download, 
  Upload, 
  Sliders,
  SlidersHorizontal,
  Volume2, 
  VolumeX, 
  Shield, 
  Radio, 
  FileJson, 
  CheckCircle2, 
  RefreshCw,
  Cpu,
  Terminal,
  Activity,
  Maximize2
} from "lucide-react";
import { ThemeMode, AppConfig } from "../types";

interface AppConfigurationProps {
  config: AppConfig;
  onUpdateConfig: (newConfig: Partial<AppConfig>) => void;
  onResetDefaults: () => void;
}

export default function AppConfiguration({
  config,
  onUpdateConfig,
  onResetDefaults
}: AppConfigurationProps) {
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const themeOptions: {
    id: ThemeMode;
    name: string;
    tagline: string;
    description: string;
    icon: any;
    primaryColor: string;
    bgPreview: string;
    borderColor: string;
    badgeText: string;
  }[] = [
    {
      id: "dark",
      name: "Dark Mode (Default)",
      tagline: "Tokyo-Night Cybernetic Console",
      description: "Midnight obsidian background with sharp ice-blue telemetry, deep dark surfaces, and subtle Tokyo-Night accents.",
      icon: Moon,
      primaryColor: "#7aa2f7",
      bgPreview: "bg-[#0b0c0f]",
      borderColor: "border-[#7aa2f7]",
      badgeText: "STATION STANDARD"
    },
    {
      id: "high-contrast",
      name: "High Contrast",
      tagline: "WCAG AAA Ultra-Legibility",
      description: "Pitch black background, stark 2px white borders, neon cyan, bright yellow, and hot pink high-visibility indicators.",
      icon: Eye,
      primaryColor: "#00ffff",
      bgPreview: "bg-[#000000]",
      borderColor: "border-[#ffffff]",
      badgeText: "ACCESSIBILITY AAA"
    },
    {
      id: "win31",
      name: "Windows 3.1 (1992)",
      tagline: "Program Manager Classic Bevels",
      description: "Teal desktop background (#008080), 3D gray push buttons, navy blue title bars, and authentic 1992 GUI window controls.",
      icon: Tv,
      primaryColor: "#000080",
      bgPreview: "bg-[#008080]",
      borderColor: "border-[#808080]",
      badgeText: "RETRO WINDOWS"
    },
    {
      id: "mario",
      name: "Super Mario Bros",
      tagline: "NES 8-Bit Mushroom Kingdom",
      description: "NES sky blue backdrop (#5c94fc), coin gold highlights, pipe green status badges, and 8-bit arcade block styling.",
      icon: Gamepad2,
      primaryColor: "#f8b800",
      bgPreview: "bg-[#5c94fc]",
      borderColor: "border-[#000000]",
      badgeText: "1UP ARCADE"
    },
    {
      id: "johnny5",
      name: "Johnny 5 (Short Circuit)",
      tagline: "S.A.I.N.T. Prototype #5 Robotics",
      description: "NOVA Robotics tactical steel chassis, glowing optic sensor amber (#ff9900), laser blue HUD, and 'NO DISASSEMBLE!' telemetry.",
      icon: Bot,
      primaryColor: "#ff9900",
      bgPreview: "bg-[#080c12]",
      borderColor: "border-[#ff9900]",
      badgeText: "INPUT! NEED INPUT!"
    }
  ];

  const handleSelectTheme = (themeId: ThemeMode) => {
    onUpdateConfig({ theme: themeId });
    setSaveStatus(`Theme updated to '${themeOptions.find(t => t.id === themeId)?.name}'`);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleExportConfig = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `netguard-app-config-${config.theme}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setSaveStatus("Configuration exported successfully!");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 select-none bg-[#0b0c0f]" id="app-configuration-page">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#24283b] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-6 h-6 text-[#7aa2f7]" />
            <h1 className="text-xl font-bold text-slate-100 tracking-tight uppercase">
              App Configuration & Theme Studio
            </h1>
          </div>
          <p className="text-xs text-[#565f89] mt-1">
            Customize core CSS root theme variables, interface visual palettes, telemetry refresh rates, and system diagnostics settings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportConfig}
            className="px-3 py-1.5 bg-[#16161e] hover:bg-[#24283b] text-slate-200 border border-[#24283b] rounded text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
            id="btn-export-config"
          >
            <Download className="w-3.5 h-3.5 text-[#7aa2f7]" />
            Export Config JSON
          </button>
          <button
            onClick={onResetDefaults}
            className="px-3 py-1.5 bg-[#f7768e]/10 hover:bg-[#f7768e]/20 text-[#f7768e] border border-[#f7768e]/30 rounded text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
            id="btn-reset-defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="bg-[#9ece6a]/15 border border-[#9ece6a]/30 text-[#9ece6a] px-4 py-2 rounded text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* SECTION 1: THEME MATRIX SELECTION */}
      <div className="bg-[#16161e] border border-[#24283b] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#7aa2f7]" />
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Interface Theme Selection & CSS Variables
            </h2>
          </div>
          <span className="text-[10px] font-mono bg-[#24283b] text-[#7aa2f7] px-2.5 py-1 rounded font-bold uppercase">
            Active: {config.theme.toUpperCase()}
          </span>
        </div>

        <p className="text-xs text-[#565f89]">
          Selecting a theme updates the global CSS root variables (<code className="text-[#a9b1d6] font-mono">:root [data-theme]</code>), overriding background colors, text contrast, borders, and window decorators across every component in NetGuard.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {themeOptions.map((t) => {
            const Icon = t.icon;
            const isSelected = config.theme === t.id;
            return (
              <div
                key={t.id}
                onClick={() => handleSelectTheme(t.id)}
                id={`theme-card-${t.id}`}
                className={`relative border rounded-lg p-4 cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? "bg-[#24283b]/60 border-[#7aa2f7] shadow-lg shadow-[#7aa2f7]/10 ring-2 ring-[#7aa2f7]/50"
                    : "bg-[#16161e] hover:bg-[#1f2335]/70 border-[#24283b] hover:border-[#565f89]"
                }`}
              >
                {/* Theme Header */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded bg-[#0b0c0f] border border-[#24283b]" style={{ color: t.primaryColor }}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                          {t.name}
                        </h3>
                        <span className="text-[10px] font-mono text-[#565f89] block">{t.tagline}</span>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="w-6 h-6 rounded-full bg-[#7aa2f7] text-slate-950 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#a9b1d6] leading-relaxed pt-1">
                    {t.description}
                  </p>
                </div>

                {/* Theme Visual Palette Swatch */}
                <div className="space-y-2 pt-2 border-t border-[#24283b]/60">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#565f89]">
                    <span>COLOR PALETTE</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#0b0c0f] border border-[#24283b]" style={{ color: t.primaryColor }}>
                      {t.badgeText}
                    </span>
                  </div>

                  <div className="h-8 rounded border border-[#24283b] p-1 flex items-center gap-1 bg-[#0b0c0f]">
                    <div className="h-full flex-1 rounded" style={{ backgroundColor: t.primaryColor }}></div>
                    <div className="h-full flex-1 rounded bg-[#1a1b26] border border-[#24283b]"></div>
                    <div className="h-full flex-1 rounded bg-[#9ece6a]"></div>
                    <div className="h-full flex-1 rounded bg-[#f7768e]"></div>
                    <div className="h-full flex-1 rounded bg-[#bb9af7]"></div>
                  </div>
                </div>

                {/* Select Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectTheme(t.id);
                  }}
                  className={`w-full py-1.5 rounded text-xs font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "bg-[#7aa2f7] text-slate-950 shadow"
                      : "bg-[#24283b] hover:bg-[#7aa2f7]/20 text-slate-200 hover:text-[#7aa2f7] border border-[#24283b]"
                  }`}
                >
                  {isSelected ? "Active Theme" : "Apply Theme"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: LIVE THEME INTERACTIVE PREVIEW */}
      <div className="bg-[#16161e] border border-[#24283b] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-[#7aa2f7]" />
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Live Theme Component Preview Sandbox
            </h2>
          </div>
          <span className="text-[10px] text-[#565f89] font-mono">Real-time Root CSS Binding</span>
        </div>

        {/* Dynamic Sandbox Window */}
        <div className="border border-[#24283b] rounded-lg bg-[#0b0c0f] overflow-hidden p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-[#24283b] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#f7768e]"></span>
              <span className="w-3 h-3 rounded-full bg-[#e0af68]"></span>
              <span className="w-3 h-3 rounded-full bg-[#9ece6a]"></span>
              <span className="font-mono text-xs text-slate-200 font-bold ml-2">netguard_live_preview.exe</span>
            </div>
            <span className="text-[10px] font-mono text-[#7aa2f7] bg-[#16161e] px-2 py-0.5 rounded border border-[#24283b]">
              CSS Root Data Attribute: data-theme="{config.theme}"
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Component 1: Metric Card */}
            <div className="bg-[#16161e] border border-[#24283b] p-3.5 rounded space-y-2">
              <span className="text-[10px] font-mono text-[#565f89] uppercase">Subnet Latency</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-[#7aa2f7]">12.4 ms</span>
                <span className="text-xs text-[#9ece6a] font-bold">OPTIMAL</span>
              </div>
              <div className="w-full bg-[#0b0c0f] h-2 rounded overflow-hidden border border-[#24283b]">
                <div className="bg-[#7aa2f7] h-full w-[65%]"></div>
              </div>
            </div>

            {/* Component 2: Threat Badge */}
            <div className="bg-[#16161e] border border-[#24283b] p-3.5 rounded space-y-2">
              <span className="text-[10px] font-mono text-[#565f89] uppercase">Firewall Threat Vector</span>
              <div className="flex items-center justify-between pt-1">
                <span className="px-2 py-0.5 bg-[#f7768e]/15 text-[#f7768e] border border-[#f7768e]/30 rounded text-xs font-bold">
                  HIGH SEVERITY
                </span>
                <span className="text-xs text-[#a9b1d6] font-mono">Port 3389</span>
              </div>
              <p className="text-[11px] text-[#565f89]">Inbound unauthorized WAN brute-force scan intercepted.</p>
            </div>

            {/* Component 3: Controls */}
            <div className="bg-[#16161e] border border-[#24283b] p-3.5 rounded space-y-2 flex flex-col justify-between">
              <span className="text-[10px] font-mono text-[#565f89] uppercase">Interactive Controls</span>
              <div className="flex gap-2">
                <button className="flex-1 py-1.5 bg-[#7aa2f7] text-slate-950 font-bold rounded text-xs hover:opacity-90 transition">
                  Confirm
                </button>
                <button className="flex-1 py-1.5 bg-[#24283b] text-slate-200 font-bold rounded text-xs border border-[#24283b] hover:bg-[#24283b]/80 transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: SYSTEM DIAGNOSTICS & TELEMETRY CONFIGURATION */}
      <div className="bg-[#16161e] border border-[#24283b] rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-[#7aa2f7]" />
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
            Telemetry & Diagnostic Engine Settings
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
          {/* Refresh interval */}
          <div className="bg-[#0b0c0f] border border-[#24283b] p-4 rounded-lg space-y-2">
            <label className="text-xs font-bold text-slate-200 block uppercase font-mono">
              Dashboard Telemetry Refresh Speed
            </label>
            <p className="text-[11px] text-[#565f89]">
              Frequency of real-time network latency, packet sniffer, and process CPU/Memory polling loops.
            </p>
            <select
              value={config.autoRefreshInterval}
              onChange={(e) => onUpdateConfig({ autoRefreshInterval: Number(e.target.value) })}
              className="w-full bg-[#16161e] border border-[#24283b] rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#7aa2f7] font-mono"
            >
              <option value={1}>1 Second (Real-Time Ultra Scan)</option>
              <option value={3}>3 Seconds (Standard Diagnostic Balance)</option>
              <option value={5}>5 Seconds (Low Bandwidth Mode)</option>
              <option value={10}>10 Seconds (Power Saver Mode)</option>
            </select>
          </div>

          {/* Subnet Sweep Range */}
          <div className="bg-[#0b0c0f] border border-[#24283b] p-4 rounded-lg space-y-2">
            <label className="text-xs font-bold text-slate-200 block uppercase font-mono">
              Target Subnet CIDR Range
            </label>
            <p className="text-[11px] text-[#565f89]">
              Default IPv4 CIDR range probed by ARP, NMAP, and Wireshark sniffer modules.
            </p>
            <input
              type="text"
              value={config.scanSubnetRange}
              onChange={(e) => onUpdateConfig({ scanSubnetRange: e.target.value })}
              className="w-full bg-[#16161e] border border-[#24283b] rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#7aa2f7] font-mono"
            />
          </div>

          {/* Retro Font Toggle */}
          <div className="bg-[#0b0c0f] border border-[#24283b] p-4 rounded-lg flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-200 block uppercase font-mono">
                Retro Monospace Typography
              </span>
              <p className="text-[11px] text-[#565f89]">
                Force fixed-width JetBrains / Retro Courier typography across all table grids and headers.
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.retroFontEnabled}
              onChange={(e) => onUpdateConfig({ retroFontEnabled: e.target.checked })}
              className="w-4 h-4 accent-[#7aa2f7] cursor-pointer"
            />
          </div>

          {/* Audio Chime Simulator */}
          <div className="bg-[#0b0c0f] border border-[#24283b] p-4 rounded-lg flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-200 block uppercase font-mono">
                System Sound Effects & Chimes
              </span>
              <p className="text-[11px] text-[#565f89]">
                Enable synthesize audio feedback on high-severity threat intercepts and terminal executions.
              </p>
            </div>
            <button
              onClick={() => onUpdateConfig({ soundEffects: !config.soundEffects })}
              className={`p-2 rounded border transition cursor-pointer ${
                config.soundEffects 
                  ? "bg-[#7aa2f7]/20 border-[#7aa2f7] text-[#7aa2f7]" 
                  : "bg-[#16161e] border-[#24283b] text-[#565f89]"
              }`}
            >
              {config.soundEffects ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
