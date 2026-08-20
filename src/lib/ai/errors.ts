export function aiErrorMessage(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "AI request failed.";

  if (/credits|max_tokens|402/i.test(message)) {
    return "OpenRouter credit limit reached for this request. Retry after the token cap, or add credits at openrouter.ai/settings/credits.";
  }

  return message;
}
