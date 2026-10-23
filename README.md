# NetGuard Diagnostics & Security Control Dashboard

NetGuard is a high-performance, full-stack local and enterprise security orchestration hub. It combines real-time network diagnostics, interactive global threat tracing, a fully active Host Intrusion Detection (IDS) overlay, an intelligent terminal CLI, and an adaptive sequential mitigation task engine.

Built using **React (with Vite)** on the frontend, styled with high-contrast tactical cyber-deck aesthetics using **Tailwind CSS**, and backed by a bundled **Express server**, NetGuard is designed for rapid local deployment, secure self-hosting, or complete commercial distribution as a standalone software package.

---

## 🌟 Core Functional Capabilities

### 1. Interactive Tactical Global Threat Heat Map & Automated Forensic Sweep
- **Live Geographical Packet Tracing**: Visualizes inbound IP coordinates using equirectangular projection onto a customized cyber-slate map grid.
- **Dynamic Connection Streams**: Renders active flow lines between hostile external nodes and the primary server gateway.
- **Automated Forensic Swapper**: One-click deep audit executing automated WHOIS directory lookups, reputational threat scores, network routing hops (traceroute simulation), and reverse DNS hostname audits.

### 2. Network Diagnostics Console & AI Assistant
- **Live Interactive Shell**: Executes diagnostic commands like `ping`, `traceroute`, `ifconfig`, `netstat`, `nmap`, and `clear`.
- **Intelligent LLM Debugger**: Integrated server-side with Gemini API to provide rapid, localized instructions and remediation advice for network anomalies and alert items.
- **Telemetry Indicators**: Tracks system clock (UTC), latency averages, packet loss rates, and node activity markers.

### 3. Intrusion Shield (IDS) & Firewall Control Desk
- **Stateful Socket Monitor**: Active switches to arm/disarm the global socket intrusion tracking.
- **Live Security Audits**: Logged timeline of network events, remote IP probes, and device state changes.
- **Dynamic Port Blocks & Firewall Rules**: Live security rule creator allowing users to draft active packet-blocking parameters (Accept, Reject, Drop) for IP subnets and ports.

### 4. Sequential Mitigation Task Planner
- **Strict Dependency Resolution**: Supports linear dependency chains (`Task B` requires `Task A`). Prevents resolving tasks when prerequisites are incomplete, throwing localized visual warning banners.
- **Mitigation Pipelines Map**: Visualizes the active security workflows and dependency pipelines. Highlights completed steps, locked states, and upcoming milestones using dynamic lucide visual indicators.
- **Circular Check Safeguards**: Advanced form algorithms prevent setting circular dependencies, blocking recursive references before they save.

### 5. Multi-Device Network Explorer
- **System Topography**: Interactive list of local devices (routers, hypervisors, server clusters, worker nodes) tracking active IP/MAC configurations, online presence, and warning thresholds.
- **Traffic Spreader**: Measures real-time TX/RX bandwidth outputs per device.

---

## 🚀 Quick Start: Run Locally (Node.js Bare-Metal)

Follow these instructions to run NetGuard directly on your local developer machine.

### 1. Prerequisites
- **Node.js**: `v18.x` or higher (compatible with standard LTS versions)
- **npm**: `v9.x` or higher

### 2. Setup Configuration
Copy the sample environment file to configure local variables:
```bash
cp .env.example .env
```
Open `.env` in your text editor and specify your configurations:
- `GEMINI_API_KEY`: Set your Google AI Studio Gemini API key to enable intelligent troubleshooting in the terminal.
- `APP_URL`: Set to `http://localhost:3000` for standard local executions.

### 3. Installation
Install all production and compilation dependencies:
```bash
npm install
```

### 4. Running the Development Server
Starts the fast-updating development environment using `tsx` (TypeScript Execute) for the backend and Vite for the React frontend:
```bash
npm run dev
```
Open your browser and navigate to **`http://localhost:3000`** to access the dashboard.

### 5. Production Compilation & Start
To bundle the frontend assets and compile the Express backend into a single robust production package, run:
```bash
npm run build
npm start
```
The application will bundle, write minimized static files to `/dist`, and build a high-performance, single-bundle server module under `dist/server.cjs` that launches on port `3000`.

