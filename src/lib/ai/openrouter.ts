import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export function getOpenRouterSiteUrl() {
  if (process.env.OPENROUTER_SITE_URL) return process.env.OPENROUTER_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://stability-skymap.vercel.app";
}

export function getOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }
  return createOpenRouter({
    apiKey,
    appName: "SKYMAP Stability Inventory",
    appUrl: getOpenRouterSiteUrl(),
  });
}

export function getOpenRouterModelId() {
  return process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
}

export function snapshotText(context: unknown, maxChars = 60_000) {
  const raw = JSON.stringify(context ?? {});
  return raw.length > maxChars ? `${raw.slice(0, maxChars)}…[truncated]` : raw;
}

export function missingAiConfigResponse() {
  if (process.env.OPENROUTER_API_KEY) return null;
  console.error("OPENROUTER_API_KEY is not set on this deployment.");
  return Response.json(
    {
      error:
        "AI is not configured. Add OPENROUTER_API_KEY in Vercel → Project → Settings → Environment Variables (Production), then Redeploy.",
    },
    { status: 503 },
  );
}

/** Gemini Flash otherwise reserves ~65k output tokens, which OpenRouter bills against remaining credits. */
export const AI_MAX_OUTPUT_TOKENS = 1024;
