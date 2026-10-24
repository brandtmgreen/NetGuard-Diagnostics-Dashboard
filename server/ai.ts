import { GoogleGenAI } from "@google/genai";

export interface AiStatus {
  configured: boolean;
  model: string;
  message: string;
}

export class AiService {
  private client: GoogleGenAI | null = null;
  private model: string;

  constructor(model: string) {
    this.model = model;
  }

  setModel(model: string): void {
    this.model = model;
  }

  getStatus(): AiStatus {
    const configured = Boolean(process.env.GEMINI_API_KEY);
    return {
      configured,
      model: this.model,
      message: configured
        ? "Gemini is configured. AI output is advisory only."
        : "GEMINI_API_KEY is not set. AI analysis is unavailable; no simulated answers are returned.",
    };
  }

  private getClient(): GoogleGenAI {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not configured.");
    if (!this.client) {
      this.client = new GoogleGenAI({
        apiKey: key,
        httpOptions: { headers: { "User-Agent": "netguard-local" } },
      });
    }
    return this.client;
  }

  async analyze(prompt: string, context: string): Promise<string> {
    if (!prompt.trim()) throw new Error("A prompt is required.");
    const client = this.getClient();
    const response = await client.models.generateContent({
      model: this.model,
      contents: `You are NetGuard's defensive security analyst. Analyze only the supplied local telemetry. Never claim that you executed a command, changed a firewall rule, or blocked an address. Recommendations must be manual and reversible. Be concise and explicit about uncertainty.\n\nLOCAL TELEMETRY:\n${context.slice(0, 12000)}\n\nANALYST QUESTION:\n${prompt.slice(0, 4000)}`,
    });
    const text = response.text?.trim();
    if (!text) throw new Error("Gemini returned an empty response.");
    return text;
  }
}
