import React, { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { 
  ShieldCheck, 
  Activity, 
  Wifi, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight,
  RefreshCw,
  Sparkles,
  Eye,
  Cpu,
  Flame
} from "lucide-react";
import {
  Device,
  ThreatLog,
  SystemAlert,
  CapturedPacket,
  HistoricalLoadResponse,
  HistoricalLoadBucket
} from "../types";
import { motion, AnimatePresence } from "motion/react";
import WindowCard from "./WindowCard";

interface DashboardOverviewProps {
  devices: Device[];
  threatLogs: ThreatLog[];
  alerts: SystemAlert[];
  securityScore: number;
  onClearAlerts: () => void;
  onSelectTab: (tab: string) => void;
  trafficMbps: number;
  loadPercent: number;
  hostname: string;
  onRefresh?: () => void;
  startupPackets?: CapturedPacket[];
  startupAiReport?: string;
  isStartupCapturing?: boolean;
  isStartupAiAnalyzing?: boolean;
}

type HeatmapMode = "combined" | "cores" | "spikes";

interface HeatmapCellDatum {
  rowId: string;
  rowLabel: string;
  minuteIndex: number;
  minutesAgo: number;
  timeLabel: string;
  value: number;
  isSpike: boolean;
  bucket: HistoricalLoadBucket;
}

export default function DashboardOverview({
  devices,
  threatLogs,
  alerts,
  securityScore,
  onClearAlerts,
  onSelectTab,
  trafficMbps,
  loadPercent,
  hostname,
  onRefresh,
  startupPackets = [],
  startupAiReport = "",
  isStartupCapturing = false,
  isStartupAiAnalyzing = false
}: DashboardOverviewProps) {
  const [networkTraffic, setNetworkTraffic] = useState<number[]>([0, 0]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 60-Minute Historical CPU/RAM Load D3 Heatmap State
  const [historyData, setHistoryData] = useState<HistoricalLoadResponse | null>(null);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("combined");
  const [spikeThreshold, setSpikeThreshold] = useState<number>(60);
  const [hoveredCell, setHoveredCell] = useState<HeatmapCellDatum | null>(null);
  const heatmapSvgRef = useRef<SVGSVGElement | null>(null);
  const heatmapContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(860);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/system/history");
      if (!res.ok) return;
      const data: HistoricalLoadResponse = await res.json();
      if (data && Array.isArray(data.buckets)) {
        setHistoryData(data);
      }
    } catch {
      // ignore transient network errors
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  // Measure container width for responsive D3 rendering
  useEffect(() => {
    if (!heatmapContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 200) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(heatmapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Append real host throughput samples for the interface telemetry graph
  useEffect(() => {
    setNetworkTraffic(prev => {
      const next = [...prev, trafficMbps];
      return next.length > 30 ? next.slice(next.length - 30) : next;
    });
  }, [trafficMbps]);

  const triggerManualRefresh = () => {
    setIsRefreshing(true);
    onRefresh?.();
    fetchHistory();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Render D3 Heatmap whenever historyData, heatmapMode, spikeThreshold, or containerWidth updates
  useEffect(() => {
    if (!heatmapSvgRef.current || !historyData || historyData.buckets.length === 0) return;

    const buckets = historyData.buckets;
    const rows: { id: string; label: string; getValue: (b: HistoricalLoadBucket) => number }[] = [];

    if (heatmapMode === "combined") {
      rows.push(
        { id: "cpuPeak", label: "CPU Peak %", getValue: (b) => b.cpuPeak },
        { id: "cpuAvg", label: "CPU Avg %", getValue: (b) => b.cpuAvg },
        { id: "ramPeak", label: "RAM Peak %", getValue: (b) => b.ramPeak },
        { id: "ramAvg", label: "RAM Used %", getValue: (b) => b.ramAvg }
      );
    } else if (heatmapMode === "cores") {
      rows.push(
        { id: "cpuPeak", label: "CPU Peak %", getValue: (b) => b.cpuPeak },
        { id: "cpuAvg", label: "CPU Avg %", getValue: (b) => b.cpuAvg }
      );
      const maxCores = Math.min(8, historyData.cpuCount || 1);
      for (let c = 0; c < maxCores; c++) {
        rows.push({
          id: `core-${c}`,
          label: `Core #${c} %`,
          getValue: (b) => (b.coreLoads && b.coreLoads[c] !== undefined ? b.coreLoads[c] : b.cpuAvg),
        });
      }
    } else {
      // "spikes" mode emphasizes burst delta & peak watermarks
      rows.push(
        { id: "cpuPeak", label: "CPU Peak %", getValue: (b) => b.cpuPeak },
        {
          id: "cpuBurst",
          label: "CPU Burst Δ",
          getValue: (b) => Math.min(100, Math.max(0, (b.cpuPeak - b.cpuAvg) * 3)),
        },
        { id: "ramPeak", label: "RAM Peak %", getValue: (b) => b.ramPeak },
        {
          id: "combinedPressure",
          label: "Sys Pressure",
          getValue: (b) => Math.min(100, Math.round(b.cpuPeak * 0.6 + b.ramPeak * 0.4)),
        }
      );
    }

    const margin = { top: 8, right: 14, bottom: 26, left: 88 };
    const width = Math.max(420, containerWidth);
    const rowHeight = rows.length > 4 ? 22 : 30;
    const innerHeight = rows.length * rowHeight;
    const height = innerHeight + margin.top + margin.bottom;
    const innerWidth = width - margin.left - margin.right;

    const svg = d3.select(heatmapSvgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xDomain = buckets.map((_, idx) => String(idx));
    const yDomain = rows.map((r) => r.id);

    const xScale = d3
      .scaleBand<string>()
      .domain(xDomain)
      .range([0, innerWidth])
      .paddingInner(0.12)
      .paddingOuter(0.04);

    const yScale = d3
      .scaleBand<string>()
      .domain(yDomain)
      .range([0, innerHeight])
      .paddingInner(0.16)
      .paddingOuter(0.06);

    // Thermal security heatmap color scale (0% -> 100%)
    const colorScale = d3
      .scaleSequential<string>()
      .domain([0, 100])
      .interpolator(
        d3.interpolateRgbBasis([
          "#131621", // 0% Idle deep slate
          "#1b365d", // 20% Low cool navy
          "#2ac3de", // 40% Moderate cyan
          "#7aa2f7", // 60% Active cobalt
          "#e0af68", // 80% Elevated amber warning
          "#f7768e", // 100% Critical crimson spike
        ])
      );

    // Flatten matrix cells
    const cells: HeatmapCellDatum[] = [];
    rows.forEach((row) => {
      buckets.forEach((bucket, idx) => {
        const val = Math.min(100, Math.max(0, row.getValue(bucket)));
        const isSpike =
          val >= spikeThreshold ||
          (row.id === "cpuPeak" && bucket.cpuPeak - bucket.cpuAvg >= 12);
        cells.push({
          rowId: row.id,
          rowLabel: row.label,
          minuteIndex: idx,
          minutesAgo: bucket.minutesAgo,
          timeLabel: bucket.label,
          value: val,
          isSpike,
          bucket,
        });
      });
    });

    // Draw cells
    const cellGroups = g
      .selectAll<SVGGElement, HeatmapCellDatum>("g.heatmap-cell")
      .data(cells, (d) => `${d.rowId}-${d.minuteIndex}`)
      .join("g")
      .attr("class", "heatmap-cell")
      .attr(
        "transform",
        (d) => `translate(${xScale(String(d.minuteIndex)) ?? 0},${yScale(d.rowId) ?? 0})`
      );

    cellGroups
      .append("rect")
      .attr("width", Math.max(2, xScale.bandwidth()))
      .attr("height", Math.max(2, yScale.bandwidth()))
      .attr("rx", 2)
      .attr("ry", 2)
      .attr("fill", (d) => colorScale(d.value))
      .attr("stroke", (d) => (d.isSpike ? "#f7768e" : "#24283b"))
      .attr("stroke-width", (d) => (d.isSpike ? 1.1 : 0.4))
      .attr("stroke-opacity", (d) => (d.isSpike ? 0.95 : 0.45))
      .style("cursor", "crosshair")
      .on("mouseenter", function (_event, d) {
        d3.select(this)
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 1.5)
          .attr("stroke-opacity", 1);
        setHoveredCell(d);
      })
      .on("mouseleave", function (_event, d) {
        d3.select(this)
          .attr("stroke", d.isSpike ? "#f7768e" : "#24283b")
          .attr("stroke-width", d.isSpike ? 1.1 : 0.4)
          .attr("stroke-opacity", d.isSpike ? 0.95 : 0.45);
      });

    // Add subtle crown marker on cells that exceed the spike threshold
    cellGroups
      .filter((d) => d.isSpike)
      .append("circle")
      .attr("cx", Math.max(2, xScale.bandwidth()) / 2)
      .attr("cy", 3.5)
      .attr("r", 1.6)
      .attr("fill", "#ffffff")
      .attr("pointer-events", "none");

    // Y-Axis row labels
    const yAxisGroup = g.append("g").attr("class", "y-axis");
    rows.forEach((row) => {
      const yPos = (yScale(row.id) ?? 0) + yScale.bandwidth() / 2;
      yAxisGroup
        .append("text")
        .attr("x", -8)
        .attr("y", yPos)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("fill", "#a9b1d6")
        .attr("font-size", "10px")
        .attr("font-family", "monospace")
        .attr("font-weight", "600")
        .text(row.label);
    });

    // X-Axis time ticks every 10 minutes + NOW
    const xAxisGroup = g
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight + 6})`);

    const tickIndices = [0, 10, 20, 30, 40, 50, 59].filter((i) => i < buckets.length);
    tickIndices.forEach((idx) => {
      const b = buckets[idx];
      const xPos = (xScale(String(idx)) ?? 0) + xScale.bandwidth() / 2;

      xAxisGroup
        .append("line")
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("y1", -4)
        .attr("y2", 2)
        .attr("stroke", "#565f89")
        .attr("stroke-width", 1);

      xAxisGroup
        .append("text")
        .attr("x", xPos)
        .attr("y", 14)
        .attr("text-anchor", idx === 0 ? "start" : idx === buckets.length - 1 ? "end" : "middle")
        .attr("fill", idx === buckets.length - 1 ? "#7aa2f7" : "#565f89")
        .attr("font-size", "9px")
        .attr("font-family", "monospace")
        .attr("font-weight", idx === buckets.length - 1 ? "700" : "500")
        .text(idx === buckets.length - 1 ? `NOW (${b.label})` : `-${b.minutesAgo}m (${b.label})`);
    });
  }, [historyData, heatmapMode, spikeThreshold, containerWidth]);

  const activeDevices = devices.filter(d => d.status === "Online").length;
  const criticalAlerts = alerts.filter(a => a.severity === "critical").length;
  const warningAlerts = alerts.filter(a => a.severity === "warning").length;

  // Convert points to SVG polyline coordinates
  const svgWidth = 500;
  const svgHeight = 120;
  const padding = 10;
  const maxTrafficVal = Math.max(...networkTraffic, 100);

  const getPointsStr = () => {
    if (networkTraffic.length < 2) {
      const y = svgHeight - padding;
      return `${padding},${y} ${svgWidth - padding},${y}`;
    }
    return networkTraffic.map((val, idx) => {
      const x = padding + (idx / (networkTraffic.length - 1)) * (svgWidth - padding * 2);
      const y = svgHeight - padding - (val / maxTrafficVal) * (svgHeight - padding * 2);
      return `${x},${y}`;
    }).join(" ");
  };

  const getAreaPointsStr = () => {
    const points = getPointsStr();
    const startX = padding;
    const endX = svgWidth - padding;
    const bottomY = svgHeight - padding;
    return `${startX},${bottomY} ${points} ${endX},${bottomY}`;
  };

  const activeInspectedBucket =
    hoveredCell?.bucket ||
    (historyData?.buckets && historyData.buckets.length > 0
      ? historyData.buckets[historyData.buckets.length - 1]
      : null);

  return (
    <div className="p-4 overflow-y-auto h-full space-y-4 bg-[#0b0c0f] font-sans text-[#a9b1d6]">
      {/* Upper Status Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#24283b] pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-100 tracking-tight uppercase">Security & Health Monitor</h2>
          <p className="text-[#565f89] text-[11px]">Real-time status monitor for Windows nodes and local client devices.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerManualRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1b26] hover:bg-[#24283b] text-[#7aa2f7] rounded border border-[#24283b] text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-[#bb9af7]" : ""}`} />
            Refresh Nodes
          </button>
          <div className="text-[10px] bg-[#16161e] text-[#a9b1d6] border border-[#24283b] px-3 py-1.5 rounded font-mono">
            HOST: <span className="text-[#7aa2f7]">{(hostname || "local").toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Window 1: Core Health & KPI Summary Cards */}
      <WindowCard
        id="dash_kpi"
        title="Host & Node KPI Overview"
        icon={<ShieldCheck className="w-4 h-4 text-[#7aa2f7]" />}
        subtitle="Real-time security posture, online assets, and aggregate cluster load"
        defaultHeight={130}
        minHeight={100}
        maxHeight={260}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3">
          {/* Posture Score */}
          <div className="bg-[#16161e] border border-[#24283b] rounded p-3 flex items-center justify-between relative overflow-hidden">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider">Security Posture</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-black text-slate-100">{securityScore}</span>
                <span className="text-xs font-semibold text-[#565f89]">/100</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#9ece6a]">
                <CheckCircle2 className="w-3 h-3" />
                Fully Compliant
              </div>
            </div>
            {/* Circular Progress Ring */}
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="24" cy="24" r="18" stroke="#101216" strokeWidth="3" fill="transparent" />
                <circle 
                  cx="24" 
                  cy="24" 
                  r="18" 
                  stroke="#7aa2f7" 
                  strokeWidth="3" 
                  fill="transparent" 
                  strokeDasharray={113}
                  strokeDashoffset={113 - (113 * securityScore) / 100}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <ShieldCheck className="w-4 h-4 text-[#7aa2f7] absolute" />
            </div>
          </div>

          {/* Network Connections */}
          <div className="bg-[#16161e] border border-[#24283b] rounded p-3 flex items-center justify-between cursor-pointer hover:border-[#7aa2f7]/50 transition" onClick={() => onSelectTab("network")}>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider">Local Network</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-black text-slate-100">{activeDevices}</span>
                <span className="text-xs font-semibold text-[#565f89]">/ {devices.length} Online</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#7aa2f7]">
                <Wifi className="w-3 h-3" />
                Range: {(() => {
                  const ip = devices[0]?.ip;
                  if (!ip) return "Unknown subnet";
                  const parts = ip.split(".");
                  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
                })()}
              </div>
            </div>
            <div className="p-2 rounded bg-[#101216] text-[#7aa2f7] border border-[#24283b]">
              <Wifi className="w-4 h-4" />
            </div>
          </div>

          {/* System Load */}
          <div className="bg-[#16161e] border border-[#24283b] rounded p-3 flex items-center justify-between cursor-pointer hover:border-[#7aa2f7]/50 transition" onClick={() => onSelectTab("tasks")}>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider">System CPU Load</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-black text-slate-100">{loadPercent}%</span>
                <span className="text-xs font-semibold text-[#565f89]">Core Avg</span>
              </div>
              <div className="w-24 bg-[#101216] h-1 rounded overflow-hidden mt-1.5">
                <div className="bg-[#7aa2f7] h-full" style={{ width: `${loadPercent}%` }}></div>
              </div>
            </div>
            <div className="p-2 rounded bg-[#101216] text-[#bb9af7] border border-[#24283b]">
              <Activity className="w-4 h-4" />
            </div>
          </div>

          {/* Device Alerts */}
          <div className="bg-[#16161e] border border-[#24283b] rounded p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-[#565f89] uppercase tracking-wider">Connected Alerts</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-black text-slate-100">{alerts.length}</span>
                <span className="text-xs font-semibold text-[#565f89]">active triggers</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[9px] bg-[#f7768e]/10 text-[#f7768e] px-1 rounded border border-[#f7768e]/20 font-bold">
                  {criticalAlerts} Critical
                </span>
                <span className="text-[9px] bg-[#e0af68]/10 text-[#e0af68] px-1 rounded border border-[#e0af68]/20 font-bold">
                  {warningAlerts} Warning
                </span>
              </div>
            </div>
            <div className="p-2 rounded bg-[#101216] text-[#f7768e] border border-[#24283b] relative">
              {alerts.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#f7768e] rounded-full border border-[#16161e] animate-pulse"></span>
              )}
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
        </div>
      </WindowCard>

      {/* Window 1A: 60-Minute Historical CPU & RAM Load D3 Heatmap */}
      <WindowCard
        id="dash_d3_load_heatmap"
        title="60-Minute Historical CPU & RAM Load Heatmap (D3)"
        icon={<Cpu className="w-4 h-4 text-[#2ac3de]" />}
        subtitle="Minute-by-minute kernel CPU utilization, memory pressure, and sub-minute performance spike telemetry"
        defaultHeight={285}
        minHeight={230}
        maxHeight={540}
        badge={
          historyData ? (
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-[#2ac3de]">
                CPU Peak: <strong className="text-slate-100">{historyData.peakCpu60m.value}%</strong> ({historyData.peakCpu60m.label})
              </span>
              <span className="text-[#565f89]">·</span>
              <span className="text-[#bb9af7]">
                RAM Peak: <strong className="text-slate-100">{historyData.peakRam60m.value}%</strong> ({historyData.peakRam60m.label})
              </span>
            </div>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-[#101216] border border-[#24283b] rounded p-0.5 text-[10px]">
              <button
                onClick={() => setHeatmapMode("combined")}
                className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
                  heatmapMode === "combined"
                    ? "bg-[#24283b] text-[#7aa2f7]"
                    : "text-[#565f89] hover:text-[#a9b1d6]"
                }`}
              >
                CPU + RAM
              </button>
              <button
                onClick={() => setHeatmapMode("cores")}
                className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
                  heatmapMode === "cores"
                    ? "bg-[#24283b] text-[#7aa2f7]"
                    : "text-[#565f89] hover:text-[#a9b1d6]"
                }`}
              >
                Per-Core ({historyData?.cpuCount || 1})
              </button>
              <button
                onClick={() => setHeatmapMode("spikes")}
                className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
                  heatmapMode === "spikes"
                    ? "bg-[#24283b] text-[#f7768e]"
                    : "text-[#565f89] hover:text-[#a9b1d6]"
                }`}
              >
                Spike Delta
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1 bg-[#101216] border border-[#24283b] rounded px-2 py-0.5 text-[10px]">
              <Flame className="w-3 h-3 text-[#f7768e]" />
              <span className="text-[#565f89]">Spike ≥</span>
              {[45, 60, 75, 85].map((thresh) => (
                <button
                  key={thresh}
                  onClick={() => setSpikeThreshold(thresh)}
                  className={`px-1 rounded font-mono transition cursor-pointer ${
                    spikeThreshold === thresh
                      ? "bg-[#f7768e]/20 text-[#f7768e] font-bold"
                      : "text-[#565f89] hover:text-slate-200"
                  }`}
                >
                  {thresh}%
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="p-3 flex flex-col justify-between h-full space-y-2.5 overflow-y-auto">
          {/* Top Summary & Thermal Scale Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#101216] border border-[#24283b] rounded px-3 py-1.5 text-[10px] font-mono">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                <span className="text-[#565f89]">HOST CPU:</span>{" "}
                <span className="text-slate-200 font-bold">{historyData?.cpuModel || "Detecting..."}</span>
              </span>
              <span className="text-[#565f89]">·</span>
              <span>
                <span className="text-[#565f89]">PHYSICAL RAM:</span>{" "}
                <span className="text-slate-200 font-bold">{historyData?.totalMemGb || 0} GB</span>
              </span>
              <span className="text-[#565f89]">·</span>
              <span>
                <span className="text-[#565f89]">LOAD AVG (1m/5m/15m):</span>{" "}
                <span className="text-[#7aa2f7] font-bold">
                  {historyData?.loadAvg ? historyData.loadAvg.join(" / ") : "0.00 / 0.00 / 0.00"}
                </span>
              </span>
              <span className="text-[#565f89]">·</span>
              <span>
                <span className="text-[#565f89]">60M SPIKE WINDOWS:</span>{" "}
                <span className={historyData && historyData.spikeCount60m > 0 ? "text-[#f7768e] font-bold" : "text-[#9ece6a] font-bold"}>
                  {historyData?.spikeCount60m ?? 0} mins
                </span>
              </span>
            </div>

            {/* Thermal Legend */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#565f89]">0%</span>
              <div
                className="w-28 h-2 rounded-sm border border-[#24283b]"
                style={{
                  background:
                    "linear-gradient(90deg, #131621 0%, #1b365d 20%, #2ac3de 40%, #7aa2f7 60%, #e0af68 80%, #f7768e 100%)",
                }}
              />
              <span className="text-[#f7768e] font-bold">100%</span>
              <span className="text-[#565f89] ml-1 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-white border border-[#f7768e]"></span>
                Spike
              </span>
            </div>
          </div>

          {/* D3 SVG Matrix Container */}
          <div
            ref={heatmapContainerRef}
            className="w-full bg-[#101216] border border-[#24283b] rounded px-2 py-2 overflow-x-auto"
          >
            {historyData && historyData.buckets.length > 0 ? (
              <svg ref={heatmapSvgRef} className="w-full block select-none" />
            ) : (
              <div className="h-32 flex items-center justify-center text-xs font-mono text-[#565f89]">
                Sampling real-time 60-minute OS CPU and memory telemetry...
              </div>
            )}
          </div>

          {/* Live Minute Inspector Bar */}
          {activeInspectedBucket && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#16161e] border border-[#24283b] rounded px-3 py-1.5 text-[10px] font-mono">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[#7aa2f7] font-bold">
                  {hoveredCell
                    ? `INSPECTING [${hoveredCell.timeLabel} · T-${hoveredCell.minutesAgo}m] ${hoveredCell.rowLabel}: ${hoveredCell.value}%`
                    : `LATEST BUCKET [${activeInspectedBucket.label} · NOW]`}
                </span>
                <span className="text-[#565f89]">·</span>
                <span>
                  CPU Peak: <strong className="text-slate-100">{activeInspectedBucket.cpuPeak}%</strong> (Avg:{" "}
                  {activeInspectedBucket.cpuAvg}%)
                </span>
                <span className="text-[#565f89]">·</span>
                <span>
                  RAM Peak: <strong className="text-slate-100">{activeInspectedBucket.ramPeak}%</strong> (Avg:{" "}
                  {activeInspectedBucket.ramAvg}%)
                </span>
                <span className="text-[#565f89]">·</span>
                <span>
                  1m Load Avg: <strong className="text-[#2ac3de]">{activeInspectedBucket.loadAvg1m}</strong>
                </span>
              </div>
              <div className="text-[#565f89]">
                Source:{" "}
                <span className="text-[#9ece6a]">
                  {activeInspectedBucket.source === "live-sampler"
                    ? `Live 5s Kernel Sampler (${activeInspectedBucket.sampleCount} samples)`
                    : `OS Kernel & Process Table (${activeInspectedBucket.sampleCount} active procs)`}
                </span>
              </div>
            </div>
          )}
        </div>
      </WindowCard>

      {/* Window 1B: Automatic Startup Packet Capture & AI Security Analysis */}
      <WindowCard
        id="dash_startup_capture_ai"
        title="Startup Live Packet Capture & AI Security Audit"
        icon={<Sparkles className="w-4 h-4 text-[#bb9af7]" />}
        subtitle="Automatic boot-time socket capture and Gemini Threat Hunter analysis"
        defaultHeight={230}
        minHeight={160}
        maxHeight={520}
        badge={
          <span className="text-[9px] font-mono text-[#bb9af7] bg-[#bb9af7]/10 border border-[#bb9af7]/25 px-2 py-0.5 rounded flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full bg-[#bb9af7] ${isStartupCapturing || isStartupAiAnalyzing ? "animate-ping" : ""}`}></span>
            {isStartupCapturing
              ? "CAPTURING PACKETS..."
              : isStartupAiAnalyzing
              ? `ANALYZING ${startupPackets.length} FRAMES...`
              : `${startupPackets.length} LIVE FRAMES CAPTURED`}
          </span>
        }
        actions={
          <button
            onClick={() => onSelectTab("wireshark")}
            className="flex items-center gap-1 text-[10px] text-[#e0af68] hover:text-[#e0af68]/80 font-bold transition cursor-pointer border border-[#24283b] bg-[#1a1b26] px-2 py-0.5 rounded"
          >
            <Eye className="w-3 h-3" />
            Open Wireshark Console
            <ChevronRight className="w-3 h-3" />
          </button>
        }
      >
        <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-3 h-full overflow-hidden">
          {/* Left: Live Captured Frames Summary */}
          <div className="bg-[#101216] border border-[#24283b] rounded p-2.5 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#24283b] pb-1.5 mb-2 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#e0af68] flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Live Socket Frame Capture ({startupPackets.length})
              </span>
              <span className="text-[9px] font-mono text-[#565f89]">
                {isStartupCapturing ? "Sampling kernel sockets..." : "Real-time host sockets"}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1 pr-1">
              {isStartupCapturing ? (
                <div className="h-full flex items-center justify-center text-[#7aa2f7] py-6">
                  Capturing live network frames from host interface...
                </div>
              ) : startupPackets.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[#565f89] py-6">
                  No active network frames captured on startup.
                </div>
              ) : (
                startupPackets.slice(0, 12).map((pkt) => (
                  <div
                    key={pkt.id}
                    className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-[#16161e] border border-[#24283b]/60 text-[#a9b1d6]"
                  >
                    <span className="text-[#7aa2f7] font-bold shrink-0">#{pkt.id}</span>
                    <span className="text-[#9ece6a] shrink-0">{pkt.protocol}</span>
                    <span className="truncate text-slate-200">{pkt.source} → {pkt.destination}</span>
                    <span className="text-[#565f89] truncate max-w-[180px] hidden sm:inline">{pkt.info}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Live AI Security Audit Output */}
          <div className="bg-[#101216] border border-[#24283b] rounded p-2.5 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#24283b] pb-1.5 mb-2 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#bb9af7] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Startup AI Threat Analysis
              </span>
              <span className="text-[9px] font-mono text-[#565f89]">Gemini Security Auditor</span>
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-[10px] text-[#a9b1d6] pr-1">
              {isStartupAiAnalyzing || isStartupCapturing ? (
                <div className="h-full flex items-center justify-center text-[#bb9af7] py-6 animate-pulse">
                  Running automated AI security audit on captured startup packets and host telemetry...
                </div>
              ) : startupAiReport ? (
                <pre className="whitespace-pre-wrap leading-relaxed text-[10px] text-slate-200">
                  {startupAiReport}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-[#565f89] py-6">
                  Awaiting live AI security audit output...
                </div>
              )}
            </div>
          </div>
        </div>
      </WindowCard>

      {/* Window 2 & 3: Telemetry Graph and Alarms Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Network Traffic Line Graph (2/3 width) */}
        <WindowCard
          id="dash_telemetry"
          title="Network Interface Telemetry"
          icon={<Activity className="w-4 h-4 text-[#7aa2f7]" />}
          subtitle="Real-time throughput metrics across host NIC adapter"
          defaultHeight={240}
          minHeight={170}
          maxHeight={500}
          className="lg:col-span-2"
          badge={
            <span className="text-[9px] font-mono text-[#7aa2f7] bg-[#7aa2f7]/10 border border-[#7aa2f7]/20 px-2 py-0.5 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#7aa2f7] rounded-full animate-pulse"></span>
              {networkTraffic[networkTraffic.length - 1]} Mbps
            </span>
          }
        >
          <div className="p-3 h-full flex flex-col justify-between">
            {/* SVG Line Graph */}
            <div className="w-full flex-1 min-h-[90px] bg-[#101216] rounded border border-[#24283b] p-1 overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 right-0 flex flex-col justify-between pointer-events-none p-1.5 opacity-5">
                <div className="border-b border-white w-full"></div>
                <div className="border-b border-white w-full"></div>
                <div className="border-b border-white w-full"></div>
              </div>
              
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7aa2f7" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#7aa2f7" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <polygon points={getAreaPointsStr()} fill="url(#areaGrad)" />
                <polyline
                  fill="none"
                  stroke="#7aa2f7"
                  strokeWidth="2"
                  points={getPointsStr()}
                  className="transition-all duration-300"
                />
                {(() => {
                  const idx = networkTraffic.length - 1;
                  const x = padding + (idx / (networkTraffic.length - 1)) * (svgWidth - padding * 2);
                  const y = svgHeight - padding - (networkTraffic[idx] / maxTrafficVal) * (svgHeight - padding * 2);
                  return (
                    <g>
                      <circle cx={x} cy={y} r="3.5" fill="#7aa2f7" />
                      <circle cx={x} cy={y} r="8" fill="#7aa2f7" fillOpacity="0.2" className="animate-ping" />
                    </g>
                  );
                })()}
              </svg>
            </div>

            <div className="flex justify-between items-center text-[9px] text-[#565f89] font-mono mt-1.5 shrink-0">
              <span>-30 SECONDS</span>
              <span>-15 SECONDS</span>
              <span>CURRENT RATE</span>
            </div>
          </div>
        </WindowCard>

        {/* Real-time Alert Feed (1/3 width) */}
        <WindowCard
          id="dash_alarms"
          title="Resource Alarms"
          icon={<AlertTriangle className="w-4 h-4 text-[#f7768e]" />}
          subtitle="Telemetry threshold alarms & watchdog triggers"
          defaultHeight={240}
          minHeight={170}
          maxHeight={500}
          actions={
            alerts.length > 0 ? (
              <button
                onClick={onClearAlerts}
                className="text-[9px] text-[#7aa2f7] hover:text-[#f7768e] border border-[#24283b] bg-[#1a1b26] px-1.5 py-0.5 rounded font-bold transition"
              >
                Clear
              </button>
            ) : undefined
          }
        >
          <div className="p-3 h-full overflow-y-auto space-y-1.5 custom-scrollbar">
            <AnimatePresence initial={false}>
              {alerts.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full min-h-[100px] flex flex-col items-center justify-center text-[#565f89] text-[10px] py-4 space-y-1"
                >
                  <CheckCircle2 className="w-5 h-5 text-[#9ece6a]" />
                  <span>All network nodes nominal</span>
                </motion.div>
              ) : (
                alerts.map((alert) => (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`p-2 rounded border flex items-start gap-2 transition text-[11px] ${
                      alert.severity === "critical"
                        ? "bg-[#f7768e]/10 border-[#f7768e]/20 text-[#f7768e]"
                        : "bg-[#e0af68]/10 border-[#e0af68]/20 text-[#e0af68]"
                    }`}
                  >
                    <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${alert.severity === "critical" ? "text-[#f7768e]" : "text-[#e0af68]"}`} />
                    <div className="flex-1 space-y-0.5 min-w-0">
                      <p className="font-medium line-clamp-2 leading-tight">{alert.message}</p>
                      <div className="flex items-center gap-1.5 text-[9px] text-[#565f89] font-mono">
                        <span>{alert.deviceIp}</span>
                        <span>•</span>
                        <span>{alert.timestamp}</span>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </WindowCard>
      </div>

      {/* Window 4: Real-Time Threat Diagnostics Table */}
      <WindowCard
        id="dash_threats"
        title="Real-Time Threat Diagnostics"
        icon={<ShieldCheck className="w-4 h-4 text-[#bb9af7]" />}
        subtitle="Policy flags, socket anomalies, and intrusion prevention audits"
        defaultHeight={280}
        minHeight={180}
        maxHeight={600}
        actions={
          <button
            onClick={() => onSelectTab("security")}
            className="flex items-center gap-0.5 text-[10px] text-[#7aa2f7] hover:text-[#89ddff] font-bold transition cursor-pointer border border-[#24283b] bg-[#1a1b26] px-2 py-0.5 rounded"
          >
            Security Center
            <ChevronRight className="w-3 h-3" />
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] text-[#a9b1d6]">
            <thead className="bg-[#101216] text-[#565f89] uppercase tracking-wider text-[9px] font-bold border-b border-[#24283b] sticky top-0">
              <tr>
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Target Host / Node</th>
                <th className="py-2 px-3">Diagnostic Threat Details</th>
                <th className="py-2 px-3">Severity</th>
                <th className="py-2 px-3">Mitigation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24283b]/40">
              <AnimatePresence initial={false}>
                {threatLogs.slice(0, 8).map((log) => (
                  <motion.tr
                    key={log.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="hover:bg-[#24283b]/20 transition"
                  >
                    <td className="py-2 px-3 font-mono text-[#565f89] text-[10px] whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-2 px-3 font-bold text-slate-200 whitespace-nowrap">{log.host}</td>
                    <td className="py-2 px-3 text-[#a9b1d6] font-medium">{log.message}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                        log.severity === "Critical" 
                          ? "bg-[#f7768e]/10 text-[#f7768e] border-[#f7768e]/20" 
                          : log.severity === "Warning"
                          ? "bg-[#e0af68]/10 text-[#e0af68] border-[#e0af68]/20"
                          : "bg-[#7aa2f7]/10 text-[#7aa2f7] border-[#7aa2f7]/20"
                      }`}>
                        {log.severity}
                      </span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="flex items-center gap-1 text-[#9ece6a] font-bold text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#9ece6a]"></span>
                        {log.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </WindowCard>
    </div>
  );
}
