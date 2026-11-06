# NetGuard — Handoff / Resume Point

**Status:** PAUSED by Mr. Green on 2026-10-25 to work on the website. Do not resume unless asked.
**Project:** `C:\Users\no\.openclaw-autoclaw\workspace\NetGuard`
**Branch:** `real-ids`
**Latest commits:** `b3f831b`, `cff4c23`, `7f67c28`

## What is built
- Real Windows telemetry: interfaces, gateway, CPU/memory, uptime, ARP neighbors, TCP connections.
- Real Npcap/`tshark` packet capture; Npcap binding is enabled on Ethernet.
- Real detection engine: port scan, SYN flood, brute force, ICMP flood, suspicious outbound ports, Windows Security 4625/7045.
- Real Windows Firewall enforcement with monitor/prevent modes, explicit arming, guardrails, expiry, and audit logging.
- Real Nmap scanning; public targets blocked by default.
- Gemini AI is optional and advisory only; no key = explicit unavailable, no fake answers.
- React UI with Dashboard, Network, Port Scanner, Detections, Prevention, Packet Capture, Reports, Settings.
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
