import fs from "fs";
import os from "os";
import path from "path";
import { run, findBinary } from "../lib/exec";
import { listLiveConnections } from "./network";
import { getProcesses } from "./system";
import { readActiveRules } from "./firewall";
import { callGeminiWithRetry } from "../lib/gemini";

export type AuditCheckStatus = "OK" | "SUGGESTION" | "WARNING" | "CRITICAL";

export type AuditCategory =
  | "Kernel & Boot"
  | "Authentication & Access"
  | "Filesystem & Permissions"
  | "Network & Firewall"
  | "SSH & Services"
  | "Logging & Integrity";

export interface LynisAuditCheck {
  id: string;
  category: AuditCategory;
  title: string;
  status: AuditCheckStatus;
  currentValue: string;
  expectedValue: string;
  humanExplanation: string;
  remediationCommand?: string;
  rollbackCommand?: string;
  riskImpact: "Low" | "Medium" | "High";
}

export interface GroundingReference {
  title: string;
  uri: string;
}

export interface AiRemediationPlanItem {
  id: string;
  findingId: string;
  title: string;
  humanSummary: string;
  whyItMatters: string;
  command: string;
  rollbackCommand: string;
  riskLevel: "Low" | "Medium" | "High";
  requiresPrivilege: boolean;
}

export interface LynisAuditReport {
  auditId: string;
  timestamp: string;
  hostname: string;
  platform: string;
  kernelVersion: string;
  lynisBinaryDetected: boolean;
  hardeningIndex: number; // 0 - 100 Lynis-style Hardening Index
  totalChecks: number;
  okCount: number;
  suggestionCount: number;
  warningCount: number;
  criticalCount: number;
  checks: LynisAuditCheck[];
  aiAnalysis?: {
    executiveSummary: string;
    plainEnglishOverview: string;
    remediationPlan: AiRemediationPlanItem[];
    groundingSources: GroundingReference[];
    generatedAt: string;
  };
}

function readProcSys(relPath: string): string | null {
  try {
    const full = path.join("/proc/sys", relPath);
    if (fs.existsSync(full)) {
      return fs.readFileSync(full, "utf8").trim();
    }
  } catch {
    // ignore
  }
  return null;
}

function statModeOctal(filePath: string): { exists: boolean; modeOctal: string; uid: number; gid: number } {
  try {
    if (!fs.existsSync(filePath)) return { exists: false, modeOctal: "", uid: -1, gid: -1 };
    const st = fs.statSync(filePath);
    const modeOctal = (st.mode & 0o777).toString(8).padStart(4, "0");
    return { exists: true, modeOctal, uid: st.uid, gid: st.gid };
  } catch {
    return { exists: false, modeOctal: "", uid: -1, gid: -1 };
  }
}

