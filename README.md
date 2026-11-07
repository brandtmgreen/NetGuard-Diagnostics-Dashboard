# NetGuard Security Desk

NetGuard is a local Windows security console for real network telemetry, packet capture, detection, and Windows Firewall enforcement. It does not ship demo events or generated telemetry: if a collector is unavailable, the UI says so. The operator workflows from the demo build are back, now backed by the real collectors.

## What is real

- **Host telemetry**: Windows interfaces, addresses, routing gateway, CPU/memory, uptime (`os` + `route.exe`).
- **Neighbor/connection tables**: `arp.exe` and `netstat -ano`.
- **Packet capture**: the installed Npcap driver and Wireshark `tshark.exe`; live packets are parsed from a real field stream.
- **Detections**: port scans, SYN floods, repeated connections to sensitive ports, ICMP floods, suspicious outbound ports, and Windows Security events 4625/7045.
- **Prevention**: real Windows Firewall rules created with `New-NetFirewallRule`, scoped to a public IPv4 address, with automatic expiry.
- **Nmap**: the installed `nmap.exe`, not a simulated scanner. Public targets are disabled by default.
- **AI**: optional Gemini analysis of real local telemetry. AI is advisory only and never executes a command or creates a rule. Without `GEMINI_API_KEY`, the app returns an explicit unavailable state.
- **System audit**: read-only Defender, firewall, UAC, SMBv1, RDP, Secure Boot, PowerShell policy, local-admin and patch checks (`GET /api/security/audit`).

## Restored operator views

- **Task Manager**: real process tree/table, parent-child lineage, command lines, path, memory and CPU time; guarded process termination.
- **Action Planner**: search, priority/status filters, assigned nodes, prerequisites, edit/delete, and blocked completion until prerequisites are complete.
- **Network Diagnostics**: host/route/socket tools plus a real ARP/gateway LAN topology map with clickable nodes and ping.
- **Port Scanner**: all four Nmap profiles, raw output, optional AI triage, and one-click remediation handoff to the Action Planner.
- **Packet Capture**: client-side packet filtering, packet details, block-source handoff, and optional AI packet analysis.
- **Security Center**: posture score, source heat map, open detections, host checks, firewall rules, and acknowledgement/ignore actions.
- **System Audit**: Lynis-style hardening index with category/status filters and remediation plans.
- **Terminal**: allowlisted, read-only diagnostics.
- **Deployment Wizard**: live readiness checks and runtime diagnostics.

## Safety guardrails

- Control plane binds to `127.0.0.1` only.
- Prevention defaults to **monitor**. Automatic blocking requires an explicit arm action and administrator privileges.
- The backend refuses to block loopback, RFC1918/private, link-local, multicast, the default gateway, the local host, or allowlisted addresses.
- Blocks expire (default 15 minutes, max 24 hours) and are appended to `%LOCALAPPDATA%\NetGuard\data\audit.log`.
- AI recommendations are manual and reversible.
- Terminal commands are a read-only allowlist (`ping`, `tracert`, `netstat`, `ipconfig`, `nslookup`, `arp`).

## Requirements

- Windows 10/11 x64.
- Node.js 18+.
- Npcap (installed with Wireshark or Nmap). The Npcap binding must be enabled on the adapter you want to capture.
- Wireshark (`tshark.exe`) for packet capture.
- Nmap for authorized scans.
- Administrator privileges for live capture and Windows Firewall changes.

## Run from source

```powershell
cd C:\Users\no\.openclaw-autoclaw\workspace\NetGuard
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

Production:

```powershell
npm run build
npm start
```

The production server serves `dist/` and uses `dist/server.cjs`.

## Configuration

Create `.env` in the project root (never commit it):

```env
GEMINI_API_KEY=your-key
# Optional:
TSHARK_PATH=C:\Program Files\Wireshark\tshark.exe
NMAP_PATH=C:\Program Files (x86)\Nmap\nmap.exe
NETGUARD_PORT=3000
```

The UI stores non-secret settings in `%LOCALAPPDATA%\NetGuard\data\settings.json`. API keys are read from the environment only.

## Windows desktop package

The installed desktop build lives at:

`C:\Users\no\AppData\Local\Programs\NetGuard\NetGuard.exe`

It starts the bundled server from `resources/app.asar.unpacked/dist/server.cjs`, waits for the health check, then loads the local UI. Packaged builds request elevation because firewall enforcement is a privileged operation. Set `NETGUARD_NO_ELEVATE=1` only for development.

The current package is an internal build, not a signed commercial installer. A release pipeline still needs code signing, an installer, a Windows service for capture when the UI is closed, and crash/update handling.

The Electron shell now keeps the local server and capture alive in the system tray when the window is closed. Logon startup can be installed with `scripts\install-startup.ps1` (run elevated); remove it with `scripts\uninstall-startup.ps1`. A portable release folder and optional zip can be built with `scripts\package-portable.ps1`; an Inno Setup 6 installer script is in `installer\NetGuard.iss` and can be compiled with `scripts\build-installer.ps1` once Inno Setup is installed.

## Data and privacy

- Alerts, reports, settings, and the audit log stay under `%LOCALAPPDATA%\NetGuard\data`.
- Packet payloads are not persisted. Only metadata and detection evidence are stored.
- Gemini, when enabled, receives a summarized telemetry context — not raw packet payloads. Review Google's terms before enabling it on sensitive networks.

## Diagnostics and crash reporting

NetGuard writes structured JSONL diagnostics to `%LOCALAPPDATA%\NetGuard\logs\netguard.log` (5 MB rotation) and desktop-shell crashes to `%LOCALAPPDATA%\NetGuard\logs\desktop.log`. The Settings page shows the live version, uptime, memory, log path and recent events; the same data is available at `GET /api/diagnostics` with the local API token.

Uncaught exceptions and unhandled rejections are captured with message, stack, timestamp and PID. API failures are logged with method, path, status and a bounded error message. Packet payloads and secrets are never written to these logs.

## Development notes

- `server/telemetry.ts` — host/interface/connection collection.
- `server/capture.ts` — tshark process and packet parsing.
- `server/detection.ts` — detection thresholds and alert generation.
- `server/prevention.ts` + `server/windows.ts` — Windows Firewall enforcement and guardrails.
- `server/api.ts` - local-only API and validation.
- `server/processes.ts` - real process listing and kill guardrails.
- `server/audit.ts` - read-only Windows hardening audit.
- `src/` - React UI, including the restored operator views.

## Verification

```powershell
npm run typecheck
npm run build
```

Manual smoke tests:

- `GET /api/health` returns `ok: true`.
- `GET /api/state` returns real host/connection data.
- `GET /api/security/audit` returns a hardening report with real checks.
- Start capture on the active adapter and confirm packets appear.
- Run `nmap -Pn -p 1-30 127.0.0.1` against a loopback capture; a port-scan alert should be recorded.
- Create a block rule for a documentation IP such as `203.0.113.10`, verify it appears in Windows Firewall, then remove it.
