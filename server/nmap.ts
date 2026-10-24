import dns from "node:dns/promises";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { NmapPort, NmapResult } from "./types.js";
import { isLoopbackAddress, isPrivateIpv4, isValidIpOrHostname, nowIso, sanitizeText } from "./util.js";
import { randomUUID } from "node:crypto";

const DEFAULT_NMAP = "C:\\Program Files (x86)\\Nmap\\nmap.exe";

const PROFILES: Record<string, string[]> = {
  quick: ["-T4", "-F", "-Pn"],
  intense: ["-T4", "-A", "-Pn"],
  vuln: ["-T4", "--script", "vuln", "-Pn"],
  os: ["-T4", "-O", "--osscan-guess", "-Pn"],
};

export function findNmap(): string | null {
  const configured = process.env.NMAP_PATH;
  if (configured && fs.existsSync(configured)) return configured;
  if (fs.existsSync(DEFAULT_NMAP)) return DEFAULT_NMAP;
  return null;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parsePorts(xml: string): NmapPort[] {
  const ports: NmapPort[] = [];
  const regex = /<port\s+protocol="([^"]+)"\s+portid="(\d+)"[^>]*>([\s\S]*?)<\/port>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml))) {
    const body = match[3];
    const state = body.match(/<state\s+state="([^"]+)"/)?.[1] || "unknown";
    const service = body.match(/<service\s+([^>]*)\/?>/)?.[1] || "";
    const name = service.match(/name="([^"]*)"/)?.[1] || "";
    const product = service.match(/product="([^"]*)"/)?.[1] || "";
    const version = service.match(/version="([^"]*)"/)?.[1] || "";
    ports.push({
      port: Number(match[2]),
      protocol: match[1],
      state,
      service: decodeXml(name),
      version: decodeXml([product, version].filter(Boolean).join(" ")),
    });
  }
  return ports;
}

async function assertTargetAllowed(target: string, allowPublicScan: boolean): Promise<void> {
  if (!isValidIpOrHostname(target)) throw new Error("Invalid scan target.");
  let resolved = target;
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(target)) {
    const lookup = await dns.lookup(target, { family: 4 });
    resolved = lookup.address;
  }
  if (isLoopbackAddress(resolved) || isPrivateIpv4(resolved)) return;
  if (!allowPublicScan) {
    throw new Error("Public targets are disabled. Enable public scanning in Settings only for systems you are authorized to test.");
  }
}

export async function runNmap(
  target: string,
  profile: string,
  allowPublicScan: boolean
): Promise<NmapResult> {
  const nmap = findNmap();
  if (!nmap) throw new Error("nmap was not found. Install Nmap or set NMAP_PATH.");
  const argsForProfile = PROFILES[profile];
  if (!argsForProfile) throw new Error("Unknown scan profile.");
  await assertTargetAllowed(target, allowPublicScan);

  const args = [...argsForProfile, "-oX", "-", target];
  const id = randomUUID();
  const timestamp = nowIso();

  return new Promise<NmapResult>((resolve) => {
    const child = spawn(nmap, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      stderr += "\nScan timed out after 180 seconds.";
    }, 180000);

    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        id,
        target,
        profile,
        timestamp,
        status: "failed",
        ports: [],
        rawOutput: sanitizeText(`${stdout}\n${stderr}`, 20000),
        error: error.message,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const ports = parsePorts(stdout);
      resolve({
        id,
        target,
        profile,
        timestamp,
        status: code === 0 ? "completed" : "failed",
        ports,
        rawOutput: sanitizeText(stdout || stderr, 20000),
        ...(code === 0 ? {} : { error: sanitizeText(stderr || `nmap exited with ${code}`, 1000) }),
      });
    });
  });
}
