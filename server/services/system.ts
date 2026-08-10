import os from "os";
import { run, ExecResult } from "../lib/exec";
import { getDefaultInterface } from "./network";

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

function parseDf(output: string): { total: number; free: number } {
  for (const raw of output.split("\n")) {
    const parts = raw.trim().split(/\s+/);
    if (parts.length < 4 || !parts[0].startsWith("/dev/")) continue;
    const totalKb = parseInt(parts[1], 10);
    const freeKb = parseInt(parts[3], 10);
    if (!Number.isNaN(totalKb) && !Number.isNaN(freeKb) && totalKb > 0) {
      return { total: totalKb * 1024, free: freeKb * 1024 };
    }
  }
  return { total: 0, free: 0 };
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const cpus = os.cpus();
  const totalMemBytes = os.totalmem();
  const freeMemBytes = os.freemem();
  const usedMemPercent = totalMemBytes ? Math.round(((totalMemBytes - freeMemBytes) / totalMemBytes) * 100) : 0;

  const dfRes = await run("/bin/df", ["-k", "/"], { timeout: 8000 });
  const disk = parseDf(dfRes.stdout);
  const diskUsedPercent = disk.total ? Math.round(((disk.total - disk.free) / disk.total) * 100) : 0;

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

export async function getProcesses(limit = 60): Promise<SystemProcess[]> {
  const res: ExecResult = await run("/bin/ps", ["-axo", "pid,ppid,%cpu,%mem,comm"], {
    timeout: 8000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const totalMemMB = os.totalmem() / (1024 * 1024);
  const processes: SystemProcess[] = [];
  if (!res.ok) return processes;

  const lines = res.stdout.split("\n").slice(1);
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+(.+)$/);
    if (!m) continue;
    const pid = parseInt(m[1], 10);
    const cpu = parseFloat(m[3]);
    const memPct = parseFloat(m[4]);
    processes.push({
      pid,
      ppid: parseInt(m[2], 10),
      cpu,
      memory: Math.round((memPct / 100) * totalMemMB),
      name: m[5].trim(),
      status: "Running",
      publisher: "",
      disk: 0,
      network: 0,
    });
  }

  return processes.sort((a, b) => b.cpu - a.cpu).slice(0, limit);
}

export async function getBandwidth(sampleMs = 1000): Promise<BandwidthSample> {
  const iface = getDefaultInterface();
  const readCounters = async (): Promise<NetstatIf[]> => {
    const res = await run("/usr/sbin/netstat", ["-ib"], { timeout: 8000 });
    if (!res.ok) return [];
    return parseNetstatIb(res.stdout).filter((n) => n.name !== "lo0");
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
    if (iface === b.name) {
      rxTotal = rx;
      txTotal = tx;
    }
  }

  const rxMbps = Number(((rxTotal * 8) / seconds / 1_000_000).toFixed(2));
  const txMbps = Number(((txTotal * 8) / seconds / 1_000_000).toFixed(2));
  return { interface: iface, rxMbps, txMbps, totalMbps: Number((rxMbps + txMbps).toFixed(2)) };
}
