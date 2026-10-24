import { Alert, FirewallRuleInfo } from "./types.js";
import { CreatedRule, createBlockRule, getFirewallRules, removeFirewallRule } from "./windows.js";
import { Store } from "./store.js";
import { isBlockableRemoteIp } from "./util.js";

export interface BlockResult {
  ip: string;
  direction: "Inbound" | "Outbound" | "Both";
  durationMinutes: number;
  rules: CreatedRule[];
}

export class PreventionService {
  private timers = new Map<string, NodeJS.Timeout>();
  private cachedRules: FirewallRuleInfo[] = [];
  private rulesRefreshedAt = 0;
  private rulesRefreshing = false;
  private store: Store;
  private getLocalAddresses: () => string[];
  private getGateway: () => string | null;

  constructor(
    store: Store,
    getLocalAddresses: () => string[],
    getGateway: () => string | null
  ) {
    this.store = store;
    this.getLocalAddresses = getLocalAddresses;
    this.getGateway = getGateway;
    void this.restoreRules();
  }

  private async restoreRules(): Promise<void> {
    try {
      const rules = await getFirewallRules();
      this.cachedRules = rules;
      this.rulesRefreshedAt = Date.now();
      for (const rule of rules) {
        const match = rule.description?.match(/expiresAt=([^\s;]+)/i);
        if (!match) continue;
        const expiresAt = Date.parse(match[1]);
        if (!Number.isFinite(expiresAt)) continue;
        const remaining = expiresAt - Date.now();
        if (remaining <= 0) {
          await this.unblock(rule.name, "startup-expiry").catch(() => undefined);
          continue;
        }
        const timer = setTimeout(() => {
          void this.unblock(rule.name, "expiry").catch(() => undefined);
        }, Math.min(remaining, 2_147_000_000));
        timer.unref();
        this.timers.set(rule.name, timer);
      }
    } catch {
      // Non-admin sessions can still see empty rules; the UI explains why.
    }
  }

  isArmed(): boolean {
    const settings = this.store.getSettings();
    return settings.preventionMode === "prevent";
  }

  private assertSafe(ip: string): void {
    if (!isBlockableRemoteIp(ip)) {
      throw new Error("Refusing to block private, loopback, multicast, or invalid addresses.");
    }
    if (this.getLocalAddresses().includes(ip)) throw new Error("Refusing to block this host.");
    if (this.getGateway() === ip) throw new Error("Refusing to block the default gateway.");
    if (this.store.getSettings().allowedRemoteIps.includes(ip)) {
      throw new Error("Address is in the allowlist.");
    }
  }

  async block(
    ip: string,
    direction: "Inbound" | "Outbound" | "Both" = "Both",
    durationMinutes?: number
  ): Promise<BlockResult> {
    this.assertSafe(ip);
    const settings = this.store.getSettings();
    const duration = Math.max(
      1,
      Math.min(1440, Math.round(durationMinutes ?? settings.blockDurationMinutes))
    );
    const rules = await createBlockRule(ip, direction, duration);
    for (const rule of rules) {
      const timer = setTimeout(() => {
        void this.unblock(rule.name, "expiry").catch(() => undefined);
      }, duration * 60_000);
      timer.unref();
      this.timers.set(rule.name, timer);
      this.cachedRules.push({
        id: rule.name,
        name: rule.name,
        displayName: `NetGuard Block ${rule.direction} ${ip}`,
        direction: rule.direction,
        action: "Block",
        enabled: true,
        remoteAddresses: [ip],
      });
    }
    this.rulesRefreshedAt = 0;
    this.store.audit("firewall.block", { ip, direction, duration, rules });
    return { ip, direction, durationMinutes: duration, rules };
  }

  async unblock(name: string, reason = "manual"): Promise<void> {
    await removeFirewallRule(name);
    const timer = this.timers.get(name);
    if (timer) clearTimeout(timer);
    this.timers.delete(name);
    this.cachedRules = this.cachedRules.filter((rule) => rule.name !== name);
    this.rulesRefreshedAt = 0;
    this.store.audit("firewall.unblock", { name, reason });
  }

  async listRules(): Promise<FirewallRuleInfo[]> {
    if (Date.now() - this.rulesRefreshedAt > 30000 && !this.rulesRefreshing) {
      this.rulesRefreshing = true;
      try {
        this.cachedRules = await getFirewallRules();
        this.rulesRefreshedAt = Date.now();
      } finally {
        this.rulesRefreshing = false;
      }
    }
    return this.cachedRules.map((rule) => ({ ...rule }));
  }

  getCachedRules(): FirewallRuleInfo[] {
    return this.cachedRules.map((rule) => ({ ...rule }));
  }

  async handleAlert(alert: Alert): Promise<void> {
    const settings = this.store.getSettings();
    if (settings.preventionMode !== "prevent" || !settings.autoBlock) return;
    if (alert.severity !== "high" && alert.severity !== "critical") return;
    if (!alert.sourceIp) return;
    if (settings.allowedRemoteIps.includes(alert.sourceIp)) return;
    try {
      const result = await this.block(alert.sourceIp, "Both", settings.blockDurationMinutes);
      this.store.updateAlert(alert.id, { status: "blocked" });
      this.store.audit("prevention.auto-block", {
        alertId: alert.id,
        ip: alert.sourceIp,
        rules: result.rules,
      });
    } catch (error) {
      this.store.audit("prevention.auto-block-failed", {
        alertId: alert.id,
        ip: alert.sourceIp,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  stop(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
