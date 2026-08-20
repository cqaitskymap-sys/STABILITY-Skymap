import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { aiErrorMessage } from "@/lib/ai/errors";
import {
  AI_MAX_OUTPUT_TOKENS,
  getOpenRouter,
  getOpenRouterModelId,
  missingAiConfigResponse,
  snapshotText,
} from "@/lib/ai/openrouter";
import { QA_ASSISTANT_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
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

    const body = (await request.json()) as { messages?: UIMessage[]; context?: unknown };
    const messages = body.messages ?? [];
    if (!messages.length) {
      return Response.json({ error: "Message is required." }, { status: 400 });
    }

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
    console.error("AI chat failed:", error);
    return Response.json({ error: aiErrorMessage(error) }, { status: 502 });
  }
}
