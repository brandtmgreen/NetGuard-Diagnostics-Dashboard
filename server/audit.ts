import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type AuditStatus = "OK" | "SUGGESTION" | "WARNING" | "CRITICAL";

export interface AuditCheck {
  id: string;
  category: "Kernel & Boot" | "Authentication & Access" | "Network & Firewall" | "Services & Exposure" | "Logging & Updates";
  title: string;
  status: AuditStatus;
  currentValue: string;
  expectedValue: string;
  humanExplanation: string;
  remediationCommand?: string;
  riskImpact: "Low" | "Medium" | "High";
}

export interface SecurityAuditReport {
  auditId: string;
  timestamp: string;
  hostname: string;
  platform: string;
  score: number;
  totalChecks: number;
  okCount: number;
  suggestionCount: number;
  warningCount: number;
  criticalCount: number;
  checks: AuditCheck[];
}

async function powershell(command: string, timeout = 12000): Promise<string> {
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
    timeout,
  });
  return stdout.trim();
}

async function readJson<T>(command: string, timeout = 12000): Promise<T | null> {
  try {
    const output = await powershell(command, timeout);
    if (!output) return null;
    return JSON.parse(output) as T;
  } catch {
    return null;
  }
}

function asArray<T>(value: T | T[] | null): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function check(
  id: string,
  category: AuditCheck["category"],
  title: string,
  status: AuditStatus,
  currentValue: string,
  expectedValue: string,
  humanExplanation: string,
  riskImpact: AuditCheck["riskImpact"],
  remediationCommand?: string
): AuditCheck {
  return { id, category, title, status, currentValue, expectedValue, humanExplanation, riskImpact, ...(remediationCommand ? { remediationCommand } : {}) };
}

