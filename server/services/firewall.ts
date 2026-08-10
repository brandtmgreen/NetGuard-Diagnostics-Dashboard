import fs from "fs";
import path from "path";
import { run, ExecResult } from "../lib/exec";
import type { FirewallRule } from "../../src/types";
import { getStore, saveStore } from "./store";

const PF_CONF = "/etc/pf.conf";
const PF_ANCHOR_FILE = "/etc/pf.anchors/netguard";
const PF_ANCHOR_NAME = "netguard";

export interface FirewallApplyResult {
  success: boolean;
  applied: number;
  message: string;
  output?: string;
  error?: string;
}

function ruleToPf(rule: FirewallRule): string {
  const proto = rule.protocol === "All" ? "proto { tcp udp }" : `proto ${rule.protocol.toLowerCase()}`;
  const direction = rule.direction === "Inbound" ? "in" : "out";
  const action = rule.action === "Allow" ? "pass" : "block drop";
  const ports = rule.port.includes(",") || rule.port.includes("-")
    ? `port { ${rule.port.split(",").map((p) => p.trim()).join(" ")} }`
    : `port ${rule.port}`;
  return `${action} ${direction} quick log ${proto} from any to any ${ports}`;
}

function buildAnchorFile(rules: FirewallRule[]): string {
  const enabled = rules.filter((r) => r.enabled);
  const lines: string[] = [
    `# NetGuard dynamic firewall anchor (auto-generated ${new Date().toISOString()})`,
  ];
  for (const r of enabled) {
    lines.push(ruleToPf(r));
  }
  return lines.join("\n") + "\n";
}

function ensurePfConf(): ExecResult | { ok: false; stderr: string } | { ok: true } {
  let content = "";
  try {
    content = fs.readFileSync(PF_CONF, "utf8");
  } catch {
    return { ok: false, stderr: `Cannot read ${PF_CONF}. Is pf configured?` };
  }
  const anchorLine = `anchor "${PF_ANCHOR_NAME}"`;
  const loadLine = `load anchor "${PF_ANCHOR_NAME}" from "${PF_ANCHOR_FILE}"`;
  if (!content.includes(anchorLine)) {
    content = content.trimEnd() + `\n\n${anchorLine}\n${loadLine}\n`;
    try {
      fs.writeFileSync(PF_CONF, content, "utf8");
    } catch (err: any) {
      return { ok: false, stderr: `Failed to update ${PF_CONF}: ${err.message}` };
    }
  }
  return { ok: true };
}

export async function applyFirewallRules(rules?: FirewallRule[]): Promise<FirewallApplyResult> {
  const store = getStore();
  const effective = rules ?? store.firewallRules;

  if (effective.length === 0) {
    return { success: false, applied: 0, message: "No firewall rules to apply.", error: "empty" };
  }

  const confCheck = ensurePfConf();
  if (!confCheck.ok) {
    return { success: false, applied: 0, message: "Failed to update pf.conf", error: (confCheck as any).stderr };
  }

  try {
    fs.mkdirSync(path.dirname(PF_ANCHOR_FILE), { recursive: true });
    fs.writeFileSync(PF_ANCHOR_FILE, buildAnchorFile(effective), "utf8");
    fs.chmodSync(PF_ANCHOR_FILE, 0o644);
  } catch (err: any) {
    return { success: false, applied: 0, message: "Failed to write pf anchor file.", error: err.message };
  }

  const enable = await run("/sbin/pfctl", ["-e"], { sudo: true, timeout: 8000 });
  const load = await run("/sbin/pfctl", ["-f", PF_CONF], { sudo: true, timeout: 8000 });
  const anchor = await run("/sbin/pfctl", ["-a", PF_ANCHOR_NAME, "-f", PF_ANCHOR_FILE], {
    sudo: true,
    timeout: 8000,
  });

  if (enable.denied || load.denied || anchor.denied) {
    return {
      success: false,
      applied: 0,
      message: "Firewall rules require elevated privileges. Grant them once with: sudo scripts/setup-sudo.sh",
      error: "sudo denied",
    };
  }

  const applied = effective.filter((r) => r.enabled).length;
  const messages = [
    `pf enabled: ${enable.code === 0 || enable.stdout.includes("already enabled") ? "yes" : enable.stderr.trim() || "yes"}`,
    `ruleset load: ${load.ok ? "ok" : load.stderr.trim()}`,
    `anchor load: ${anchor.ok ? "ok" : anchor.stderr.trim()}`,
  ];

  if (!load.ok || !anchor.ok) {
    return {
      success: false,
      applied,
      message: "pf reported errors while applying rules.",
      output: messages.join("\n"),
      error: load.stderr + anchor.stderr,
    };
  }

  saveStore({ firewallRules: effective });
  return {
    success: true,
    applied,
    message: `Applied ${applied} pf firewall rule(s) on this host.`,
    output: messages.join("\n"),
  };
}

export function removeFirewallRule(ruleId: string): FirewallRule[] {
  const store = getStore();
  const remaining = store.firewallRules.filter((r) => r.id !== ruleId);
  saveStore({ firewallRules: remaining });
  return remaining;
}

export function getAppliedRules(): FirewallRule[] {
  return getStore().firewallRules;
}

export async function readActiveRules(): Promise<string> {
  const res = await run("/sbin/pfctl", ["-a", PF_ANCHOR_NAME, "-s", "rules"], {
    sudo: true,
    timeout: 8000,
  });
  if (res.denied) return "Requires elevated privileges (sudo scripts/setup-sudo.sh).";
  if (!res.ok) return res.stderr.trim() || "No active NetGuard pf rules.";
  return res.stdout.trim();
}
