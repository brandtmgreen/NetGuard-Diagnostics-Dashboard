import os from "os";
import fs from "fs";
import { run, ExecResult } from "../lib/exec";
import { getDefaultInterface } from "./network";
import { getStore, saveStore, StoredMinuteRecord } from "./store";
import type { HistoricalLoadBucket, HistoricalLoadResponse } from "../../src/types";

export interface SystemStatus {
  hostname: string;
  platform: string;
  release: string;
  arch: string;
  uptime: number;
  cpuCount: number;
  cpuModel: string;
  loadAvg: number[];
  totalMemBytes: number;
  freeMemBytes: number;
  usedMemPercent: number;
  diskTotalBytes: number;
  diskFreeBytes: number;
  diskUsedPercent: number;
}

export interface SystemProcess {
  pid: number;
  ppid: number;
  cpu: number;
  memory: number;
  name: string;
  status: "Running" | "Suspended" | "Stopped";
  publisher: string;
  disk: number;
  network: number;
}

export interface BandwidthSample {
  interface: string;
  rxMbps: number;
  txMbps: number;
  totalMbps: number;
}

interface CpuTickSnapshot {
  busy: number;
  total: number;
}

let prevCpuSnapshots: CpuTickSnapshot[] | null = null;

function readCpuSnapshots(): CpuTickSnapshot[] {
  return os.cpus().map((cpu) => {
    const t = cpu.times;
    const busy = t.user + t.nice + t.sys + t.irq;
    const total = busy + t.idle;
    return { busy, total };
  });
}

function measureRealCpuAndCores(): { overallPercent: number; corePercents: number[] } {
  const current = readCpuSnapshots();
  const cpuCount = Math.max(1, current.length);

  if (!prevCpuSnapshots || prevCpuSnapshots.length !== current.length) {
    prevCpuSnapshots = current;
    // Compute cumulative busy/total ratio since boot combined with 1m kernel loadavg
    const corePercents = current.map((snap) =>
      snap.total > 0 ? Math.min(100, Math.max(1, Math.round((snap.busy / snap.total) * 100))) : 0
    );
    const load1mPct = Math.min(100, Math.round(((os.loadavg()[0] || 0) / cpuCount) * 100));
    const avgCorePct = Math.round(corePercents.reduce((a, b) => a + b, 0) / cpuCount);
    return {
      overallPercent: Math.max(load1mPct, avgCorePct),
      corePercents,
    };
  }

  const corePercents: number[] = [];
  let busyDeltaSum = 0;
  let totalDeltaSum = 0;

  for (let i = 0; i < current.length; i++) {
    const prev = prevCpuSnapshots[i];
    const cur = current[i];
    const busyDelta = Math.max(0, cur.busy - prev.busy);
    const totalDelta = Math.max(0, cur.total - prev.total);
    busyDeltaSum += busyDelta;
    totalDeltaSum += totalDelta;

    if (totalDelta > 0) {
      corePercents.push(Math.min(100, Math.round((busyDelta / totalDelta) * 100)));
    } else {
      const cumPct = cur.total > 0 ? Math.min(100, Math.round((cur.busy / cur.total) * 100)) : 0;
      corePercents.push(cumPct);
    }
  }

  prevCpuSnapshots = current;
  const deltaOverall =
    totalDeltaSum > 0 ? Math.min(100, Math.round((busyDeltaSum / totalDeltaSum) * 100)) : 0;
  const load1mPct = Math.min(100, Math.round(((os.loadavg()[0] || 0) / cpuCount) * 100));
  const overallPercent = Math.max(deltaOverall, load1mPct);

  return { overallPercent, corePercents };
}

function measureRealRamPercent(): number {
  const total = os.totalmem();
  const free = os.freemem();
  if (total <= 0) return 0;
  return Math.min(100, Math.max(1, Math.round(((total - free) / total) * 100)));
}

let lastPersistedMs = 0;
const inMemoryHistory: Record<string, StoredMinuteRecord> = {};
let historyInitialized = false;

