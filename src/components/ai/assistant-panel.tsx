"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Sparkles, Send, Square, X, Bot } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { executeSkymapTool } from "@/lib/ai/execute-tool";
import { getInventoryContext } from "@/lib/ai/inventory-context";
import { OPEN_AI_EVENT } from "@/lib/ai/events";
import { TOOL_LABELS } from "@/lib/ai/tools";

const SUGGESTIONS = [
  "Add product Paracetamol 500 mg tablet, code PCM-500",
  "Which withdrawals are overdue or due today?",
  "Summarize chamber utilization risks",
  "Explain active QA alerts",
];

function messageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function renderRichText(text: string) {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\/stability\/[a-z0-9\-/?=_]+|\/masters\/[a-z0-9\-/?=_]+)/gi;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(
        <Link key={key++} href={token} className="font-medium text-teal-700 underline-offset-2 hover:underline">
          {token}
        </Link>
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function ToolChip({ part }: { part: UIMessage["parts"][number] }) {
  if (!isToolUIPart(part)) return null;
  const name = getToolName(part);
  const label = TOOL_LABELS[name] || name;
  const state = part.state;
  let text = label;
  let tone = "border-slate-200 bg-white text-slate-600";
  if (state === "input-streaming" || state === "input-available") {
    text = `${label}…`;
    tone = "border-teal-200 bg-teal-50 text-teal-800";
  } else if (state === "output-error" || state === "output-denied") {
    text = part.state === "output-error" ? part.errorText || `${label} failed` : `${label} denied`;
    tone = "border-rose-200 bg-rose-50 text-rose-800";
  } else if (state === "output-available") {
    const output = part.output as { ok?: boolean; error?: string } | undefined;
    if (output && output.ok === false) {
      text = output.error || `${label} failed`;
      tone = "border-rose-200 bg-rose-50 text-rose-800";
    } else {
      text = `${label} done`;
      tone = "border-emerald-200 bg-emerald-50 text-emerald-800";
    }
  }
  return <div className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-medium", tone)}>{text}</div>;
}

export function AssistantPanel() {
  const { user, profile, hasPermission } = useAuth();
  const userRef = useRef(user);
  const profileRef = useRef(profile);
  const hasPermissionRef = useRef(hasPermission);
  userRef.current = user;
  profileRef.current = profile;
  hasPermissionRef.current = hasPermission;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        prepareSendMessagesRequest: async ({ id, messages, api, headers }) => {
          const token = await userRef.current?.getIdToken();
          if (!token) throw new Error("Sign in required.");
          const context = await getInventoryContext();
          return {
            api,
            headers: {
              ...(headers as Record<string, string> | undefined),
              Authorization: `Bearer ${token}`,
            },
            body: { id, messages, context },
          };
        },
      }),
    []
  );

  const { messages, sendMessage, status, stop, error, setMessages, addToolOutput } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (err) => toast.error(err.message || "AI request failed."),
    onToolCall: ({ toolCall }) => {
      if (toolCall.dynamic) return;
      void (async () => {
        try {
          const output = await executeSkymapTool({
            name: toolCall.toolName,
            input: toolCall.input,
            profile: profileRef.current,
            hasPermission: hasPermissionRef.current,
          });
          addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output,
          });
        } catch (err) {
          addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            state: "output-error",
            errorText: err instanceof Error ? err.message : "Action failed.",
          });
        }
      })();
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    function onOpen(event: Event) {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt?.trim();
      setOpen(true);
      if (prompt) setQueuedPrompt(prompt);
    }
    window.addEventListener(OPEN_AI_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_AI_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open || !queuedPrompt || busy) return;
    const prompt = queuedPrompt;
    setQueuedPrompt(null);
    void sendMessage({ text: prompt });
  }, [open, queuedPrompt, busy, sendMessage]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  async function submitPrompt() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ text });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await submitPrompt();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-teal-500 to-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-10px_rgba(13,148,136,0.8)] transition hover:from-teal-600 hover:to-teal-800"
        aria-label="Open SkyMap AI assistant"
      >
        <Sparkles className="h-4 w-4" />
        Ask SkyMap
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-[2px]">
          <div className="flex h-full w-full max-w-md flex-col border-l border-white/20 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 px-4 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-400/20 ring-1 ring-white/10">
                  <Bot className="h-5 w-5 text-teal-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold">SkyMap QA Assistant</p>
                  <p className="text-[11px] text-slate-300">Can add products, charge, withdraw, and answer from live data</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {!messages.length ? (
                <div className="rounded-2xl border border-teal-100 bg-teal-50/80 p-4 text-sm text-teal-950">
                  Ask me to add a product, create a batch, charge a study, or withdraw samples — I will do it with your
                  permissions. I can also explain overdue pulls, chambers, and alerts.
                </div>
              ) : null}

              {messages.map((message) => {
                const mine = message.role === "user";
                if (mine) {
                  const text = messageText(message);
                  if (!text) return null;
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[90%] whitespace-pre-wrap rounded-2xl bg-teal-700 px-3.5 py-2.5 text-sm leading-6 text-white">
                        {text}
                      </div>
                    </div>
                  );
                }

                const visible = message.parts.filter(
                  (part) =>
                    (part.type === "text" && part.text.trim()) ||
                    isToolUIPart(part)
                );
                if (!visible.length) return null;

                return (
                  <div key={message.id} className="flex justify-start">
                    <div className="max-w-[90%] space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm leading-6 text-slate-800">
                      {visible.map((part, index) => {
                        if (part.type === "text") {
                          return (
                            <div key={`${message.id}-text-${index}`} className="whitespace-pre-wrap">
                              {renderRichText(part.text)}
                            </div>
                          );
                        }
                        return <ToolChip key={`${message.id}-tool-${index}`} part={part} />;
                      })}
                    </div>
                  </div>
                );
              })}

              {busy ? <p className="text-xs text-slate-500">Working…</p> : null}
              {error ? <p className="text-xs text-rose-600">{error.message}</p> : null}

              {!messages.length ? (
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => void sendMessage({ text: item })}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-xs text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <form onSubmit={onSubmit} className="border-t border-slate-200 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submitPrompt();
                    }
                  }}
                  rows={2}
                  placeholder="e.g. Add product Paracetamol 500 mg tablet…"
                  className="min-h-12 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                />
                {busy ? (
                  <Button type="button" variant="outline" onClick={() => stop()} aria-label="Stop">
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={!input.trim()} aria-label="Send">
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {messages.length ? (
                <button
                  type="button"
                  className="mt-2 text-xs text-slate-500 hover:text-teal-700"
                  onClick={() => setMessages([])}
                >
                  Clear chat
                </button>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
