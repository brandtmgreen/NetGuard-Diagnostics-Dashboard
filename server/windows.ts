import { isIP } from "node:net";
import { FirewallRuleInfo } from "./types.js";
import { powershell, powershellJson, run, isBlockableRemoteIp } from "./util.js";

let adminCache: { value: boolean; at: number } | null = null;
let gatewayCache: { value: string | null; at: number } | null = null;

export async function getIsAdmin(): Promise<boolean> {
  if (adminCache && Date.now() - adminCache.at < 60000) return adminCache.value;
  const text = await powershell(
    "$p=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent()); $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"
  );
  const value = /^true$/i.test(text);
  adminCache = { value, at: Date.now() };
  return value;
}

export async function getGateway(): Promise<string | null> {
  if (gatewayCache && Date.now() - gatewayCache.at < 60000) return gatewayCache.value;
  try {
    const result = await run("route.exe", ["print", "-4"], 8000);
    const line = result.stdout
      .split(/\r?\n/)
      .find((row) => /^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+\d{1,3}(\.\d{1,3}){3}\s+/.test(row));
    const value = line ? (line.trim().split(/\s+/)[2] || null) : null;
    gatewayCache = { value, at: Date.now() };
    return value;
  } catch {
    return null;
  }
}

export async function getNeighbors(): Promise<
  Array<{ ip: string; mac: string; state: string; interfaceAlias: string }>
> {
  try {
    const result = await run("arp.exe", ["-a"], 8000);
    const neighbors: Array<{ ip: string; mac: string; state: string; interfaceAlias: string }> = [];
    let currentInterface = "";
    for (const line of result.stdout.split(/\r?\n/)) {
      const interfaceLine = line.match(/Interface:\s*([0-9.]+)/i);
      if (interfaceLine) {
        currentInterface = interfaceLine[1];
        continue;
      }
      const row = line.match(/^\s*(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-f-]{17})\s+(\S+)/i);
      if (row) {
        neighbors.push({
          ip: row[1],
          mac: row[2].replace(/-/g, ":").toUpperCase(),
          state: row[3],
          interfaceAlias: currentInterface,
        });
      }
    }
    return neighbors;
  } catch {
    return [];
  }
}

export async function getConnections(): Promise<
  Array<{
    localAddress: string;
    localPort: number;
    remoteAddress: string;
    remotePort: number;
    state: string;
    pid: number;
    processName: string;
  }>
> {
  try {
    const result = await run("netstat.exe", ["-ano"], 12000);
    const connections: Array<{
      localAddress: string;
      localPort: number;
      remoteAddress: string;
      remotePort: number;
      state: string;
      pid: number;
      processName: string;
    }> = [];
    for (const line of result.stdout.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const protocol = parts[0].toUpperCase();
      if (protocol !== "TCP" && protocol !== "UDP") continue;
      const local = parts[1];
      const remote = parts[2];
      const state = protocol === "TCP" ? parts[3] : "UDP";
      const pid = protocol === "TCP" ? parts[4] : parts[3];
      if (!local || !remote || !pid) continue;
      const splitEndpoint = (endpoint: string): { address: string; port: number } => {
        const index = endpoint.lastIndexOf(":");
        if (index <= 0) return { address: endpoint, port: 0 };
        return {
          address: endpoint.slice(0, index).replace(/^\[|\]$/g, ""),
          port: Number(endpoint.slice(index + 1)) || 0,
        };
      };
      const localEndpoint = splitEndpoint(local);
      const remoteEndpoint = splitEndpoint(remote);
      connections.push({
        localAddress: localEndpoint.address,
        localPort: localEndpoint.port,
        remoteAddress: remoteEndpoint.address,
        remotePort: remoteEndpoint.port,
        state: protocol.toUpperCase() === "UDP" ? "UDP" : String(state || ""),
        pid: Number(pid) || 0,
        processName: "",
      });
    }
    return connections;
  } catch {
    return [];
  }
}

export async function getFirewallRules(): Promise<FirewallRuleInfo[]> {
  try {
    const rows = await powershellJson<
      Array<{
        Name?: string;
        DisplayName?: string;
        Direction?: string;
        Action?: string;
        Enabled?: boolean | string;
        RemoteAddress?: string[] | string;
        Description?: string;
      }>
    >(
      "Get-NetFirewallRule -DisplayName 'NetGuard Block*' -ErrorAction SilentlyContinue | ForEach-Object { $r=$_; $a=$r | Get-NetFirewallAddressFilter; [pscustomobject]@{ Name=$r.Name; DisplayName=$r.DisplayName; Direction=[string]$r.Direction; Action=[string]$r.Action; Enabled=$r.Enabled; RemoteAddress=$a.RemoteAddress; Description=[string]$r.Description } } | ConvertTo-Json -Compress -Depth 4"
    );
    const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
    return list.map((row) => {
      const remote = Array.isArray(row.RemoteAddress)
        ? row.RemoteAddress
        : row.RemoteAddress
          ? [row.RemoteAddress]
          : [];
      return {
        id: String(row.Name || ""),
        name: String(row.Name || ""),
        displayName: String(row.DisplayName || ""),
        direction: String(row.Direction || ""),
        action: String(row.Action || ""),
        enabled: row.Enabled === true || String(row.Enabled).toLowerCase() === "true",
        remoteAddresses: remote.map(String),
        description: String(row.Description || ""),
      };
    });
  } catch {
    return [];
  }
}

export interface CreatedRule {
  name: string;
  direction: "Inbound" | "Outbound";
  ip: string;
}

export async function createBlockRule(
  ip: string,
  direction: "Inbound" | "Outbound" | "Both",
  durationMinutes: number
): Promise<CreatedRule[]> {
  if (!isBlockableRemoteIp(ip)) {
    throw new Error("Refusing to block a private, loopback, multicast, or invalid address.");
  }
  if (!(await getIsAdmin())) {
    throw new Error("Administrator privileges are required to change Windows Firewall.");
  }
  const safeIp = ip.replace(/[^0-9.]/g, "");
  const stamp = Date.now();
  const directions: Array<"Inbound" | "Outbound"> =
    direction === "Both" ? ["Inbound", "Outbound"] : [direction];
  const created: CreatedRule[] = [];

  for (const dir of directions) {
    const name = `NetGuard-${dir}-${safeIp.replace(/\./g, "-")}-${stamp}`;
    const display = `NetGuard Block ${dir} ${safeIp}`;
    const expiresAt = new Date(Date.now() + Math.max(1, durationMinutes) * 60_000).toISOString();
    const script = [
      "$ErrorActionPreference='Stop'",
      `$name='${name}'`,
      `$display='${display}'`,
      `New-NetFirewallRule -Name $name -DisplayName $display -Direction ${dir} -RemoteAddress '${safeIp}' -Action Block -Profile Any -Description 'NetGuard intrusion prevention; expiresAt=${expiresAt}' | Out-Null`,
      "Write-Output 'ok'",
    ].join("; ");
    await powershell(script, 30000);
    created.push({ name, direction: dir, ip: safeIp });
  }
  return created;
}

export async function removeFirewallRule(name: string): Promise<void> {
  if (!/^NetGuard-(Inbound|Outbound)-\d{1,3}(-\d{1,3}){3}-\d+$/.test(name)) {
    throw new Error("Invalid NetGuard rule name.");
  }
  if (!(await getIsAdmin())) {
    throw new Error("Administrator privileges are required to change Windows Firewall.");
  }
  await powershell(
    `$ErrorActionPreference='Stop'; Remove-NetFirewallRule -Name '${name}' -ErrorAction Stop; Write-Output 'ok'`,
    20000
  );
}