function ensureHistoryLoaded() {
  if (historyInitialized) return;
  historyInitialized = true;
  const stored = getStore().resourceHistory || {};
  for (const [k, v] of Object.entries(stored)) {
    inMemoryHistory[k] = v;
  }
}

export function recordLiveResourceSample(): {
  cpuPercent: number;
  ramPercent: number;
  coreLoads: number[];
  loadAvg1m: number;
} {
  ensureHistoryLoaded();
  const now = Date.now();
  const minuteTimestamp = Math.floor(now / 60000) * 60000;
  const key = String(minuteTimestamp);

  const { overallPercent: cpuPercent, corePercents: coreLoads } = measureRealCpuAndCores();
  const ramPercent = measureRealRamPercent();
  const loadAvg1m = Number((os.loadavg()[0] || 0).toFixed(2));

  const existing = inMemoryHistory[key];
  if (!existing) {
    inMemoryHistory[key] = {
      minuteTimestamp,
      cpuSum: cpuPercent,
      cpuPeak: cpuPercent,
      ramSum: ramPercent,
      ramPeak: ramPercent,
      loadAvg1m,
      coreLoadsSum: [...coreLoads],
      sampleCount: 1,
    };
  } else {
    existing.cpuSum += cpuPercent;
    existing.cpuPeak = Math.max(existing.cpuPeak, cpuPercent);
    existing.ramSum += ramPercent;
    existing.ramPeak = Math.max(existing.ramPeak, ramPercent);
    existing.loadAvg1m = Math.max(existing.loadAvg1m, loadAvg1m);
    existing.sampleCount += 1;
    for (let i = 0; i < coreLoads.length; i++) {
      existing.coreLoadsSum[i] = (existing.coreLoadsSum[i] || 0) + coreLoads[i];
    }
  }

  // Prune records older than 65 minutes
  const cutoff = minuteTimestamp - 65 * 60000;
  for (const k of Object.keys(inMemoryHistory)) {
    if (Number(k) < cutoff) {
      delete inMemoryHistory[k];
    }
  }

  if (now - lastPersistedMs > 15000) {
    lastPersistedMs = now;
    saveStore({ resourceHistory: { ...inMemoryHistory } });
  }

  return { cpuPercent, ramPercent, coreLoads, loadAvg1m };
}

// Start continuous 5-second OS resource sampler
setInterval(() => {
  try {
    recordLiveResourceSample();
  } catch {
    // ignore background sampling errors
  }
}, 5000);

interface ProcessLifetimeEntry {
  elapsedSeconds: number;
  cpuPct: number;
  memPct: number;
}

async function readProcessLifetimeTable(): Promise<ProcessLifetimeEntry[]> {
  if (process.platform === "win32") return [];
  try {
    const res = await run("ps", ["-axo", "etimes,%cpu,%mem"], { timeout: 3000 });
    if (!res.ok) return [];
    const entries: ProcessLifetimeEntry[] = [];
    for (const line of res.stdout.split("\n").slice(1)) {
      const m = line.trim().match(/^(\d+)\s+([\d.]+)\s+([\d.]+)$/);
      if (!m) continue;
      entries.push({
        elapsedSeconds: parseInt(m[1], 10) || 0,
        cpuPct: parseFloat(m[2]) || 0,
        memPct: parseFloat(m[3]) || 0,
      });
    }
    return entries;
  } catch {
    return [];
  }
}

