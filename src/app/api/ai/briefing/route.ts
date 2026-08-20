import { generateText } from "ai";
import { aiErrorMessage } from "@/lib/ai/errors";
import { AI_MAX_OUTPUT_TOKENS, getOpenRouter, getOpenRouterModelId } from "@/lib/ai/openrouter";
import { QA_ASSISTANT_SYSTEM_PROMPT, QA_BRIEFING_PROMPT } from "@/lib/ai/system-prompt";
import { requireSignedInUser } from "@/lib/ai/verify-user";

export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await requireSignedInUser(request);
  if (!user) {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json({ error: "AI is not configured. Add OPENROUTER_API_KEY to .env.local." }, { status: 500 });
  }

  try {
    const body = (await request.json()) as { context?: unknown };
    const openrouter = getOpenRouter();
    const { text } = await generateText({
      model: openrouter(getOpenRouterModelId()),
      system: QA_ASSISTANT_SYSTEM_PROMPT,
      prompt: `${QA_BRIEFING_PROMPT}\n\nLive inventory snapshot:\n${JSON.stringify(body.context ?? {})}`,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    });

    return Response.json({ text });
  } catch (error) {
    return Response.json({ error: aiErrorMessage(error) }, { status: 502 });
  }
}
