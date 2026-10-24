import { powershellJson, nowIso, sanitizeText } from "./util.js";

export interface WindowsEvent {
  id: number;
  timestamp: string;
  provider: string;
  level: string;
  message: string;
}

export async function getSecurityEvents(limit = 30): Promise<WindowsEvent[]> {
  try {
    const raw = await powershellJson<
      Array<{ TimeCreated?: string; Id?: number; ProviderName?: string; LevelDisplayName?: string; Message?: string }>
      >(
        `$e=Get-WinEvent -LogName Security -MaxEvents ${Math.max(10, Math.min(100, limit))} -ErrorAction SilentlyContinue | Where-Object { $_.Id -in @(4625,5156,5157,4688,7045) } | Select-Object -First ${limit} TimeCreated,Id,ProviderName,LevelDisplayName,Message; $e | ConvertTo-Json -Compress -Depth 3`,
        30000
      );
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return list.map((event) => ({
      id: Number(event.Id || 0),
      timestamp: event.TimeCreated ? new Date(event.TimeCreated).toISOString() : nowIso(),
      provider: String(event.ProviderName || ""),
      level: String(event.LevelDisplayName || ""),
      message: sanitizeText(event.Message || "", 2000),
    }));
  } catch {
    return [];
  }
}
