import "dotenv/config";
import express from "express";
import path from "node:path";
import { AiService } from "./server/ai.js";
import { apiErrorHandler, createApi } from "./server/api.js";
import { CaptureService } from "./server/capture.js";
import { DetectionEngine } from "./server/detection.js";
import { getSecurityEvents } from "./server/eventlog.js";
import { PreventionService } from "./server/prevention.js";
import { Store } from "./server/store.js";
import { Telemetry } from "./server/telemetry.js";
import { WindowsEventInfo } from "./server/types.js";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.NETGUARD_HOST || "127.0.0.1";

app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
  }
  next();
});

const store = new Store();
const telemetry = new Telemetry();
const capture = new CaptureService();
let windowsEvents: WindowsEventInfo[] = [];
const prevention = new PreventionService(
  store,
  () => telemetry.getLocalAddresses(),
  () => telemetry.getGateway()
);
const detector = new DetectionEngine((alert) => {
  store.addAlert(alert);
  void prevention.handleAlert(alert);
});
const ai = new AiService(store.getSettings().geminiModel);
// Firewall enumeration is slow on some Windows hosts; warm the cache in the
// background so /api/state stays responsive.
void prevention.listRules().catch(() => undefined);
const localAddressTimer = setInterval(
  () => detector.setLocalAddresses(telemetry.getLocalAddresses()),
  3000
);
const connectionTimer = setInterval(() => {
  detector.ingestConnections(telemetry.getConnections());
}, 3000);
const eventTimer = setInterval(() => {
  void getSecurityEvents(30).then((events) => {
    windowsEvents = events;
    detector.ingestWindowsEvents(events);
  }).catch(() => undefined);
}, 60000);
void getSecurityEvents(30).then((events) => {
  windowsEvents = events;
  detector.ingestWindowsEvents(events);
}).catch(() => undefined);

capture.on("packet", (packet) => detector.ingestPacket(packet));

app.use("/api", createApi({ store, telemetry, capture, detector, prevention, ai, events: () => windowsEvents }));
app.use(apiErrorHandler);

async function startServer(): Promise<void> {
  await telemetry.start();
  detector.setLocalAddresses(telemetry.getLocalAddresses());

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = __dirname;
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`[NetGuard] control plane: http://${HOST}:${PORT}`);
    console.log(`[NetGuard] admin=${telemetry.getHost().isAdmin} tshark=${capture.getStatus().tsharkPath || "missing"}`);
  });

  server.on("error", (error) => {
    console.error("[NetGuard] server error:", error.message);
    process.exitCode = 1;
  });

  const shutdown = (): void => {
    clearInterval(localAddressTimer);
    clearInterval(connectionTimer);
    clearInterval(eventTimer);
    capture.stop();
    detector.stop();
    prevention.stop();
    telemetry.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 3000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer().catch((error) => {
  console.error("[NetGuard] failed to start:", error);
  process.exit(1);
});
