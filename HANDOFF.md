# NetGuard — Handoff / Resume Point

**Status:** Restored demo feature set shipped in 1.0.6 on 2026-11-07.
**Project:** `C:\Users\no\.openclaw-autoclaw\workspace\NetGuard`
**Branch:** `real-ids`
**Latest commits:** `ca97e9d`, `443a34d`, tag `v1.0.6`

## What is built
- Real Windows telemetry: interfaces, gateway, CPU/memory, uptime, ARP neighbors, TCP connections.
- Real Npcap/`tshark` packet capture; Npcap binding is enabled on Ethernet.
- Real detection engine: port scan, SYN flood, brute force, ICMP flood, suspicious outbound ports, Windows Security 4625/7045.
- Real Windows Firewall enforcement with monitor/prevent modes, explicit arming, guardrails, expiry, and audit logging.
- Real Nmap scanning; public targets blocked by default.
- Gemini AI is optional and advisory only; no key = explicit unavailable, no fake answers.
- React UI with Dashboard, Task Manager, Action Planner, Network, Diagnostics, Port Scanner, Security Center, System Audit, Detections, Prevention, Packet Capture, Terminal, Reports, Deployment Wizard, Settings.
- Electron tray/background mode, per-launch local API token, logon-startup scripts, portable packaging, Inno Setup script.

## Verified
- `npm run typecheck` pass.
- `npm run build` pass.
- `npm start` production server + UI pass.
- Real loopback Nmap scan generated a real port-scan alert.
- Real Nmap scan returned actual ports.
- Real firewall rule create/list/remove tested with `203.0.113.10`.
- Packaged app: 0 console errors.
- Test alerts/rules cleaned; app data directory is clean.

## Builds
- Installed: `C:\Users\no\AppData\Local\Programs\NetGuard\NetGuard.exe`
- Portable: `C:\Users\no\.openclaw-autoclaw\workspace\NetGuard\release\NetGuard\NetGuard.exe`
- Source: `C:\Users\no\.openclaw-autoclaw\workspace\NetGuard`

## Resume commands
```powershell
cd C:\Users\no\.openclaw-autoclaw\workspace\NetGuard
git status
npm run dev                  # http://127.0.0.1:3000
npm run build
npm start
.\scripts\package-portable.ps1
```

## Remaining before commercial release
1. Signed installer + update pipeline; code-signing certificate.
2. True Windows service for capture when no user is logged in (current tray/logon task is not a service).
3. Crash reporting / structured production telemetry.
4. Detection-rule tuning and a larger real-traffic test matrix.
5. Optional: local API hardening beyond per-launch token; service/GUI handshake.

## Environment notes
- Windows 10.0.19045, admin shell.
- Npcap 1.86 driver running; Ethernet `INSECURE_NPCAP` binding enabled.
- Wireshark/tshark: `C:\Program Files\Wireshark\tshark.exe`
- Nmap: `C:\Program Files (x86)\Nmap\nmap.exe`
- Data/audit: `%LOCALAPPDATA%\NetGuard\data`
- The pasted browser console from 2026-10-24 was **GreenTree Hub**, not NetGuard (Maps CSP, Socket.io 413, chart 0×0). Left untouched.

## 2026-11-05 — Production diagnostics added (v1.0.5)

- Added `server/logger.ts`: structured JSONL logs under `%LOCALAPPDATA%\NetGuard\logs\netguard.log`, 5 MB rotation, bounded stack traces.
- Added crash handlers for `uncaughtException` and `unhandledRejection` in both the server and Electron shell; desktop crashes go to `desktop.log`.
- Added `GET /api/diagnostics` with version, uptime, memory, Node/platform, log metadata, recent events, capture state and admin state.
- Added a **Diagnostics & crash log** section to Settings with live version, uptime, memory, copyable log path and recent JSONL events.
- Bumped app/installer version to **1.0.5**.
- Verified: `npm run typecheck` exit 0; `npm run build` exit 0; production health returns `version: 1.0.5`; `/api/diagnostics` returns 200 with log path and events; Settings renders the diagnostics panel; an API validation error was captured as `api.error`; 0 console errors in the headless UI test.

Remaining commercial gaps are unchanged: signed installer/update pipeline, true Windows service, code signing, and a larger detection-rule test matrix.

## 2026-11-06 — Installed app replaced

- Replaced `C:\Users\no\AppData\Local\Programs\NetGuard` with the refreshed 1.0.5 portable build.
- Previous installation backed up at `C:\Users\no\.openclaw-autoclaw\workspace\.cluster\NetGuard-install-backup-20261106-0146`.
- Verified installed `NetGuard.exe` launches and `/api/health` returns **version 1.0.5**.
- User data under `%LOCALAPPDATA%\NetGuard\data` was not touched.

## 2026-11-07 - Demo operator features restored in 1.0.6

- Restored the demo-class operator surfaces on top of the real collectors:
  - Task Manager process tree/table with parent PIDs, command lines, path, memory, CPU time and guarded termination.
  - Action Planner search, priority/status filters, assigned nodes, prerequisite dependencies, edit/delete and blocked-completion rules.
  - Network Diagnostics ARP/gateway topology map with selectable nodes and live ping.
  - System Audit: read-only Defender, firewall, UAC, SMBv1, RDP, Secure Boot, PowerShell policy, admin membership and patch checks.
  - Port Scanner AI triage and remediation handoff to the planner.
  - Packet Capture client-side filters, block-source and AI packet analysis.
  - Security Center host checks, firewall policy list and source heat map.
  - Dashboard resource trend and collapsible sidebar.
- New backend pieces: `server/processes.ts` (real process table/kill guard), `server/audit.ts` and `GET /api/security/audit`.
- Version bumped to **1.0.6**. Portable package and installed copy replaced; no user data under `%LOCALAPPDATA%\NetGuard\data` was modified.
- GitHub: pushed `main` and tag `v1.0.6` to `brandtmgreen/NetGuard-Diagnostics-Dashboard`.
- Verified: typecheck/build pass; all 15 views load with 0 console errors and 0 failed requests; process tree 376 rows; planner add/block/edit/delete; topology/ping; Nmap local scan (4 open ports); capture start/stop; audit score 83 with 9 real checks; installed app shows `v1.0.6`.