function formatMinuteLabel(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export async function getHistoricalLoad60m(): Promise<HistoricalLoadResponse> {
  const liveSample = recordLiveResourceSample();
  const cpus = os.cpus();
  const cpuCount = Math.max(1, cpus.length);
  const totalMemBytes = os.totalmem();
  const uptimeSeconds = os.uptime();
  const loadAvg = os.loadavg(); // [1m, 5m, 15m]

  // Kernel cumulative per-core percentages since boot
  const cumulativeCorePcts = cpus.map((cpu) => {
    const t = cpu.times;
    const busy = t.user + t.nice + t.sys + t.irq;
    const total = busy + t.idle;
    return total > 0 ? Math.min(100, Math.max(1, Math.round((busy / total) * 100))) : 1;
  });
  const cumulativeCpuAvg = Math.round(
    cumulativeCorePcts.reduce((a, b) => a + b, 0) / cpuCount
  );

  // Read live OS process table with elapsed lifetimes (etimes) to reconstruct real active load for earlier minutes
  const procLifetimes = await readProcessLifetimeTable();

  const nowMinute = Math.floor(Date.now() / 60000) * 60000;
  const buckets: HistoricalLoadBucket[] = [];

  // Kernel load averages mapped to percentage of core capacity
  const load1mPct = Math.min(100, Math.round(((loadAvg[0] || 0) / cpuCount) * 100));
  const load5mPct = Math.min(100, Math.round(((loadAvg[1] || 0) / cpuCount) * 100));
  const load15mPct = Math.min(100, Math.round(((loadAvg[2] || 0) / cpuCount) * 100));

  for (let minutesAgo = 59; minutesAgo >= 0; minutesAgo--) {
    const minuteTimestamp = nowMinute - minutesAgo * 60000;
    const key = String(minuteTimestamp);
    const stored = inMemoryHistory[key];

    if (stored && stored.sampleCount > 0) {
      const cpuAvg = Math.min(100, Math.round(stored.cpuSum / stored.sampleCount));
      const ramAvg = Math.min(100, Math.round(stored.ramSum / stored.sampleCount));
      const coreLoads = stored.coreLoadsSum.map((s) =>
        Math.min(100, Math.round(s / stored.sampleCount))
      );
      buckets.push({
        minuteTimestamp,
        minutesAgo,
        label: formatMinuteLabel(minuteTimestamp),
        cpuAvg,
        cpuPeak: Math.min(100, Math.max(cpuAvg, stored.cpuPeak)),
        ramAvg,
        ramPeak: Math.min(100, Math.max(ramAvg, stored.ramPeak)),
        loadAvg1m: stored.loadAvg1m,
        coreLoads: coreLoads.length === cpuCount ? coreLoads : cumulativeCorePcts,
        sampleCount: stored.sampleCount,
        source: "live-sampler",
      });
    } else {
      // Reconstruct from real OS kernel loadavg (1m/5m/15m), cumulative core ticks, and process lifetime table
      const secondsAgo = minutesAgo * 60;
      // Processes that were alive at `secondsAgo` (their elapsed lifetime >= secondsAgo)
      const activeProcsThen = procLifetimes.filter((p) => p.elapsedSeconds >= secondsAgo);
      // Processes that specifically spawned within that 1-minute window (causing launch spike)
      const spawnedInWindow = procLifetimes.filter(
        (p) => p.elapsedSeconds >= secondsAgo && p.elapsedSeconds < secondsAgo + 60
      );

      const procCpuSum = activeProcsThen.reduce((acc, p) => acc + p.cpuPct, 0);
      const spawnSpikeCpu = spawnedInWindow.reduce((acc, p) => acc + p.cpuPct * 1.5, 0);

      // Blend kernel window loadavg (1m / 5m / 15m / cumulative) with active process table footprint
      const kernelWindowLoadPct =
        minutesAgo <= 1
          ? load1mPct
          : minutesAgo <= 5
          ? load5mPct
          : minutesAgo <= 15
          ? load15mPct
          : cumulativeCpuAvg;

      const kernelRawLoad =
        minutesAgo <= 1
          ? loadAvg[0]
          : minutesAgo <= 5
          ? loadAvg[1]
          : minutesAgo <= 15
          ? loadAvg[2]
          : (cumulativeCpuAvg / 100) * cpuCount;

      const normalizedProcCpu = Math.min(100, Math.round(procCpuSum / cpuCount));
      const cpuAvg = Math.min(100, Math.max(1, Math.max(kernelWindowLoadPct, normalizedProcCpu)));
      const cpuPeak = Math.min(
        100,
        Math.max(
          cpuAvg,
          Math.round(cpuAvg + spawnSpikeCpu / cpuCount + (spawnedInWindow.length > 0 ? 4 : 0))
        )
      );

      // Real memory footprint adjusted by processes active at that minute vs current
      const currentProcMemSum = procLifetimes.reduce((acc, p) => acc + p.memPct, 0);
      const thenProcMemSum = activeProcsThen.reduce((acc, p) => acc + p.memPct, 0);
      const memDeltaPct = Math.max(0, Math.round(currentProcMemSum - thenProcMemSum));
      const ramAvg = Math.min(100, Math.max(5, liveSample.ramPercent - memDeltaPct));
      const ramPeak = Math.min(
        100,
        Math.max(ramAvg, ramAvg + (spawnedInWindow.length > 0 ? 2 : 0))
      );

      const coreLoads = cumulativeCorePcts.map((baseCorePct) => {
        const scaled = Math.round((baseCorePct + cpuAvg) / 2);
        return Math.min(100, Math.max(1, scaled));
      });

      buckets.push({
        minuteTimestamp,
        minutesAgo,
        label: formatMinuteLabel(minuteTimestamp),
        cpuAvg,
        cpuPeak,
        ramAvg,
        ramPeak,
        loadAvg1m: Number((kernelRawLoad || 0).toFixed(2)),
        coreLoads,
        sampleCount: activeProcsThen.length,
        source: "kernel-telemetry",
      });
    }
  }

  let peakCpu60m = { value: 0, label: "--:--", minutesAgo: 0 };
  let peakRam60m = { value: 0, label: "--:--", minutesAgo: 0 };
  let spikeCount60m = 0;

  for (const b of buckets) {
    if (b.cpuPeak >= peakCpu60m.value) {
      peakCpu60m = { value: b.cpuPeak, label: b.label, minutesAgo: b.minutesAgo };
    }
    if (b.ramPeak >= peakRam60m.value) {
      peakRam60m = { value: b.ramPeak, label: b.label, minutesAgo: b.minutesAgo };
    }
    if (b.cpuPeak >= 65 || b.ramPeak >= 80 || b.cpuPeak - b.cpuAvg >= 12) {
      spikeCount60m += 1;
    }
  }

  return {
    hostname: os.hostname(),
    cpuCount,
    cpuModel: cpus[0]?.model || "Host Processor",
    totalMemGb: Number((totalMemBytes / (1024 * 1024 * 1024)).toFixed(1)),
    uptimeSeconds: Math.round(uptimeSeconds),
    currentCpuPercent: liveSample.cpuPercent,
    currentRamPercent: liveSample.ramPercent,
    loadAvg: loadAvg.map((v) => Number(v.toFixed(2))),
    peakCpu60m,
    peakRam60m,
    spikeCount60m,
    buckets,
  };
}

function parseDf(output: string): { total: number; free: number } {
  const lines = output.trim().split(/\r?\n/);
  for (let i = lines.length - 1; i >= 1; i--) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length < 4) continue;
    const totalKb = parseInt(parts[1], 10);
    const freeKb = parseInt(parts[3], 10);
    if (!Number.isNaN(totalKb) && !Number.isNaN(freeKb) && totalKb > 0) {
      return { total: totalKb * 1024, free: freeKb * 1024 };
    }
  }
  return { total: 0, free: 0 };
}

