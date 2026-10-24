import { execFile } from "node:child_process";
import { isIP } from "node:net";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

const DEFAULT_MAX_BUFFER = 8 * 1024 * 1024;

export function run(
  file: string,
  args: string[],
  timeoutMs = 15000,
  maxBuffer = DEFAULT_MAX_BUFFER
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        timeout: timeoutMs,
        maxBuffer,
        windowsHide: true,
        encoding: "utf8",
      },
      (error, stdout, stderr) => {
        if (error && typeof (error as NodeJS.ErrnoException).code === "string") {
          reject(error);
          return;
        }
        resolve({
          code: error ? (error.code as unknown as number) || 1 : 0,
          stdout: stdout || "",
          stderr: stderr || "",
        });
      }
    );
  });
}

const POWERSHELL = process.env.SystemRoot
  ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
  : "powershell.exe";

export async function powershell(
  script: string,
  timeoutMs = 20000
): Promise<string> {
  const result = await run(
    POWERSHELL,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ],
    timeoutMs
  );
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || `PowerShell exited with ${result.code}`);
  }
  return result.stdout.replace(/^\uFEFF/, "").trim();
}

export async function powershellJson<T>(
  script: string,
  timeoutMs = 20000
): Promise<T> {
  const text = await powershell(script, timeoutMs);
  if (!text) return [] as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`PowerShell returned invalid JSON: ${text.slice(0, 300)}`);
  }
}

export function compactJson(value: unknown): string {
  return JSON.stringify(value);
}

export function isLoopbackAddress(address: string): boolean {
  return (
    address === "::1" ||
    address === "0:0:0:0:0:0:0:1" ||
    address.startsWith("127.")
  );
}

export function isPrivateIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const parts = address.split(".").map(Number);
  if (parts.some((part) => Number.isNaN(part))) return false;
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254) ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19))
  );
}

export function isValidIpOrHostname(value: string): boolean {
  if (!value || value.length > 253) return false;
  if (isIP(value)) return true;
  return /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(value);
}

export function isBlockableRemoteIp(ip: string): boolean {
  if (isIP(ip) !== 4) return false;
  if (isLoopbackAddress(ip) || isPrivateIpv4(ip)) return false;
  const parts = ip.split(".").map(Number);
  if (parts[0] === 0 || parts[0] >= 224) return false;
  return true;
}

export function sanitizeText(value: unknown, max = 500): string {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseCsvLine(line: string, delimiter = "\t"): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}
