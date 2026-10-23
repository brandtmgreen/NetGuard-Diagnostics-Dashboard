import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiInstance: GoogleGenAI | null = null;
let cachedKey: string | undefined;

export function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return null;
  }
  if (!aiInstance || cachedKey !== key) {
    cachedKey = key;
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface GeminiRetryResult {
  text: string | null;
  groundingSources: GroundingSource[];
  quotaExhausted: boolean;
  errorMessage?: string;
}

function isQuotaOrRateLimitError(err: any): boolean {
  const msg = String(err?.message || err || "");
  return (
    err?.status === 429 ||
    err?.code === 429 ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota") ||
    msg.includes("rate-limits")
  );
}

function extractGroundingSources(response: any): GroundingSource[] {
  const sources: GroundingSource[] = [];
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (Array.isArray(chunks)) {
    for (const chunk of chunks) {
      if (chunk?.web?.uri) {
        sources.push({
          title: chunk.web.title || chunk.web.uri,
          uri: chunk.web.uri,
        });
      }
    }
  }
  return sources;
}

export async function callGeminiWithRetry(options: {
  prompt: string;
  useSearch?: boolean;
}): Promise<GeminiRetryResult> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      text: null,
      groundingSources: [],
      quotaExhausted: false,
      errorMessage: "GEMINI_API_KEY is not configured.",
    };
  }

  // Attempt 1: gemini-3.8-flash with optional Google Search grounding
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: options.prompt,
      config: options.useSearch ? { tools: [{ googleSearch: {} }] } : undefined,
    });
    return {
      text: response.text || null,
      groundingSources: extractGroundingSources(response),
      quotaExhausted: false,
    };
  } catch (primaryErr: any) {
    const quotaHit = isQuotaOrRateLimitError(primaryErr);

    // Attempt 2: Fallback to gemini-3.1-flash-lite without googleSearch tool
    // (Search grounding and flash models have separate rate-limit buckets)
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const fallbackResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: options.prompt,
      });
      return {
        text: fallbackResponse.text || null,
        groundingSources: extractGroundingSources(fallbackResponse),
        quotaExhausted: false,
      };
    } catch (fallbackErr: any) {
      const finalQuotaHit = quotaHit || isQuotaOrRateLimitError(fallbackErr);
      return {
        text: null,
        groundingSources: [],
        quotaExhausted: finalQuotaHit,
        errorMessage: String(fallbackErr?.message || primaryErr?.message || "Gemini request failed"),
      };
    }
  }
}