export async function runSecurityAudit(): Promise<SecurityAuditReport> {
  const checks: AuditCheck[] = [];

  const defender = await readJson<{
    AntivirusEnabled?: boolean;
    RealTimeProtectionEnabled?: boolean;
    AntivirusSignatureAge?: number;
  }>("$ErrorActionPreference='Stop'; Get-MpComputerStatus | Select-Object AntivirusEnabled,RealTimeProtectionEnabled,AntivirusSignatureAge | ConvertTo-Json -Compress");
  if (defender) {
    const enabled = defender.AntivirusEnabled === true && defender.RealTimeProtectionEnabled === true;
    const signatureAge = Number(defender.AntivirusSignatureAge ?? -1);
    const stale = Number.isFinite(signatureAge) && signatureAge > 7;
    checks.push(check(
      "DEF-001",
      "Services & Exposure",
      "Windows Defender real-time protection",
      enabled && !stale ? "OK" : "WARNING",
      `Antivirus ${defender.AntivirusEnabled ? "enabled" : "disabled"}, real-time ${defender.RealTimeProtectionEnabled ? "on" : "off"}, signature age ${signatureAge >= 0 ? `${signatureAge} days` : "unknown"}`,
      "Antivirus and real-time protection enabled; signatures <= 7 days old",
      enabled
        ? stale
          ? "Defender is active but its signatures are stale. Update signatures before relying on detection coverage."
          : "Windows Defender is active with real-time protection and a current signature set."
        : "Defender real-time protection is off or the antivirus engine is disabled. The host is relying on other controls.",
      enabled && !stale ? "Low" : "High",
      "Update-MpSignature; Set-MpPreference -DisableRealtimeMonitoring $false"
    ));
  } else {
    checks.push(check("DEF-001", "Services & Exposure", "Windows Defender status", "SUGGESTION", "Status unavailable", "Defender status readable", "The Defender status query did not return data. This can happen on servers with a third-party antivirus or a restricted PowerShell session.", "Medium"));
  }

  const firewall = asArray(await readJson<Array<{ Name?: string; Enabled?: boolean; DefaultInboundAction?: string }> | { Name?: string; Enabled?: boolean; DefaultInboundAction?: string }>(
    "$ErrorActionPreference='Stop'; Get-NetFirewallProfile | Select-Object Name,Enabled,DefaultInboundAction | ConvertTo-Json -Compress"
  ));
  if (firewall.length > 0) {
    const disabled = firewall.filter(profile => profile.Enabled === false);
    const summary = firewall.map(profile => `${profile.Name || "profile"}: ${profile.Enabled ? "on" : "off"}`).join(", ");
    checks.push(check(
      "FIRE-001",
      "Network & Firewall",
      "Windows Firewall profiles",
      disabled.length === 0 ? "OK" : "CRITICAL",
      summary,
      "Domain, Private and Public firewall profiles enabled",
      disabled.length === 0
        ? "All Windows Firewall profiles are enabled."
        : `These firewall profiles are disabled: ${disabled.map(profile => profile.Name).join(", ")}. Inbound traffic is not filtered on those networks.`,
      disabled.length === 0 ? "Low" : "High",
      "Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled True"
    ));
  } else {
    checks.push(check("FIRE-001", "Network & Firewall", "Windows Firewall profiles", "SUGGESTION", "Profiles unavailable", "Firewall profile state readable", "The firewall profile query returned no data. Check that the Windows Firewall service is running and PowerShell has permission.", "Medium"));
  }

  const uac = await readJson<{ EnableLUA?: number }>("$ErrorActionPreference='Stop'; Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System' | Select-Object EnableLUA | ConvertTo-Json -Compress");
  const uacOn = Number(uac?.EnableLUA) === 1;
  checks.push(check(
    "AUTH-001",
    "Authentication & Access",
    "User Account Control (UAC)",
    uacOn ? "OK" : "CRITICAL",
    uac ? `EnableLUA = ${uac.EnableLUA}` : "Registry value unavailable",
    "EnableLUA = 1",
    uacOn ? "UAC is enabled and will prompt before elevated changes." : "UAC is disabled, so processes can elevate without an explicit consent prompt.",
    uacOn ? "Low" : "High",
    "Set-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System' -Name EnableLUA -Value 1"
  ));

  const smb = await readJson<{ EnableSMB1Protocol?: boolean }>("$ErrorActionPreference='Stop'; Get-SmbServerConfiguration | Select-Object EnableSMB1Protocol | ConvertTo-Json -Compress");
  if (smb) {
    checks.push(check(
      "SVC-001",
      "Services & Exposure",
      "SMBv1 legacy protocol",
      smb.EnableSMB1Protocol ? "CRITICAL" : "OK",
      smb.EnableSMB1Protocol ? "SMBv1 enabled" : "SMBv1 disabled",
      "SMBv1 disabled",
      smb.EnableSMB1Protocol ? "SMBv1 is enabled. This legacy protocol is exploited by ransomware and should be disabled unless a documented legacy dependency exists." : "SMBv1 is disabled, removing a common lateral-movement and ransomware path.",
      smb.EnableSMB1Protocol ? "High" : "Low",
      "Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -NoRestart"
    ));
  } else {
    checks.push(check("SVC-001", "Services & Exposure", "SMBv1 legacy protocol", "SUGGESTION", "Status unavailable", "SMB server configuration readable", "SMB server configuration could not be read; verify the Server service and permissions.", "Medium"));
  }

  const rdp = await readJson<{ fDenyTSConnections?: number }>("$ErrorActionPreference='Stop'; Get-ItemProperty 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' | Select-Object fDenyTSConnections | ConvertTo-Json -Compress");
  if (rdp) {
    const disabled = Number(rdp.fDenyTSConnections) === 1;
    checks.push(check(
      "SVC-002",
      "Services & Exposure",
      "Remote Desktop exposure",
      disabled ? "OK" : "SUGGESTION",
      disabled ? "RDP disabled" : "RDP enabled (fDenyTSConnections = 0)",
      "RDP disabled unless explicitly required",
      disabled ? "Remote Desktop is disabled on this host." : "Remote Desktop is enabled. Restrict it to trusted networks, require MFA at the edge and monitor 4625 logon failures.",
      disabled ? "Low" : "Medium",
      "Set-ItemProperty 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' -Name fDenyTSConnections -Value 1"
    ));
  }

  let secureBoot = "Unavailable";
  try {
    const output = await powershell("$ErrorActionPreference='Stop'; Confirm-SecureBootUEFI", 8000);
    secureBoot = output.toLowerCase();
  } catch {
    secureBoot = "unavailable";
  }
  const secureBootOn = secureBoot === "true";
  checks.push(check(
    "KRNL-001",
    "Kernel & Boot",
    "Secure Boot",
    secureBootOn ? "OK" : secureBoot === "false" ? "WARNING" : "SUGGESTION",
    secureBoot === "unavailable" ? "Not available or not readable" : `Secure Boot = ${secureBoot}`,
    "Secure Boot enabled on UEFI systems",
    secureBootOn ? "Secure Boot is enabled and validates boot components." : "Secure Boot is disabled or could not be confirmed. Enable it in firmware where the hardware supports it.",
    secureBootOn ? "Low" : "Medium",
    "Confirm-SecureBootUEFI (enable Secure Boot in firmware setup)"
  ));

  const execution = asArray(await readJson<Array<{ Scope?: string; ExecutionPolicy?: string }> | { Scope?: string; ExecutionPolicy?: string }>(
    "$ErrorActionPreference='Stop'; Get-ExecutionPolicy -List | Select-Object Scope,ExecutionPolicy | ConvertTo-Json -Compress"
  ));
  const localMachine = execution.find(item => String(item.Scope).toLowerCase() === "localmachine");
  const policy = localMachine?.ExecutionPolicy || "Undefined";
  const policyOk = ["RemoteSigned", "AllSigned", "Restricted"].includes(policy);
  checks.push(check(
    "AUTH-002",
    "Authentication & Access",
    "PowerShell execution policy",
    policyOk ? "OK" : "WARNING",
    `LocalMachine = ${policy}`,
    "RemoteSigned, AllSigned or Restricted",
    policyOk ? "PowerShell will not run unsigned scripts fetched from the internet by default." : "The LocalMachine execution policy allows unsigned or unrestricted scripts, increasing script-based attack risk.",
    policyOk ? "Low" : "Medium",
    "Set-ExecutionPolicy -Scope LocalMachine RemoteSigned"
  ));

  const admins = asArray(await readJson<Array<{ Name?: string }> | { Name?: string }>(
    "$ErrorActionPreference='Stop'; Get-LocalGroupMember -Group Administrators | Select-Object Name | ConvertTo-Json -Compress"
  ));
  checks.push(check(
    "AUTH-003",
    "Authentication & Access",
    "Local administrator membership",
    admins.length <= 2 ? "OK" : "SUGGESTION",
    admins.length ? `${admins.length} local administrators` : "Membership unavailable",
    "Only accounts that require local administration",
    admins.length <= 2 ? "Local administrator membership is limited." : "The local Administrators group contains more than two entries. Review each account and remove unnecessary standing access.",
    admins.length <= 2 ? "Low" : "Medium"
  ));

  const hotfix = await readJson<{ HotFixID?: string; InstalledOn?: string } | Array<{ HotFixID?: string; InstalledOn?: string }>>(
    "$ErrorActionPreference='Stop'; Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 1 HotFixID,InstalledOn | ConvertTo-Json -Compress"
  );
  const latest = asArray(hotfix)[0];
  const installedOn = latest?.InstalledOn ? new Date(latest.InstalledOn) : null;
  const daysOld = installedOn && !Number.isNaN(installedOn.getTime()) ? Math.floor((Date.now() - installedOn.getTime()) / 86400000) : null;
  checks.push(check(
    "UPD-001",
    "Logging & Updates",
    "Recent Windows update",
    daysOld === null ? "SUGGESTION" : daysOld <= 60 ? "OK" : "WARNING",
    latest?.HotFixID ? `${latest.HotFixID}${daysOld !== null ? ` (${daysOld} days ago)` : ""}` : "No hotfix history returned",
    "A security update within the last 60 days",
    daysOld === null ? "The host did not return a recent hotfix. Verify Windows Update history manually." : daysOld <= 60 ? "A recent Windows hotfix is installed." : `The newest reported hotfix is ${daysOld} days old. Check Windows Update and patch compliance.`,
    daysOld === null ? "Medium" : daysOld <= 60 ? "Low" : "Medium",
    "Install-WindowsUpdate -AcceptAll (or use Windows Update)"
  ));

  const weights: Record<AuditStatus, number> = { OK: 100, SUGGESTION: 70, WARNING: 40, CRITICAL: 0 };
  const score = Math.round(checks.reduce((sum, item) => sum + weights[item.status], 0) / Math.max(1, checks.length));
  return {
    auditId: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    score,
    totalChecks: checks.length,
    okCount: checks.filter(item => item.status === "OK").length,
    suggestionCount: checks.filter(item => item.status === "SUGGESTION").length,
    warningCount: checks.filter(item => item.status === "WARNING").length,
    criticalCount: checks.filter(item => item.status === "CRITICAL").length,
    checks,
  };
}