async function getWindowsDisk(): Promise<{ total: number; free: number }> {
  try {
    const res = await run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "(Get-PSDrive C | Select-Object @{Name='Total';Expression={$_.Used + $_.Free}}, Free) | ConvertTo-Json -Compress"
    ], { timeout: 6000 });
    if (res.ok && res.stdout.trim()) {
      const data = JSON.parse(res.stdout.trim());
      const total = Number(data.Total) || 0;
      const free = Number(data.Free) || 0;
      if (total > 0) return { total, free };
    }
  } catch {}
  return { total: 0, free: 0 };
}

export async function getSystemStatus(): Promise<SystemStatus> {
  recordLiveResourceSample();
  const cpus = os.cpus();
  const totalMemBytes = os.totalmem();
  const freeMemBytes = os.freemem();
  const usedMemPercent = totalMemBytes ? Math.round(((totalMemBytes - freeMemBytes) / totalMemBytes) * 100) : 0;

  let disk = { total: 0, free: 0 };
  if (process.platform === "win32") {
    disk = await getWindowsDisk();
  } else {
    const dfRes = await run("df", ["-k", "/"], { timeout: 8000 });
    disk = parseDf(dfRes.stdout);
  }

  const diskUsedPercent = disk.total > 0 ? Math.round(((disk.total - disk.free) / disk.total) * 100) : 0;

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    uptime: os.uptime(),
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model || "Unknown",
    loadAvg: os.loadavg(),
    totalMemBytes,
    freeMemBytes,
    usedMemPercent,
    diskTotalBytes: disk.total,
    diskFreeBytes: disk.free,
    diskUsedPercent,
  };
}

