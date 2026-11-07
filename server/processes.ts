import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ProcessInfo {
  pid: number;
  parentPid: number | null;
  name: string;
  cpuSeconds: number;
  memoryMb: number;
  threads: number;
  status: string;
  path: string;
  commandLine: string;
}

/**
 * Read the real Windows process table. CPU is total processor time (seconds),
 * not a sampled percentage; the UI labels it accordingly rather than inventing
 * a number. Requires no elevation to list processes.
 */
export async function listProcesses(): Promise<ProcessInfo[]> {
  const command = [
    "$ErrorActionPreference='Stop';",
    "$cim=@{};",
    "Get-CimInstance Win32_Process | ForEach-Object { $cim[[int]$_.ProcessId]=$_ };",
    "$out=foreach($p in Get-Process){",
    "  $c=$cim[[int]$p.Id];",
    "  [pscustomobject]@{",
    "    Id=[int]$p.Id;",
    "    ParentPid=$(if($c){[int]$c.ParentProcessId}else{$null});",
    "    ProcessName=$p.ProcessName;",
    "    CPU=$p.CPU;",
    "    WorkingSet64=$p.WorkingSet64;",
    "    Threads=@($p.Threads).Count;",
    "    Responding=$p.Responding;",
    "    Path=$p.Path;",
    "    CommandLine=$(if($c){[string]$c.CommandLine}else{''})",
    "  }",
    "};",
    "$out | ConvertTo-Json -Compress",
  ].join(" ");
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    timeout: 15000,
  });
  const parsed = JSON.parse(stdout || "[]");
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows
    .filter((row: any) => row && Number.isFinite(Number(row.Id)))
    .map((row: any) => ({
      pid: Number(row.Id),
      parentPid: Number.isFinite(Number(row.ParentPid)) && Number(row.ParentPid) > 0 ? Number(row.ParentPid) : null,
      name: String(row.ProcessName || "unknown"),
      cpuSeconds: Math.max(0, Number(row.CPU) || 0),
      memoryMb: Math.round((Number(row.WorkingSet64) || 0) / 1048576 * 10) / 10,
      threads: Array.isArray(row.Threads) ? row.Threads.length : Number(row.Threads) || 0,
      status: row.Responding === false ? "Not responding" : "Running",
      path: String(row.Path || ""),
      commandLine: String(row.CommandLine || ""),
    }))
    .sort((a, b) => b.memoryMb - a.memoryMb);
}

const PROTECTED_PIDS = new Set([0, 4]);
const PROTECTED_NAMES = new Set([
  "system",
  "idle",
  "csrss",
  "wininit",
  "winlogon",
  "services",
  "lsass",
  "smss",
  "netguard",
  "explorer",
]);

export function assertProcessCanBeStopped(pid: number, name: string): void {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error("Invalid process id.");
  if (PROTECTED_PIDS.has(pid) || pid === process.pid) throw new Error("That process is protected.");
  if (PROTECTED_NAMES.has(name.replace(/\.exe$/i, "").toLowerCase())) {
    throw new Error("That process is a protected system process.");
  }
}
