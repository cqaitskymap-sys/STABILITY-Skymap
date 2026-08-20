import { generateText } from "ai";
import { aiErrorMessage } from "@/lib/ai/errors";
import {
  AI_MAX_OUTPUT_TOKENS,
  getOpenRouter,
  getOpenRouterModelId,
  missingAiConfigResponse,
  snapshotText,
} from "@/lib/ai/openrouter";
import { QA_BRIEFING_PROMPT } from "@/lib/ai/system-prompt";
import { requireSignedInUser } from "@/lib/ai/verify-user";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await requireSignedInUser(request);
    if (!user) {
      return Response.json({ error: "Sign in required." }, { status: 401 });
    }

    const configError = missingAiConfigResponse();
    if (configError) return configError;

    const body = (await request.json()) as { context?: unknown };
    const openrouter = getOpenRouter();
    const { text } = await generateText({
      model: openrouter(getOpenRouterModelId()),
      system:
        "You are SkyMap QA Assistant. Use only the live inventory snapshot. Never invent counts, dates, or names.",
      prompt: `${QA_BRIEFING_PROMPT}\n\nLive inventory snapshot:\n${snapshotText(body.context)}`,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    });

    return Response.json({ text });
  } catch (error) {
    console.error("AI briefing failed:", error);
    return Response.json({ error: aiErrorMessage(error) }, { status: 502 });
  }
}