---

## 🐳 Quick Start: Docker Orchestration (Recommended for Self-Hosting)

NetGuard is fully dockerized with a highly optimized multi-stage `Dockerfile` and `docker-compose.yml` configuration, allowing you to bundle and spin up the complete application in a single terminal action.

### 1. Launch with Docker Compose
Simply run:
```bash
docker compose up -d --build
```
This builds the production package and launches the containerized web platform. Access the running dashboard instantly at **`http://localhost:3000`**.

To shut down the services, run:
```bash
docker compose down
```

### 2. Direct Container Construction
If you prefer running the container image directly without Compose orchestration:
```bash
# Build the Docker image
docker build -t netguard-dashboard .

# Start the container on port 3000 (binds container port 3000 to host port 3000)
docker run -d -p 3000:3000 --env GEMINI_API_KEY="YOUR_API_KEY_HERE" netguard-dashboard
```

---

## 💼 Commercial Distribution & Packaging Guide (Selling NetGuard)

To package and distribute NetGuard as a closed-source or commercial standalone application for enterprise or end-user licensing, you have several highly viable paths:

### 1. Desktop App Wrapper (Electron / Tauri)
You can wrap the Node/Express server and the React GUI into a native, single-executable cross-platform desktop application:
- **Tauri (Recommended)**: Offers extremely lightweight builds (< 15MB) with rapid Rust-backed performance. You can let Tauri launch the Express backend on a local port internally and load the index in its system webview.
- **Electron**: Highly standard. Configures Electron's main process to spawn the Express server child-process on start, then opens a BrowserWindow pointing to `localhost:3000`. You can compile this into native `.exe` (Windows), `.app`/`.dmg` (macOS), or `.deb`/`.rpm` (Linux) installers using `electron-builder`.

### 2. Standalone Binary Compilation (Node SEA / pkg)
To distribute NetGuard as a single command-line executable without forcing users to install Node.js:
- **Node Single Executable Applications (SEA)**: Build native, self-contained binaries natively using newer Node.js features by injecting your bundled `dist/server.cjs` and the static `/dist` client assets directly into the node runtime binary itself.
- **pkg (Vercel)**: Compile the project into a single, fully self-contained binary:
  ```bash
  # Install the packaging library
  npm install -g pkg
  # Compile for Windows, macOS, and Linux
  pkg . --targets node18-win-x64,node18-macos-x64,node18-linux-x64 --out-path bin/
  ```

---

## 📁 Technical Architecture

Here is an overview of the modular codebase:
```
├── /dist/                  # Compiled production React SPA assets and Server CJS bundles
├── /src/
│   ├── /components/        # Extracted UI elements
│   │   ├── SecurityHeatMap.tsx   # Threat tracer maps and WHOIS automated trace modules
│   │   ├── TaskPlanner.tsx       # Scheduler with dependency maps, locks, and pipeline tracks
│   │   ├── DeviceExplorer.tsx    # Device telemetry, ping grids, and online statuses
│   │   ├── TerminalConsole.tsx   # Interactive command CLI & Gemini API troubleshooter
│   │   ├── SecurityCenter.tsx    # Central firewall rules form, alert trackers, and active logs
│   │   └── SecurityReports.tsx   # Dynamic charts, vulnerability indexes, and report builders
│   ├── App.tsx             # Central state coordinator and core navigation routers
│   ├── main.tsx            # React application mounting entry-point
│   ├── index.css           # Global Tailwind v4 style config and custom font definitions
│   └── types.ts            # Centralized TypeScript models and interfaces
├── server.ts               # Core full-stack Express server, API proxy, and asset provider
├── Dockerfile              # Multi-stage production container config
├── docker-compose.yml      # Orchestration metadata
└── package.json            # Build scripts, project dependencies, and bundling procedures
```

---

## 🔒 Security Best Practices for Self-Hosting
- **Reverse Proxying**: Always front local installations with a reverse proxy like **Nginx**, **Caddy**, or **Cloudflare Tunnels** to enable SSL (HTTPS) and rate-limit authentication thresholds.
- **Environment Safety**: Keep the `.env` file secured on your server with `chmod 600` access rules. Never commit secrets, API keys, or private access credentials into public source-control repositories.
