const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
};

export const api = {
  state: () => request<import("./types").AppState>("/api/state"),
  health: () => request<Record<string, unknown>>("/api/health"),
  settings: (patch: Partial<import("./types").Settings>) =>
    request<import("./types").Settings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  acknowledgeAlert: (id: string) =>
    request<import("./types").Alert>(`/api/alerts/${encodeURIComponent(id)}/ack`, {
      method: "POST",
      body: "{}",
    }),
  ignoreAlert: (id: string) =>
    request<import("./types").Alert>(`/api/alerts/${encodeURIComponent(id)}/ignore`, {
      method: "POST",
      body: "{}",
    }),
  block: (ip: string, direction: "Inbound" | "Outbound" | "Both", durationMinutes: number) =>
    request<{ rules: unknown[] }>("/api/firewall/block", {
      method: "POST",
      body: JSON.stringify({ ip, direction, durationMinutes, confirm: true }),
    }),
  unblock: (name: string) =>
    request<{ ok: boolean }>(`/api/firewall/rules/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),
  captureInterfaces: () => request<import("./types").CaptureInterface[]>("/api/capture/interfaces"),
  startCapture: (interfacePath: string, filter: string) =>
    request<import("./types").CaptureStatus>("/api/capture/start", {
      method: "POST",
      body: JSON.stringify({ interface: interfacePath, filter }),
    }),
  stopCapture: () =>
    request<import("./types").CaptureStatus>("/api/capture/stop", { method: "POST", body: "{}" }),
  packets: (limit = 300) =>
    request<{ packets: import("./types").Packet[]; status: import("./types").CaptureStatus }>(
      `/api/capture/packets?limit=${limit}`
    ),
  scan: (target: string, profile: string) =>
    request<import("./types").NmapResult>("/api/scan", {
      method: "POST",
      body: JSON.stringify({ target, profile }),
    }),
  terminal: (command: string) =>
    request<{ output: string }>("/api/terminal", {
      method: "POST",
      body: JSON.stringify({ command }),
    }),
  ai: (prompt: string) =>
    request<{ text: string; model: string }>("/api/ai/analyze", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),
  reports: () => request<import("./types").Report[]>("/api/reports"),
  generateReport: () =>
    request<import("./types").Report>("/api/reports/generate", { method: "POST", body: "{}" }),
};
