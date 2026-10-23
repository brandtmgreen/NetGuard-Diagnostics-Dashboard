/**
 * Safe fetch helper for JSON APIs.
 * Prevents "SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON"
 * if the server or proxy returns an HTML error/warmup page during startup.
 */
export async function safeFetchJson<T = any>(
  url: string,
  init?: RequestInit
): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      return null;
    }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
