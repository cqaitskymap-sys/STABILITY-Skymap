export const OPEN_AI_EVENT = "skymap-open-ai";

type OpenDetail = { prompt: string };
let pendingOpen: OpenDetail | null = null;

export function openAiAssistant(prompt?: string) {
  const detail = { prompt: prompt || "" };
  pendingOpen = detail;
  window.dispatchEvent(new CustomEvent(OPEN_AI_EVENT, { detail }));
}

export function takePendingAiOpen() {
  const value = pendingOpen;
  pendingOpen = null;
  return value;
}
