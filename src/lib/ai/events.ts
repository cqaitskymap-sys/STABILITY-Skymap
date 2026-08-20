export const OPEN_AI_EVENT = "skymap-open-ai";

export function openAiAssistant(prompt?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_AI_EVENT, { detail: { prompt: prompt || "" } }));
}
