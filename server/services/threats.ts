import type { SuspiciousActivity } from "../../src/types";
import { getLiveConnections, LiveConnection } from "./network";
import { getGeo } from "./intel";

export interface LiveThreat extends SuspiciousActivity {
  geo?: {
    lat: number;
    lng: number;
    city: string;
    country: string;
    countryCode: string;
  };
  process: string;
}

function classifyThreat(conn: LiveConnection): {
  type: LiveThreat["type"];
  severity: LiveThreat["severity"];
} {
  switch (conn.port) {
    case 445:
    case 139:
      return { type: "Potential Intrusion", severity: "critical" };
    case 3389:
      return { type: "Brute Force", severity: "critical" };
    case 23:
    case 21:
      return { type: "Brute Force", severity: "high" };
    case 22:
      return { type: "Brute Force", severity: "medium" };
    case 53:
      return { type: "Unusual Traffic Spike", severity: "medium" };
    case 80:
    case 443:
      return { type: "Unusual Traffic Spike", severity: "low" };
    default:
      return { type: "Unusual Traffic Spike", severity: conn.proto === "UDP" ? "medium" : "low" };
  }
}

export async function getLiveThreats(limit = 10): Promise<LiveThreat[]> {
  const connections = await getLiveConnections();
  const grouped = new Map<string, LiveConnection>();
  for (const c of connections) {
    const existing = grouped.get(c.ip);
    if (!existing || c.count > existing.count) grouped.set(c.ip, c);
  }

  const unique = Array.from(grouped.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  const threats: LiveThreat[] = await Promise.all(
    unique.map(async (conn) => {
      const geo = await getGeo(conn.ip);
      const { type, severity } = classifyThreat(conn);
      const now = new Date();
      return {
        id: `live-${conn.ip}-${conn.port}-${conn.proto}-${now.getTime()}`,
        timestamp: now.toLocaleTimeString("en-GB"),
        srcIp: conn.ip,
        destIp: "0.0.0.0",
        protocol: conn.proto === "UDP" ? "UDP" : "TCP",
        destPort: String(conn.port),
        type,
        severity,
        packetSize: `${conn.count} conn`,
        reason: `Live ${conn.proto} connection to ${conn.ip}:${conn.port} via ${conn.process} (${conn.state}).`,
        status: "active",
        process: conn.process,
        geo: geo
          ? {
              lat: geo.lat,
              lng: geo.lng,
              city: geo.city,
              country: geo.country,
              countryCode: geo.countryCode,
            }
          : {
              lat: 0,
              lng: 0,
              city: "Unknown",
              country: "Unknown",
              countryCode: "??",
            },
      };
    })
  );

  return threats;
}