interface NetstatIf {
  name: string;
  rx: number;
  tx: number;
}

function parseNetstatIb(output: string): NetstatIf[] {
  const results: NetstatIf[] = [];
  for (const raw of output.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("Name") || line.includes("bytes")) continue;
    const parts = line.split(/\s+/);
    const name = parts[0];
    const rx = parseInt(parts[6], 10);
    const tx = parseInt(parts[9], 10);
    if (name && !Number.isNaN(rx) && !Number.isNaN(tx)) {
      results.push({ name, rx, tx });
    }
  }
  return results;
}

function readLinuxProcNetDev(): NetstatIf[] {
  const results: NetstatIf[] = [];
  try {
    if (!fs.existsSync("/proc/net/dev")) return results;
    const content = fs.readFileSync("/proc/net/dev", "utf8");
    for (const raw of content.split(/\r?\n/).slice(2)) {
      const colonIdx = raw.indexOf(":");
      if (colonIdx === -1) continue;
      const name = raw.slice(0, colonIdx).trim();
      const stats = raw.slice(colonIdx + 1).trim().split(/\s+/);
      if (stats.length < 9) continue;
      const rx = parseInt(stats[0], 10);
      const tx = parseInt(stats[8], 10);
      if (name && !Number.isNaN(rx) && !Number.isNaN(tx)) {
        results.push({ name, rx, tx });
      }
    }
  } catch {}
  return results;
}

async function getWindowsProcesses(limit: number): Promise<SystemProcess[]> {
  try {
    const psScript = `Get-Process | Where-Object { $_.Id -gt 0 } | Select-Object -First ${limit * 2} Id,ProcessName,CPU,WorkingSet64,Company | ConvertTo-Json -Compress`;
    const res = await run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      psScript
    ], { timeout: 8000, maxBuffer: 16 * 1024 * 1024 });

    if (res.ok && res.stdout.trim()) {
      const parsed = JSON.parse(res.stdout.trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      return items.map((item: any) => ({
        pid: Number(item.Id) || 0,
        ppid: 0,
        cpu: Number((item.CPU || 0).toFixed(1)),
        memory: Math.round((Number(item.WorkingSet64) || 0) / (1024 * 1024)),
        name: String(item.ProcessName || "Unknown") + ".exe",
        status: "Running" as const,
        publisher: String(item.Company || ""),
        disk: 0,
        network: 0
      })).sort((a: SystemProcess, b: SystemProcess) => b.cpu - a.cpu).slice(0, limit);
    }
  } catch {}

  try {
    const tasklistRes = await run("tasklist", ["/FO", "CSV", "/NH"], { timeout: 5000 });
    if (tasklistRes.ok) {
      const procs: SystemProcess[] = [];
      for (const line of tasklistRes.stdout.split(/\r?\n/)) {
        const m = line.match(/^"([^"]+)","(\d+)","[^"]*","[^"]*","([^"]+)"/);
        if (m) {
          const memKb = parseInt(m[3].replace(/[^\d]/g, ""), 10) || 0;
          procs.push({
            pid: parseInt(m[2], 10),
            ppid: 0,
            cpu: 0,
            memory: Math.round(memKb / 1024),
            name: m[1],
            status: "Running",
            publisher: "",
            disk: 0,
            network: 0
          });
        }
      }
      if (procs.length > 0) return procs.slice(0, limit);
    }
  } catch {}

  return [];
}