export async function runLynisEquivalentAudit(includeAi = true): Promise<LynisAuditReport> {
  const platform = os.platform();
  const hostname = os.hostname();
  const kernelVersion = `${os.type()} ${os.release()} (${os.arch()})`;
  const checks: LynisAuditCheck[] = [];

  const lynisBin = await findBinary("lynis", ["lynis", "/usr/bin/lynis", "/usr/sbin/lynis", "/usr/local/bin/lynis"]);

  // ============================================================================
  // 1. KERNEL & BOOT HARDENING CHECKS (KRNL-*)
  // ============================================================================
  if (platform !== "win32") {
    // KRNL-6000: ASLR (kernel.randomize_va_space)
    const aslr = readProcSys("kernel/randomize_va_space");
    if (aslr !== null) {
      const isFull = aslr === "2";
      checks.push({
        id: "KRNL-6000",
        category: "Kernel & Boot",
        title: "Address Space Layout Randomization (ASLR)",
        status: isFull ? "OK" : aslr === "1" ? "WARNING" : "CRITICAL",
        currentValue: `kernel.randomize_va_space = ${aslr}`,
        expectedValue: "kernel.randomize_va_space = 2 (Full randomization)",
        humanExplanation: isFull
          ? "Full Address Space Layout Randomization (ASLR) is active. Memory locations for stack, heap, and shared libraries are randomized, protecting against buffer overflow exploits."
          : "ASLR is not set to full randomization (2). Attackers can more easily predict memory addresses to execute buffer overflow or ROP chain exploits.",
        remediationCommand: isFull ? undefined : "sysctl -w kernel.randomize_va_space=2",
        rollbackCommand: isFull ? undefined : `sysctl -w kernel.randomize_va_space=${aslr}`,
        riskImpact: isFull ? "Low" : "High",
      });
    }

    // KRNL-6010: Kernel pointer restriction (kernel.kptr_restrict)
    const kptr = readProcSys("kernel/kptr_restrict");
    if (kptr !== null) {
      const isHardened = kptr === "2";
      checks.push({
        id: "KRNL-6010",
        category: "Kernel & Boot",
        title: "Kernel Pointer Exposure Restriction (kptr_restrict)",
        status: isHardened ? "OK" : kptr === "1" ? "SUGGESTION" : "WARNING",
        currentValue: `kernel.kptr_restrict = ${kptr}`,
        expectedValue: "kernel.kptr_restrict = 2 (Hide kernel pointers from all users)",
        humanExplanation: isHardened
          ? "Kernel pointers in /proc/kallsyms and other interfaces are hidden regardless of privilege level, preventing kernel exploit address leaks."
          : `Kernel pointer restriction is currently set to ${kptr}. Setting it to 2 hides exposed kernel memory addresses from local processes, making privilege escalation exploits much harder.`,
        remediationCommand: isHardened ? undefined : "sysctl -w kernel.kptr_restrict=2",
        rollbackCommand: isHardened ? undefined : `sysctl -w kernel.kptr_restrict=${kptr}`,
        riskImpact: "Medium",
      });
    }

    // KRNL-6020: Restrict dmesg buffer (kernel.dmesg_restrict)
    const dmesg = readProcSys("kernel/dmesg_restrict");
    if (dmesg !== null) {
      const isRestricted = dmesg === "1";
      checks.push({
        id: "KRNL-6020",
        category: "Kernel & Boot",
        title: "Kernel Ring Buffer Access Restriction (dmesg_restrict)",
        status: isRestricted ? "OK" : "SUGGESTION",
        currentValue: `kernel.dmesg_restrict = ${dmesg}`,
        expectedValue: "kernel.dmesg_restrict = 1",
        humanExplanation: isRestricted
          ? "Unprivileged users cannot read kernel ring buffer messages (dmesg), preventing leakage of hardware layout and kernel memory offsets."
          : "Any local user can run 'dmesg' to inspect kernel boot logs and memory addresses. Restricting dmesg prevents unprivileged reconnaissance.",
        remediationCommand: isRestricted ? undefined : "sysctl -w kernel.dmesg_restrict=1",
        rollbackCommand: isRestricted ? undefined : "sysctl -w kernel.dmesg_restrict=0",
        riskImpact: "Low",
      });
    }

    // KRNL-5820: SUID Core Dumps (fs.suid_dumpable)
    const suidDump = readProcSys("fs/suid_dumpable");
    if (suidDump !== null) {
      const isHardened = suidDump === "0";
      checks.push({
        id: "KRNL-5820",
        category: "Kernel & Boot",
        title: "Privileged Process Core Dump Protection (suid_dumpable)",
        status: isHardened ? "OK" : "WARNING",
        currentValue: `fs.suid_dumpable = ${suidDump}`,
        expectedValue: "fs.suid_dumpable = 0 (Disabled)",
        humanExplanation: isHardened
          ? "SetUID/privileged programs are prevented from dumping core memory to disk when they crash, protecting sensitive credentials in memory."
          : `fs.suid_dumpable is set to ${suidDump}. If a privileged program crashes, its memory (which may contain passwords or keys) could be written to disk.`,
        remediationCommand: isHardened ? undefined : "sysctl -w fs.suid_dumpable=0",
        rollbackCommand: isHardened ? undefined : `sysctl -w fs.suid_dumpable=${suidDump}`,
        riskImpact: "Medium",
      });
    }

    // KRNL-6040: Yama ptrace_scope
    const ptrace = readProcSys("kernel/yama/ptrace_scope");
    if (ptrace !== null) {
      const ok = parseInt(ptrace, 10) >= 1;
      checks.push({
        id: "KRNL-6040",
        category: "Kernel & Boot",
        title: "Process Memory Debugging Scope (yama.ptrace_scope)",
        status: ok ? "OK" : "WARNING",
        currentValue: `kernel.yama.ptrace_scope = ${ptrace}`,
        expectedValue: "kernel.yama.ptrace_scope >= 1",
        humanExplanation: ok
          ? "Process tracing (ptrace) is restricted so non-parent processes cannot attach debuggers to other running user processes to steal credentials."
          : "ptrace_scope is 0, meaning any compromised process running under a user account can attach to and read memory from any other process owned by that same user.",
        remediationCommand: ok ? undefined : "sysctl -w kernel.yama.ptrace_scope=1",
        rollbackCommand: ok ? undefined : `sysctl -w kernel.yama.ptrace_scope=${ptrace}`,
        riskImpact: "Medium",
      });
    }
  } else {
    // Windows Kernel/Boot checks via PowerShell/Registry
    const depCheck = await run("wmic", ["os", "get", "DataExecutionPrevention_SupportPolicy", "/value"], { timeout: 5000 });
    const depVal = depCheck.stdout.match(/DataExecutionPrevention_SupportPolicy=(\d+)/)?.[1] || "Unknown";
    const depOk = depVal === "2" || depVal === "3";
    checks.push({
      id: "KRNL-6000",
      category: "Kernel & Boot",
      title: "Windows Data Execution Prevention (DEP) Policy",
      status: depOk ? "OK" : "WARNING",
      currentValue: `DEP SupportPolicy = ${depVal}`,
      expectedValue: "OptOut (3) or AlwaysOn (2)",
      humanExplanation: depOk
        ? "Windows Data Execution Prevention (DEP) is enforced for system and application binaries to block code execution from data memory pages."
        : "Windows DEP policy is not set to OptOut or AlwaysOn, increasing exposure to memory corruption exploits.",
      remediationCommand: depOk ? undefined : "bcdedit.exe /set {current} nx OptOut",
      rollbackCommand: depOk ? undefined : "bcdedit.exe /set {current} nx OptIn",
      riskImpact: "High",
    });
  }

  // ============================================================================
  // 2. AUTHENTICATION, USERS & SUDO (AUTH-*)
  // ============================================================================
  if (platform !== "win32" && fs.existsSync("/etc/passwd")) {
    try {
      const passwdRaw = fs.readFileSync("/etc/passwd", "utf8");
      const lines = passwdRaw.split("\n").filter(Boolean);
      const uidZeroUsers = lines
        .map((line) => line.split(":"))
        .filter((parts) => parts.length >= 3 && parts[2] === "0")
        .map((parts) => parts[0]);

      const extraRoot = uidZeroUsers.filter((u) => u !== "root");
      checks.push({
        id: "AUTH-9208",
        category: "Authentication & Access",
        title: "Superuser (UID 0) Account Exclusivity",
        status: extraRoot.length === 0 ? "OK" : "CRITICAL",
        currentValue: `UID 0 accounts: ${uidZeroUsers.join(", ")}`,
        expectedValue: "Only 'root' has UID 0",
        humanExplanation:
          extraRoot.length === 0
            ? "Only the standard 'root' account possesses superuser UID 0 privileges in /etc/passwd."
            : `Multiple accounts share UID 0 (${uidZeroUsers.join(", ")}). Non-root accounts with UID 0 have full kernel root access and obscure audit trails.`,
        remediationCommand:
          extraRoot.length > 0 ? `usermod -L ${extraRoot[0]}` : undefined,
        rollbackCommand:
          extraRoot.length > 0 ? `usermod -U ${extraRoot[0]}` : undefined,
        riskImpact: "High",
      });
    } catch {
      // ignore
    }
  }

  if (platform !== "win32" && fs.existsSync("/etc/login.defs")) {
    try {
      const loginDefs = fs.readFileSync("/etc/login.defs", "utf8");
      const passMaxMatch = loginDefs.match(/^\s*PASS_MAX_DAYS\s+(\d+)/m);
      const encryptMatch = loginDefs.match(/^\s*ENCRYPT_METHOD\s+(\S+)/m);

      const maxDays = passMaxMatch ? parseInt(passMaxMatch[1], 10) : 99999;
      const maxDaysOk = maxDays <= 365;
      checks.push({
        id: "AUTH-9230",
        category: "Authentication & Access",
        title: "Maximum Password Expiration Policy (PASS_MAX_DAYS)",
        status: maxDaysOk ? "OK" : "SUGGESTION",
        currentValue: `PASS_MAX_DAYS = ${maxDays}`,
        expectedValue: "PASS_MAX_DAYS <= 365 (CIS/Lynis recommendation: 90 - 365 days)",
        humanExplanation: maxDaysOk
          ? `Password rotation policy in /etc/login.defs is configured to ${maxDays} days.`
          : `PASS_MAX_DAYS in /etc/login.defs is set to ${maxDays} days (effectively never expiring). Setting a bounded lifetime enforces periodic credential rotation.`,
        remediationCommand: maxDaysOk
          ? undefined
          : "sed -i 's/^PASS_MAX_DAYS.*/PASS_MAX_DAYS   365/' /etc/login.defs",
        rollbackCommand: maxDaysOk
          ? undefined
          : `sed -i 's/^PASS_MAX_DAYS.*/PASS_MAX_DAYS   ${maxDays}/' /etc/login.defs`,
        riskImpact: "Low",
      });

      const encMethod = encryptMatch ? encryptMatch[1].toUpperCase() : "UNKNOWN";
      const strongHash = ["SHA512", "YESCRYPT", "BCRYPT"].includes(encMethod);
      checks.push({
        id: "AUTH-9234",
        category: "Authentication & Access",
        title: "Password Hashing Algorithm Strength (ENCRYPT_METHOD)",
        status: strongHash ? "OK" : "WARNING",
        currentValue: `ENCRYPT_METHOD = ${encMethod}`,
        expectedValue: "SHA512 or YESCRYPT",
        humanExplanation: strongHash
          ? `System password hashing uses ${encMethod}, providing strong cryptographic resistance against offline password cracking.`
          : `Password hashing method in /etc/login.defs is ${encMethod}. Modern systems should enforce SHA512 or YESCRYPT.`,
        remediationCommand: strongHash
          ? undefined
          : "sed -i 's/^ENCRYPT_METHOD.*/ENCRYPT_METHOD SHA512/' /etc/login.defs",
        riskImpact: "Medium",
      });
    } catch {
      // ignore
    }
  }

  // ============================================================================
  // 3. FILESYSTEM & PERMISSIONS (FILE-*)
  // ============================================================================
  if (platform !== "win32") {
    const criticalFiles: Array<{
      id: string;
      filePath: string;
      allowedModes: string[];
      recommendedMode: string;
      desc: string;
    }> = [
      {
        id: "FILE-6410",
        filePath: "/etc/passwd",
        allowedModes: ["0644", "0640", "0600"],
        recommendedMode: "0644",
        desc: "User account database (/etc/passwd)",
      },
      {
        id: "FILE-6412",
        filePath: "/etc/shadow",
        allowedModes: ["0640", "0600", "0400", "0000"],
        recommendedMode: "0640",
        desc: "Password hash database (/etc/shadow)",
      },
      {
        id: "FILE-6414",
        filePath: "/etc/group",
        allowedModes: ["0644", "0640", "0600"],
        recommendedMode: "0644",
        desc: "System group definitions (/etc/group)",
      },
    ];

    for (const item of criticalFiles) {
      const st = statModeOctal(item.filePath);
      if (st.exists) {
        const isOk = item.allowedModes.includes(st.modeOctal) && st.uid === 0;
        checks.push({
          id: item.id,
          category: "Filesystem & Permissions",
          title: `Permissions on ${item.desc}`,
          status: isOk ? "OK" : "CRITICAL",
          currentValue: `${item.filePath} mode=${st.modeOctal} uid=${st.uid} gid=${st.gid}`,
          expectedValue: `mode in [${item.allowedModes.join(", ")}], owner uid=0`,
          humanExplanation: isOk
            ? `${item.filePath} is owned by root (uid 0) with secure octal permissions (${st.modeOctal}), preventing unauthorized modification.`
            : `${item.filePath} has overly permissive mode ${st.modeOctal} or non-root owner (uid ${st.uid}). Unauthorized users may be able to read or tamper with system credentials.`,
          remediationCommand: isOk ? undefined : `chown root:root ${item.filePath} && chmod ${item.recommendedMode} ${item.filePath}`,
          rollbackCommand: isOk ? undefined : `chmod ${st.modeOctal} ${item.filePath}`,
          riskImpact: "High",
        });
      }
    }

    // FILE-6310: Check /proc/mounts for /tmp or /dev/shm mount flags
    if (fs.existsSync("/proc/mounts")) {
      try {
        const mounts = fs.readFileSync("/proc/mounts", "utf8").split("\n");
        const shmLine = mounts.find((m) => m.split(" ")[1] === "/dev/shm");
        if (shmLine) {
          const opts = shmLine.split(" ")[3] || "";
          const hasNosuid = opts.includes("nosuid");
          const hasNoexec = opts.includes("noexec");
          const shmHardened = hasNosuid && hasNoexec;
          checks.push({
            id: "FILE-6310",
            category: "Filesystem & Permissions",
            title: "Shared Memory Mount Hardening (/dev/shm)",
            status: shmHardened ? "OK" : "SUGGESTION",
            currentValue: `/dev/shm options: ${opts}`,
            expectedValue: "noexec,nosuid,nodev enabled on /dev/shm",
            humanExplanation: shmHardened
              ? "Shared memory (/dev/shm) is mounted with noexec and nosuid, preventing attackers from executing compiled exploit payloads directly from shared memory."
              : `/dev/shm is currently mounted with options (${opts}) missing ${!hasNoexec ? "noexec " : ""}${!hasNosuid ? "nosuid" : ""}. Hardening /dev/shm prevents execution of binaries dropped into world-writable shared memory.`,
            remediationCommand: shmHardened ? undefined : "mount -o remount,noexec,nosuid,nodev /dev/shm",
            rollbackCommand: shmHardened ? undefined : "mount -o remount,exec,suid /dev/shm",
            riskImpact: "Low",
          });
        }
      } catch {
        // ignore
      }
    }
  }

  // ============================================================================
  // 4. NETWORK STACK & FIREWALL (NETW-* / FIRE-*)
  // ============================================================================
  if (platform !== "win32") {
    // NETW-3012: IPv4 TCP SYN Cookies
    const synCookies = readProcSys("net/ipv4/tcp_syncookies");
    if (synCookies !== null) {
      const ok = synCookies === "1";
      checks.push({
        id: "NETW-3012",
        category: "Network & Firewall",
        title: "TCP SYN Cookie Flood Protection (tcp_syncookies)",
        status: ok ? "OK" : "WARNING",
        currentValue: `net.ipv4.tcp_syncookies = ${synCookies}`,
        expectedValue: "net.ipv4.tcp_syncookies = 1",
        humanExplanation: ok
          ? "TCP SYN cookies are enabled in the kernel network stack, protecting the host from SYN flood denial-of-service attacks when the socket backlog fills."
          : "TCP SYN cookies are disabled. A surge of half-open TCP SYN packets could exhaust the kernel connection table.",
        remediationCommand: ok ? undefined : "sysctl -w net.ipv4.tcp_syncookies=1",
        rollbackCommand: ok ? undefined : "sysctl -w net.ipv4.tcp_syncookies=0",
        riskImpact: "Medium",
      });
    }

    // NETW-3015: ICMP Redirect Acceptance
    const acceptRedirects = readProcSys("net/ipv4/conf/all/accept_redirects");
    if (acceptRedirects !== null) {
      const ok = acceptRedirects === "0";
      checks.push({
        id: "NETW-3015",
        category: "Network & Firewall",
        title: "ICMP Redirect Packet Rejection (accept_redirects)",
        status: ok ? "OK" : "SUGGESTION",
        currentValue: `net.ipv4.conf.all.accept_redirects = ${acceptRedirects}`,
        expectedValue: "net.ipv4.conf.all.accept_redirects = 0",
        humanExplanation: ok
          ? "The kernel ignores bogus ICMP redirect messages, preventing attackers on the local network from altering the host's routing table (MITM routing attacks)."
          : "The host currently accepts ICMP redirect packets (accept_redirects = 1). A malicious device on the LAN could send forged ICMP redirects to intercept traffic.",
        remediationCommand: ok ? undefined : "sysctl -w net.ipv4.conf.all.accept_redirects=0",
        rollbackCommand: ok ? undefined : "sysctl -w net.ipv4.conf.all.accept_redirects=1",
        riskImpact: "Low",
      });
    }

    // NETW-3020: Source Routed Packets
    const sourceRoute = readProcSys("net/ipv4/conf/all/accept_source_route");
    if (sourceRoute !== null) {
      const ok = sourceRoute === "0";
      checks.push({
        id: "NETW-3020",
        category: "Network & Firewall",
        title: "IP Source Routing Rejection (accept_source_route)",
        status: ok ? "OK" : "WARNING",
        currentValue: `net.ipv4.conf.all.accept_source_route = ${sourceRoute}`,
        expectedValue: "net.ipv4.conf.all.accept_source_route = 0",
        humanExplanation: ok
          ? "Source-routed IPv4 packets are rejected, preventing senders from specifying explicit routing paths to bypass network perimeter controls."
          : "Source routing is enabled, allowing remote senders to dictate how packets are routed back to them.",
        remediationCommand: ok ? undefined : "sysctl -w net.ipv4.conf.all.accept_source_route=0",
        rollbackCommand: ok ? undefined : "sysctl -w net.ipv4.conf.all.accept_source_route=1",
        riskImpact: "Medium",
      });
    }
  }

  // NETW-3200: Wildcard Listening Sockets Inspection
  const liveConns = await listLiveConnections();
  const wildcardListeners = liveConns.filter(
    (c) =>
      c.state === "LISTEN" &&
      (c.localAddress === "0.0.0.0" || c.localAddress === "::" || c.localAddress === "*")
  );
  const nonHttpWildcard = wildcardListeners.filter((c) => c.localPort !== 3000);
  checks.push({
    id: "NETW-3200",
    category: "Network & Firewall",
    title: "Exposed Wildcard Listening Daemons (0.0.0.0 / ::)",
    status: nonHttpWildcard.length === 0 ? "OK" : "SUGGESTION",
    currentValue:
      wildcardListeners.length > 0
        ? wildcardListeners.map((c) => `${c.protocol} ${c.localAddress}:${c.localPort} (${c.process || "kernel"})`).join(", ")
        : "No wildcard listeners detected",
    expectedValue: "Only explicitly required services bound to 0.0.0.0; internal services bound to 127.0.0.1",
    humanExplanation:
      nonHttpWildcard.length === 0
        ? "Only the expected application service is listening on wildcard network interfaces."
        : `Detected ${wildcardListeners.length} service(s) listening across all network interfaces (0.0.0.0/::). Verify that internal services are bound to 127.0.0.1 or protected by host firewall rules.`,
    remediationCommand:
      nonHttpWildcard.length > 0
        ? `ss -tulnp || netstat -tulnp`
        : undefined,
    riskImpact: "Low",
  });

  // FIRE-4512: Active Host Firewall Status
  const activeFirewallText = await readActiveRules();
  const hasFirewallRules =
    activeFirewallText.includes("block") ||
    activeFirewallText.includes("DROP") ||
    activeFirewallText.includes("REJECT") ||
    activeFirewallText.includes("Chain INPUT");
  checks.push({
    id: "FIRE-4512",
    category: "Network & Firewall",
    title: "Host Packet Filter / Firewall Policy State",
    status: hasFirewallRules ? "OK" : "WARNING",
    currentValue: hasFirewallRules ? "Active packet filter rules detected" : "No active DROP/BLOCK rules found in host firewall",
    expectedValue: "Host firewall enabled with explicit ingress filtering rules",
    humanExplanation: hasFirewallRules
      ? "The host firewall subsystem reports active filtering chains/rules."
      : "No active packet-dropping rules were detected in the local kernel firewall table. Deploying ingress block rules reduces attack surface on untrusted networks.",
    remediationCommand: hasFirewallRules
      ? undefined
      : platform === "win32"
      ? "netsh advfirewall set allprofiles state on"
      : "iptables -L -n -v",
    riskImpact: "Medium",
  });

  // ============================================================================
  // 5. SSH & REMOTE SERVICES (SSH-*)
  // ============================================================================
  if (platform !== "win32" && fs.existsSync("/etc/ssh/sshd_config")) {
    try {
      const sshdRaw = fs.readFileSync("/etc/ssh/sshd_config", "utf8");
      const rootLoginMatch = sshdRaw.match(/^\s*PermitRootLogin\s+(\S+)/im);
      const rootLoginVal = rootLoginMatch ? rootLoginMatch[1].toLowerCase() : "prohibit-password (default)";
      const rootOk = rootLoginVal === "no" || rootLoginVal.includes("prohibit-password");

      checks.push({
        id: "SSH-7408",
        category: "SSH & Services",
        title: "SSH Root Login Policy (PermitRootLogin)",
        status: rootOk ? "OK" : "CRITICAL",
        currentValue: `PermitRootLogin ${rootLoginVal}`,
        expectedValue: "PermitRootLogin no",
        humanExplanation: rootOk
          ? `SSH daemon configuration restricts direct password-based root login (${rootLoginVal}).`
          : "PermitRootLogin is enabled in /etc/ssh/sshd_config, allowing remote attackers to brute-force the root account directly over SSH.",
        remediationCommand: rootOk
          ? undefined
          : "sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config",
        riskImpact: "High",
      });
    } catch {
      // ignore
    }
  } else if (platform !== "win32") {
    checks.push({
      id: "SSH-7408",
      category: "SSH & Services",
      title: "OpenSSH Server Exposure (/etc/ssh/sshd_config)",
      status: "OK",
      currentValue: "No OpenSSH server daemon configuration active (/etc/ssh/sshd_config absent)",
      expectedValue: "SSH server disabled if not required, or hardened with PermitRootLogin no",
      humanExplanation:
        "No OpenSSH server daemon configuration is present on this host, eliminating remote SSH brute-force attack surface.",
      riskImpact: "Low",
    });
  }

  // ============================================================================
  // 6. LOGGING, MALWARE & INTEGRITY (LOGG-* / PKGS-*)
  // ============================================================================
  const processes = await getProcesses(500);
  const loggerProc = processes.find((p) =>
    /rsyslog|syslog|journald|auditd|eventlog/i.test(p.name)
  );
  checks.push({
    id: "LOGG-2130",
    category: "Logging & Integrity",
    title: "System Audit & Syslog Daemon Status",
    status: loggerProc ? "OK" : "SUGGESTION",
    currentValue: loggerProc
      ? `Active logging daemon: ${loggerProc.name} (PID ${loggerProc.pid})`
      : "No dedicated syslog/auditd daemon detected in process tree",
    expectedValue: "systemd-journald, rsyslogd, or auditd running",
    humanExplanation: loggerProc
      ? `System event logging daemon (${loggerProc.name}) is actively recording host security events.`
      : "No background syslog or auditd daemon was detected in the process table. Containerized or minimal environments often rely on stdout logging rather than local syslog daemons.",
    riskImpact: "Low",
  });

  // Score calculation (Lynis Hardening Index style)
  let totalPoints = 0;
  let earnedPoints = 0;
  for (const c of checks) {
    const weight = c.riskImpact === "High" ? 15 : c.riskImpact === "Medium" ? 10 : 5;
    totalPoints += weight;
    if (c.status === "OK") earnedPoints += weight;
    else if (c.status === "SUGGESTION") earnedPoints += weight * 0.6;
    else if (c.status === "WARNING") earnedPoints += weight * 0.25;
  }
  const hardeningIndex = totalPoints > 0 ? Math.max(10, Math.min(100, Math.round((earnedPoints / totalPoints) * 100))) : 80;

  const okCount = checks.filter((c) => c.status === "OK").length;
  const suggestionCount = checks.filter((c) => c.status === "SUGGESTION").length;
  const warningCount = checks.filter((c) => c.status === "WARNING").length;
  const criticalCount = checks.filter((c) => c.status === "CRITICAL").length;

  const report: LynisAuditReport = {
    auditId: `lynis-${Date.now()}`,
    timestamp: new Date().toLocaleString(),
    hostname,
    platform,
    kernelVersion,
    lynisBinaryDetected: Boolean(lynisBin),
    hardeningIndex,
    totalChecks: checks.length,
    okCount,
    suggestionCount,
    warningCount,
    criticalCount,
    checks,
  };

  if (includeAi) {
    const nonOkChecks = checks.filter((c) => c.status !== "OK");
    const prompt = `You are a Principal Linux & Windows System Hardening Architect (modeled after CIS Benchmarks and Lynis Enterprise).
We just executed a real-time Lynis-equivalent system audit on host "${hostname}" running "${kernelVersion}".
Hardening Index: ${hardeningIndex}/100 (${okCount} OK, ${suggestionCount} Suggestions, ${warningCount} Warnings, ${criticalCount} Critical).

Here are the live non-OK findings detected on this system:
${JSON.stringify(nonOkChecks, null, 2)}

Here are all checks for context:
${JSON.stringify(
  checks.map((c) => ({ id: c.id, title: c.title, status: c.status, currentValue: c.currentValue, expectedValue: c.expectedValue })),
  null,
  2
)}

Use Google Search grounding to cross-reference current CIS Benchmark / Lynis hardening best practices for these exact check IDs and sysctl/OS parameters.
Return ONLY a valid JSON object (no markdown fences) matching this exact structure:
{
  "executiveSummary": "2-3 sentence executive summary of the host's security hardening posture.",
  "plainEnglishOverview": "Clear, human-friendly explanation for a non-expert explaining what the audit found and what the top priorities mean in everyday terms.",
  "remediationPlan": [
    {
      "id": "rem-1",
      "findingId": "KRNL-6010",
      "title": "Short human-readable remediation title",
      "humanSummary": "Plain-English explanation of what this fix does",
      "whyItMatters": "Why applying this change improves security according to Lynis/CIS standards",
      "command": "Exact shell or PowerShell command to fix the issue",
      "rollbackCommand": "Exact command to undo/revert the change if needed",
      "riskLevel": "Low",
      "requiresPrivilege": true
    }
  ]
}`;

    const geminiRes = await callGeminiWithRetry({ prompt, useSearch: true });
    let parsed: any = null;

    if (geminiRes.text) {
      try {
        const rawText = geminiRes.text.trim();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        parsed = null;
      }
    }

    if (parsed && parsed.executiveSummary) {
      report.aiAnalysis = {
        executiveSummary: parsed.executiveSummary,
        plainEnglishOverview: parsed.plainEnglishOverview || parsed.executiveSummary,
        remediationPlan: Array.isArray(parsed.remediationPlan) ? parsed.remediationPlan : [],
        groundingSources: geminiRes.groundingSources,
        generatedAt: new Date().toLocaleTimeString(),
      };
    } else {
      const quotaAdvisory = geminiRes.quotaExhausted
        ? " Note: Gemini API free-tier quota (429 RESOURCE_EXHAUSTED) was reached; upgrading to a paid tier increases quota—you can select a billing-enabled API key in the Settings > Secrets panel."
        : "";

      report.aiAnalysis = {
        executiveSummary: `System Hardening Index is ${hardeningIndex}/100 across ${checks.length} live OS checks (${okCount} OK, ${warningCount} Warnings, ${criticalCount} Critical, ${suggestionCount} Suggestions).${quotaAdvisory}`,
        plainEnglishOverview:
          nonOkChecks.length > 0
            ? `The live system audit identified ${nonOkChecks.length} hardening opportunities across kernel parameters, filesystem permissions, and network/firewall policies. Review each item below and approve individual remediation commands to harden the host.`
            : `All ${checks.length} live Lynis-equivalent checks passed with OK status on ${hostname}.`,
        remediationPlan: nonOkChecks
          .filter((c) => Boolean(c.remediationCommand))
          .map((c, idx) => ({
            id: `rem-live-${idx + 1}`,
            findingId: c.id,
            title: `Harden ${c.title} (${c.id})`,
            humanSummary: c.humanExplanation,
            whyItMatters: `Aligns ${c.id} from '${c.currentValue}' to the recommended '${c.expectedValue}' baseline.`,
            command: c.remediationCommand!,
            rollbackCommand: c.rollbackCommand,
            riskLevel: c.riskImpact,
            requiresPrivilege: true,
          })),
        groundingSources: [],
        generatedAt: new Date().toLocaleTimeString(),
      };
    }
  }

  return report;
}
