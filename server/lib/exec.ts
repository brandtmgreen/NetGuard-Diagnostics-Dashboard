import { execFile } from "child_process";

export interface ExecOptions {
  timeout?: number;
  sudo?: boolean;
  maxBuffer?: number;
}

export interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
  ok: boolean;
  timedOut: boolean;
  denied: boolean;
}

const SUDO_DENIED_MARKERS = [
  "a password is required",
  "password is required",
  "not allowed to run as root",
  "sorry, you must have a tty to run sudo",
  "sudo: 3 incorrect password attempts",
];

export function isPrivateIp(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  const [a, b] = parts.map(Number);
  return (
    ip === "localhost" ||
    ip === "127.0.0.1" ||
    ip === "0.0.0.0" ||
    ip === "255.255.255.255" ||
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

export function run(
  cmd: string,
  args: string[] = [],
  opts: ExecOptions = {}
): Promise<ExecResult> {
  const timeout = opts.timeout ?? 15000;
  const maxBuffer = opts.maxBuffer ?? 8 * 1024 * 1024;

  return new Promise((resolve) => {
    const fullArgs = opts.sudo ? ["-n", cmd, ...args] : args;
    const fullCmd = opts.sudo ? "sudo" : cmd;

    execFile(
      fullCmd,
      fullArgs,
      { timeout, maxBuffer, encoding: "utf8" as const },
      (err, stdout, stderr) => {
        if (!err) {
          resolve({ code: 0, stdout, stderr, ok: true, timedOut: false, denied: false });
          return;
        }
        const anyErr = err as NodeJS.ErrnoException & {
          code?: number | string;
          killed?: boolean;
          signal?: string | null;
          stdout?: string;
          stderr?: string;
        };
        const code = typeof anyErr.code === "number" ? anyErr.code : null;
        const out = (anyErr.stdout as string | undefined) ?? stdout ?? "";
        const errOut = (anyErr.stderr as string | undefined) ?? stderr ?? "";
        const msg = `${errOut}\n${anyErr.message ?? ""}`;
        const denied = opts.sudo
          ? SUDO_DENIED_MARKERS.some((m) => msg.toLowerCase().includes(m.toLowerCase()))
          : false;
        resolve({
          code,
          stdout: out,
          stderr: errOut,
          ok: false,
          timedOut: anyErr.killed === true,
          denied,
        });
      }
    );
  });
}

export async function which(binary: string): Promise<string | null> {
  const res = await run("/usr/bin/which", [binary], { timeout: 5000 });
  const first = res.stdout.trim().split("\n")[0];
  return first && res.ok ? first : null;
}

export async function findBinary(name: string, candidates: string[]): Promise<string | null> {
  for (const c of candidates) {
    if (c.startsWith("/")) {
      const probe = await run(c, ["--version"], { timeout: 3000 });
      if (probe.ok || (probe.code !== null && probe.code <= 1)) return c;
      continue;
    }
    const found = await which(c);
    if (found) return found;
  }
  return null;
}
