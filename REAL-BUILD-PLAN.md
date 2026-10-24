# NetGuard — Real IDS/IPS Build Plan

## Goal
Replace every simulated value with real Windows/host telemetry and a safe, auditable prevention path. Ship as a Windows desktop app with a local-only control plane.

## Non-negotiable guardrails
- Bind API to `127.0.0.1` only; generated API token required for mutating calls.
- Prevention defaults to **monitor**. Blocking requires an explicit arm action and admin privileges.
- Never auto-block loopback, RFC1918/private LAN, the default gateway, DNS, or the NetGuard host.
- Automatic blocks expire (default 15 min) and are written to an audit log.
- AI output is advisory only; it never executes a command or changes a firewall rule.
- No fake fallback data. If a collector is unavailable, return an explicit `unavailable` state.

## Architecture
```
Electron shell
  └─ localhost:3000 (Express)
       ├─ TelemetryService: interfaces, routes, neighbors, TCP connections, processes, stats
       ├─ CaptureService: tshark/Npcap live packet stream (admin)
       ├─ DetectionEngine: rules over packets + connection deltas
       ├─ FirewallService: Windows Firewall audit + scoped block rules (admin)
       ├─ EventLogService: Security log 4625/5156/5157/4688/7045
       ├─ Store: JSON state (alerts, rules, settings, audit)
       └─ AI: Gemini advisory against real context, no simulated answer
```

## Phases
1. **Real core**: replace mock endpoints, real dashboard data, remove mock UI state.
2. **Capture + detections**: tshark streaming, port-scan/brute-force/flood rules, live alerts.
3. **Prevention**: Windows Firewall block/unblock with dry-run, admin checks, expiry, audit.
4. **Event log**: ingest Windows Security events and correlate with connections.
5. **Hardening**: localhost-only, API token, CSP, input validation, rate limits, redacted logs.
6. **Market readiness**: Windows service, signed installer, UAC manifest, settings/onboarding, tests, docs, privacy policy.

## Current verified environment (2026-10-23)
- Windows 10.0.19045, admin shell.
- Npcap 1.86 driver running; Npcap binding enabled on Ethernet.
- Wireshark/tshark at `C:\Program Files\Wireshark\tshark.exe`.
- Nmap at `C:\Program Files (x86)\Nmap\nmap.exe`.
- Real capture verified on `\Device\NPF_{D54693E8-...}` (Ethernet).
