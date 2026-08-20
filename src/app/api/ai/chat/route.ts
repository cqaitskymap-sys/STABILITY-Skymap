import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { aiErrorMessage } from "@/lib/ai/errors";
import { AI_MAX_OUTPUT_TOKENS, getOpenRouter, getOpenRouterModelId } from "@/lib/ai/openrouter";
import { QA_ASSISTANT_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { requireSignedInUser } from "@/lib/ai/verify-user";

export const maxDuration = 60;

function snapshotText(context: unknown) {
  const raw = JSON.stringify(context ?? {});
  return raw.length > 60_000 ? `${raw.slice(0, 60_000)}…[truncated]` : raw;
}

export async function POST(request: Request) {
  const user = await requireSignedInUser(request);
  if (!user) {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json({ error: "AI is not configured. Add OPENROUTER_API_KEY to .env.local." }, { status: 500 });
  }

  const body = (await request.json()) as { messages?: UIMessage[]; context?: unknown };
  const messages = body.messages ?? [];
  if (!messages.length) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }

  try {
    const openrouter = getOpenRouter();
    const result = streamText({
      model: openrouter(getOpenRouterModelId()),
      system: `${QA_ASSISTANT_SYSTEM_PROMPT}\n\nLive inventory snapshot:\n${snapshotText(body.context)}`,
      messages: await convertToModelMessages(messages),
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => aiErrorMessage(error),
    });
  } catch (error) {
    return Response.json({ error: aiErrorMessage(error) }, { status: 502 });
  }
}
