import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export function getOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing. Add it to .env.local.");
  }
  return createOpenRouter({
    apiKey,
    appName: "SKYMAP Stability Inventory",
    appUrl: process.env.OPENROUTER_SITE_URL || "https://stability-skymap.local",
  });
}

export function getOpenRouterModelId() {
  return process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
}

/** Gemini Flash otherwise reserves ~65k output tokens, which OpenRouter bills against remaining credits. */
export const AI_MAX_OUTPUT_TOKENS = 1024;
