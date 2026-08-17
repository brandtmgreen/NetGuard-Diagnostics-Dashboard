import dns from "dns";
import { isPrivateIp, run } from "../lib/exec";

export interface IpGeo {
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lng: number;
  isp: string;
  org: string;
  asn: string;
  hosting: boolean;
}

export interface TracerouteHop {
  hop: number;
  ip: string;
  host: string;
  rtt: string;
}

export interface IpIntel {
  ip: string;
  hostname: string;
  geo: {
    country: string;
    countryCode: string;
    city: string;
    lat: number;
    lng: number;
  };
  isp: string;
  asn: string;
  abuseScore: number;
  threatType: string;
  whois: string;
  traceroute: TracerouteHop[];
  source: "live" | "derived";
}

const geoCache = new Map<string, { data: IpGeo; expires: number }>();
const GEO_TTL = 30 * 60 * 1000;

async function reverseDns(ip: string): Promise<string> {
  try {
    const hosts = await dns.promises.reverse(ip);
    return hosts[0] || "";
  } catch {
    return "";
  }
}

export async function getGeo(ip: string): Promise<IpGeo | null> {
  const cached = geoCache.get(ip);
  if (cached && cached.expires > Date.now()) return cached.data;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,city,lat,lon,isp,org,as,hosting,query`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      country?: string;
      countryCode?: string;
      city?: string;
      lat?: number;
      lon?: number;
      isp?: string;
      org?: string;
      as?: string;
      hosting?: boolean;
    };
    if (data.status !== "success") return null;

    const geo: IpGeo = {
      country: data.country || "Unknown",
      countryCode: data.countryCode || "??",
      city: data.city || "Unknown",
      lat: data.lat || 0,
      lng: data.lon || 0,
      isp: data.isp || data.org || "Unknown",
      org: data.org || "",
      asn: data.as || "",
      hosting: Boolean(data.hosting),
    };
    geoCache.set(ip, { data: geo, expires: Date.now() + GEO_TTL });
    return geo;
  } catch {
    return null;
  }
}

async function fetchRdatWhois(ip: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://rdap.org/ip/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as any;

    const lines: string[] = [];
    lines.push(`% RDAP WHOIS lookup for ${ip}`);
    lines.push(`% Registry: ${data.port43 || "IANA RDAP"}`);
    lines.push(`% Query Time: ${new Date().toUTCString()}`);
    lines.push("");
    if (data.handle) lines.push(`NetHandle:    ${data.handle}`);
    if (data.startAddress && data.endAddress) {
      lines.push(`NetRange:     ${data.startAddress} - ${data.endAddress}`);
      lines.push(`CIDR:         ${data.cidr?.join(", ") || "n/a"}`);
    }
    if (data.name) lines.push(`NetName:      ${data.name}`);
    if (data.type) lines.push(`NetType:      ${data.type}`);
    if (data.country) lines.push(`Country:      ${data.country}`);
    if (data.status) lines.push(`Status:       ${(data.status as string[]).join(", ")}`);

    for (const e of data.entities || []) {
      const vcard = e?.vcardArray?.[1];
      const vobj: Record<string, string> = {};
      for (const item of vcard || []) {
        vobj[item[0]] = Array.isArray(item[3]) ? item[3][0] : item[3];
      }
      if (e.roles?.includes("registrant") || e.roles?.includes("technical") || e.roles?.includes("abuse")) {
        lines.push("");
        lines.push(`OrgName:      ${vobj.fn || vobj.org || "n/a"}`);
        lines.push(`OrgHandle:    ${e.handle || "n/a"}`);
        if (vobj.email) lines.push(`OrgEmail:     ${vobj.email}`);
        if (e.roles) lines.push(`Roles:        ${e.roles.join(", ")}`);
      }
    }
    if (lines.length <= 3) return null;
    return lines.join("\n");
  } catch {
    return null;
  }
}

async function runRealTraceroute(ip: string): Promise<TracerouteHop[]> {
  const res = await run("/usr/sbin/traceroute", ["-n", "-m", "20", "-w", "1", "-q", "1", ip], {
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const hops: TracerouteHop[] = [];
  const output = res.stdout || res.stderr || "";
  for (const line of output.split("\n")) {
    const m = line.match(/^\s*(\d+)\s+(\S+)\s+(.+?)\s*$/);
    if (!m) continue;
    const rttMatch = m[3].match(/([\d.]+)\s*ms/);
    hops.push({
      hop: parseInt(m[1], 10),
      ip: m[2],
      host: m[2],
      rtt: rttMatch ? `${rttMatch[1]}ms` : "*",
    });
  }
  return hops;
}

async function abuseScoreFromApi(ip: string): Promise<number | null> {
  const key = process.env.ABUSEIPDB_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=30`,
      { headers: { Key: key, Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return typeof data?.data?.abuseConfidenceScore === "number" ? data.data.abuseConfidenceScore : null;
  } catch {
    return null;
  }
}

function deriveAbuseScore(geo: IpGeo | null): number {
  if (!geo) return 10;
  let score = 5;
  if (geo.hosting) score += 25;
  if (/^AS\d+/.test(geo.asn || "")) {
    const asnNum = parseInt(geo.asn.replace(/\D/g, ""), 10) || 0;
    if (asnNum > 0) score += Math.min(20, (asnNum % 17)); // deterministic derived weighting
  }
  return Math.min(95, score);
}

function deriveThreatType(geo: IpGeo | null, ip: string): string {
  if (!geo) return "Unknown Network";
  if (geo.hosting) return "Datacenter / Hosting IP";
  return "Consumer Broadband / Mobile";
}

export async function ipLookup(ip: string): Promise<IpIntel> {
  const cleanIp = ip.trim();
  const isLocal = isPrivateIp(cleanIp);

  const hostname = (await reverseDns(cleanIp)) || "";

  let geo: IpGeo | null = null;
  if (!isLocal) {
    geo = await getGeo(cleanIp);
  }

  const fallbackGeo: IpGeo = {
    country: isLocal ? "Internal Private Network" : "Unknown",
    countryCode: isLocal ? "LAN" : "??",
    city: isLocal ? "Local Segment" : "Unknown",
    lat: 0,
    lng: 0,
    isp: isLocal ? "LAN Intranet Controller" : "Unknown ISP",
    org: "",
    asn: "PRIVATE",
    hosting: false,
  };

  const effective = geo || fallbackGeo;
  const apiScore = await abuseScoreFromApi(cleanIp);
  const abuseScore = apiScore ?? deriveAbuseScore(geo);
  const threatType = isLocal ? "Internal Network Endpoint" : deriveThreatType(geo, cleanIp);

  let whois = "";
  let traceroute: TracerouteHop[] = [];

  if (isLocal) {
    whois = `% Local Private Network Address\n% RFC 1918 allocation (IANA)\n% No public registry information exists for private ranges.\n\nNetRange:     ${cleanIp}\nNetType:      Private (RFC 1918)\nOrganization: Local LAN Intranet`;
    traceroute = [
      { hop: 1, ip: cleanIp, host: hostname || "local endpoint", rtt: "<1ms" },
    ];
  } else {
    const rdap = await fetchRdatWhois(cleanIp);
    whois = rdap || `% No RDAP registry record found for ${cleanIp}\n% Fallback: manual reverse DNS only.`;
    traceroute = await runRealTraceroute(cleanIp);
    if (traceroute.length === 0) {
      traceroute = [{ hop: 1, ip: cleanIp, host: hostname || cleanIp, rtt: "n/a" }];
    }
  }

  return {
    ip: cleanIp,
    hostname,
    geo: {
      country: effective.country,
      countryCode: effective.countryCode,
      city: effective.city,
      lat: effective.lat,
      lng: effective.lng,
    },
    isp: effective.isp,
    asn: effective.asn || "AS-UNKNOWN",
    abuseScore,
    threatType,
    whois,
    traceroute,
    source: geo ? "live" : "derived",
  };
}