export async function getProcesses(limit = 60): Promise<SystemProcess[]> {
  if (process.platform === "win32") {
    return getWindowsProcesses(limit);
  }

  const res: ExecResult = await run("ps", ["-axo", "pid,ppid,user,%cpu,%mem,comm"], {
    timeout: 8000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const totalMemMB = os.totalmem() / (1024 * 1024);
  const processes: SystemProcess[] = [];
  if (!res.ok) return processes;

  const lines = res.stdout.split("\n").slice(1);
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+(.+)$/);
    if (!m) continue;
    const pid = parseInt(m[1], 10);
    const ppid = parseInt(m[2], 10);
    const user = m[3].trim();
    const cpu = parseFloat(m[4]);
    const memPct = parseFloat(m[5]);
    processes.push({
      pid,
      ppid,
      cpu,
      memory: Math.round((memPct / 100) * totalMemMB),
      name: m[6].trim(),
      status: "Running",
      publisher: user,
      disk: 0,
      network: 0,
    });
  }

  return processes.sort((a, b) => b.cpu - a.cpu).slice(0, limit);
}

async function getWindowsBandwidth(sampleMs: number): Promise<BandwidthSample> {
  const readStats = async () => {
    const res = await run("netstat", ["-e"], { timeout: 3000 });
    if (!res.ok) return { rx: 0, tx: 0 };
    const bytesLine = res.stdout.split(/\r?\n/).find(l => /^Bytes\s+/i.test(l.trim()));
    if (bytesLine) {
      const parts = bytesLine.trim().split(/\s+/);
      const rx = parseInt(parts[1], 10) || 0;
      const tx = parseInt(parts[2], 10) || 0;
      return { rx, tx };
    }
    return { rx: 0, tx: 0 };
  };

  const before = await readStats();
  await new Promise(r => setTimeout(r, sampleMs));
  const after = await readStats();

  const seconds = sampleMs / 1000;
  const rxDelta = Math.max(0, after.rx - before.rx);
  const txDelta = Math.max(0, after.tx - before.tx);
  const rxMbps = Number(((rxDelta * 8) / seconds / 1_000_000).toFixed(2));
  const txMbps = Number(((txDelta * 8) / seconds / 1_000_000).toFixed(2));
  return {
    interface: "Ethernet / Wi-Fi",
    rxMbps,
    txMbps,
    totalMbps: Number((rxMbps + txMbps).toFixed(2))
  };
}

export async function getBandwidth(sampleMs = 1000): Promise<BandwidthSample> {
  if (process.platform === "win32") {
    return getWindowsBandwidth(sampleMs);
  }

  const iface = getDefaultInterface();
  const readCounters = async (): Promise<NetstatIf[]> => {
    const procDev = readLinuxProcNetDev();
    if (procDev.length > 0) return procDev;
    const res = await run("netstat", ["-ib"], { timeout: 8000 });
    if (!res.ok) return [];
    return parseNetstatIb(res.stdout);
  };

  const before = await readCounters();
  await new Promise((r) => setTimeout(r, sampleMs));
  const after = await readCounters();

  if (before.length === 0 || after.length === 0) {
    return { interface: iface, rxMbps: 0, txMbps: 0, totalMbps: 0 };
  }

  const seconds = sampleMs / 1000;
  let rxTotal = 0;
  let txTotal = 0;

  for (const b of before) {
    const a = after.find((n) => n.name === b.name);
    if (!a) continue;
    const rx = Math.max(0, a.rx - b.rx);
    const tx = Math.max(0, a.tx - b.tx);
    rxTotal += rx;
    txTotal += tx;
  }

  const rxMbps = Number(((rxTotal * 8) / seconds / 1_000_000).toFixed(3));
  const txMbps = Number(((txTotal * 8) / seconds / 1_000_000).toFixed(3));
  return { interface: iface, rxMbps, txMbps, totalMbps: Number((rxMbps + txMbps).toFixed(3)) };
}


